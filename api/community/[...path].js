import jwt from 'jsonwebtoken';
import pg from 'pg';

const { Pool } = pg;

const WALLETTWO_API = 'https://api.wallettwo.com/auth/v1/api';
const API_KEY = () => process.env.WALLETTWO_API_KEY;

let pool;
let dbReady = false;

function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL?.includes('localhost')
        ? false
        : { rejectUnauthorized: false },
      max: 5,
    });
  }
  return pool;
}

async function initDB() {
  if (dbReady) return;
  const client = await getPool().connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS photos (
        id TEXT PRIMARY KEY,
        cid TEXT NOT NULL,
        url TEXT NOT NULL,
        caption TEXT DEFAULT '',
        author_id TEXT NOT NULL,
        author_name TEXT DEFAULT 'Member',
        tagged_members TEXT[] DEFAULT '{}',
        comment_count INT DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS photo_comments (
        id TEXT PRIMARY KEY,
        photo_id TEXT NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
        text TEXT NOT NULL,
        author_id TEXT NOT NULL,
        author_name TEXT DEFAULT 'Member',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_photo_comments_photo ON photo_comments(photo_id);
      CREATE TABLE IF NOT EXISTS chat_messages (
        id TEXT PRIMARY KEY,
        text TEXT NOT NULL,
        author_id TEXT NOT NULL,
        author_name TEXT DEFAULT 'Member',
        recipient_id TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_chat_created ON chat_messages(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_chat_dm ON chat_messages(author_id, recipient_id);
    `);
    dbReady = true;
  } finally {
    client.release();
  }
}

function authenticate(req) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return null;
  try {
    return jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret');
  } catch {
    return null;
  }
}

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

export default async function handler(req, res) {
  const fullPath = req.url.split('?')[0].replace('/api/community/', '').replace(/\/$/, '');

  // ─── MEMBERS ───
  if (fullPath === 'members' && req.method === 'GET') {
    try {
      const { limit = 50, offset = 0, search } = req.query;
      const page = Math.floor(parseInt(offset || 0) / parseInt(limit || 50)) + 1;
      const parsedLimit = Math.min(parseInt(limit) || 50, 100);
      const url = `${WALLETTWO_API}/members?limit=${parsedLimit}&page=${page}`;
      const response = await fetch(url, { headers: { 'x-api-key': API_KEY() } });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        return res.status(response.status).json({ success: false, error: err.message || 'Failed to fetch members' });
      }
      const data = await response.json();
      const members = (data.members || []).map(m => {
        const user = m.user || {};
        const displayName = user.isPublic ? (user.name || 'Member') : `Member ${(m.userId || '').slice(0, 6)}`;
        return {
          id: m.userId,
          name: displayName,
          wallet: user.isPublic ? user.wallet : undefined,
          avatar: (user.name?.charAt(0) || 'M').toUpperCase(),
          joinedAt: m.createdAt,
          isPublic: user.isPublic || false,
        };
      });
      const filtered = search
        ? members.filter(m => m.name.toLowerCase().includes(search.toLowerCase()) || (m.wallet && m.wallet.toLowerCase().includes(search.toLowerCase())))
        : members;
      return res.json({
        success: true,
        data: filtered,
        pagination: { limit: parsedLimit, offset: parseInt(offset) || 0, total: data.total || 0, totalPages: data.totalPages || 1, page: data.page || 1, hasMore: (data.page || 1) < (data.totalPages || 1) },
      });
    } catch (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  // GET /api/community/members/:memberId
  const memberMatch = fullPath.match(/^members\/([^/]+)$/);
  if (memberMatch && req.method === 'GET') {
    try {
      const response = await fetch(`${WALLETTWO_API}/members?limit=100`, { headers: { 'x-api-key': API_KEY() } });
      if (!response.ok) return res.status(response.status).json({ success: false, error: 'Failed to fetch member' });
      const data = await response.json();
      const member = (data.members || []).find(m => m.userId === memberMatch[1]);
      if (!member) return res.status(404).json({ success: false, error: 'Member not found' });
      const user = member.user || {};
      return res.json({
        success: true,
        data: {
          id: member.userId,
          name: user.isPublic ? (user.name || 'Member') : `Member ${(member.userId || '').slice(0, 6)}`,
          wallet: user.isPublic ? user.wallet : undefined,
          avatar: (user.name?.charAt(0) || 'M').toUpperCase(),
          joinedAt: member.createdAt,
          isPublic: user.isPublic || false,
        },
      });
    } catch (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  // ─── GALLERY ───

  // GET /api/community/gallery
  if (fullPath === 'gallery' && req.method === 'GET') {
    try {
      await initDB();
      const { limit = 30, offset = 0 } = req.query;
      const l = Math.min(parseInt(limit) || 30, 100);
      const o = parseInt(offset) || 0;
      const result = await getPool().query(
        'SELECT * FROM photos ORDER BY created_at DESC LIMIT $1 OFFSET $2',
        [l, o]
      );
      const countResult = await getPool().query('SELECT COUNT(*)::int AS total FROM photos');
      return res.json({
        success: true,
        data: result.rows.map(r => ({
          id: r.id, cid: r.cid, url: r.url, caption: r.caption,
          authorId: r.author_id, authorName: r.author_name,
          taggedMembers: r.tagged_members || [],
          commentCount: r.comment_count, createdAt: r.created_at,
        })),
        pagination: { limit: l, offset: o, total: countResult.rows[0].total, hasMore: o + l < countResult.rows[0].total },
      });
    } catch (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  // POST /api/community/gallery — upload photo
  if (fullPath === 'gallery' && req.method === 'POST') {
    const user = authenticate(req);
    if (!user) return res.status(401).json({ error: 'No token provided' });
    try {
      await initDB();
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const { image, caption, taggedMembers } = body;
      if (!image) return res.status(400).json({ success: false, error: 'Image is required (base64)' });

      // Upload to Pinata IPFS
      const buffer = Buffer.from(image.replace(/^data:image\/\w+;base64,/, ''), 'base64');
      if (buffer.length > 4 * 1024 * 1024) return res.status(400).json({ success: false, error: 'Image must be under 4 MB' });

      const formData = new FormData();
      const blob = new Blob([buffer], { type: 'image/jpeg' });
      formData.append('file', blob, `photo-${Date.now()}.jpg`);

      const pinataRes = await fetch('https://uploads.pinata.cloud/v3/files', {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.PINATA_JWT}` },
        body: formData,
      });

      if (!pinataRes.ok) {
        const err = await pinataRes.text();
        return res.status(500).json({ success: false, error: 'IPFS upload failed', detail: err });
      }

      const pinataData = await pinataRes.json();
      const cid = pinataData.data?.cid || pinataData.IpfsHash;
      const photoUrl = `https://${process.env.PINATA_GATEWAY}/ipfs/${cid}`;
      const id = genId();
      const authorName = user.name || user.givenName || 'Member';

      await getPool().query(
        'INSERT INTO photos (id, cid, url, caption, author_id, author_name, tagged_members) VALUES ($1,$2,$3,$4,$5,$6,$7)',
        [id, cid, photoUrl, caption || '', user.userId, authorName, taggedMembers || []]
      );

      return res.json({
        success: true,
        data: { id, cid, url: photoUrl, caption: caption || '', authorId: user.userId, authorName, taggedMembers: taggedMembers || [], commentCount: 0, createdAt: new Date().toISOString() },
      });
    } catch (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  // GET /api/community/gallery/:photoId
  const photoMatch = fullPath.match(/^gallery\/([^/]+)$/);
  if (photoMatch && req.method === 'GET') {
    try {
      await initDB();
      const photo = await getPool().query('SELECT * FROM photos WHERE id=$1', [photoMatch[1]]);
      if (!photo.rows[0]) return res.status(404).json({ success: false, error: 'Photo not found' });
      const comments = await getPool().query('SELECT * FROM photo_comments WHERE photo_id=$1 ORDER BY created_at ASC', [photoMatch[1]]);
      const p = photo.rows[0];
      return res.json({
        success: true,
        data: {
          id: p.id, cid: p.cid, url: p.url, caption: p.caption,
          authorId: p.author_id, authorName: p.author_name,
          taggedMembers: p.tagged_members || [], commentCount: p.comment_count, createdAt: p.created_at,
          comments: comments.rows.map(c => ({ id: c.id, text: c.text, authorId: c.author_id, authorName: c.author_name, createdAt: c.created_at })),
        },
      });
    } catch (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  // DELETE /api/community/gallery/:photoId
  if (photoMatch && req.method === 'DELETE') {
    const user = authenticate(req);
    if (!user) return res.status(401).json({ error: 'No token provided' });
    try {
      await initDB();
      const photo = await getPool().query('SELECT author_id FROM photos WHERE id=$1', [photoMatch[1]]);
      if (!photo.rows[0]) return res.status(404).json({ success: false, error: 'Photo not found' });
      if (photo.rows[0].author_id !== user.userId) return res.status(403).json({ success: false, error: 'Not your photo' });
      await getPool().query('DELETE FROM photos WHERE id=$1', [photoMatch[1]]);
      return res.json({ success: true });
    } catch (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  // POST /api/community/gallery/:photoId/comments
  const commentPostMatch = fullPath.match(/^gallery\/([^/]+)\/comments$/);
  if (commentPostMatch && req.method === 'POST') {
    const user = authenticate(req);
    if (!user) return res.status(401).json({ error: 'No token provided' });
    try {
      await initDB();
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      if (!body.text || body.text.length > 1000) return res.status(400).json({ success: false, error: 'Comment text required (max 1000 chars)' });
      const id = genId();
      const authorName = user.name || user.givenName || 'Member';
      await getPool().query('INSERT INTO photo_comments (id, photo_id, text, author_id, author_name) VALUES ($1,$2,$3,$4,$5)', [id, commentPostMatch[1], body.text, user.userId, authorName]);
      await getPool().query('UPDATE photos SET comment_count = comment_count + 1 WHERE id=$1', [commentPostMatch[1]]);
      return res.json({ success: true, data: { id, text: body.text, authorId: user.userId, authorName, createdAt: new Date().toISOString() } });
    } catch (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  // DELETE /api/community/gallery/:photoId/comments/:commentId
  const commentDelMatch = fullPath.match(/^gallery\/([^/]+)\/comments\/([^/]+)$/);
  if (commentDelMatch && req.method === 'DELETE') {
    const user = authenticate(req);
    if (!user) return res.status(401).json({ error: 'No token provided' });
    try {
      await initDB();
      const comment = await getPool().query('SELECT author_id FROM photo_comments WHERE id=$1 AND photo_id=$2', [commentDelMatch[2], commentDelMatch[1]]);
      if (!comment.rows[0]) return res.status(404).json({ success: false, error: 'Comment not found' });
      if (comment.rows[0].author_id !== user.userId) return res.status(403).json({ success: false, error: 'Not your comment' });
      await getPool().query('DELETE FROM photo_comments WHERE id=$1', [commentDelMatch[2]]);
      await getPool().query('UPDATE photos SET comment_count = GREATEST(comment_count - 1, 0) WHERE id=$1', [commentDelMatch[1]]);
      return res.json({ success: true });
    } catch (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  // ─── CHAT ───

  // GET /api/community/chat — general chat or DMs
  if (fullPath === 'chat' && req.method === 'GET') {
    const user = authenticate(req);
    if (!user) return res.status(401).json({ error: 'No token provided' });
    try {
      await initDB();
      const { limit = 50, offset = 0, with: withUser } = req.query;
      const l = Math.min(parseInt(limit) || 50, 100);
      const o = parseInt(offset) || 0;
      let result, countResult;

      if (withUser) {
        // DM between current user and withUser
        result = await getPool().query(
          `SELECT * FROM chat_messages
           WHERE (author_id=$1 AND recipient_id=$2) OR (author_id=$2 AND recipient_id=$1)
           ORDER BY created_at DESC LIMIT $3 OFFSET $4`,
          [user.userId, withUser, l, o]
        );
        countResult = await getPool().query(
          `SELECT COUNT(*)::int AS total FROM chat_messages
           WHERE (author_id=$1 AND recipient_id=$2) OR (author_id=$2 AND recipient_id=$1)`,
          [user.userId, withUser]
        );
      } else {
        // General chat (recipient_id IS NULL)
        result = await getPool().query(
          'SELECT * FROM chat_messages WHERE recipient_id IS NULL ORDER BY created_at DESC LIMIT $1 OFFSET $2',
          [l, o]
        );
        countResult = await getPool().query(
          'SELECT COUNT(*)::int AS total FROM chat_messages WHERE recipient_id IS NULL'
        );
      }
      return res.json({
        success: true,
        data: result.rows.reverse().map(m => ({
          id: m.id, text: m.text, authorId: m.author_id, authorName: m.author_name,
          recipientId: m.recipient_id, createdAt: m.created_at,
        })),
        pagination: { limit: l, offset: o, total: countResult.rows[0].total, hasMore: o + l < countResult.rows[0].total },
      });
    } catch (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  // POST /api/community/chat — send message
  if (fullPath === 'chat' && req.method === 'POST') {
    const user = authenticate(req);
    if (!user) return res.status(401).json({ error: 'No token provided' });
    try {
      await initDB();
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      if (!body.text || body.text.length > 2000) return res.status(400).json({ success: false, error: 'Message text required (max 2000 chars)' });
      const id = genId();
      const authorName = user.name || user.givenName || 'Member';
      const recipientId = body.recipientId || null;
      await getPool().query(
        'INSERT INTO chat_messages (id, text, author_id, author_name, recipient_id) VALUES ($1,$2,$3,$4,$5)',
        [id, body.text, user.userId, authorName, recipientId]
      );
      return res.json({
        success: true,
        data: { id, text: body.text, authorId: user.userId, authorName, recipientId, createdAt: new Date().toISOString() },
      });
    } catch (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  // DELETE /api/community/chat/:messageId
  const chatDelMatch = fullPath.match(/^chat\/([^/]+)$/);
  if (chatDelMatch && req.method === 'DELETE') {
    const user = authenticate(req);
    if (!user) return res.status(401).json({ error: 'No token provided' });
    try {
      await initDB();
      const msg = await getPool().query('SELECT author_id FROM chat_messages WHERE id=$1', [chatDelMatch[1]]);
      if (!msg.rows[0]) return res.status(404).json({ success: false, error: 'Message not found' });
      if (msg.rows[0].author_id !== user.userId) return res.status(403).json({ success: false, error: 'Not your message' });
      await getPool().query('DELETE FROM chat_messages WHERE id=$1', [chatDelMatch[1]]);
      return res.json({ success: true });
    } catch (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  // GET /api/community/chat/conversations — list DM partners
  if (fullPath === 'chat/conversations' && req.method === 'GET') {
    const user = authenticate(req);
    if (!user) return res.status(401).json({ error: 'No token provided' });
    try {
      await initDB();
      const result = await getPool().query(
        `SELECT DISTINCT
           CASE WHEN author_id=$1 THEN recipient_id ELSE author_id END AS partner_id,
           CASE WHEN author_id=$1 THEN author_name ELSE author_name END AS partner_name,
           MAX(created_at) AS last_message_at
         FROM chat_messages
         WHERE recipient_id IS NOT NULL AND (author_id=$1 OR recipient_id=$1)
         GROUP BY partner_id, partner_name
         ORDER BY last_message_at DESC`,
        [user.userId]
      );
      return res.json({ success: true, data: result.rows.map(r => ({ partnerId: r.partner_id, partnerName: r.partner_name, lastMessageAt: r.last_message_at })) });
    } catch (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  // ─── STATS ───
  if (fullPath === 'stats' && req.method === 'GET') {
    try {
      await initDB();
      const membersRes = await fetch(`${WALLETTWO_API}/members?limit=1`, { headers: { 'x-api-key': API_KEY() } });
      const membersData = membersRes.ok ? await membersRes.json() : {};
      const photosCount = await getPool().query('SELECT COUNT(*)::int AS total FROM photos');
      const messagesCount = await getPool().query('SELECT COUNT(*)::int AS total FROM chat_messages WHERE recipient_id IS NULL');
      return res.json({
        success: true,
        data: {
          totalMembers: membersData.total || 0,
          totalPhotos: photosCount.rows[0].total,
          totalMessages: messagesCount.rows[0].total,
          eventsThisMonth: 0,
        },
      });
    } catch {
      return res.json({ success: true, data: { totalMembers: 0, totalPhotos: 0, totalMessages: 0, eventsThisMonth: 0 } });
    }
  }

  // Legacy feed endpoint
  if (fullPath === 'feed' && req.method === 'GET') {
    return res.json({ success: true, data: [], pagination: { limit: 30, offset: 0, hasMore: false } });
  }

  return res.status(404).json({ error: 'Route not found' });
}
