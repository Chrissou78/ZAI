import jwt from 'jsonwebtoken';
import axios from 'axios';
import https from 'https';

const engageClient = axios.create({
  baseURL: process.env.ENGAGE_API_BASE || 'https://api.engage.onchainlabs.ch',
  headers: {
    'Authorization': `Bearer ${process.env.WALLETTWO_API_KEY}`,
    'Content-Type': 'application/json'
  },
  timeout: 10000,
  httpsAgent: new https.Agent({ rejectUnauthorized: false })
});

function authenticate(req) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return null;
  try { return jwt.verify(token, process.env.JWT_SECRET); } catch { return null; }
}

export default async function handler(req, res) {
  const path = req.url.split('?')[0].replace('/api/users/', '').replace(/\/$/, '');
  const user = authenticate(req);

  // GET/PUT /api/users/me
  if (path === 'me') {
    if (!user) return res.status(401).json({ error: 'No token provided' });
    if (req.method === 'GET') {
      try {
        const response = await engageClient.get(`/users/${user.userId}`);
        const u = response.data.data || response.data;
        if (!u) return res.json({ success: true, user });
        return res.json({ success: true, user: { id: u.id, givenName: u.givenName, familyName: u.familyName, email: u.email, phoneNumber: u.phoneNumber, address: u.address, city: u.city, country: u.country, postalCode: u.postalCode, birthdate: u.birthdate, isPublic: u.isPublic, role: u.role, walletAddress: u.wallet, createdAt: u.createdAt, emailVerified: u.emailVerified } });
      } catch { return res.status(500).json({ error: 'Failed to get user' }); }
    }
    if (req.method === 'PUT') {
      try {
        const response = await engageClient.put(`/users/${user.userId}`, req.body);
        return res.json({ success: true, user: response.data.data || response.data });
      } catch { return res.status(500).json({ error: 'Failed to update user' }); }
    }
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // GET/PUT /api/users/me/settings
  if (path === 'me/settings') {
    if (!user) return res.status(401).json({ error: 'No token provided' });
    if (req.method === 'GET') {
      return res.json({ success: true, data: { notifications: { eventInvitations: true, membershipUpdates: true, productLaunches: false, partnerOffers: false, productUpdates: true, eventReminders: true }, privacy: { partnerDataSharing: true, analytics: false, profileVisibility: true, communityVisibility: false }, card: { nfcActive: true, autoLoginOnTap: true }, region: { country: 'Switzerland', currency: 'CHF', language: 'English' } } });
    }
    if (req.method === 'PUT') {
      return res.json({ success: true, message: 'Settings saved' });
    }
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // POST /api/users/me/request-card-replacement
  if (path === 'me/request-card-replacement' && req.method === 'POST') {
    if (!user) return res.status(401).json({ error: 'No token provided' });
    return res.json({ success: true, message: 'Card replacement request submitted' });
  }

  // /api/users/:userId/products/claim
  const claimMatch = path.match(/^([^/]+)\/products\/claim$/);
  if (claimMatch && req.method === 'POST') {
    if (!user) return res.status(401).json({ error: 'No token provided' });
    const userId = claimMatch[1];
    if (user.userId !== userId) return res.status(403).json({ success: false, error: 'Unauthorized' });
    try {
      const response = await engageClient.post(`/users/${userId}/products/claim`, { serialNumber: req.body.serialNumber, claimedAt: new Date().toISOString() });
      return res.json({ success: true, message: 'Product claimed successfully', data: response.data.data || response.data });
    } catch (error) { return res.status(500).json({ success: false, error: error.message }); }
  }

  // /api/users/:userId/products
  const productsMatch = path.match(/^([^/]+)\/products$/);
  if (productsMatch && req.method === 'GET') {
    if (!user) return res.status(401).json({ error: 'No token provided' });
    const userId = productsMatch[1];
    if (user.userId !== userId) return res.status(403).json({ success: false, error: 'Unauthorized' });
    try {
      const response = await engageClient.get(`/users/${userId}/products`);
      const products = response.data.data || response.data || [];
      return res.json({ success: true, data: products, stats: { total: products.length, withInsurance: products.filter(p => p.insurance?.active).length } });
    } catch (error) { return res.status(500).json({ success: false, error: error.message }); }
  }

  // GET /api/users/:userId
  const userMatch = path.match(/^([^/]+)$/);
  if (userMatch && req.method === 'GET') {
    if (!user) return res.status(401).json({ error: 'No token provided' });
    try {
      const response = await engageClient.get(`/users/${userMatch[1]}`);
      const u = response.data.data || response.data;
      if (!u) return res.status(404).json({ success: false, error: 'User not found' });
      return res.json({ success: true, user: { id: u.id, givenName: u.givenName, familyName: u.familyName, email: u.email, role: u.role } });
    } catch { return res.status(500).json({ error: 'User not found' }); }
  }

  return res.status(404).json({ error: 'Route not found' });
}
