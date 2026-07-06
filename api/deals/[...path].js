import { randomUUID } from 'crypto';
import { getPool, initDB, requireAdmin } from '../db.js';
import { verifyToken } from '../middleware.js';

export default async function handler(req, res) {
  try { await initDB(); } catch {}

  const decoded = verifyToken(req);
  if (!decoded) return res.status(401).json({ error: 'Unauthorized' });

  const userId = decoded.userId || decoded.sub;
  const segments = (req.query.path || []).filter(Boolean);
  const method = req.method;

  // ── GET /api/deals ── list active deals
  if (method === 'GET' && segments.length === 0) {
    const r = await getPool().query(
      `SELECT id, title, description, category, price_chf, max_points_discount,
              image_url, ends_at, spots_total, spots_left, members_only, featured
       FROM deals
       WHERE active = true
       ORDER BY featured DESC, created_at DESC`
    );
    return res.json({ success: true, data: r.rows });
  }

  // ── GET /api/deals/:id
  if (method === 'GET' && segments.length === 1 && segments[0] !== 'admin') {
    const r = await getPool().query('SELECT * FROM deals WHERE id = $1 AND active = true', [segments[0]]);
    if (!r.rows.length) return res.status(404).json({ error: 'Deal not found' });
    return res.json({ success: true, data: r.rows[0] });
  }

  // ── POST /api/deals/:id/redeem ── apply points + create Stripe checkout
  if (method === 'POST' && segments.length === 2 && segments[1] === 'redeem') {
    const dealId = segments[0];
    const { pointsToUse = 0 } = req.body || {};

    const dr = await getPool().query('SELECT * FROM deals WHERE id = $1 AND active = true', [dealId]);
    if (!dr.rows.length) return res.status(404).json({ error: 'Deal not found' });
    const deal = dr.rows[0];

    if (deal.spots_left !== null && deal.spots_left <= 0) {
      return res.status(400).json({ error: 'No spots remaining' });
    }
    if (deal.ends_at && new Date(deal.ends_at) < new Date()) {
      return res.status(400).json({ error: 'Deal has ended' });
    }

    // Validate points
    const pts = Math.max(0, Math.min(parseInt(pointsToUse) || 0, deal.max_points_discount));
    const discountCHF = pts / 100; // 1 pt = CHF 0.01
    const finalCHF = Math.max(0, parseFloat(deal.price_chf) - discountCHF);

    // Import spendPoints lazily to avoid circular
    const { getBalance } = await import('../rewards/[...path].js');
    const bal = await getBalance(userId);
    if (pts > bal) return res.status(400).json({ error: 'Insufficient points' });

    // Create Stripe checkout
    const Stripe = (await import('stripe')).default;
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

    const redemptionId = randomUUID();
    const PLATFORM_FEE_PERCENT = parseFloat(process.env.PLATFORM_FEE_PERCENT || '5'); // e.g. 5%

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

    // Reserve the redemption
    await getPool().query(
      `INSERT INTO deal_redemptions (id, deal_id, user_id, points_used, amount_chf, stripe_session_id, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending')`,
      [redemptionId, dealId, userId, pts, finalCHF, session.id]
    );

    return res.json({ success: true, data: { checkoutUrl: session.url, redemptionId } });
  }

  // ══════════════════════════════════════════════════════════
  // ADMIN CRUD
  // ══════════════════════════════════════════════════════════

  // ── POST /api/deals/admin ── create deal
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

  // ── PUT /api/deals/admin/:id ── update deal
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

  // ── DELETE /api/deals/admin/:id ── soft-delete
  if (method === 'DELETE' && segments[0] === 'admin' && segments.length === 2) {
    await requireAdmin(decoded);
    await getPool().query('UPDATE deals SET active = false, updated_at = NOW() WHERE id = $1', [segments[1]]);
    return res.json({ success: true });
  }

  return res.status(404).json({ error: 'Not found' });
}
