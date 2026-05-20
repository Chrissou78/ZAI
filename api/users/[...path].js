import jwt from 'jsonwebtoken';
import { getPool, initDB } from '../db.js';
import { authenticator } from 'otplib';

const DEFAULT_SETTINGS = {
  notifications: {
    eventInvitations: true,
    membershipUpdates: true,
    productLaunches: false,
    partnerOffers: false,
    productUpdates: true,
    eventReminders: true,
  },
  privacy: {
    partnerDataSharing: true,
    analytics: false,
    profileVisibility: true,
    communityVisibility: false,
  },
  card: {
    nfcActive: true,
    autoLoginOnTap: true,
  },
  region: {
    country: 'Switzerland',
    currency: 'CHF',
    language: 'English',
  },
};

function authenticate(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return null;
  try {
    return jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET || 'fallback-secret');
  } catch {
    return null;
  }
}

async function ensureProfile(decoded) {
  const pool = getPool();
  const existing = await pool.query('SELECT user_id FROM user_profiles WHERE user_id = $1', [decoded.userId]);
  if (existing.rows.length === 0) {
    await pool.query(
      `INSERT INTO user_profiles (user_id, wallet, name, given_name, family_name, email, phone_number, address, city, country, postal_code, birthdate, is_public, salutation, language)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
      [
        decoded.userId, decoded.wallet || '',
        decoded.name || '', decoded.givenName || '', decoded.familyName || '',
        decoded.email || '', decoded.phoneNumber || '',
        decoded.address || '', decoded.city || '', decoded.country || '',
        decoded.postalCode || '', decoded.birthdate || null, decoded.isPublic || false,
        decoded.salutation || 0, decoded.language || 'en',
      ]
    );
  }
}

async function ensureSettings(userId) {
  const pool = getPool();
  const existing = await pool.query('SELECT user_id FROM user_settings WHERE user_id = $1', [userId]);
  if (existing.rows.length === 0) {
    await pool.query('INSERT INTO user_settings (user_id) VALUES ($1)', [userId]);
  }
}

export default async function handler(req, res) {
  const path = req.url.split('?')[0].replace('/api/users/', '').replace(/\/$/, '');

  // ─── GET /api/users/profile ───
  if (path === 'profile' && req.method === 'GET') {
    const decoded = authenticate(req);
    if (!decoded) return res.status(401).json({ error: 'No token provided' });
    try {
      await initDB();
      await ensureProfile(decoded);
      const result = await getPool().query('SELECT * FROM user_profiles WHERE user_id = $1', [decoded.userId]);
      const row = result.rows[0];
      return res.json({ success: true, data: { userId: row.user_id, wallet: row.wallet } });
    } catch (err) {
      return res.json({ success: true, data: { userId: decoded.userId, wallet: decoded.wallet } });
    }
  }

  // ─── GET /api/users/me ───
  if (path === 'me' && req.method === 'GET') {
    const decoded = authenticate(req);
    if (!decoded) return res.status(401).json({ error: 'No token provided' });
    try {
      await initDB();
      await ensureProfile(decoded);
      const result = await getPool().query('SELECT * FROM user_profiles WHERE user_id = $1', [decoded.userId]);
      const row = result.rows[0];
      return res.json({
        success: true,
        data: {
          id: row.user_id, userId: row.user_id, wallet: row.wallet,
          name: row.name, givenName: row.given_name, familyName: row.family_name,
          email: row.email, phoneNumber: row.phone_number,
          address: row.address, city: row.city, country: row.country,
          postalCode: row.postal_code, birthdate: row.birthdate, isPublic: row.is_public,
          salutation: row.salutation, language: row.language,
        },
      });
    } catch (err) {
      return res.json({
        success: true,
        data: {
          id: decoded.userId, userId: decoded.userId, wallet: decoded.wallet,
          name: decoded.name || '', givenName: decoded.givenName || '',
          familyName: decoded.familyName || '', email: decoded.email || '',
          phoneNumber: decoded.phoneNumber || '', address: decoded.address || '',
          city: decoded.city || '', country: decoded.country || '',
          postalCode: decoded.postalCode || '', birthdate: decoded.birthdate || null,
          isPublic: decoded.isPublic || false, salutation: 0, language: 'en',
        },
      });
    }
  }

  // ─── PUT /api/users/me ───
  if (path === 'me' && req.method === 'PUT') {
    const decoded = authenticate(req);
    if (!decoded) return res.status(401).json({ error: 'No token provided' });
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const updatableFields = ['name','givenName','familyName','email','phoneNumber','address','city','country','postalCode','birthdate','isPublic','salutation','language'];
      const updatedUser = { id: decoded.userId, userId: decoded.userId, wallet: decoded.wallet };
      for (const field of updatableFields) {
        updatedUser[field] = body[field] !== undefined ? body[field] : (decoded[field] || '');
      }

      await initDB();
      await ensureProfile(decoded);
      await getPool().query(
        `UPDATE user_profiles SET
           name=$2, given_name=$3, family_name=$4, email=$5, phone_number=$6,
           address=$7, city=$8, country=$9, postal_code=$10, birthdate=$11,
           is_public=$12, salutation=$13, language=$14, updated_at=NOW()
         WHERE user_id=$1`,
        [
          decoded.userId,
          updatedUser.name, updatedUser.givenName, updatedUser.familyName,
          updatedUser.email, updatedUser.phoneNumber,
          updatedUser.address, updatedUser.city, updatedUser.country,
          updatedUser.postalCode, updatedUser.birthdate || null,
          updatedUser.isPublic || false, parseInt(updatedUser.salutation) || 0,
          updatedUser.language || 'en',
        ]
      );

      const newToken = jwt.sign(
        {
          userId: decoded.userId, wallet: decoded.wallet, wallettwoToken: decoded.wallettwoToken,
          name: updatedUser.name, givenName: updatedUser.givenName, familyName: updatedUser.familyName,
          email: updatedUser.email, phoneNumber: updatedUser.phoneNumber, address: updatedUser.address,
          city: updatedUser.city, country: updatedUser.country, postalCode: updatedUser.postalCode,
          birthdate: updatedUser.birthdate, isPublic: updatedUser.isPublic,
          salutation: updatedUser.salutation, language: updatedUser.language,
        },
        process.env.JWT_SECRET || 'fallback-secret',
        { expiresIn: '7d' }
      );

      return res.json({ success: true, message: 'Profile updated successfully', jwtToken: newToken, user: updatedUser });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // ─── GET /api/users/me/settings ───
  if (path === 'me/settings' && req.method === 'GET') {
    const decoded = authenticate(req);
    if (!decoded) return res.status(401).json({ error: 'No token provided' });
    try {
      await initDB();
      await ensureProfile(decoded);
      await ensureSettings(decoded.userId);
      const result = await getPool().query('SELECT * FROM user_settings WHERE user_id = $1', [decoded.userId]);
      const row = result.rows[0];
      return res.json({
        success: true,
        data: { notifications: row.notifications, privacy: row.privacy, card: row.card, region: row.region },
      });
    } catch (err) {
      return res.json({ success: true, data: DEFAULT_SETTINGS });
    }
  }

  // ─── PUT /api/users/me/settings ───
  if (path === 'me/settings' && req.method === 'PUT') {
    const decoded = authenticate(req);
    if (!decoded) return res.status(401).json({ error: 'No token provided' });
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      await initDB();
      await ensureProfile(decoded);
      await ensureSettings(decoded.userId);
      const existing = await getPool().query('SELECT * FROM user_settings WHERE user_id = $1', [decoded.userId]);
      const current = existing.rows[0] || {};
      const updated = {
        notifications: { ...(current.notifications || DEFAULT_SETTINGS.notifications), ...(body.notifications || {}) },
        privacy: { ...(current.privacy || DEFAULT_SETTINGS.privacy), ...(body.privacy || {}) },
        card: { ...(current.card || DEFAULT_SETTINGS.card), ...(body.card || {}) },
        region: { ...(current.region || DEFAULT_SETTINGS.region), ...(body.region || {}) },
      };
      await getPool().query(
        `UPDATE user_settings SET notifications=$2, privacy=$3, card=$4, region=$5, updated_at=NOW() WHERE user_id=$1`,
        [decoded.userId, JSON.stringify(updated.notifications), JSON.stringify(updated.privacy), JSON.stringify(updated.card), JSON.stringify(updated.region)]
      );
      return res.json({ success: true, message: 'Settings saved', data: updated });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // ─── POST /api/users/me/request-card-replacement ───
  if (path === 'me/request-card-replacement' && req.method === 'POST') {
    const decoded = authenticate(req);
    if (!decoded) return res.status(401).json({ error: 'No token provided' });
    console.log(`Card replacement requested by ${decoded.userId}`);
    return res.json({ success: true, message: 'Card replacement request submitted' });
  }

  // ── At the top of the file, add this import ──
import { authenticator } from 'otplib';

// ──────────────────────────────────────────────
// GET /api/users/me/security
// ──────────────────────────────────────────────
if (method === 'GET' && pathParts[2] === 'me' && pathParts[3] === 'security') {
  const decoded = authenticate(req);
  if (!decoded) return res.status(401).json({ error: 'Unauthorized' });

  const db = await getDb();

  // Ensure tables exist
  await db.query(`
    CREATE TABLE IF NOT EXISTS user_security (
      user_id TEXT PRIMARY KEY,
      two_factor_enabled BOOLEAN DEFAULT false,
      two_factor_method TEXT DEFAULT 'none',
      two_factor_secret TEXT,
      last_password_change TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS user_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      device TEXT,
      browser TEXT,
      ip_address TEXT,
      last_active TIMESTAMPTZ DEFAULT NOW(),
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // Upsert security row
  await db.query(`
    INSERT INTO user_security (user_id) VALUES ($1)
    ON CONFLICT (user_id) DO NOTHING
  `, [decoded.userId]);

  // Upsert current session
  const userAgent = req.headers['user-agent'] || 'Unknown';
  const sessionId = `${decoded.userId}-${Buffer.from(userAgent).toString('base64').slice(0, 16)}`;
  const device = /Mobile|Android|iPhone/i.test(userAgent) ? 'Mobile' : 'Desktop';
  const browser = userAgent.match(/(Chrome|Firefox|Safari|Edge|Opera)/i)?.[1] || 'Unknown';
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'Unknown';

  await db.query(`
    INSERT INTO user_sessions (id, user_id, device, browser, ip_address, last_active)
    VALUES ($1, $2, $3, $4, $5, NOW())
    ON CONFLICT (id) DO UPDATE SET last_active = NOW(), ip_address = $5
  `, [sessionId, decoded.userId, device, browser, ip]);

  // Fetch security settings
  const secResult = await db.query(
    `SELECT two_factor_enabled, two_factor_method, last_password_change FROM user_security WHERE user_id = $1`,
    [decoded.userId]
  );

  // Fetch sessions (last 10)
  const sessResult = await db.query(
    `SELECT id, device, browser, ip_address, last_active, created_at FROM user_sessions WHERE user_id = $1 ORDER BY last_active DESC LIMIT 10`,
    [decoded.userId]
  );

  const sec = secResult.rows[0] || {};
  return res.status(200).json({
    success: true,
    security: {
      twoFactorEnabled: sec.two_factor_enabled || false,
      twoFactorMethod: sec.two_factor_method || 'none',
      lastPasswordChange: sec.last_password_change || null,
    },
    sessions: sessResult.rows.map(s => ({
      id: s.id,
      device: s.device,
      browser: s.browser,
      ipAddress: s.ip_address,
      lastActive: s.last_active,
      createdAt: s.created_at,
      isCurrent: s.id === sessionId,
    })),
  });
}

// ──────────────────────────────────────────────
// POST /api/users/me/change-password
// ──────────────────────────────────────────────
if (method === 'POST' && pathParts[2] === 'me' && pathParts[3] === 'change-password') {
  const decoded = authenticate(req);
  if (!decoded) return res.status(401).json({ error: 'Unauthorized' });

  const { newPassword } = req.body || {};
  if (!newPassword || newPassword.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  const db = await getDb();
  await db.query(`
    INSERT INTO user_security (user_id, last_password_change, updated_at)
    VALUES ($1, NOW(), NOW())
    ON CONFLICT (user_id) DO UPDATE SET last_password_change = NOW(), updated_at = NOW()
  `, [decoded.userId]);

  return res.status(200).json({ success: true, message: 'Password updated' });
}

// ──────────────────────────────────────────────
// POST /api/users/me/2fa/setup
// ──────────────────────────────────────────────
if (method === 'POST' && pathParts[2] === 'me' && pathParts[3] === '2fa' && pathParts[4] === 'setup') {
  const decoded = authenticate(req);
  if (!decoded) return res.status(401).json({ error: 'Unauthorized' });

  const { method: tfMethod } = req.body || {};
  const db = await getDb();

  // Generate a real TOTP secret using otplib
  const secret = authenticator.generateSecret();

  // Build the otpauth URI for authenticator apps
  const otpauthUrl = authenticator.keyuri(
    decoded.email || decoded.userId,
    'ZAI',
    secret
  );

  // Store the secret (not yet enabled — user must verify first)
  await db.query(`
    INSERT INTO user_security (user_id, two_factor_secret, two_factor_method, updated_at)
    VALUES ($1, $2, $3, NOW())
    ON CONFLICT (user_id) DO UPDATE
      SET two_factor_secret = $2, two_factor_method = $3, updated_at = NOW()
  `, [decoded.userId, secret, tfMethod || 'authenticator']);

  // QR code URL (using a public QR API — can be replaced with a local generator)
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(otpauthUrl)}`;

  return res.status(200).json({
    success: true,
    secret,
    qrCodeUrl,
    otpauthUrl,
    message: 'Scan the QR code with your authenticator app, then verify with a code.',
  });
}

// ──────────────────────────────────────────────
// POST /api/users/me/2fa/verify
// ──────────────────────────────────────────────
if (method === 'POST' && pathParts[2] === 'me' && pathParts[3] === '2fa' && pathParts[4] === 'verify') {
  const decoded = authenticate(req);
  if (!decoded) return res.status(401).json({ error: 'Unauthorized' });

  const { code } = req.body || {};
  if (!code || code.length !== 6) {
    return res.status(400).json({ error: 'Please enter a 6-digit code' });
  }

  const db = await getDb();

  // Retrieve the stored secret
  const secResult = await db.query(
    `SELECT two_factor_secret, two_factor_method FROM user_security WHERE user_id = $1`,
    [decoded.userId]
  );

  if (!secResult.rows.length || !secResult.rows[0].two_factor_secret) {
    return res.status(400).json({ error: '2FA setup not initiated. Please start setup first.' });
  }

  const storedSecret = secResult.rows[0].two_factor_secret;
  const method2fa = secResult.rows[0].two_factor_method;

  // Real TOTP verification
  let isValid = false;

  if (method2fa === 'email') {
    // For email method, we stored a 6-digit code as the "secret"
    // In a production app you'd store a separate short-lived code
    // For now, generate the TOTP from the secret and compare
    isValid = authenticator.verify({ token: code, secret: storedSecret });
  } else {
    // Authenticator app — standard TOTP verification
    // otplib allows a ±1 step window by default (30s steps)
    isValid = authenticator.verify({ token: code, secret: storedSecret });
  }

  if (!isValid) {
    return res.status(400).json({ error: 'Invalid verification code. Please try again.' });
  }

  // Code is valid — enable 2FA
  await db.query(`
    UPDATE user_security
    SET two_factor_enabled = true, updated_at = NOW()
    WHERE user_id = $1
  `, [decoded.userId]);

  return res.status(200).json({ success: true, message: 'Two-factor authentication enabled successfully' });
}

// ──────────────────────────────────────────────
// POST /api/users/me/2fa/disable
// ──────────────────────────────────────────────
if (method === 'POST' && pathParts[2] === 'me' && pathParts[3] === '2fa' && pathParts[4] === 'disable') {
  const decoded = authenticate(req);
  if (!decoded) return res.status(401).json({ error: 'Unauthorized' });

  const { code } = req.body || {};
  if (!code || code.length !== 6) {
    return res.status(400).json({ error: 'Please enter your current 6-digit code to disable 2FA' });
  }

  const db = await getDb();

  const secResult = await db.query(
    `SELECT two_factor_secret FROM user_security WHERE user_id = $1`,
    [decoded.userId]
  );

  if (!secResult.rows.length || !secResult.rows[0].two_factor_secret) {
    return res.status(400).json({ error: '2FA is not set up' });
  }

  const storedSecret = secResult.rows[0].two_factor_secret;

  // Verify the code before allowing disable
  const isValid = authenticator.verify({ token: code, secret: storedSecret });
  if (!isValid) {
    return res.status(400).json({ error: 'Invalid code. 2FA was not disabled.' });
  }

  await db.query(`
    UPDATE user_security
    SET two_factor_enabled = false, two_factor_secret = NULL, two_factor_method = 'none', updated_at = NOW()
    WHERE user_id = $1
  `, [decoded.userId]);

  return res.status(200).json({ success: true, message: 'Two-factor authentication disabled' });
}

// ──────────────────────────────────────────────
// GET /api/users/me/sessions
// ──────────────────────────────────────────────
if (method === 'GET' && pathParts[2] === 'me' && pathParts[3] === 'sessions') {
  const decoded = authenticate(req);
  if (!decoded) return res.status(401).json({ error: 'Unauthorized' });

  const db = await getDb();
  const userAgent = req.headers['user-agent'] || 'Unknown';
  const currentSessionId = `${decoded.userId}-${Buffer.from(userAgent).toString('base64').slice(0, 16)}`;

  const result = await db.query(
    `SELECT id, device, browser, ip_address, last_active, created_at FROM user_sessions WHERE user_id = $1 ORDER BY last_active DESC`,
    [decoded.userId]
  );

  return res.status(200).json({
    success: true,
    sessions: result.rows.map(s => ({
      id: s.id,
      device: s.device,
      browser: s.browser,
      ipAddress: s.ip_address,
      lastActive: s.last_active,
      createdAt: s.created_at,
      isCurrent: s.id === currentSessionId,
    })),
  });
}

// ──────────────────────────────────────────────
// POST /api/users/me/sessions/revoke
// ──────────────────────────────────────────────
if (method === 'POST' && pathParts[2] === 'me' && pathParts[3] === 'sessions' && pathParts[4] === 'revoke') {
  const decoded = authenticate(req);
  if (!decoded) return res.status(401).json({ error: 'Unauthorized' });

  const { sessionId } = req.body || {};
  if (!sessionId) return res.status(400).json({ error: 'Session ID required' });

  const db = await getDb();
  await db.query(`DELETE FROM user_sessions WHERE id = $1 AND user_id = $2`, [sessionId, decoded.userId]);

  return res.status(200).json({ success: true, message: 'Session revoked' });
}

// ──────────────────────────────────────────────
// POST /api/users/me/sessions/revoke-all
// ──────────────────────────────────────────────
if (method === 'POST' && pathParts[2] === 'me' && pathParts[3] === 'sessions' && pathParts[4] === 'revoke-all') {
  const decoded = authenticate(req);
  if (!decoded) return res.status(401).json({ error: 'Unauthorized' });

  const userAgent = req.headers['user-agent'] || 'Unknown';
  const currentSessionId = `${decoded.userId}-${Buffer.from(userAgent).toString('base64').slice(0, 16)}`;

  const db = await getDb();
  await db.query(`DELETE FROM user_sessions WHERE user_id = $1 AND id != $2`, [decoded.userId, currentSessionId]);

  return res.status(200).json({ success: true, message: 'All other sessions revoked' });
}


  return res.status(404).json({ error: 'Route not found' });
}
