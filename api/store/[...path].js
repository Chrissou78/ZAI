import { randomUUID } from 'crypto';
import { getPool, initDB, requireAdmin, isAdmin } from '../db.js';
import { pointsForAmount, chfForPoints, categoryEarnsPoints, pointsToCoverCHF, TIERS, VOUCHER_VALID_YEARS, tierForPoints } from '../points.js';
import { authenticate } from '../middleware.js';

// ══════════════════════════════════════════════════════════
// TIERS — the table lives in api/points.js (single source of truth,
// shared with the vouchers logic). These shims keep the existing
// rewards-balance response shape working against the new 5-tier scheme.
// Note there is now no tier below the first threshold, so tierFor() can
// return null and callers must handle it.
// ══════════════════════════════════════════════════════════
function tierFor(points) {
  return tierForPoints(points);
}

/** Upper bound of a tier = one below the next tier's floor, or null. */
function tierCeiling(tier) {
  if (!tier) return TIERS[0] ? TIERS[0].min - 1 : null;
  const idx = TIERS.findIndex(t => t.key === tier.key);
  return idx >= 0 && idx < TIERS.length - 1 ? TIERS[idx + 1].min - 1 : null;
}

function nextTier(current) {
  if (!current) return TIERS[0] || null;
  const idx = TIERS.findIndex(t => t.key === current.key);
  return idx >= 0 && idx < TIERS.length - 1 ? TIERS[idx + 1] : null;
}

// ══════════════════════════════════════════════════════════
// POINTS HELPERS (also used by products route via import)
// ══════════════════════════════════════════════════════════
export async function getBalance(userId) {
  const r = await getPool().query(
    'SELECT COALESCE(SUM(amount), 0)::int AS balance FROM points_ledger WHERE user_id = $1',
    [userId]
  );
  return r.rows[0].balance;
}

export async function addPoints(userId, amount, type, description, relatedId) {
  const id = randomUUID();
  await getPool().query(
    `INSERT INTO points_ledger (id, user_id, amount, type, description, related_id)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [id, userId, amount, type, description || '', relatedId || '']
  );
  return id;
}

export async function spendPoints(userId, amount, type, description, relatedId) {
  const bal = await getBalance(userId);
  if (bal < amount) throw new Error('INSUFFICIENT_POINTS');
  return addPoints(userId, -amount, type, description, relatedId);
}

// Kept as a named export because api/products imports it. Delegates to the
// shared economics module so the earn rate lives in exactly one place.
export function pointsFromCHF(priceCHF) {
  return pointsForAmount(priceCHF);
}

export async function logPurchase(userId, { source, itemId, itemTitle, itemImage, category, amountCHF, pointsUsed, pointsEarned }) {
  const id = randomUUID();
  await getPool().query(
    `INSERT INTO purchase_history (id, user_id, source, item_id, item_title, item_image, category, amount_chf, points_used, points_earned)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [id, userId, source, itemId, itemTitle || '', itemImage || '', category || '',
     amountCHF || 0, pointsUsed || 0, pointsEarned || 0]
  );
  return id;
}

// ══════════════════════════════════════════════════════════
// RAW BODY HELPER (for Stripe webhook)
// ══════════════════════════════════════════════════════════
async function rawBuffer(readable) {
  const chunks = [];
  for await (const chunk of readable) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

// ══════════════════════════════════════════════════════════
// SUB-HANDLERS
// ══════════════════════════════════════════════════════════

// ── REWARDS ─────────────────────────────────────────────
async function handleRewards(req, res, segments, method, userId) {

  // GET /api/store/rewards/balance
  if (method === 'GET' && segments[0] === 'balance') {
    const balance = await getBalance(userId);
    const tier = tierFor(balance);
    const next = nextTier(tier);
    // `tier` is null below the first threshold — there is no entry tier in
    // the new scheme, so callers get nulls rather than a fabricated "Blue".
    return res.json({
      success: true,
      data: {
        balance,
        tier: tier ? tier.name : null,
        tierKey: tier ? tier.key : null,
        tierFloor: tier ? tier.min : null,
        tierCeiling: tierCeiling(tier),
        voucherCHF: tier ? tier.voucherCHF : null,
        nextTier: next ? next.name : null,
        nextTierFloor: next ? next.min : null,
        pointsToNext: next ? Math.max(0, next.min - balance) : 0,
      },
    });
  }

  // GET /api/store/rewards/history?page=1&limit=20
  if (method === 'GET' && segments[0] === 'history') {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;

    const [rows, countRes] = await Promise.all([
      getPool().query(
        `SELECT id, amount, type, description, related_id, created_at
         FROM points_ledger WHERE user_id = $1
         ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
        [userId, limit, offset]
      ),
      getPool().query(
        'SELECT COUNT(*)::int AS total FROM points_ledger WHERE user_id = $1',
        [userId]
      ),
    ]);

    return res.json({
      success: true,
      data: rows.rows,
      total: countRes.rows[0].total,
      page,
      limit,
    });
  }

  // GET /api/store/rewards/tiers
  if (method === 'GET' && segments[0] === 'tiers') {
    return res.json({
      success: true,
      data: TIERS.map(t => ({
        key: t.key,
        name: t.name,
        floor: t.min,
        ceiling: tierCeiling(t),
        voucherCHF: t.voucherCHF,
      })),
    });
  }

  return res.status(404).json({ error: 'Not found' });
}

// ── DEALS ───────────────────────────────────────────────
// ── Shared deal-redemption fulfillment ──────────────────
// Called from two places: the Stripe webhook (payment_intent.succeeded /
// checkout.session.completed) AND a client-triggered confirm endpoint below.
// The client-triggered path exists because webhook delivery is not
// guaranteed to reach every deployment (misconfigured/unregistered webhook,
// signing-secret mismatch, network issues) — without it a customer can pay
// successfully in the Stripe UI and never actually receive their points
// deduction or their product, which is exactly the "paid but nothing
// happened" bug this was written to close. Both callers are guarded by the
// same idempotency check, so whichever one runs first "wins" and the other
// becomes a no-op.
async function fulfillDealRedemption({ redemptionId, dealId, userId, pointsUsed, amountCHF, stripePaymentIntentId }) {
  const already = await getPool().query(
    `SELECT status FROM deal_redemptions WHERE id = $1`, [redemptionId]
  );
  if (!already.rows.length) {
    return { ok: false, reason: 'not_found' };
  }
  if (already.rows[0].status === 'paid') {
    return { ok: true, alreadyProcessed: true };
  }

  const pts = parseInt(pointsUsed) || 0;

  // Deduct points used as discount
  if (pts > 0) {
    try {
      await spendPoints(userId, pts, 'deal_redeem', `Deal purchase: ${dealId}`, redemptionId);
    } catch (e) {
      console.error('[deal-fulfill] Points deduction failed:', e.message);
    }
  }

  // Update redemption status
  await getPool().query(
    `UPDATE deal_redemptions SET status = 'paid', stripe_payment_intent = $2, updated_at = NOW()
    WHERE id = $1`,
    [redemptionId, stripePaymentIntentId || null]
  );

  // Decrement spots
  await getPool().query(
    `UPDATE deals SET spots_left = GREATEST(0, spots_left - 1), updated_at = NOW()
    WHERE id = $1 AND spots_total > 0`,
    [dealId]
  );

  // The deal row is loaded BEFORE awarding points because the award now
  // depends on its category: only physical zai goods earn. Events,
  // services and anything not on the allowlist earn nothing.
  const dealRes = await getPool().query(
    'SELECT title, contract_address, image_url, category FROM deals WHERE id = $1', [dealId]
  );
  const deal = dealRes.rows[0];

  // Award loyalty points — 1 point per unit of currency spent, physical only.
  let earnedPts = 0;
  if (categoryEarnsPoints(deal?.category)) {
    earnedPts = pointsForAmount(amountCHF);
    if (earnedPts > 0) {
      await addPoints(userId, earnedPts, 'purchase', `Deal purchase: ${dealId}`, redemptionId);
    }
  } else {
    console.log(`[deal-fulfill] No points awarded for deal ${dealId} — category "${deal?.category || 'unknown'}" is not point-earning`);
  }

  try {
    await logPurchase(userId, {
      source: 'deal', itemId: dealId, itemTitle: deal?.title, itemImage: deal?.image_url,
      category: deal?.category, amountCHF: amountCHF, pointsUsed: pts, pointsEarned: earnedPts,
    });
  } catch (logErr) {
    console.error('[deal-fulfill] Failed to log purchase history (non-fatal):', logErr.message);
  }

  // ── Auto-mint NFT for the deal (non-fatal if it fails) ──
  let minted = false;
  try {
    if (deal?.contract_address) {
      const userRes = await getPool().query(
        'SELECT wallet FROM user_profiles WHERE user_id = $1', [userId]
      );
      const wallet = userRes.rows[0]?.wallet;

      if (wallet) {
        const RWA_BASE = 'https://rwa.onchainlabs.ch/v1/api';
        const apiKey = process.env.WALLETTWO_API_KEY;

        const rwaListRes = await fetch(`${RWA_BASE}/rwa?limit=200`, {
          headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
        });
        const rwaList = await rwaListRes.json();
        const rwas = Array.isArray(rwaList) ? rwaList : (rwaList.rwas || rwaList.data || rwaList.result || []);
        const rwa = rwas.find(r =>
          (r.smartContractAddress || '').toLowerCase() === deal.contract_address.toLowerCase()
        );

        if (rwa) {
          const mintRes = await fetch(`${RWA_BASE}/rwa/${rwa.id}/mint`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
            body: JSON.stringify({ wallet, address: wallet }),
          });
          const mintData = await mintRes.json();
          const mintOk = mintRes.ok && mintData?.success !== false;

          try {
            await getPool().query(
              `INSERT INTO mint_attempts (id, source, user_id, rwa_id, product_name, requested_wallet, http_status, ok, error_detail, nft_snapshot, created_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())`,
              [randomUUID(), 'deal-fulfill', userId, rwa.id, deal.title || '', wallet,
               mintRes.status, mintOk, mintOk ? null : (mintData?.message || mintData?.error || 'Unknown error'),
               mintData?.nft ? JSON.stringify(mintData.nft) : null]
            );
          } catch (logErr) {
            console.error('[MINT-DEBUG] Failed to log mint attempt:', logErr.message);
          }

          if (mintOk) {
            try {
              await getPool().query(
                `INSERT INTO product_claims (id, user_id, product_id, claimed_at)
                VALUES ($1, $2, $3, NOW())
                ON CONFLICT (user_id, product_id) DO NOTHING`,
                [randomUUID(), userId, rwa.id]
              );
              console.log(`[deal-fulfill] ✓ NFT minted for deal ${dealId} → ${wallet} (RWA: ${rwa.id})`);
              minted = true; // only set once the claim record is actually persisted
            } catch (claimWriteErr) {
              console.error('[deal-fulfill] Mint succeeded but product_claims write failed:', claimWriteErr.message);
            }
          } else {
            console.error('[deal-fulfill] NFT mint failed:', mintData?.message || mintData?.error || 'Unknown error');
          }
        } else {
          console.error(`[deal-fulfill] No RWA found for contract ${deal.contract_address}`);
        }
      } else {
        console.error(`[deal-fulfill] No wallet found for user ${userId}`);
      }
    }
  } catch (mintErr) {
    console.error('[deal-fulfill] NFT mint error (non-fatal):', mintErr.message);
  }

  console.log(`[deal-fulfill] ✓ Redemption ${redemptionId} paid — ${pts}pts spent, ${earnedPts}pts earned, CHF ${amountCHF}`);

  return { ok: true, alreadyProcessed: false, pointsDeducted: pts, pointsEarned: earnedPts, minted };
}

// ── TIER EVENT VOUCHERS ───────────────────────────────────
// One voucher per member per tier, unlocked by reaching that tier's point
// threshold. Codes are minted on claim rather than up front, so unclaimed
// tiers hold no dormant codes. The UNIQUE(user_id, tier_key) constraint —
// not an application-level check — is what makes claiming idempotent under
// concurrent requests.
const VOUCHER_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I/O/0/1

function makeVoucherCode(tierKey, amountCHF) {
  let block = '';
  for (let i = 0; i < 4; i++) {
    block += VOUCHER_CODE_ALPHABET[Math.floor(Math.random() * VOUCHER_CODE_ALPHABET.length)];
  }
  return `ZAI-${tierKey.slice(0, 3).toUpperCase()}${amountCHF}-${block}`;
}

async function handleVouchers(req, res, segments, method, userId) {
  // GET /api/store/vouchers
  if (method === 'GET' && segments.length === 0) {
    const balance = await getBalance(userId);
    const rows = (await getPool().query(
      'SELECT tier_key, amount_chf, code, expires_at, redeemed_at FROM tier_vouchers WHERE user_id = $1',
      [userId]
    )).rows;
    const byTier = Object.fromEntries(rows.map(r => [r.tier_key, r]));
    const current = tierForPoints(balance);

    return res.json({
      success: true,
      data: {
        balance,
        currentTier: current ? current.key : null,
        tiers: TIERS.map(t => {
          const claimed = byTier[t.key];
          return {
            key: t.key,
            name: t.name,
            minPoints: t.min,
            amountCHF: t.voucherCHF,
            unlocked: balance >= t.min,
            claimed: !!claimed,
            code: claimed ? claimed.code : null,
            expiresAt: claimed ? claimed.expires_at : null,
            redeemedAt: claimed ? claimed.redeemed_at : null,
          };
        }),
      },
    });
  }

  // POST /api/store/vouchers/validate  { code }
  // Read-only check used by checkout UIs before taking payment. It never
  // marks the voucher as used — redemption happens only once a payment is
  // actually confirmed, so an abandoned checkout can't burn a voucher.
  if (method === 'POST' && segments.length === 1 && segments[0] === 'validate') {
    const raw = (req.body && req.body.code) || '';
    const code = String(raw).trim().toUpperCase();
    if (!code) return res.status(400).json({ success: false, error: 'Voucher code is required' });

    // Scoped to this user: a valid code belonging to someone else must look
    // exactly like a code that does not exist, or the endpoint becomes an
    // oracle for guessing other members' vouchers.
    const v = (await getPool().query(
      `SELECT tier_key, amount_chf, expires_at, redeemed_at
         FROM tier_vouchers WHERE user_id = $1 AND code = $2`,
      [userId, code]
    )).rows[0];

    if (!v) return res.status(404).json({ success: false, error: 'Voucher code not found' });
    if (v.redeemed_at) {
      return res.status(409).json({ success: false, error: 'Voucher has already been used', redeemedAt: v.redeemed_at });
    }
    if (v.expires_at && new Date(v.expires_at) < new Date()) {
      return res.status(410).json({ success: false, error: 'Voucher has expired', expiresAt: v.expires_at });
    }

    return res.json({
      success: true,
      data: { code, tierKey: v.tier_key, amountCHF: Number(v.amount_chf), expiresAt: v.expires_at },
    });
  }

  // POST /api/store/vouchers/:tierKey/claim
  if (method === 'POST' && segments.length === 2 && segments[1] === 'claim') {
    const tierKey = segments[0];
    const tier = TIERS.find(t => t.key === tierKey);
    if (!tier) return res.status(404).json({ error: 'Unknown tier' });

    const balance = await getBalance(userId);
    if (balance < tier.min) {
      return res.status(403).json({
        error: 'Tier not reached',
        required: tier.min,
        balance,
      });
    }

    const expires = new Date();
    expires.setFullYear(expires.getFullYear() + VOUCHER_VALID_YEARS);

    // Let the UNIQUE(user_id, tier_key) constraint arbitrate rather than
    // pre-checking, so two simultaneous claims can't both succeed.
    try {
      const code = makeVoucherCode(tier.key, tier.voucherCHF);
      const r = await getPool().query(
        `INSERT INTO tier_vouchers (id, user_id, tier_key, amount_chf, code, expires_at)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING code, expires_at`,
        [randomUUID(), userId, tier.key, tier.voucherCHF, code, expires.toISOString()]
      );
      return res.json({
        success: true,
        data: { tierKey: tier.key, amountCHF: tier.voucherCHF, code: r.rows[0].code, expiresAt: r.rows[0].expires_at },
      });
    } catch (e) {
      if (e && e.code === '23505') { // unique_violation
        const existing = (await getPool().query(
          'SELECT code, expires_at FROM tier_vouchers WHERE user_id = $1 AND tier_key = $2',
          [userId, tier.key]
        )).rows[0];
        // Idempotent: hand back the code they already hold.
        return res.json({
          success: true,
          alreadyClaimed: true,
          data: { tierKey: tier.key, amountCHF: tier.voucherCHF, code: existing?.code || null, expiresAt: existing?.expires_at || null },
        });
      }
      throw e;
    }
  }

  return res.status(404).json({ error: 'Not found' });
}

// Points may cover a deal's full price, so the redeemable cap is derived from
// the price at read time rather than trusted from max_points_discount. Keeping
// the stored column authoritative was what made points look broken: values
// like 1,000 (CHF 10) sat against a CHF 1,950 ski. Points-only items are left
// alone — they are priced in points already.
function withDerivedPointsCap(rows) {
  return rows.map(d => d.points_only
    ? d
    : { ...d, max_points_discount: pointsToCoverCHF(d.price_chf) });
}

async function handleDeals(req, res, segments, method, userId, decoded) {

  // GET /api/store/deals
  if (method === 'GET' && segments.length === 0) {
    const adminUser = await isAdmin(decoded).catch(() => false);

    if (adminUser) {
      const r = await getPool().query(
        `SELECT id, title, description, category, price_chf, max_points_discount,
                image_url, ends_at, spots_total, spots_left, members_only, featured, active,
                points_only, points_price,
                created_at,
                CASE
                  WHEN active = false THEN 'archived'
                  WHEN ends_at IS NOT NULL AND ends_at < NOW() THEN 'expired'
                  WHEN spots_total > 0 AND spots_left <= 0 THEN 'sold_out'
                  ELSE 'active'
                END AS deal_status
         FROM deals
         ORDER BY
           CASE WHEN active = true AND (ends_at IS NULL OR ends_at > NOW()) THEN 0 ELSE 1 END,
           featured DESC, created_at DESC`
      );
      return res.json({ success: true, data: withDerivedPointsCap(r.rows) });
    } else {
      const r = await getPool().query(
        `SELECT id, title, description, category, price_chf, max_points_discount,
                image_url, ends_at, spots_total, spots_left, members_only, featured,
                points_only, points_price
         FROM deals
         WHERE active = true
           AND (ends_at IS NULL OR ends_at > NOW())
           AND (spots_total = 0 OR spots_left > 0)
         ORDER BY featured DESC, created_at DESC`
      );
      // Flag what this member has already redeemed so the catalogue can show
      // it as claimed instead of offering it again.
      const mine = await getPool().query(
        `SELECT DISTINCT deal_id FROM deal_redemptions WHERE user_id = $1 AND status = 'paid'`,
        [userId]
      );
      const redeemed = new Set(mine.rows.map(x => x.deal_id));
      return res.json({
        success: true,
        data: withDerivedPointsCap(r.rows).map(d => ({ ...d, alreadyRedeemed: redeemed.has(d.id) })),
      });
    }
  }

  // GET /api/store/deals/:id
  if (method === 'GET' && segments.length === 1 && segments[0] !== 'admin') {
    const r = await getPool().query(
      'SELECT * FROM deals WHERE id = $1 AND active = true', [segments[0]]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Deal not found' });
    return res.json({ success: true, data: withDerivedPointsCap(r.rows)[0] });
  }

  // POST /api/store/deals/:id/redeem
  if (method === 'POST' && segments.length === 2 && segments[1] === 'redeem') {
    const dealId = segments[0];
    const { pointsToUse = 0 } = req.body || {};

    const dr = await getPool().query(
      'SELECT * FROM deals WHERE id = $1 AND active = true', [dealId]
    );
    if (!dr.rows.length) return res.status(404).json({ error: 'Deal not found' });
    const deal = dr.rows[0];

    if (deal.spots_total > 0 && deal.spots_left <= 0)
      return res.status(400).json({ error: 'Sold out' });
    if (deal.ends_at && new Date(deal.ends_at) < new Date())
      return res.status(400).json({ error: 'Deal has expired' });

    // Points may cover the entire price, so the cap is derived from the price
    // rather than read from max_points_discount — those stored values had
    // drifted badly (CHF 10 off a CHF 1,950 ski) and would silently re-cap
    // members here even though the UI offered more.
    const maxPts = pointsToCoverCHF(deal.price_chf);
    const pts = Math.max(0, Math.min(parseInt(pointsToUse) || 0, maxPts));
    // 1 point = CHF 0.01 (see api/points.js).
    const discountCHF = chfForPoints(pts);
    const finalCHF = Math.max(0, parseFloat(deal.price_chf) - discountCHF);

    const bal = await getBalance(userId);
    if (pts > bal) return res.status(400).json({ error: 'Insufficient points' });

    const redemptionId = randomUUID();

    // ── Fully covered by points: settle without Stripe ──
    // Points may now cover 100% of a price, which leaves nothing to charge.
    // Stripe rejects a zero-amount PaymentIntent, so routing this through the
    // card flow would hard-fail on exactly the most attractive path. Settle it
    // here instead and reuse the shared fulfilment helper, so a points-only
    // settlement deducts points, marks the redemption paid, decrements spots,
    // logs history and mints identically to a paid one — and stays idempotent.
    if (finalCHF <= 0) {
      await getPool().query(
        `INSERT INTO deal_redemptions (id, deal_id, user_id, points_used, amount_chf, stripe_session_id, status)
         VALUES ($1, $2, $3, $4, 0, '', 'pending')`,
        [redemptionId, dealId, userId, pts]
      );

      const result = await fulfillDealRedemption({
        redemptionId, dealId, userId, pointsUsed: pts,
        amountCHF: 0, stripePaymentIntentId: null,
      });

      if (!result.ok) {
        return res.status(500).json({ error: 'Could not complete points redemption', detail: result.reason });
      }

      return res.json({
        success: true,
        data: {
          clientSecret: null,
          redemptionId,
          amount: 0,
          pointsUsed: pts,
          fullyCoveredByPoints: true,
          balance: await getBalance(userId),
        },
      });
    }

    const Stripe = (await import('stripe')).default;
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const PLATFORM_FEE_PERCENT = parseFloat(process.env.PLATFORM_FEE_PERCENT || '5');

    // ── Create a PaymentIntent (embedded payment, no redirect) ──
    const piConfig = {
      amount: Math.round(finalCHF * 100),
      currency: 'chf',
      automatic_payment_methods: { enabled: true },
      metadata: { redemptionId, dealId, userId, pointsUsed: String(pts) },
    };

    // Only add platform fee + connected account if configured
    if (process.env.STRIPE_CONNECTED_ACCOUNT_ID && finalCHF > 0) {
      piConfig.application_fee_amount = Math.round(finalCHF * 100 * PLATFORM_FEE_PERCENT / 100);
      piConfig.transfer_data = {
        destination: process.env.STRIPE_CONNECTED_ACCOUNT_ID,
      };
    }

    const paymentIntent = await stripe.paymentIntents.create(piConfig);

    await getPool().query(
      `INSERT INTO deal_redemptions (id, deal_id, user_id, points_used, amount_chf, stripe_session_id, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending')`,
      [redemptionId, dealId, userId, pts, finalCHF, paymentIntent.id]
    );

    return res.json({
      success: true,
      data: {
        clientSecret: paymentIntent.client_secret,
        redemptionId,
        amount: finalCHF,
      },
    });
  }

  // POST /api/store/deals/redemptions/:id/confirm
  // Client-triggered fallback fulfillment. The Stripe Elements flow already
  // confirms the payment succeeded client-side; this endpoint double-checks
  // that with Stripe directly (using the secret key, so it can't be spoofed
  // from the browser) and then runs the same points/mint fulfillment the
  // webhook would run. This is what makes purchases work correctly even if
  // the Stripe webhook isn't reachable/registered for this deployment.
  if (method === 'POST' && segments[0] === 'redemptions' && segments.length === 3 && segments[2] === 'confirm') {
    const redemptionId = segments[1];

    const rr = await getPool().query(
      'SELECT * FROM deal_redemptions WHERE id = $1', [redemptionId]
    );
    if (!rr.rows.length) return res.status(404).json({ error: 'Redemption not found' });
    const redemption = rr.rows[0];

    if (redemption.user_id !== userId) {
      return res.status(403).json({ error: 'Not your redemption' });
    }

    if (redemption.status === 'paid') {
      const balance = await getBalance(userId);
      return res.json({ success: true, data: { alreadyProcessed: true, balance } });
    }

    const Stripe = (await import('stripe')).default;
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

    let pi;
    try {
      pi = await stripe.paymentIntents.retrieve(redemption.stripe_session_id);
    } catch (e) {
      return res.status(502).json({ error: 'Could not verify payment with Stripe' });
    }

    if (pi.status !== 'succeeded') {
      return res.status(400).json({ error: `Payment not completed yet (status: ${pi.status})` });
    }

    const result = await fulfillDealRedemption({
      redemptionId,
      dealId: redemption.deal_id,
      userId,
      pointsUsed: redemption.points_used,
      amountCHF: parseFloat(redemption.amount_chf) || (pi.amount || 0) / 100,
      stripePaymentIntentId: pi.id,
    });

    if (!result.ok) {
      return res.status(404).json({ error: 'Redemption not found' });
    }

    const balance = await getBalance(userId);
    return res.json({
      success: true,
      data: {
        alreadyProcessed: !!result.alreadyProcessed,
        pointsDeducted: result.pointsDeducted || 0,
        pointsEarned: result.pointsEarned || 0,
        minted: !!result.minted,
        balance,
      },
    });
  }

  // ── ADMIN CRUD ──

  // POST /api/store/deals/:id/redeem-points
  // Points-only redemption. Deliberately shares nothing with the Stripe
  // path: there is no PaymentIntent, no redemption-confirm round trip and
  // no money, so the whole thing settles in one request. spendPoints()
  // throws INSUFFICIENT_POINTS, which is caught below and surfaced as a
  // 400 rather than a 500.
  if (method === 'POST' && segments.length === 2 && segments[1] === 'redeem-points') {
    const dealId = segments[0];
    const dRes = await getPool().query('SELECT * FROM deals WHERE id = $1 AND active = true', [dealId]);
    const deal = dRes.rows[0];
    if (!deal) return res.status(404).json({ error: 'Deal not found' });
    if (!deal.points_only) {
      return res.status(400).json({ error: 'This item is not a points-only redemption' });
    }
    if (deal.ends_at && new Date(deal.ends_at) < new Date()) {
      return res.status(400).json({ error: 'Deal has expired' });
    }
    if (deal.spots_total > 0 && deal.spots_left <= 0) {
      return res.status(400).json({ error: 'Sold out' });
    }

    const cost = parseInt(deal.points_price) || 0;
    if (cost <= 0) return res.status(400).json({ error: 'Item has no points price set' });

    // One per member. Without this a points reward could be redeemed
    // repeatedly — the seeded items have spots_total 0, so the spots
    // decrement is a no-op and nothing else stopped a second claim. It also
    // reappeared as available after a re-login because the catalogue never
    // consulted the member's own redemption history.
    const prior = await getPool().query(
      `SELECT 1 FROM deal_redemptions
        WHERE user_id = $1 AND deal_id = $2 AND status = 'paid' LIMIT 1`,
      [userId, dealId]
    );
    if (prior.rows.length) {
      return res.status(409).json({ error: 'You have already redeemed this reward', alreadyRedeemed: true });
    }

    const balance = await getBalance(userId);
    if (balance < cost) {
      return res.status(400).json({
        error: 'Not enough points',
        required: cost,
        balance,
        shortfall: cost - balance,
      });
    }

    const redemptionId = randomUUID();
    try {
      await spendPoints(userId, cost, 'redeem', `Points redemption: ${deal.title}`, redemptionId);
    } catch (e) {
      if (String(e.message) === 'INSUFFICIENT_POINTS') {
        return res.status(400).json({ error: 'Not enough points', required: cost, balance });
      }
      throw e;
    }

    await getPool().query(
      `INSERT INTO deal_redemptions (id, deal_id, user_id, points_used, amount_chf, stripe_session_id, status)
       VALUES ($1,$2,$3,$4,0,'',$5)`,
      [redemptionId, dealId, userId, cost, 'paid']
    );
    await getPool().query(
      `UPDATE deals SET spots_left = GREATEST(0, spots_left - 1), updated_at = NOW()
       WHERE id = $1 AND spots_total > 0`, [dealId]
    );

    try {
      // pointsEarned is 0 by design: spending points does not earn points.
      await logPurchase(userId, {
        source: 'points_redemption', itemId: dealId, itemTitle: deal.title,
        itemImage: deal.image_url, category: deal.category,
        amountCHF: 0, pointsUsed: cost, pointsEarned: 0,
      });
    } catch (logErr) {
      console.error('[points-redeem] purchase history log failed (non-fatal):', logErr.message);
    }

    return res.json({
      success: true,
      data: { redemptionId, pointsSpent: cost, balance: await getBalance(userId) },
    });
  }

  // POST /api/store/deals/admin
  if (method === 'POST' && segments[0] === 'admin' && segments.length === 1) {
    await requireAdmin(decoded);
    const { title, description, category, price_chf, max_points_discount,
            image_url, ends_at, spots_total, members_only, featured, contract_address,
            points_only, points_price } = req.body;
    const id = randomUUID();
    const spotsVal = parseInt(spots_total) || 0;
    // A points-only item has no money path: force price_chf to 0 and ignore
    // any money-discount cap, so it can never accidentally be charged for.
    const isPointsOnly = points_only === true;
    const ptsPrice = isPointsOnly ? Math.max(0, parseInt(points_price) || 0) : 0;
    await getPool().query(
      `INSERT INTO deals (id, title, description, category, price_chf, max_points_discount,
                          image_url, ends_at, spots_total, spots_left, members_only, featured, contract_address,
                          points_only, points_price)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
      [id, title, description || '', category || 'accessories',
       isPointsOnly ? 0 : price_chf, isPointsOnly ? 0 : (max_points_discount || 0), image_url || '',
       ends_at || null, spotsVal, spotsVal,
       members_only !== false, featured === true, contract_address || '',
       isPointsOnly, ptsPrice]
    );
    return res.json({ success: true, data: { id } });
  }

  // PUT /api/store/deals/admin/:id
  if (method === 'PUT' && segments[0] === 'admin' && segments.length === 2) {
    await requireAdmin(decoded);
    const b = req.body;

    const fields = [];
    const values = [segments[1]];
    let idx = 2;

    const set = (col, val) => {
      if (val !== undefined) {
        fields.push(`${col} = $${idx}`);
        values.push(val);
        idx++;
      }
    };

    set('title', b.title);
    set('description', b.description);
    set('category', b.category);
    set('price_chf', b.price_chf);
    set('max_points_discount', b.max_points_discount);
    set('points_only', b.points_only);
    set('points_price', b.points_price);
    set('image_url', b.image_url);
    set('spots_total', b.spots_total);
    set('spots_left', b.spots_left);
    set('members_only', b.members_only);
    set('featured', b.featured);
    set('active', b.active);
    set('contract_address', b.contract_address);

    if (b.ends_at !== undefined) {
      fields.push(`ends_at = $${idx}`);
      values.push(b.ends_at);
      idx++;
    }

    if (fields.length === 0) return res.json({ success: true });

    fields.push('updated_at = NOW()');
    await getPool().query(
      `UPDATE deals SET ${fields.join(', ')} WHERE id = $1`,
      values
    );
    return res.json({ success: true });
  }

  // DELETE /api/store/deals/admin/:id (soft-delete = archive)
  if (method === 'DELETE' && segments[0] === 'admin' && segments.length === 2) {
    await requireAdmin(decoded);
    await getPool().query(
      'UPDATE deals SET active = false, updated_at = NOW() WHERE id = $1', [segments[1]]
    );
    return res.json({ success: true });
  }

  return res.status(404).json({ error: 'Not found' });
}

// ── PURCHASE HISTORY ────────────────────────────────────
async function handlePurchases(req, res, segments, method, userId) {

  // GET /api/store/purchases?page=1&limit=20
  if (method === 'GET' && segments.length === 0) {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;

    const [rows, countRes] = await Promise.all([
      getPool().query(
        `SELECT id, source, item_id, item_title, item_image, category,
                amount_chf, points_used, points_earned, created_at
         FROM purchase_history WHERE user_id = $1
         ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
        [userId, limit, offset]
      ),
      getPool().query(
        'SELECT COUNT(*)::int AS total FROM purchase_history WHERE user_id = $1',
        [userId]
      ),
    ]);

    return res.json({
      success: true,
      data: rows.rows,
      total: countRes.rows[0].total,
      page,
      limit,
    });
  }

  return res.status(404).json({ error: 'Not found' });
}

// ── COLLECTIBLES ────────────────────────────────────────
async function handleCollectibles(req, res, segments, method, userId) {

  // GET /api/store/collectibles/series
  if (method === 'GET' && segments[0] === 'series') {
    const seriesRes = await getPool().query(
      'SELECT * FROM collectible_series WHERE active = true ORDER BY created_at DESC'
    );

    const result = [];
    for (const series of seriesRes.rows) {
      const cardsRes = await getPool().query(
        `SELECT c.*,
                EXISTS(SELECT 1 FROM collectible_claims cc WHERE cc.card_id = c.id AND cc.user_id = $2) AS claimed
         FROM collectible_cards c
         WHERE c.series_id = $1 AND c.active = true
         ORDER BY c.card_number ASC`,
        [series.id, userId]
      );

      const cards = [];
      for (const card of cardsRes.rows) {
        let locked = false;
        let lock_reason = null;

        if (card.requires_product_contract) {
          const owns = await getPool().query(
            'SELECT 1 FROM product_claims WHERE user_id = $1 AND product_id = $2 LIMIT 1',
            [userId, card.requires_product_contract]
          );
          if (!owns.rows.length) {
            locked = true;
            lock_reason = card.requires_product_name
              ? `Requires ${card.requires_product_name}` : 'Requires product ownership';
          }
        }
        if (card.requires_event_id) {
          const attended = await getPool().query(
            'SELECT 1 FROM event_registrations WHERE user_id = $1 AND event_id = $2 LIMIT 1',
            [userId, card.requires_event_id]
          );
          if (!attended.rows.length) {
            locked = true;
            lock_reason = 'Requires event participation';
          }
        }
        if (card.available_from && new Date(card.available_from) > new Date()) {
          locked = true;
          lock_reason = 'Not yet released';
        }

        cards.push({
          id: card.id, cardNumber: card.card_number, name: card.name,
          rarity: card.rarity, pointsReward: card.points_reward,
          imageUrl: card.image_url, editionClosed: card.edition_closed,
          availableFrom: card.available_from, claimed: card.claimed,
          locked, lockReason: lock_reason,
        });
      }

      result.push({
        id: series.id, name: series.name, season: series.season,
        totalCards: series.total_cards, description: series.description,
        claimedCount: cards.filter(c => c.claimed).length, cards,
      });
    }

    return res.json({ success: true, data: result });
  }

  // POST /api/store/collectibles/:cardId/claim
  if (method === 'POST' && segments.length === 2 && segments[1] === 'claim') {
    const cardId = segments[0];

    const cr = await getPool().query(
      'SELECT * FROM collectible_cards WHERE id = $1 AND active = true', [cardId]
    );
    if (!cr.rows.length) return res.status(404).json({ error: 'Card not found' });
    const card = cr.rows[0];

    if (card.edition_closed) return res.status(400).json({ error: 'Edition closed' });
    if (card.available_from && new Date(card.available_from) > new Date())
      return res.status(400).json({ error: 'Not yet available' });

    if (card.requires_product_contract) {
      const owns = await getPool().query(
        'SELECT 1 FROM product_claims WHERE user_id = $1 AND product_id = $2 LIMIT 1',
        [userId, card.requires_product_contract]
      );
      if (!owns.rows.length) return res.status(403).json({ error: 'Product ownership required' });
    }
    if (card.requires_event_id) {
      const attended = await getPool().query(
        'SELECT 1 FROM event_registrations WHERE user_id = $1 AND event_id = $2 LIMIT 1',
        [userId, card.requires_event_id]
      );
      if (!attended.rows.length) return res.status(403).json({ error: 'Event participation required' });
    }

    const existing = await getPool().query(
      'SELECT 1 FROM collectible_claims WHERE card_id = $1 AND user_id = $2', [cardId, userId]
    );
    if (existing.rows.length) return res.status(400).json({ error: 'Already claimed' });

    // Digital collectibles no longer award points — only physical zai goods
    // do (see EARNING_CATEGORIES in api/points.js). The card's points_reward
    // column and admin field are left intact so existing data and the admin
    // UI keep working, but nothing is credited to the member's balance and
    // the claim is recorded as earning zero.
    const claimId = randomUUID();
    await getPool().query(
      `INSERT INTO collectible_claims (id, card_id, user_id, points_earned)
       VALUES ($1, $2, $3, $4)`,
      [claimId, cardId, userId, 0]
    );

    try {
      await logPurchase(userId, {
        source: 'collectible', itemId: cardId, itemTitle: card.name, itemImage: card.image_url,
        category: card.rarity, amountCHF: 0, pointsUsed: 0, pointsEarned: 0,
      });
    } catch (logErr) {
      console.error('[collectible-claim] Failed to log purchase history (non-fatal):', logErr.message);
    }

    return res.json({
      success: true,
      data: { claimId, pointsEarned: 0 },
    });
  }

  return res.status(404).json({ error: 'Not found' });
}

// ── MEDIA ───────────────────────────────────────────────
async function handleMedia(req, res, segments, method, decoded) {

  // GET /api/store/media
  if (method === 'GET' && segments.length === 0) {
    const r = await getPool().query(
      `SELECT id, title, media_type, category, description, media_url,
              thumbnail_url, duration, exclusive, published_at, featured
       FROM media_stories
       WHERE active = true AND published_at <= NOW()
       ORDER BY featured DESC, published_at DESC`
    );
    return res.json({ success: true, data: r.rows });
  }

  // GET /api/store/media/:id
  if (method === 'GET' && segments.length === 1 && segments[0] !== 'admin') {
    const r = await getPool().query(
      'SELECT * FROM media_stories WHERE id = $1 AND active = true', [segments[0]]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
    return res.json({ success: true, data: r.rows[0] });
  }

  // POST /api/store/media/admin
  if (method === 'POST' && segments[0] === 'admin' && segments.length === 1) {
    await requireAdmin(decoded);
    const { title, media_type, category, description, media_url,
            thumbnail_url, duration, exclusive, published_at, featured } = req.body;
    const id = randomUUID();
    await getPool().query(
      `INSERT INTO media_stories (id, title, media_type, category, description, media_url,
                                  thumbnail_url, duration, exclusive, published_at, featured)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [id, title, media_type || 'article', category || 'editorial',
       description || '', media_url || '', thumbnail_url || '',
       duration || '', exclusive !== false, published_at || new Date().toISOString(),
       featured === true]
    );
    return res.json({ success: true, data: { id } });
  }

  // PUT /api/store/media/admin/:id
  if (method === 'PUT' && segments[0] === 'admin' && segments.length === 2) {
    await requireAdmin(decoded);
    const { title, media_type, category, description, media_url,
            thumbnail_url, duration, exclusive, published_at, featured, active } = req.body;
    await getPool().query(
      `UPDATE media_stories SET
         title = COALESCE($2, title), media_type = COALESCE($3, media_type),
         category = COALESCE($4, category), description = COALESCE($5, description),
         media_url = COALESCE($6, media_url), thumbnail_url = COALESCE($7, thumbnail_url),
         duration = COALESCE($8, duration), exclusive = COALESCE($9, exclusive),
         published_at = COALESCE($10, published_at), featured = COALESCE($11, featured),
         active = COALESCE($12, active)
       WHERE id = $1`,
      [segments[1], title, media_type, category, description, media_url,
       thumbnail_url, duration, exclusive, published_at, featured, active]
    );
    return res.json({ success: true });
  }

  // DELETE /api/store/media/admin/:id
  if (method === 'DELETE' && segments[0] === 'admin' && segments.length === 2) {
    await requireAdmin(decoded);
    await getPool().query('UPDATE media_stories SET active = false WHERE id = $1', [segments[1]]);
    return res.json({ success: true });
  }

  return res.status(404).json({ error: 'Not found' });
}

// ── STRIPE WEBHOOK ──────────────────────────────────────
async function handleStripe(req, res, segments) {

  // POST /api/store/stripe/webhook
  if (req.method === 'POST' && segments[0] === 'webhook') {
    const Stripe = (await import('stripe')).default;
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const sig = req.headers['stripe-signature'];
    const buf = await rawBuffer(req);

    let event;
    try {
      event = stripe.webhooks.constructEvent(buf, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
      console.error('[stripe] Webhook sig failed:', err.message);
      return res.status(400).json({ error: 'Invalid signature' });
    }

    // Fulfillment can genuinely throw — spendPoints() raises
    // INSUFFICIENT_POINTS, and every DB write here can fail. handleStripe is
    // invoked BEFORE the outer try/catch in the main handler, so any throw
    // used to escape as an unhandled rejection: the function crashed with no
    // context logged, Stripe saw a 5xx, and retried a blind failure. Catch it
    // here so the cause is always logged. We still answer non-2xx so Stripe
    // retries (fulfillDealRedemption is idempotent — guarded on
    // status === 'paid' — so a retry is safe, and a genuinely stuck
    // paid-but-unfulfilled order SHOULD keep alerting rather than be silently
    // swallowed with a 200).
    try {
    // ── Handle PaymentIntent succeeded (embedded payment flow) ──
    // Fulfillment logic lives in the shared fulfillDealRedemption() helper —
    // the exact same function the client-triggered /redemptions/:id/confirm
    // endpoint calls, so this webhook and that fallback path can never
    // disagree or double-process (both are guarded by the same idempotency
    // check inside the helper).
    if (event.type === 'payment_intent.succeeded') {
      const pi = event.data.object;
      const { redemptionId, dealId, userId, pointsUsed } = pi.metadata || {};
      if (!redemptionId) return res.json({ received: true });

      await fulfillDealRedemption({
        redemptionId,
        dealId,
        userId,
        pointsUsed,
        amountCHF: (pi.amount || 0) / 100,
        stripePaymentIntentId: pi.id,
      });
    }

    // ── Keep backward compat for any existing Checkout Sessions ──
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const { redemptionId, dealId, userId, pointsUsed } = session.metadata || {};
      if (!redemptionId) return res.json({ received: true });

      await fulfillDealRedemption({
        redemptionId,
        dealId,
        userId,
        pointsUsed,
        amountCHF: (session.amount_total || 0) / 100,
        stripePaymentIntentId: session.payment_intent || null,
      });
    }

    return res.json({ received: true });
    } catch (fulfillErr) {
      console.error(
        `[stripe] Fulfillment failed for event ${event.id} (${event.type}):`,
        fulfillErr && fulfillErr.stack ? fulfillErr.stack : fulfillErr
      );
      return res.status(500).json({
        error: 'Fulfillment failed',
        eventId: event.id,
        detail: fulfillErr && fulfillErr.message ? fulfillErr.message : String(fulfillErr),
      });
    }
  }

  return res.status(404).json({ error: 'Not found' });
}

// ══════════════════════════════════════════════════════════
// MAIN ROUTER
// ══════════════════════════════════════════════════════════
export const config = {
  api: { bodyParser: false },
};

export default async function handler(req, res) {
  // ── CORS preflight ──
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(200).end();
  }

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  try { await initDB(); } catch (e) {
    console.error('[store] DB init failed:', e.message);
    return res.status(500).json({ error: 'DB init failed', detail: e.message });
  }

  // ── Parse path from req.url ──
  const fullPath = req.url.split('?')[0].replace(/^\/api\/store\/?/, '').replace(/\/$/, '');
  const allSegments = fullPath.split('/').filter(Boolean);
  const domain = allSegments[0];
  const segments = allSegments.slice(1);
  const method = req.method;

  // Parse JSON body for non-Stripe routes
  if (domain !== 'stripe' && !req.body && method !== 'GET') {
    try {
      const buf = await rawBuffer(req);
      req.body = JSON.parse(buf.toString());
    } catch {
      req.body = {};
    }
  }

  // Stripe webhook doesn't need auth
  if (domain === 'stripe') {
    return handleStripe(req, res, segments);
  }

  // Everything else requires auth
  let decoded;
  try {
    decoded = authenticate(req);
  } catch (e) {
    console.error('[store] authenticate threw:', e.message);
    return res.status(401).json({ error: 'Auth failed', detail: e.message });
  }
  if (!decoded) return res.status(401).json({ error: 'Unauthorized' });
  const userId = decoded.userId || decoded.sub;

  try {
    switch (domain) {
      case 'rewards':      return await handleRewards(req, res, segments, method, userId);
      case 'deals':        return await handleDeals(req, res, segments, method, userId, decoded);
      case 'collectibles': return await handleCollectibles(req, res, segments, method, userId);
      case 'purchases':    return await handlePurchases(req, res, segments, method, userId);
      case 'media':        return await handleMedia(req, res, segments, method, decoded);
      case 'referrals':    return await handleReferrals(req, res, segments, method, userId, decoded);
      case 'vouchers':     return await handleVouchers(req, res, segments, method, userId);
      default:             return res.status(404).json({ error: 'Not found', path: fullPath });
    }
  } catch (err) {
    console.error(`[store] ${domain} error:`, err);
    return res.status(500).json({ error: err.message || 'Internal error' });
  }
}

// ── REFERRALS ───────────────────────────────────────────
const REFERRER_BONUS = 200;
const REFERRED_BONUS = 100;

function generateReferralCode(name) {
  const clean = (name || 'ZAI')
    .replace(/[^a-zA-Z]/g, '')
    .toUpperCase()
    .slice(0, 8) || 'ZAI';
  const num = Math.floor(1000 + Math.random() * 9000);
  return `ZAI-${clean}-${num}`;
}

async function handleReferrals(req, res, segments, method, userId, decoded) {

  // GET /api/store/referrals/code
  if (method === 'GET' && segments[0] === 'code') {
    let r = await getPool().query(
      'SELECT code FROM referral_codes WHERE user_id = $1', [userId]
    );

    if (!r.rows.length) {
      const userRes = await getPool().query(
        'SELECT given_name, family_name, name FROM user_profiles WHERE user_id = $1',
        [userId]
      );
      const u = userRes.rows[0] || {};
      const name = u.given_name || u.name || '';

      let code;
      let attempts = 0;
      while (attempts < 5) {
        code = generateReferralCode(name);
        try {
          await getPool().query(
            'INSERT INTO referral_codes (user_id, code) VALUES ($1, $2)',
            [userId, code]
          );
          break;
        } catch (e) {
          if (e.code === '23505') { attempts++; continue; }
          throw e;
        }
      }

      r = await getPool().query(
        'SELECT code FROM referral_codes WHERE user_id = $1', [userId]
      );
    }

    return res.json({ success: true, data: { code: r.rows[0]?.code || '' } });
  }

  // GET /api/store/referrals/stats
  if (method === 'GET' && segments[0] === 'stats') {
    const [codeRes, statsRes] = await Promise.all([
      getPool().query('SELECT code FROM referral_codes WHERE user_id = $1', [userId]),
      getPool().query(
        `SELECT
           COUNT(*)::int AS total_referrals,
           COUNT(*) FILTER (WHERE status = 'completed')::int AS completed_referrals,
           COALESCE(SUM(referrer_points) FILTER (WHERE status = 'completed'), 0)::int AS bonus_points
         FROM referrals WHERE referrer_id = $1`,
        [userId]
      ),
    ]);

    const stats = statsRes.rows[0];
    const valueCHF = (stats.bonus_points / 100).toFixed(0);

    return res.json({
      success: true,
      data: {
        code: codeRes.rows[0]?.code || '',
        referralsSent: stats.total_referrals,
        completedReferrals: stats.completed_referrals,
        bonusPoints: stats.bonus_points,
        valueUnlockedCHF: valueCHF,
      },
    });
  }

  // POST /api/store/referrals/apply
  if (method === 'POST' && segments[0] === 'apply') {
    const { code } = req.body || {};
    if (!code) return res.status(400).json({ error: 'Code required' });

    const codeRes = await getPool().query(
      'SELECT user_id FROM referral_codes WHERE code = $1', [code.toUpperCase().trim()]
    );
    if (!codeRes.rows.length) return res.status(404).json({ error: 'Invalid referral code' });

    const referrerId = codeRes.rows[0].user_id;

    if (referrerId === userId) return res.status(400).json({ error: 'Cannot use your own code' });

    const existing = await getPool().query(
      'SELECT 1 FROM referrals WHERE referred_id = $1', [userId]
    );
    if (existing.rows.length) return res.status(400).json({ error: 'Already used a referral code' });

    const id = randomUUID();
    await getPool().query(
      `INSERT INTO referrals (id, referrer_id, referred_id, referrer_points, referred_points, status)
       VALUES ($1, $2, $3, $4, $5, 'pending')`,
      [id, referrerId, userId, REFERRER_BONUS, REFERRED_BONUS]
    );

    return res.json({ success: true, data: { referralId: id } });
  }

  return res.status(404).json({ error: 'Not found' });
}