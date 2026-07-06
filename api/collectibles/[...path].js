import { randomUUID } from 'crypto';
import { getPool, initDB } from '../db.js';
import { verifyToken } from '../middleware.js';
import { addPoints } from '../rewards/[...path].js';

export default async function handler(req, res) {
  try { await initDB(); } catch {}

  const decoded = verifyToken(req);
  if (!decoded) return res.status(401).json({ error: 'Unauthorized' });

  const userId = decoded.userId || decoded.sub;
  const segments = (req.query.path || []).filter(Boolean);
  const method = req.method;

  // ── GET /api/collectibles/series ── list all active series with cards
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

      // Check lock conditions per card
      const cards = [];
      for (const card of cardsRes.rows) {
        let locked = false;
        let lock_reason = null;

        // Lock: requires owning a specific product
        if (card.requires_product_contract) {
          const owns = await getPool().query(
            'SELECT 1 FROM product_claims WHERE user_id = $1 AND product_id = $2 LIMIT 1',
            [userId, card.requires_product_contract]
          );
          if (!owns.rows.length) {
            locked = true;
            lock_reason = card.requires_product_name
              ? `Requires ${card.requires_product_name}`
              : 'Requires product ownership';
          }
        }

        // Lock: requires event attendance
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

        // Lock: not yet available
        if (card.available_from && new Date(card.available_from) > new Date()) {
          locked = true;
          lock_reason = 'Not yet released';
        }

        cards.push({
          id: card.id,
          cardNumber: card.card_number,
          name: card.name,
          rarity: card.rarity,
          pointsReward: card.points_reward,
          imageUrl: card.image_url,
          editionClosed: card.edition_closed,
          availableFrom: card.available_from,
          claimed: card.claimed,
          locked,
          lockReason: lock_reason,
        });
      }

      const claimedCount = cards.filter(c => c.claimed).length;
      result.push({
        id: series.id,
        name: series.name,
        season: series.season,
        totalCards: series.total_cards,
        description: series.description,
        claimedCount,
        cards,
      });
    }

    return res.json({ success: true, data: result });
  }

  // ── POST /api/collectibles/:cardId/claim ──
  if (method === 'POST' && segments.length === 2 && segments[1] === 'claim') {
    const cardId = segments[0];

    const cr = await getPool().query(
      'SELECT * FROM collectible_cards WHERE id = $1 AND active = true',
      [cardId]
    );
    if (!cr.rows.length) return res.status(404).json({ error: 'Card not found' });
    const card = cr.rows[0];

    if (card.edition_closed) {
      return res.status(400).json({ error: 'Edition closed' });
    }
    if (card.available_from && new Date(card.available_from) > new Date()) {
      return res.status(400).json({ error: 'Not yet available' });
    }

    // Check lock conditions
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

    // Check not already claimed
    const existing = await getPool().query(
      'SELECT 1 FROM collectible_claims WHERE card_id = $1 AND user_id = $2',
      [cardId, userId]
    );
    if (existing.rows.length) return res.status(400).json({ error: 'Already claimed' });

    // Claim it
    const claimId = randomUUID();
    await getPool().query(
      `INSERT INTO collectible_claims (id, card_id, user_id, points_earned)
       VALUES ($1, $2, $3, $4)`,
      [claimId, cardId, userId, card.points_reward]
    );

    // Award points
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
