import jwt from 'jsonwebtoken';
import axios from 'axios';

const engageClient = axios.create({
  baseURL: process.env.ENGAGE_API_BASE || 'https://api.engage.onchainlabs.ch',
  headers: {
    'Authorization': `Bearer ${process.env.WALLETTWO_API_KEY}`,
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

function authenticate(req) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return null;
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const user = authenticate(req);
  if (!user) return res.status(401).json({ error: 'No token provided' });

  const { userId } = req.query;

  if (user.userId !== userId) {
    return res.status(403).json({ success: false, error: 'Unauthorized' });
  }

  try {
    const response = await engageClient.get(`/users/${userId}/products`);
    const products = response.data.data || response.data || [];

    return res.json({
      success: true,
      data: products,
      stats: {
        total: products.length,
        withInsurance: products.filter(p => p.insurance?.active).length,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}
