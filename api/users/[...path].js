import jwt from 'jsonwebtoken';
import { getPool, initDB } from '../db.js';
import { createHmac, randomBytes } from 'crypto';

// ── Inline TOTP helpers (replaces otplib) ──
function base32Encode(buffer) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let result = '';
  let bits = 0, value = 0;
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      result += alphabet[(value >>> bits) & 31];
    }
  }
  if (bits > 0) result += alphabet[(value << (5 - bits)) & 31];
  return result;
}

function base32Decode(str) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0, value = 0;
  const bytes = [];
  for (const ch of str.toUpperCase().replace(/=+$/, '')) {
    const idx = alphabet.indexOf(ch);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((value >>> bits) & 0xff);
    }
  }
  return Buffer.from(bytes);
}

function generateSecret() {
  return base32Encode(randomBytes(20));
}

function totpCode(secret, time) {
  const counter = Math.floor((time || Date.now() / 1000) / 30);
  const buf = Buffer.alloc(8);
  buf.writeUInt32BE(0, 0);
  buf.writeUInt32BE(counter, 4);
  const hmac = createHmac('sha1', base32Decode(secret)).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code = ((hmac[offset] & 0x7f) << 24 | hmac[offset + 1] << 16 | hmac[offset + 2] << 8 | hmac[offset + 3]) % 1000000;
  return code.toString().padStart(6, '0');
}

function verifyTOTP(token, secret) {
  const now = Date.now() / 1000;
  for (const offset of [-1, 0, 1]) {
    if (totpCode(secret, now + offset * 30) === token) return true;
  }
  return false;
}

function totpKeyUri(account, issuer, secret) {
  return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(account)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}

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

async function ensureSecurity(userId) {
  const pool = getPool();
  await pool.query(`
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
  await pool.query(`
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
  // Migrate: add ip_address column if table exists but column doesn't
  await pool.query(`
    DO $$ BEGIN
      ALTER TABLE user_sessions ADD COLUMN ip_address TEXT;
    EXCEPTION WHEN duplicate_column THEN NULL;
    END $$
  `);
  await pool.query(
    `INSERT INTO user_security (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`,
    [userId]
  );
}

export default async function handler(req, res) {
  const method = req.method;
  const path = req.url.split('?')[0].replace('/api/users/', '').replace(/\/$/, '');

  // ─── GET /api/users/profile ───
  if (path === 'profile' && method === 'GET') {
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
  if (path === 'me' && method === 'GET') {
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
  if (path === 'me' && method === 'PUT') {
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
  if (path === 'me/settings' && method === 'GET') {
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
  if (path === 'me/settings' && method === 'PUT') {
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
  if (path === 'me/request-card-replacement' && method === 'POST') {
    const decoded = authenticate(req);
    if (!decoded) return res.status(401).json({ error: 'No token provided' });
    console.log(`Card replacement requested by ${decoded.userId}`);
    return res.json({ success: true, message: 'Card replacement request submitted' });
  }

  // ─── GET /api/users/me/security ───
  if (path === 'me/security' && method === 'GET') {
    const decoded = authenticate(req);
    if (!decoded) return res.status(401).json({ error: 'No token provided' });
    try {
      await initDB();
      const pool = getPool();
      await ensureSecurity(decoded.userId);

      const userAgent = req.headers['user-agent'] || 'Unknown';
      const sessionId = `${decoded.userId}-${Buffer.from(userAgent).toString('base64').slice(0, 16)}`;
      const device = /Mobile|Android|iPhone/i.test(userAgent) ? 'Mobile' : 'Desktop';
      const browser = userAgent.match(/(Chrome|Firefox|Safari|Edge|Opera)/i)?.[1] || 'Unknown';
      const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'Unknown';

      await pool.query(`
        INSERT INTO user_sessions (id, user_id, device, browser, ip_address, last_active)
        VALUES ($1, $2, $3, $4, $5, NOW())
        ON CONFLICT (id) DO UPDATE SET last_active = NOW(), ip_address = $5
      `, [sessionId, decoded.userId, device, browser, ip]);

      const secResult = await pool.query(
        `SELECT two_factor_enabled, two_factor_method, last_password_change FROM user_security WHERE user_id = $1`,
        [decoded.userId]
      );
      const sessResult = await pool.query(
        `SELECT id, device, browser, ip_address, last_active, created_at FROM user_sessions WHERE user_id = $1 ORDER BY last_active DESC LIMIT 10`,
        [decoded.userId]
      );

      const sec = secResult.rows[0] || {};
      return res.json({
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
    } catch (err) {
      console.error('Security fetch error:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // ─── POST /api/users/me/change-password ───
  if (path === 'me/change-password' && method === 'POST') {
    const decoded = authenticate(req);
    if (!decoded) return res.status(401).json({ error: 'No token provided' });
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const { newPassword } = body || {};
      if (!newPassword || newPassword.length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters' });
      }
      await initDB();
      const pool = getPool();
      await ensureSecurity(decoded.userId);
      await pool.query(`
        UPDATE user_security SET last_password_change = NOW(), updated_at = NOW() WHERE user_id = $1
      `, [decoded.userId]);
      return res.json({ success: true, message: 'Password updated' });
    } catch (err) {
      console.error('Password change error:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // ─── POST /api/users/me/2fa/setup ───
  if (path === 'me/2fa/setup' && method === 'POST') {
    const decoded = authenticate(req);
    if (!decoded) return res.status(401).json({ error: 'No token provided' });
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const tfMethod = body?.method || 'authenticator';
      await initDB();
      const pool = getPool();
      await ensureSecurity(decoded.userId);

      const secret = generateSecret();
      const otpauthUrl = totpKeyUri(decoded.email || decoded.wallet || decoded.userId, 'ZAI', secret);
      const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(otpauthUrl)}`;

      await pool.query(
        `UPDATE user_security SET two_factor_secret = $2, two_factor_method = $3, updated_at = NOW() WHERE user_id = $1`,
        [decoded.userId, secret, tfMethod]
      );

      return res.json({ success: true, secret, qrCodeUrl, otpauthUrl });
    } catch (err) {
      console.error('2FA setup error:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // ─── POST /api/users/me/2fa/verify ───
  if (path === 'me/2fa/verify' && method === 'POST') {
    const decoded = authenticate(req);
    if (!decoded) return res.status(401).json({ error: 'No token provided' });
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const { code } = body || {};
      if (!code || code.length !== 6) {
        return res.status(400).json({ error: 'Invalid verification code' });
      }
      await initDB();
      const pool = getPool();
      const secResult = await pool.query(
        `SELECT two_factor_secret, two_factor_method FROM user_security WHERE user_id = $1`,
        [decoded.userId]
      );
      const secRow = secResult.rows[0];
      if (!secRow?.two_factor_secret) {
        return res.status(400).json({ error: 'No 2FA setup found. Please run setup first.' });
      }

      const isValid = verifyTOTP(code, secRow.two_factor_secret);

      if (!isValid) {
        return res.status(400).json({ error: 'Invalid verification code' });
      }

      await pool.query(
        `UPDATE user_security SET two_factor_enabled = true, updated_at = NOW() WHERE user_id = $1`,
        [decoded.userId]
      );
      return res.json({ success: true, message: 'Two-factor authentication enabled' });
    } catch (err) {
      console.error('2FA verify error:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // ─── POST /api/users/me/2fa/disable ───
  if (path === 'me/2fa/disable' && method === 'POST') {
    const decoded = authenticate(req);
    if (!decoded) return res.status(401).json({ error: 'No token provided' });
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const { code } = body || {};
      if (!code || code.length !== 6) {
        return res.status(400).json({ error: 'Invalid verification code' });
      }
      await initDB();
      const pool = getPool();
      const secResult = await pool.query(
        `SELECT two_factor_secret FROM user_security WHERE user_id = $1`,
        [decoded.userId]
      );
      const secRow = secResult.rows[0];
      if (!secRow?.two_factor_secret) {
        return res.status(400).json({ error: '2FA is not enabled' });
      }

      const isValid = verifyTOTP(code, secRow.two_factor_secret);

      if (!isValid) {
        return res.status(400).json({ error: 'Invalid verification code' });
      }

      await pool.query(
        `UPDATE user_security SET two_factor_enabled = false, two_factor_secret = NULL, two_factor_method = 'none', updated_at = NOW() WHERE user_id = $1`,
        [decoded.userId]
      );
      return res.json({ success: true, message: 'Two-factor authentication disabled' });
    } catch (err) {
      console.error('2FA disable error:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // ─── GET /api/users/me/sessions ───
  if (path === 'me/sessions' && method === 'GET') {
    const decoded = authenticate(req);
    if (!decoded) return res.status(401).json({ error: 'No token provided' });
    try {
      await initDB();
      const pool = getPool();
      const userAgent = req.headers['user-agent'] || 'Unknown';
      const sessionId = `${decoded.userId}-${Buffer.from(userAgent).toString('base64').slice(0, 16)}`;
      const result = await pool.query(
        `SELECT id, device, browser, ip_address, last_active, created_at FROM user_sessions WHERE user_id = $1 ORDER BY last_active DESC`,
        [decoded.userId]
      );
      return res.json({
        success: true,
        sessions: result.rows.map(s => ({
          id: s.id,
          device: s.device,
          browser: s.browser,
          ipAddress: s.ip_address,
          lastActive: s.last_active,
          createdAt: s.created_at,
          isCurrent: s.id === sessionId,
        })),
      });
    } catch (err) {
      console.error('Sessions fetch error:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // ─── POST /api/users/me/sessions/revoke ───
  if (path === 'me/sessions/revoke' && method === 'POST') {
    const decoded = authenticate(req);
    if (!decoded) return res.status(401).json({ error: 'No token provided' });
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const { sessionId } = body || {};
      if (!sessionId) return res.status(400).json({ error: 'sessionId required' });
      await initDB();
      await getPool().query(
        `DELETE FROM user_sessions WHERE id = $1 AND user_id = $2`,
        [sessionId, decoded.userId]
      );
      return res.json({ success: true, message: 'Session revoked' });
    } catch (err) {
      console.error('Session revoke error:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

    // ─── GET /api/users/me/stats ───
  if (path === 'me/stats' && method === 'GET') {
    const decoded = authenticate(req);
    if (!decoded) return res.status(401).json({ error: 'No token provided' });
    try {
      await initDB();
      const pool = getPool();
      
      // Count claimed products from product_claims table
      const prodResult = await pool.query(
        'SELECT COUNT(*) as count FROM product_claims WHERE user_id = $1',
        [decoded.userId]
      );
      
      // Count event registrations from event_registrations table
      const evtResult = await pool.query(
        'SELECT COUNT(*) as count FROM event_registrations WHERE user_id = $1',
        [decoded.userId]
      );
      
      return res.json({
        success: true,
        stats: {
          productsClaimed: parseInt(prodResult.rows[0]?.count || '0'),
          eventsAttended: parseInt(evtResult.rows[0]?.count || '0'),
        },
      });
    } catch (err) {
      console.error('Stats fetch error:', err);
      return res.json({
        success: true,
        stats: { productsClaimed: 0, eventsAttended: 0 },
      });
    }
  }

  // ─── POST /api/users/me/sessions/revoke-all ───
  if (path === 'me/sessions/revoke-all' && method === 'POST') {
    const decoded = authenticate(req);
    if (!decoded) return res.status(401).json({ error: 'No token provided' });
    try {
      await initDB();
      const userAgent = req.headers['user-agent'] || 'Unknown';
      const currentSessionId = `${decoded.userId}-${Buffer.from(userAgent).toString('base64').slice(0, 16)}`;
      await getPool().query(
        `DELETE FROM user_sessions WHERE user_id = $1 AND id != $2`,
        [decoded.userId, currentSessionId]
      );
      return res.json({ success: true, message: 'All other sessions revoked' });
    } catch (err) {
      console.error('Revoke all error:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  return res.status(404).json({ error: 'Route not found' });
}
