import { getPool, initDB } from '../db.js';
import { addPoints, spendPoints } from '../rewards/[...path].js';

export const config = { api: { bodyParser: false } }; // raw body for webhook

async function buffer(readable) {
  const chunks = [];
  for await (const chunk of readable) chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  try { await initDB(); } catch {}

  const segments = (req.query.path || []).filter(Boolean);

  // ── POST /api/stripe/webhook ──
  if (req.method === 'POST' && segments[0] === 'webhook') {
    const Stripe = (await import('stripe')).default;
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const sig = req.headers['stripe-signature'];
    const buf = await buffer(req);

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

      // Deduct points now that payment succeeded
      if (pts > 0) {
        try {
          await spendPoints(userId, pts, 'deal_redeem', `Deal purchase: ${dealId}`, redemptionId);
        } catch (e) {
          console.error('[stripe] Points deduction failed:', e.message);
        }
      }

      // Mark redemption as paid
      await getPool().query(
        `UPDATE deal_redemptions SET status = 'paid', stripe_payment_intent = $2, updated_at = NOW()
         WHERE id = $1`,
        [redemptionId, session.payment_intent || '']
      );

      // Decrement spots
      await getPool().query(
        `UPDATE deals SET spots_left = GREATEST(0, spots_left - 1), updated_at = NOW()
         WHERE id = $1 AND spots_left > 0`,
        [dealId]
      );

      // Award loyalty points: 2.7× the amount paid
      const amountCHF = (session.amount_total || 0) / 100;
      const earnedPts = Math.round(amountCHF * 2.7 * 100);
      if (earnedPts > 0) {
        await addPoints(userId, earnedPts, 'purchase', `Purchase: ${dealId}`, redemptionId);
      }

      console.log(`[stripe] ✓ Redemption ${redemptionId} paid — ${pts}pts spent, ${earnedPts}pts earned`);
    }

    return res.json({ received: true });
  }

  return res.status(404).json({ error: 'Not found' });
}
