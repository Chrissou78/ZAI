import jwt from 'jsonwebtoken';

let dbModule = null;
async function getDB() {
  if (!dbModule) {
    try { dbModule = await import('../db.js'); } catch (e) { console.error('DB import failed:', e.message); }
  }
  return dbModule;
}

function authenticate(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return null;
  try {
    return jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET || 'fallback-secret');
  } catch { return null; }
}

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

// ── Fallback sample events when DB is unavailable ──
function getSampleEvents() {
  const now = Date.now();
  return [
    { id: 'sample-1', title: 'Zai Ski Demo Day — Zermatt', tag: 'demo day', location: 'Zermatt, Switzerland', date: new Date(now + 14 * 86400000).toISOString(), description: 'Experience the latest zai ski collection on the slopes of Zermatt.', imageUrl: null, tier: 'all', maxAttendees: 50, attendeeCount: 0, status: 'upcoming', registered: false },
    { id: 'sample-2', title: 'Factory Tour — Disentis Atelier', tag: 'factory visit', location: 'Disentis, Switzerland', date: new Date(now + 30 * 86400000).toISOString(), description: 'A rare look inside the zai atelier.', imageUrl: null, tier: 'gold', maxAttendees: 12, attendeeCount: 0, status: 'upcoming', registered: false },
    { id: 'sample-3', title: 'Community Meetup — Laax', tag: 'community', location: 'Laax, Switzerland', date: new Date(now + 60 * 86400000).toISOString(), description: 'Casual gathering of zai community members.', imageUrl: null, tier: 'all', maxAttendees: 0, attendeeCount: 0, status: 'upcoming', registered: false },
  ];
}

export default async function handler(req, res) {
  const rawPath = req.url.split('?')[0];
  const path = rawPath.replace(/^\/api\/events\/?/, '').replace(/\/$/, '');

  // Try DB — don't crash if unavailable
  const db = await getDB();
  let pool = null;
  let dbReady = false;
  if (db) {
    try {
      await db.initDB();
      pool = db.getPool();
      dbReady = true;
    } catch (err) {
      console.error('Events: DB init failed (non-fatal):', err.message);
    }
  }

  // ─── GET /api/events ───
  if ((!path || path === '') && req.method === 'GET') {
    const decoded = authenticate(req);

    // If DB is not available, return sample events so the page doesn't crash
    if (!dbReady) {
      const { status } = req.query || {};
      let events = getSampleEvents();
      if (status === 'past') events = [];
      return res.json({
        success: true,
        data: events,
        pagination: { limit: 50, offset: 0, total: events.length, hasMore: false },
        _dbOffline: true,
      });
    }

    try {
      const { status, type, limit = 50, offset = 0 } = req.query;
      const now = new Date().toISOString();
      const l = Math.min(parseInt(limit) || 50, 100);
      const o = parseInt(offset) || 0;

      let query = 'SELECT * FROM events';
      let countQuery = 'SELECT COUNT(*)::int AS total FROM events';
      const conditions = [];
      const params = [];
      let paramIdx = 1;

      if (status === 'upcoming') { conditions.push(`date >= $${paramIdx++}`); params.push(now); }
      else if (status === 'past') { conditions.push(`date < $${paramIdx++}`); params.push(now); }

      if (type && type !== 'all') { conditions.push(`LOWER(tag) LIKE $${paramIdx++}`); params.push(`%${type.toLowerCase()}%`); }

      if (conditions.length > 0) {
        const where = ' WHERE ' + conditions.join(' AND ');
        query += where;
        countQuery += where;
      }

      query += ' ORDER BY date ' + (status === 'past' ? 'DESC' : 'ASC');
      query += ` LIMIT $${paramIdx++} OFFSET $${paramIdx++}`;
      params.push(l, o);

      const countParams = params.slice(0, params.length - 2);
      const [result, countResult] = await Promise.all([
        pool.query(query, params),
        pool.query(countQuery, countParams),
      ]);

      let userRegistrations = new Set();
      if (decoded) {
        const regs = await pool.query('SELECT event_id FROM event_registrations WHERE user_id = $1', [decoded.userId]);
        userRegistrations = new Set(regs.rows.map(r => r.event_id));
      }

      const eventIds = result.rows.map(r => r.id);
      let regCounts = {};
      if (eventIds.length > 0) {
        const countRes = await pool.query(
          `SELECT event_id, COUNT(*)::int AS count FROM event_registrations WHERE event_id = ANY($1) GROUP BY event_id`,
          [eventIds]
        );
        for (const row of countRes.rows) regCounts[row.event_id] = row.count;
      }

      const events = result.rows.map(e => ({
        id: e.id, title: e.title, tag: e.tag, location: e.location, date: e.date,
        description: e.description, imageUrl: e.image_url, tier: e.tier,
        maxAttendees: e.max_attendees, attendeeCount: regCounts[e.id] || 0,
        status: new Date(e.date) >= new Date() ? 'upcoming' : 'past',
        registered: userRegistrations.has(e.id),
      }));

      return res.json({ success: true, data: events, pagination: { limit: l, offset: o, total: countResult.rows[0].total, hasMore: o + l < countResult.rows[0].total } });
    } catch (err) {
      console.error('Events list error:', err);
      // Fallback on query error too
      return res.json({ success: true, data: getSampleEvents(), pagination: { limit: 50, offset: 0, total: 3, hasMore: false }, _dbOffline: true });
    }
  }

  // ─── POST /api/events ───
  if ((!path || path === '') && req.method === 'POST') {
    const decoded = authenticate(req);
    if (!decoded) return res.status(401).json({ error: 'No token provided' });
    if (!dbReady) return res.status(503).json({ success: false, error: 'Database unavailable' });
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const { title, tag, location, date, description, imageUrl, tier, maxAttendees } = body;
      if (!title || !date) return res.status(400).json({ success: false, error: 'Title and date are required' });
      const id = genId();
      await pool.query(
        `INSERT INTO events (id, title, tag, location, date, description, image_url, tier, max_attendees) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [id, title, tag || 'community', location || '', date, description || '', imageUrl || null, tier || 'all', maxAttendees || 0]
      );
      return res.json({ success: true, data: { id, title, tag: tag || 'community', location: location || '', date, description: description || '', imageUrl: imageUrl || null, tier: tier || 'all', maxAttendees: maxAttendees || 0, attendeeCount: 0, status: 'upcoming', registered: false } });
    } catch (err) { return res.status(500).json({ success: false, error: err.message }); }
  }

  // ─── GET /api/events/:eventId ───
  const eventMatch = path.match(/^([^/]+)$/);
  if (eventMatch && req.method === 'GET' && eventMatch[1] !== 'seed') {
    if (!dbReady) return res.status(503).json({ success: false, error: 'Database unavailable' });
    const decoded = authenticate(req);
    try {
      const result = await pool.query('SELECT * FROM events WHERE id = $1', [eventMatch[1]]);
      if (!result.rows[0]) return res.status(404).json({ success: false, error: 'Event not found' });
      const e = result.rows[0];
      const regCount = await pool.query('SELECT COUNT(*)::int AS count FROM event_registrations WHERE event_id = $1', [e.id]);
      let registered = false;
      if (decoded) {
        const userReg = await pool.query('SELECT id FROM event_registrations WHERE event_id = $1 AND user_id = $2', [e.id, decoded.userId]);
        registered = userReg.rows.length > 0;
      }
      return res.json({ success: true, data: { id: e.id, title: e.title, tag: e.tag, location: e.location, date: e.date, description: e.description, imageUrl: e.image_url, tier: e.tier, maxAttendees: e.max_attendees, attendeeCount: regCount.rows[0].count, status: new Date(e.date) >= new Date() ? 'upcoming' : 'past', registered } });
    } catch (err) { return res.status(500).json({ success: false, error: err.message }); }
  }

  // ─── POST /api/events/:eventId/register ───
  const registerMatch = path.match(/^([^/]+)\/register$/);
  if (registerMatch && req.method === 'POST') {
    const decoded = authenticate(req);
    if (!decoded) return res.status(401).json({ error: 'No token provided' });
    if (!dbReady) return res.status(503).json({ success: false, error: 'Database unavailable' });
    try {
      const eventId = registerMatch[1];
      const event = await pool.query('SELECT * FROM events WHERE id = $1', [eventId]);
      if (!event.rows[0]) return res.status(404).json({ success: false, error: 'Event not found' });
      const existing = await pool.query('SELECT id FROM event_registrations WHERE event_id = $1 AND user_id = $2', [eventId, decoded.userId]);
      if (existing.rows.length > 0) return res.json({ success: true, message: 'Already registered' });
      if (event.rows[0].max_attendees > 0) {
        const count = await pool.query('SELECT COUNT(*)::int AS count FROM event_registrations WHERE event_id = $1', [eventId]);
        if (count.rows[0].count >= event.rows[0].max_attendees) return res.status(400).json({ success: false, error: 'Event is full' });
      }
      const id = genId();
      await pool.query('INSERT INTO event_registrations (id, event_id, user_id) VALUES ($1, $2, $3)', [id, eventId, decoded.userId]);
      return res.json({ success: true, message: 'Successfully registered' });
    } catch (err) { return res.status(500).json({ success: false, error: err.message }); }
  }

  // ─── DELETE /api/events/:eventId/register ───
  if (registerMatch && req.method === 'DELETE') {
    const decoded = authenticate(req);
    if (!decoded) return res.status(401).json({ error: 'No token provided' });
    if (!dbReady) return res.status(503).json({ success: false, error: 'Database unavailable' });
    try {
      await pool.query('DELETE FROM event_registrations WHERE event_id = $1 AND user_id = $2', [registerMatch[1], decoded.userId]);
      return res.json({ success: true, message: 'Registration cancelled' });
    } catch (err) { return res.status(500).json({ success: false, error: err.message }); }
  }

  // ─── POST /api/events/seed ───
  if (path === 'seed' && req.method === 'POST') {
    const decoded = authenticate(req);
    if (!decoded) return res.status(401).json({ error: 'No token provided' });
    if (!dbReady) return res.status(503).json({ success: false, error: 'Database unavailable' });
    try {
      const sampleEvents = [
        { id: genId(), title: 'Zai Ski Demo Day — Zermatt', tag: 'demo day', location: 'Zermatt, Switzerland', date: new Date(Date.now() + 14 * 86400000).toISOString(), description: 'Experience the latest zai ski collection on the slopes of Zermatt.', tier: 'all', max_attendees: 50 },
        { id: genId(), title: 'Factory Tour — Disentis Atelier', tag: 'factory visit', location: 'Disentis, Switzerland', date: new Date(Date.now() + 30 * 86400000).toISOString(), description: 'A rare look inside the zai atelier.', tier: 'gold', max_attendees: 12 },
        { id: genId(), title: 'Partner Evening — The Chedi Andermatt', tag: 'partner event', location: 'Andermatt, Switzerland', date: new Date(Date.now() + 45 * 86400000).toISOString(), description: 'An evening of fine dining and networking.', tier: 'silver', max_attendees: 30 },
        { id: genId(), title: 'Community Meetup — Laax', tag: 'community', location: 'Laax, Switzerland', date: new Date(Date.now() + 60 * 86400000).toISOString(), description: 'Casual gathering of zai community members.', tier: 'all', max_attendees: 0 },
      ];
      for (const e of sampleEvents) {
        await pool.query(`INSERT INTO events (id, title, tag, location, date, description, tier, max_attendees) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (id) DO NOTHING`, [e.id, e.title, e.tag, e.location, e.date, e.description, e.tier, e.max_attendees]);
      }
      return res.json({ success: true, message: `Seeded ${sampleEvents.length} events` });
    } catch (err) { return res.status(500).json({ success: false, error: err.message }); }
  }

  return res.status(404).json({ error: 'Route not found' });
}
