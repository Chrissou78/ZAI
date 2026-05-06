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

  if (req.method === 'GET') {
    try {
      const response = await engageClient.get(`/users/${user.userId}`);
      const u = response.data.data || response.data;

      if (!u) return res.json({ success: true, user });

      return res.json({
        success: true,
        user: {
          id: u.id,
          givenName: u.givenName,
          familyName: u.familyName,
          email: u.email,
          phoneNumber: u.phoneNumber,
          address: u.address,
          city: u.city,
          country: u.country,
          postalCode: u.postalCode,
          birthdate: u.birthdate,
          isPublic: u.isPublic,
          role: u.role,
          walletAddress: u.wallet,
          createdAt: u.createdAt,
          emailVerified: u.emailVerified,
        },
      });
    } catch {
      return res.status(500).json({ error: 'Failed to get user' });
    }
  }

  if (req.method === 'PUT') {
    try {
      const response = await engageClient.put(`/users/${user.userId}`, req.body);
      const updatedUser = response.data.data || response.data;
      return res.json({ success: true, user: updatedUser });
    } catch {
      return res.status(500).json({ error: 'Failed to update user' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
