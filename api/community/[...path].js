import jwt from 'jsonwebtoken';
import axios from 'axios';

const engageClient = axios.create({
  baseURL: process.env.ENGAGE_API_BASE || 'https://api.engage.onchainlabs.ch',
  headers: { 'Authorization': `Bearer ${process.env.WALLETTWO_API_KEY}`, 'Content-Type': 'application/json' },
  timeout: 10000,
});

function authenticate(req) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return null;
  try { return jwt.verify(token, process.env.JWT_SECRET); } catch { return null; }
}

function generateAvatar(firstName, lastName) {
  return ((firstName?.charAt(0) || '') + (lastName?.charAt(0) || '')).toUpperCase() || 'U';
}

function generateHandle(firstName, lastName) {
  return `${(firstName || '').toLowerCase()}.${(lastName || '').toLowerCase()}`.replace(/\.+/g, '.').replace(/^\.|\.$/, '');
}

export default async function handler(req, res) {
  const path = req.url.split('?')[0].replace('/api/community/', '').replace(/\/$/, '');

  // GET /api/community/members
  if (path === 'members' && req.method === 'GET') {
    try {
      const { limit = 50, offset = 0, search } = req.query;
      const parsedLimit = Math.min(parseInt(limit) || 50, 100);
      const parsedOffset = parseInt(offset) || 0;
      const params = { limit: parsedLimit, offset: parsedOffset };
      if (search) params.search = search;
      const response = await engageClient.get('/users', { params });
      const members = (response.data.data || response.data || []).map(m => ({
        id: m.id, name: m.firstName && m.lastName ? `${m.firstName} ${m.lastName}` : m.name || 'User',
        avatar: generateAvatar(m.firstName, m.lastName), handle: m.handle || generateHandle(m.firstName, m.lastName),
        location: m.location || 'Unknown', joinedAt: m.createdAt, tier: m.tier || 'member',
        productsCount: m.products?.length || 0, eventsAttended: m.eventsAttended || 0,
      }));
      return res.json({ success: true, data: members, pagination: { limit: parsedLimit, offset: parsedOffset, total: members.length, hasMore: members.length === parsedLimit } });
    } catch (error) { return res.status(500).json({ success: false, error: error.message }); }
  }

  // GET /api/community/members/:memberId
  const memberMatch = path.match(/^members\/([^/]+)$/);
  if (memberMatch && req.method === 'GET') {
    try {
      const response = await engageClient.get(`/users/${memberMatch[1]}`);
      const m = response.data.data || response.data;
      if (!m) return res.status(404).json({ success: false, error: 'Member not found' });
      return res.json({ success: true, data: { id: m.id, name: m.firstName && m.lastName ? `${m.firstName} ${m.lastName}` : m.name, avatar: generateAvatar(m.firstName, m.lastName), handle: m.handle || generateHandle(m.firstName, m.lastName), location: m.location, bio: m.bio || '', joinedAt: m.createdAt, tier: m.tier, products: m.products || [], eventsAttended: m.eventsAttended || 0, whatsapp: m.whatsappSubscribed || false } });
    } catch (error) { return res.status(500).json({ success: false, error: error.message }); }
  }

  // GET /api/community/feed
  if (path === 'feed' && req.method === 'GET') {
    const { limit = 30, offset = 0 } = req.query;
    return res.json({ success: true, data: [], pagination: { limit: parseInt(limit), offset: parseInt(offset), hasMore: false } });
  }

  // GET /api/community/stats
  if (path === 'stats' && req.method === 'GET') {
    try {
      const [membersRes, eventsRes] = await Promise.all([
        engageClient.get('/users', { params: { limit: 10000, offset: 0 } }),
        engageClient.get('/events', { params: { status: 'upcoming' } }),
      ]);
      const allMembers = membersRes.data.data || membersRes.data || [];
      const events = eventsRes.data.data || eventsRes.data || [];
      const membersByRegion = allMembers.reduce((acc, m) => { const r = m.location?.split(',').pop()?.trim() || 'Unknown'; acc[r] = (acc[r] || 0) + 1; return acc; }, {});
      return res.json({ success: true, data: { totalMembers: allMembers.length, connectedInstagram: allMembers.filter(m => m.instagramHandle).length, totalPhotos: 0, eventsThisMonth: events.length, membersByRegion } });
    } catch (error) { return res.status(500).json({ success: false, error: error.message }); }
  }

  // POST /api/community/whatsapp/subscribe
  if (path === 'whatsapp/subscribe' && req.method === 'POST') {
    const user = authenticate(req);
    if (!user) return res.status(401).json({ error: 'No token provided' });
    const { phoneNumber } = req.body;
    if (!phoneNumber) return res.status(400).json({ success: false, error: 'Phone number required' });
    try {
      await engageClient.put(`/users/${user.userId}`, { whatsappPhone: phoneNumber, whatsappSubscribed: true });
      const masked = phoneNumber.replace(/(.{3})(.*)(.{3})/, '$1 *** $3');
      return res.json({ success: true, message: 'WhatsApp subscription initiated', data: { userId: user.userId, phoneNumber: masked, subscribedAt: new Date().toISOString() } });
    } catch (error) { return res.status(500).json({ success: false, error: error.message }); }
  }

  return res.status(404).json({ error: 'Route not found' });
}
