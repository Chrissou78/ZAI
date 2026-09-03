import axios from 'axios';
import { applyCors } from '../middleware.js';

export default async function handler(req, res) {
  // Answers preflights and echoes an allowlisted origin. Must run before
  // any auth check, since a preflight carries no Authorization header.
  if (applyCors(req, res)) return;

  const path = req.url.split('?')[0].replace('/api/wallettwo/', '').replace(/\/$/, '');

  if (path === 'profile' && req.method === 'GET') {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'No token provided' });
    const accessToken = authHeader.replace('Bearer ', '');

    try {
      const baseUrl = process.env.VITE_WALLETTWO_URL || 'https://api.wallettwo.com';
      const response = await axios.get(`${baseUrl}/auth/api/auth/get-session`, {
        headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      });
      const userInfo = response.data || {};
      return res.json({ success: true, data: { firstName: userInfo.firstName || 'User', lastName: userInfo.lastName || '', email: userInfo.email || '', phone: userInfo.phone || '', verified: userInfo.verified || false, tier: 'member' } });
    } catch (error) {
      return res.json({ success: true, data: { firstName: 'User', lastName: '', email: '', phone: '', verified: false, tier: 'member' } });
    }
  }

  return res.status(404).json({ error: 'Route not found' });
}
