import { randomUUID } from 'crypto';
import { getPool, initDB, requireAdmin } from '../db.js';
import { authenticate } from '../middleware.js';

// ══════════════════════════════════════════════════════════
// TIER DEFINITIONS
// ══════════════════════════════════════════════════════════
const TIERS = [
  { name: 'Blue',    floor: 0,     ceiling: 14999 },
  { name: 'Red',     floor: 15000, ceiling: 29999 },
  { name: 'Black',   floor: 30000, ceiling: 49999 },
  { name: 'Diamond', floor: 50000, ceiling: Infinity },
];

function tierFor(points) {
  return TIERS.find(t => points >= t.floor && points <= t.ceiling) || TIERS[0];
}

function nextTier(current) {
  const idx = TIERS.findIndex(t => t.name === current.name);
  return idx < TIERS.length - 1 ? TIERS[idx + 1] : null;
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

export function pointsFromCHF(priceCHF) {
  return Math.round(parseFloat(priceCHF || 0) * 2.7);
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
    return res.json({
      success: true,
      data: {
        balance,
        tier: tier.name,
        tierFloor: tier.floor,
        tierCeiling: tier.ceiling === Infinity ? null : tier.ceiling,
        nextTier: next ? next.name : null,
        nextTierFloor: next ? next.floor : null,
        pointsToNext: next ? next.floor - balance : 0,
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
        name: t.name,
        floor: t.floor,
        ceiling: t.ceiling === Infinity ? null : t.ceiling,
      })),
    });
  }

  return res.status(404).json({ error: 'Not found' });
}

// ── DEALS ───────────────────────────────────────────────
async function handleDeals(req, res, segments, method, userId, decoded) {

  // GET /api/store/deals
  if (method === 'GET' && segments.length === 0) {
    const r = await getPool().query(
      `SELECT id, title, description, category, price_chf, max_points_discount,
              image_url, ends_at, spots_total, spots_left, members_only, featured
       FROM deals WHERE active = true
       ORDER BY featured DESC, created_at DESC`
    );
    return res.json({ success: true, data: r.rows });
  }

  // GET /api/store/deals/:id
  if (method === 'GET' && segments.length === 1 && segments[0] !== 'admin') {
    const r = await getPool().query(
      'SELECT * FROM deals WHERE id = $1 AND active = true', [segments[0]]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Deal not found' });
    return res.json({ success: true, data: r.rows[0] });
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

    if (deal.spots_left !== null && deal.spots_left <= 0)
      return res.status(400).json({ error: 'No spots remaining' });
    if (deal.ends_at && new Date(deal.ends_at) < new Date())
      return res.status(400).json({ error: 'Deal has ended' });

    const pts = Math.max(0, Math.min(parseInt(pointsToUse) || 0, deal.max_points_discount));
    const discountCHF = pts / 100;
    const finalCHF = Math.max(0, parseFloat(deal.price_chf) - discountCHF);

    const bal = await getBalance(userId);
    if (pts > bal) return res.status(400).json({ error: 'Insufficient points' });

    const Stripe = (await import('stripe')).default;
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const PLATFORM_FEE_PERCENT = parseFloat(process.env.PLATFORM_FEE_PERCENT || '5');

    const redemptionId = randomUUID();
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: decoded.email || undefined,
      metadata: { redemptionId, dealId, userId, pointsUsed: String(pts) },
      line_items: [{
        price_data: {
          currency: 'chf',
          product_data: {
            name: deal.title,
            description: deal.description || undefined,
            images: deal.image_url?.length ? [deal.image_url] : undefined,
          },
          unit_amount: Math.round(finalCHF * 100),
        },
        quantity: 1,
      }],
      payment_intent_data: {
        application_fee_amount: Math.round(finalCHF * 100 * PLATFORM_FEE_PERCENT / 100),
        transfer_data: {
          destination: process.env.STRIPE_CONNECTED_ACCOUNT_ID,
        },
      },
      success_url: `${process.env.VITE_API_URL}/updates?payment=success&rid=${redemptionId}`,
      cancel_url: `${process.env.VITE_API_URL}/updates?payment=cancelled`,
    });

    await getPool().query(
      `INSERT INTO deal_redemptions (id, deal_id, user_id, points_used, amount_chf, stripe_session_id, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending')`,
      [redemptionId, dealId, userId, pts, finalCHF, session.id]
    );

    return res.json({ success: true, data: { checkoutUrl: session.url, redemptionId } });
  }

  // ── ADMIN CRUD ──

  // POST /api/store/deals/admin
  if (method === 'POST' && segments[0] === 'admin' && segments.length === 1) {
    await requireAdmin(decoded);
    const { title, description, category, price_chf, max_points_discount,
            image_url, ends_at, spots_total, members_only, featured } = req.body;
    const id = randomUUID();
    await getPool().query(
      `INSERT INTO deals (id, title, description, category, price_chf, max_points_discount,
                          image_url, ends_at, spots_total, spots_left, members_only, featured)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$9,$10,$11)`,
      [id, title, description || '', category || 'accessories',
       price_chf, max_points_discount || 0, image_url || '',
       ends_at || null, spots_total || 0, members_only !== false, featured === true]
    );
    return res.json({ success: true, data: { id } });
  }

  // PUT /api/store/deals/admin/:id
  if (method === 'PUT' && segments[0] === 'admin' && segments.length === 2) {
    await requireAdmin(decoded);
    const { title, description, category, price_chf, max_points_discount,
            image_url, ends_at, spots_total, spots_left, members_only, featured, active } = req.body;
    await getPool().query(
      `UPDATE deals SET
         title = COALESCE($2, title), description = COALESCE($3, description),
         category = COALESCE($4, category), price_chf = COALESCE($5, price_chf),
         max_points_discount = COALESCE($6, max_points_discount),
         image_url = COALESCE($7, image_url), ends_at = COALESCE($8, ends_at),
         spots_total = COALESCE($9, spots_total), spots_left = COALESCE($10, spots_left),
         members_only = COALESCE($11, members_only), featured = COALESCE($12, featured),
         active = COALESCE($13, active), updated_at = NOW()
       WHERE id = $1`,
      [segments[1], title, description, category, price_chf, max_points_discount,
       image_url, ends_at, spots_total, spots_left, members_only, featured, active]
    );
    return res.json({ success: true });
  }

  // DELETE /api/store/deals/admin/:id
  if (method === 'DELETE' && segments[0] === 'admin' && segments.length === 2) {
    await requireAdmin(decoded);
    await getPool().query(
      'UPDATE deals SET active = false, updated_at = NOW() WHERE id = $1', [segments[1]]
    );
    return res.json({ success: true });
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

    const claimId = randomUUID();
    await getPool().query(
      `INSERT INTO collectible_claims (id, card_id, user_id, points_earned)
       VALUES ($1, $2, $3, $4)`,
      [claimId, cardId, userId, card.points_reward]
    );

    if (card.points_reward > 0) {
      await addPoints(userId, card.points_reward, 'collectible', `Claimed: ${card.name}`, cardId);
    }

    return res.json({
      success: true,
      data: { claimId, pointsEarned: card.points_reward },
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

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const { redemptionId, dealId, userId, pointsUsed } = session.metadata || {};
      if (!redemptionId) return res.json({ received: true });

      const pts = parseInt(pointsUsed) || 0;

      if (pts > 0) {
        try {
          await spendPoints(userId, pts, 'deal_redeem', `Deal purchase: ${dealId}`, redemptionId);
        } catch (e) {
          console.error('[stripe] Points deduction failed:', e.message);
        }
      }

      await getPool().query(
        `UPDATE deal_redemptions SET status = 'paid', stripe_payment_intent = $2, updated_at = NOW()
         WHERE id = $1`,
        [redemptionId, session.payment_intent || '']
      );

      await getPool().query(
        `UPDATE deals SET spots_left = GREATEST(0, spots_left - 1), updated_at = NOW()
         WHERE id = $1 AND spots_left > 0`,
        [dealId]
      );

      const amountCHF = (session.amount_total || 0) / 100;
      const earnedPts = Math.round(amountCHF * 2.7);
      if (earnedPts > 0) {
        await addPoints(userId, earnedPts, 'purchase', `Purchase: ${dealId}`, redemptionId);
      }

      console.log(`[stripe] ✓ Redemption ${redemptionId} paid — ${pts}pts spent, ${earnedPts}pts earned`);
    }

    return res.json({ received: true });
  }

  return res.status(404).json({ error: 'Not found' });
}

// ══════════════════════════════════════════════════════════
// MAIN ROUTER
// ══════════════════════════════════════════════════════════
export const config = {
  api: { bodyParser: false }, // needed for Stripe webhook raw body
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

  // ── Parse path from req.url (same approach as products handler) ──
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
      case 'media':        return await handleMedia(req, res, segments, method, decoded);
      case 'referrals':    return await handleReferrals(req, res, segments, method, userId, decoded);
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

  // GET /api/store/referrals/code — get or create the user's referral code
  if (method === 'GET' && segments[0] === 'code') {
    let r = await getPool().query(
      'SELECT code FROM referral_codes WHERE user_id = $1', [userId]
    );

    if (!r.rows.length) {
      // Get user name for code generation
      const userRes = await getPool().query(
        'SELECT given_name, family_name, name FROM user_profiles WHERE user_id = $1',
        [userId]
      );
      const u = userRes.rows[0] || {};
      const name = u.given_name || u.name || '';

      // Generate unique code with retry
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
          if (e.code === '23505') { attempts++; continue; } // unique violation, retry
          throw e;
        }
      }

      r = await getPool().query(
        'SELECT code FROM referral_codes WHERE user_id = $1', [userId]
      );
    }

    return res.json({ success: true, data: { code: r.rows[0]?.code || '' } });
  }

  // GET /api/store/referrals/stats — referral stats for current user
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
    const valueCHF = (stats.bonus_points / 100).toFixed(0); // 1pt = CHF 0.01

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

  // POST /api/store/referrals/apply — apply a referral code (called when a new user signs up or claims first product)
  if (method === 'POST' && segments[0] === 'apply') {
    const { code } = req.body || {};
    if (!code) return res.status(400).json({ error: 'Code required' });

    // Find the referrer
    const codeRes = await getPool().query(
      'SELECT user_id FROM referral_codes WHERE code = $1', [code.toUpperCase().trim()]
    );
    if (!codeRes.rows.length) return res.status(404).json({ error: 'Invalid referral code' });

    const referrerId = codeRes.rows[0].user_id;

    // Can't refer yourself
    if (referrerId === userId) return res.status(400).json({ error: 'Cannot use your own code' });

    // Check if already referred
    const existing = await getPool().query(
      'SELECT 1 FROM referrals WHERE referred_id = $1', [userId]
    );
    if (existing.rows.length) return res.status(400).json({ error: 'Already used a referral code' });

    // Create referral (pending — completed when they claim first product)
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
