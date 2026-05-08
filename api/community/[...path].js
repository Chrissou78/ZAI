import jwt from 'jsonwebtoken';

const WALLETTWO_API = 'https://api.wallettwo.com/auth/v1/api';
const API_KEY = () => process.env.WALLETTWO_API_KEY;

function authenticate(req) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return null;
  try {
    return jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret');
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  const path = req.url.split('?')[0].replace('/api/community/', '').replace(/\/$/, '');

  // GET /api/community/members
  if (path === 'members' && req.method === 'GET') {
    try {
      const { limit = 50, offset = 0, search } = req.query;
      const page = Math.floor(parseInt(offset || 0) / parseInt(limit || 50)) + 1;
      const parsedLimit = Math.min(parseInt(limit) || 50, 100);

      const url = `${WALLETTWO_API}/members?limit=${parsedLimit}&page=${page}`;
      const response = await fetch(url, {
        headers: { 'x-api-key': API_KEY() },
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        return res.status(response.status).json({
          success: false,
          error: err.message || 'Failed to fetch members',
        });
      }

      const data = await response.json();

      const members = (data.members || []).map(m => {
        const user = m.user || {};
        // Respect privacy — only show details for public profiles
        const displayName = user.isPublic
          ? (user.name || 'Member')
          : `Member ${user.id?.slice(0, 6) || ''}`;

        return {
          id: m.userId,
          name: displayName,
          wallet: user.isPublic ? user.wallet : undefined,
          avatar: (user.name?.charAt(0) || 'M').toUpperCase(),
          joinedAt: m.createdAt,
          isPublic: user.isPublic || false,
        };
      });

      // Filter by search if provided
      const filtered = search
        ? members.filter(m =>
            m.name.toLowerCase().includes(search.toLowerCase()) ||
            (m.wallet && m.wallet.toLowerCase().includes(search.toLowerCase()))
          )
        : members;

      return res.json({
        success: true,
        data: filtered,
        pagination: {
          limit: parsedLimit,
          offset: parseInt(offset) || 0,
          total: data.total || 0,
          totalPages: data.totalPages || 1,
          page: data.page || 1,
          hasMore: (data.page || 1) < (data.totalPages || 1),
        },
      });
    } catch (error) {
      console.error('Members API error:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  // GET /api/community/members/:memberId
  const memberMatch = path.match(/^members\/([^/]+)$/);
  if (memberMatch && req.method === 'GET') {
    try {
      // Fetch all members and find the one — no single-member endpoint known yet
      const response = await fetch(`${WALLETTWO_API}/members?limit=100`, {
        headers: { 'x-api-key': API_KEY() },
      });

      if (!response.ok) {
        return res.status(response.status).json({ success: false, error: 'Failed to fetch member' });
      }

      const data = await response.json();
      const member = (data.members || []).find(m => m.userId === memberMatch[1]);

      if (!member) {
        return res.status(404).json({ success: false, error: 'Member not found' });
      }

      const user = member.user || {};
      return res.json({
        success: true,
        data: {
          id: member.userId,
          name: user.isPublic ? (user.name || 'Member') : `Member ${user.id?.slice(0, 6) || ''}`,
          wallet: user.isPublic ? user.wallet : undefined,
          email: user.isPublic ? user.email : undefined,
          avatar: (user.name?.charAt(0) || 'M').toUpperCase(),
          joinedAt: member.createdAt,
          isPublic: user.isPublic || false,
        },
      });
    } catch (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  // GET /api/community/feed
  if (path === 'feed' && req.method === 'GET') {
    const { limit = 30, offset = 0 } = req.query;
    return res.json({
      success: true,
      data: [],
      pagination: { limit: parseInt(limit), offset: parseInt(offset), hasMore: false },
    });
  }

  // GET /api/community/stats
  if (path === 'stats' && req.method === 'GET') {
    try {
      const response = await fetch(`${WALLETTWO_API}/members?limit=1`, {
        headers: { 'x-api-key': API_KEY() },
      });
      const data = response.ok ? await response.json() : {};

      return res.json({
        success: true,
        data: {
          totalMembers: data.total || 0,
          totalPhotos: 0,
          eventsThisMonth: 0,
          membersByRegion: {},
        },
      });
    } catch {
      return res.json({
        success: true,
        data: { totalMembers: 0, totalPhotos: 0, eventsThisMonth: 0, membersByRegion: {} },
      });
    }
  }

  // POST /api/community/whatsapp/subscribe
  if (path === 'whatsapp/subscribe' && req.method === 'POST') {
    const user = authenticate(req);
    if (!user) return res.status(401).json({ error: 'No token provided' });
    return res.json({
      success: true,
      message: 'WhatsApp subscription initiated',
      data: { userId: user.userId, subscribedAt: new Date().toISOString() },
    });
  }

  return res.status(404).json({ error: 'Route not found' });
}
