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
  const user = authenticate(req);
  if (!user) return res.status(401).json({ error: 'No token provided' });

  const { userId } = req.query;

  if (req.method === 'GET') {
    try {
      const response = await engageClient.get(`/users/${userId}`);
      const u = response.data.data || response.data;
      if (!u) return res.status(404).json({ success: false, error: 'User not found' });

      return res.json({
        success: true,
        user: {
          id: u.id,
          givenName: u.givenName,
          familyName: u.familyName,
          email: u.email,
          role: u.role,
        },
      });
    } catch {
      return res.status(500).json({ error: 'User not found' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
