import jwt from 'jsonwebtoken';
import axios from 'axios';

export default async function handler(req, res) {
  const path = req.url.split('?')[0].replace('/api/auth/', '').replace(/\/$/, '');

  if (path === 'login' && req.method === 'POST') {
    return handleLogin(req, res);
  }

  if (path === 'profile' && req.method === 'PUT') {
    return handleProfile(req, res);
  }

  return res.status(404).json({ error: 'Route not found' });
}

async function handleLogin(req, res) {
  res.setHeader('Content-Type', 'application/json');
  try {
    let body = req.body;
    if (typeof body === 'string') body = JSON.parse(body);

    const { token, userId, wallet } = body;
    if (!token || !userId || !wallet) {
      return res.status(400).json({ error: 'Missing token, userId, or wallet' });
    }

    const baseUrl = process.env.WALLETTWO_API_URL || 'https://api.wallettwo.com';
    const exchangeUrl = `${baseUrl}/auth/api/auth/one-time-token/verify`;

    const exchangeResponse = await axios.post(exchangeUrl, { token }, {
      headers: {
        'Authorization': `Bearer ${process.env.WALLETTWO_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    const sessionToken = exchangeResponse.data.session?.token;
    const userProfile = exchangeResponse.data.user || {};

    if (!sessionToken) {
      return res.status(400).json({ error: 'Invalid exchange response' });
    }

    // ALWAYS use the original userId from the request — this is what the frontend knows
    const mappedUser = {
      id: userId,
      name: userProfile.name || '',
      givenName: userProfile.givenName || '',
      familyName: userProfile.familyName || '',
      email: userProfile.email || '',
      emailVerified: userProfile.emailVerified || false,
      phoneNumber: userProfile.phoneNumber || '',
      address: userProfile.address || '',
      city: userProfile.city || '',
      country: userProfile.country || '',
      postalCode: userProfile.postalCode || '',
      image: userProfile.image || null,
      birthdate: userProfile.birthdate || null,
      wallet: userProfile.wallet || wallet,
      walletAddress: wallet,
      walletSecured: userProfile.walletSecured || false,
      role: userProfile.role || 'user',
      banned: userProfile.banned || false,
      isPublic: userProfile.isPublic || false,
    };

    const jwtToken = jwt.sign(
      { userId: userId, wallet, wallettwoToken: sessionToken },
      process.env.JWT_SECRET || 'fallback-secret',
      { expiresIn: '7d' }
    );

    return res.status(200).json({ success: true, jwtToken, user: mappedUser });
  } catch (error) {
    return res.status(500).json({ error: error.message, details: error.response?.data });
  }
}

async function handleProfile(req, res) {
  res.setHeader('Content-Type', 'application/json');
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'No token provided' });

  try {
    const decoded = jwt.verify(authHeader.replace('Bearer ', ''), process.env.JWT_SECRET || 'fallback-secret');
    const { name, givenName, familyName, email, phoneNumber, address, city, country, postalCode, birthdate, isPublic } = req.body;

    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      user: { ...decoded, name, givenName, familyName, email, phoneNumber, address, city, country, postalCode, birthdate, isPublic },
    });
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}
