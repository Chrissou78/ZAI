import { randomUUID } from 'crypto';
import { getPool, initDB, requireAdmin } from '../db.js';
import { verifyToken } from '../middleware.js';

export default async function handler(req, res) {
  try { await initDB(); } catch {}

  const decoded = verifyToken(req);
  if (!decoded) return res.status(401).json({ error: 'Unauthorized' });

  const segments = (req.query.path || []).filter(Boolean);
  const method = req.method;

  // ── GET /api/media ── list published stories
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

  // ── GET /api/media/:id
  if (method === 'GET' && segments.length === 1 && segments[0] !== 'admin') {
    const r = await getPool().query(
      'SELECT * FROM media_stories WHERE id = $1 AND active = true',
      [segments[0]]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
    return res.json({ success: true, data: r.rows[0] });
  }

  // ══════════════════════════════════════════════════════════
  // ADMIN CRUD
  // ══════════════════════════════════════════════════════════

  // ── POST /api/media/admin ── create story
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

  // ── PUT /api/media/admin/:id
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

  // ── DELETE /api/media/admin/:id
  if (method === 'DELETE' && segments[0] === 'admin' && segments.length === 2) {
    await requireAdmin(decoded);
    await getPool().query('UPDATE media_stories SET active = false WHERE id = $1', [segments[1]]);
    return res.json({ success: true });
  }

  return res.status(404).json({ error: 'Not found' });
}
