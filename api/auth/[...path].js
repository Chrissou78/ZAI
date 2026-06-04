import jwt from 'jsonwebtoken';
import axios from 'axios';
import { JWT_SECRET, applyRateLimit, signToken, sanitizeString } from '../middleware.js';

let dbModule = null;
async function getDB() {
  if (!dbModule) {
    try { dbModule = await import('../db.js'); } catch (e) {
      console.error('DB module import failed:', e.message);
    }
  }
  return dbModule;
}

export default async function handler(req, res) {
  const path = req.url.split('?')[0].replace('/api/auth/', '').replace(/\/$/, '');

  if (path === 'login' && req.method === 'POST') {
    return handleLogin(req, res);
  }

  if (path === 'profile' && req.method === 'PUT') {
    return handleProfile(req, res);
  }

  // ── Token refresh endpoint ──
  if (path === 'refresh' && req.method === 'POST') {
    return handleRefresh(req, res);
  }

  return res.status(404).json({ error: 'Route not found' });
}

async function handleLogin(req, res) {
  res.setHeader('Content-Type', 'application/json');

  // Rate limit: 10 login attempts per minute per IP
  if (applyRateLimit(req, res, 'auth:login', 10, 60_000)) return;

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

    // ── Fetch role from DB (authoritative source) ──
    let orgRole = 'member';
    try {
      const db = await getDB();
      if (db) {
        await db.initDB();
        orgRole = await db.getUserRole(userId, wallet);
      }
    } catch (dbErr) {
      console.error('[AUTH] DB role lookup failed (non-fatal):', dbErr.message);
    }

    const mappedUser = {
      id: userId,
      name: sanitizeString(userProfile.name || ''),
      givenName: sanitizeString(userProfile.givenName || ''),
      familyName: sanitizeString(userProfile.familyName || ''),
      email: userProfile.email || '',
      emailVerified: userProfile.emailVerified || false,
      phoneNumber: userProfile.phoneNumber || '',
      address: sanitizeString(userProfile.address || ''),
      city: sanitizeString(userProfile.city || ''),
      country: sanitizeString(userProfile.country || ''),
      postalCode: userProfile.postalCode || '',
      image: userProfile.image || null,
      birthdate: userProfile.birthdate || null,
      wallet: userProfile.wallet || wallet,
      walletAddress: wallet,
      walletSecured: userProfile.walletSecured || false,
      role: orgRole,
      banned: userProfile.banned || false,
      isPublic: userProfile.isPublic || false,
      organizations: userProfile.organizations || exchangeResponse.data.organizations || [],
    };

    // Short-lived access token (1h) — role NOT embedded, always re-check from DB
    const jwtToken = signToken(
      {
        userId: userId,
        wallet,
        wallettwoToken: sessionToken,
        name: mappedUser.name,
        givenName: mappedUser.givenName,
        familyName: mappedUser.familyName,
      },
      '1h'
    );

    // Long-lived refresh token (7d, minimal claims)
    const refreshToken = signToken(
      { userId, wallet, type: 'refresh' },
      '7d'
    );

    return res.status(200).json({ success: true, jwtToken, refreshToken, user: mappedUser });
  } catch (error) {
    return res.status(500).json({ error: error.message, details: error.response?.data });
  }
}

async function handleRefresh(req, res) {
  res.setHeader('Content-Type', 'application/json');

  if (applyRateLimit(req, res, 'auth:refresh', 20, 60_000)) return;

  try {
    let body = req.body;
    if (typeof body === 'string') body = JSON.parse(body);

    const { refreshToken } = body;
    if (!refreshToken) return res.status(400).json({ error: 'Missing refreshToken' });

    const decoded = jwt.verify(refreshToken, JWT_SECRET);
    if (decoded.type !== 'refresh') return res.status(401).json({ error: 'Invalid token type' });

    // Fetch fresh user data from DB if possible
    let userName = '', givenName = '', familyName = '';
    try {
      const db = await getDB();
      if (db) {
        await db.initDB();
        const pool = db.getPool();
        const profileRes = await pool.query(
          'SELECT name, given_name, family_name FROM user_profiles WHERE user_id = $1',
          [decoded.userId]
        );
        const row = profileRes.rows[0];
        if (row) {
          userName = row.name || '';
          givenName = row.given_name || '';
          familyName = row.family_name || '';
        }
      }
    } catch { /* silent */ }

    const newAccessToken = signToken(
      {
        userId: decoded.userId,
        wallet: decoded.wallet,
        name: userName,
        givenName,
        familyName,
      },
      '1h'
    );

    return res.status(200).json({ success: true, jwtToken: newAccessToken });
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired refresh token' });
  }
}

async function handleProfile(req, res) {
  res.setHeader('Content-Type', 'application/json');

  if (applyRateLimit(req, res, 'auth:profile', 20, 60_000)) return;

  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'No token provided' });

  try {
    const decoded = jwt.verify(authHeader.replace('Bearer ', ''), JWT_SECRET);
    const { name, givenName, familyName, email, phoneNumber, address, city, country, postalCode, birthdate, isPublic } = req.body;

    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        ...decoded,
        name: sanitizeString(name),
        givenName: sanitizeString(givenName),
        familyName: sanitizeString(familyName),
        email,
        phoneNumber,
        address: sanitizeString(address),
        city: sanitizeString(city),
        country: sanitizeString(country),
        postalCode,
        birthdate,
        isPublic,
      },
    });
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}
