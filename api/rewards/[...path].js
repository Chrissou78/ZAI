import { randomUUID } from 'crypto';
import { getPool, initDB } from '../db.js';
import { verifyToken } from '../middleware.js';

// ── Tier definitions ──
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

// ── Points helpers (exported for use by other routes) ──
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

// ── Points earned from a product claim: 2.7 × CHF price ──
export function pointsFromCHF(priceCHF) {
  return Math.round(parseFloat(priceCHF || 0) * 2.7 * 100);
  // 2.7× the CHF amount, expressed in points where 1pt = CHF 0.01
}

// ── Handler ──
export default async function handler(req, res) {
  try {
    await initDB();
  } catch (e) {
    console.error('[rewards] DB init:', e.message);
  }

  const decoded = verifyToken(req);
  if (!decoded) return res.status(401).json({ error: 'Unauthorized' });

  const userId = decoded.userId || decoded.sub;
  const segments = (req.query.path || []).filter(Boolean);
  const method = req.method;

  // GET /api/rewards/balance
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

  // GET /api/rewards/history?page=1&limit=20
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

  // GET /api/rewards/tiers (public-ish, still needs auth)
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
