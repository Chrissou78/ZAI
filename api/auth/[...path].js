// api/auth/[...path].js
import jwt from 'jsonwebtoken';
import axios from 'axios';
import {
  authenticate,
  applyRateLimit,
  signToken,
  sanitizeString,
  JWT_SECRET,
} from '../middleware.js';

// Lazy DB import
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

  // ══════════════════════════════════════════════════════════════
  // GET /api/auth/me — return current user profile + DB-verified role
  // ══════════════════════════════════════════════════════════════
  if (path === 'me' && req.method === 'GET') {
    const decoded = authenticate(req);
    if (!decoded) return res.status(401).json({ error: 'No token provided' });

    // Rate limit: 30 req/min
    if (applyRateLimit(req, res, 'auth:me', 30, 60_000)) return;

    try {
      // Always verify role from DB, never trust JWT claim
      let role = 'member';
      let profileData = {};

      const db = await getDB();
      if (db) {
        try {
          await db.initDB();
          role = await db.getUserRole(decoded.userId);
        } catch (dbErr) {
          console.error('[AUTH] DB role lookup failed (non-fatal):', dbErr.message);
          // Fall back to JWT role if DB is unavailable (still better than nothing)
          role = decoded.role || 'member';
        }

        // Also fetch latest profile data from DB if available
        try {
          const pool = db.getPool();
          const profileResult = await pool.query(
            `SELECT * FROM user_profiles WHERE user_id = $1`,
            [decoded.userId]
          );
          if (profileResult.rows.length > 0) {
            const row = profileResult.rows[0];
            profileData = {
              name: row.name || '',
              givenName: row.given_name || '',
              familyName: row.family_name || '',
              email: row.email || '',
              phoneNumber: row.phone_number || '',
              address: row.address || '',
              city: row.city || '',
              country: row.country || '',
              postalCode: row.postal_code || '',
              birthdate: row.birthdate || null,
              isPublic: row.is_public || false,
              language: row.language || 'en',
            };
          }
        } catch (profileErr) {
          console.error('[AUTH] Profile fetch failed (non-fatal):', profileErr.message);
        }
      } else {
        // No DB — fall back to JWT claims
        role = decoded.role || 'member';
      }

      return res.status(200).json({
        success: true,
        data: {
          id: decoded.userId,
          wallet: decoded.wallet,
          name: profileData.name || decoded.name || '',
          givenName: profileData.givenName || decoded.givenName || '',
          familyName: profileData.familyName || decoded.familyName || '',
          email: profileData.email || decoded.email || '',
          phoneNumber: profileData.phoneNumber || '',
          address: profileData.address || '',
          city: profileData.city || '',
          country: profileData.country || '',
          postalCode: profileData.postalCode || '',
          birthdate: profileData.birthdate || null,
          isPublic: profileData.isPublic || false,
          language: profileData.language || 'en',
          role,
        },
      });
    } catch (err) {
      console.error('[AUTH] /me error:', err);
      return res.status(500).json({ error: 'Internal error', detail: err.message });
    }
  }

  // ══════════════════════════════════════════════════════════════
  // POST /api/auth/login
  // ══════════════════════════════════════════════════════════════
  if (path === 'login' && req.method === 'POST') {
    return handleLogin(req, res);
  }

  // ══════════════════════════════════════════════════════════════
  // POST /api/auth/refresh
  // ══════════════════════════════════════════════════════════════
  if (path === 'refresh' && req.method === 'POST') {
    return handleRefresh(req, res);
  }

  return res.status(404).json({ error: 'Route not found' });
}

async function handleLogin(req, res) {
  res.setHeader('Content-Type', 'application/json');

  // Rate limit: 10 req/min on login
  if (applyRateLimit(req, res, 'auth:login', 10, 60_000)) return;

  try {
    let body = req.body;
    if (typeof body === 'string') body = JSON.parse(body);

    const { token, userId: claimedUserId, wallet: bodyWallet } = body;
    if (!token) {
      return res.status(400).json({ error: 'Missing token' });
    }

    const baseUrl = process.env.VITE_WALLETTWO_URL || 'https://api.wallettwo.com';
    const exchangeUrl = `${baseUrl}/auth/api/auth/one-time-token/verify`;

    const exchangeResponse = await axios.post(exchangeUrl, { token }, {
      headers: {
        'Authorization': `Bearer ${process.env.WALLETTWO_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    const sessionToken = exchangeResponse.data.session?.token;
    const userProfile = exchangeResponse.data.user || {};

    console.log('[AUTH] Exchange response:', JSON.stringify({
      keys: Object.keys(exchangeResponse.data),
      userKeys: Object.keys(userProfile),
      sessionKeys: exchangeResponse.data.session ? Object.keys(exchangeResponse.data.session) : [],
      hasWallet: !!(userProfile.wallet || userProfile.walletAddress || userProfile.address),
    }));

    if (!sessionToken) {
      return res.status(400).json({ error: 'Invalid exchange response' });
    }

    // ══════════════════════════════════════════════════════════════
    // SECURITY: userId must come from WalletTwo's verified response,
    // never from the request body. The body's userId is attacker-
    // controlled — trusting it would let anyone holding a valid token
    // for their own account mint a JWT for any other userId (found via
    // e.g. GET /api/community/members) and fully impersonate them.
    // ══════════════════════════════════════════════════════════════
    const userId = userProfile.id || userProfile.userId;
    if (!userId) {
      return res.status(400).json({ error: 'Exchange response missing verified user id' });
    }
    if (claimedUserId && claimedUserId !== userId) {
      console.warn('[AUTH] Client-claimed userId did not match verified identity:', { claimedUserId, verifiedUserId: userId });
    }

    // Resolve wallet: user profile → exchange root → body (last resort) → fallback to verified userId
    const wallet = userProfile.wallet
      || userProfile.walletAddress
      || userProfile.address
      || exchangeResponse.data.wallet
      || exchangeResponse.data.address
      || bodyWallet
      || userId;

    // ── Fetch role from DB ──
    let orgRole = 'member';
    try {
      const db = await getDB();
      if (db) {
        await db.initDB();
        orgRole = await db.getUserRole(userId);
        // Auto-grant admin if this email is on the allowlist.
        if (orgRole !== 'owner' && orgRole !== 'admin') {
          const granted = await db.ensureAdminFromEmail(userId, userProfile.email);
          if (granted) orgRole = 'admin';
        }
      }
    } catch (dbErr) {
      console.error('[AUTH] DB role lookup failed (non-fatal):', dbErr.message);
    }

    const mappedUser = {
      id: userId,
      name: sanitizeString(userProfile.name || ''),
      givenName: sanitizeString(userProfile.givenName || ''),
      familyName: sanitizeString(userProfile.familyName || ''),
      email: sanitizeString(userProfile.email || ''),
      emailVerified: userProfile.emailVerified || false,
      phoneNumber: sanitizeString(userProfile.phoneNumber || ''),
      address: sanitizeString(userProfile.address || ''),
      city: sanitizeString(userProfile.city || ''),
      country: sanitizeString(userProfile.country || ''),
      postalCode: sanitizeString(userProfile.postalCode || ''),
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

    // Short-lived access token (1h) — no role in JWT payload
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

    // Refresh token (7d)
    const refreshToken = signToken(
      { userId, wallet, type: 'refresh' },
      '7d'
    );

    return res.status(200).json({
      success: true,
      jwtToken,
      refreshToken,
      user: mappedUser,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message, details: error.response?.data });
  }
}

async function handleRefresh(req, res) {
  res.setHeader('Content-Type', 'application/json');

  // Rate limit: 10 req/min
  if (applyRateLimit(req, res, 'auth:refresh', 10, 60_000)) return;

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { refreshToken } = body;

    if (!refreshToken) {
      return res.status(400).json({ error: 'refreshToken is required' });
    }

    const decoded = jwt.verify(refreshToken, JWT_SECRET);

    if (decoded.type !== 'refresh') {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    // Get fresh role from DB
    let role = 'member';
    try {
      const db = await getDB();
      if (db) {
        await db.initDB();
        role = await db.getUserRole(decoded.userId);
      }
    } catch (dbErr) {
      console.error('[AUTH] refresh DB role lookup failed:', dbErr.message);
    }

    const newAccessToken = signToken(
      {
        userId: decoded.userId,
        wallet: decoded.wallet,
        name: decoded.name || '',
        givenName: decoded.givenName || '',
        familyName: decoded.familyName || '',
      },
      '1h'
    );

    return res.status(200).json({
      success: true,
      jwtToken: newAccessToken,
      role,
    });
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired refresh token' });
  }
}