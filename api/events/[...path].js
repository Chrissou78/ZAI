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

export default async function handler(req, res) {
  const path = req.url.split('?')[0].replace('/api/events/', '').replace(/\/$/, '');

  // GET /api/events
  if (path === '' && req.method === 'GET') {
    try {
      const { status = 'upcoming' } = req.query;
      const response = await engageClient.get('/events', { params: { status } });
      return res.json({ success: true, data: response.data.data || response.data || [] });
    } catch (error) { return res.status(500).json({ success: false, error: error.message }); }
  }

  // POST /api/events/:eventId/register
  const registerMatch = path.match(/^([^/]+)\/register$/);
  if (registerMatch && req.method === 'POST') {
    const user = authenticate(req);
    if (!user) return res.status(401).json({ error: 'No token provided' });
    try {
      const response = await engageClient.post(`/events/${registerMatch[1]}/attendees`, { userId: user.userId, registeredAt: new Date().toISOString() });
      return res.json({ success: true, message: 'Registered successfully', data: response.data.data || response.data });
    } catch (error) { return res.status(500).json({ success: false, error: error.message }); }
  }

  return res.status(404).json({ error: 'Route not found' });
}
