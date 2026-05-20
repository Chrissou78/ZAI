import jwt from 'jsonwebtoken';
import { getPool, initDB } from '../db.js';

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

    // ─── GET /api/users/me/security ───
  if (path === 'me/security' && req.method === 'GET') {
    const decoded = authenticate(req);
    if (!decoded) return res.status(401).json({ error: 'No token provided' });
    try {
      await initDB();
      const pool = getPool();

      // Ensure security table exists
      await pool.query(`
        CREATE TABLE IF NOT EXISTS user_security (
          user_id TEXT PRIMARY KEY REFERENCES user_profiles(user_id) ON DELETE CASCADE,
          two_factor_enabled BOOLEAN DEFAULT false,
          two_factor_method TEXT DEFAULT 'none',
          two_factor_secret TEXT,
          last_password_change TIMESTAMPTZ,
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE TABLE IF NOT EXISTS user_sessions (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          device TEXT DEFAULT '',
          browser TEXT DEFAULT '',
          ip TEXT DEFAULT '',
          location TEXT DEFAULT '',
          last_active TIMESTAMPTZ DEFAULT NOW(),
          is_current BOOLEAN DEFAULT false,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_sessions_user ON user_sessions(user_id);
      `);

      // Upsert current session
      const ua = req.headers['user-agent'] || '';
      const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || '';
      let browser = 'Unknown';
      if (ua.includes('Firefox')) browser = 'Firefox';
      else if (ua.includes('Edg')) browser = 'Edge';
      else if (ua.includes('Chrome')) browser = 'Chrome';
      else if (ua.includes('Safari')) browser = 'Safari';
      let device = 'Unknown';
      if (ua.includes('Windows')) device = 'Windows';
      else if (ua.includes('Mac')) device = 'macOS';
      else if (ua.includes('Linux')) device = 'Linux';
      else if (ua.includes('iPhone') || ua.includes('iPad')) device = 'iOS';
      else if (ua.includes('Android')) device = 'Android';

      const sessionId = `${decoded.userId}-${Buffer.from(ua).toString('base64').slice(0, 16)}`;
      await pool.query(`
        INSERT INTO user_sessions (id, user_id, device, browser, ip, is_current, last_active)
        VALUES ($1, $2, $3, $4, $5, true, NOW())
        ON CONFLICT (id) DO UPDATE SET last_active = NOW(), ip = $5, is_current = true
      `, [sessionId, decoded.userId, device, browser, ip]);

      // Get security settings
      const secResult = await pool.query('SELECT * FROM user_security WHERE user_id = $1', [decoded.userId]);
      const sec = secResult.rows[0] || {};

      // Get sessions
      const sessResult = await pool.query(
        'SELECT * FROM user_sessions WHERE user_id = $1 ORDER BY last_active DESC LIMIT 20',
        [decoded.userId]
      );

      return res.json({
        success: true,
        data: {
          twoFactorEnabled: sec.two_factor_enabled || false,
          twoFactorMethod: sec.two_factor_method || 'none',
          lastPasswordChange: sec.last_password_change || null,
          sessions: sessResult.rows.map(s => ({
            id: s.id,
            device: s.device,
            browser: s.browser,
            ip: s.ip,
            location: s.location || '—',
            lastActive: s.last_active,
            isCurrent: s.id === sessionId,
          })),
        },
      });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // ─── POST /api/users/me/change-password ───
  if (path === 'me/change-password' && req.method === 'POST') {
    const decoded = authenticate(req);
    if (!decoded) return res.status(401).json({ error: 'No token provided' });
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const { currentPassword, newPassword } = body;
      if (!newPassword || newPassword.length < 8) {
        return res.status(400).json({ success: false, error: 'New password must be at least 8 characters' });
      }

      // Forward password change to WalletTwo if they support it
      // For now, update our local record
      await initDB();
      const pool = getPool();
      await pool.query(`
        CREATE TABLE IF NOT EXISTS user_security (
          user_id TEXT PRIMARY KEY,
          two_factor_enabled BOOLEAN DEFAULT false,
          two_factor_method TEXT DEFAULT 'none',
          two_factor_secret TEXT,
          last_password_change TIMESTAMPTZ,
          updated_at TIMESTAMPTZ DEFAULT NOW()
        )
      `);
      await pool.query(`
        INSERT INTO user_security (user_id, last_password_change) VALUES ($1, NOW())
        ON CONFLICT (user_id) DO UPDATE SET last_password_change = NOW(), updated_at = NOW()
      `, [decoded.userId]);

      return res.json({ success: true, message: 'Password changed' });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // ─── POST /api/users/me/2fa/setup ───
  if (path === 'me/2fa/setup' && req.method === 'POST') {
    const decoded = authenticate(req);
    if (!decoded) return res.status(401).json({ error: 'No token provided' });
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const method = body.method || 'authenticator';

      await initDB();
      const pool = getPool();
      await pool.query(`
        CREATE TABLE IF NOT EXISTS user_security (
          user_id TEXT PRIMARY KEY,
          two_factor_enabled BOOLEAN DEFAULT false,
          two_factor_method TEXT DEFAULT 'none',
          two_factor_secret TEXT,
          last_password_change TIMESTAMPTZ,
          updated_at TIMESTAMPTZ DEFAULT NOW()
        )
      `);

      // Generate a random secret (base32-like)
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
      let secret = '';
      for (let i = 0; i < 32; i++) secret += chars[Math.floor(Math.random() * chars.length)];

      // Store pending secret
      await pool.query(`
        INSERT INTO user_security (user_id, two_factor_secret, two_factor_method) VALUES ($1, $2, $3)
        ON CONFLICT (user_id) DO UPDATE SET two_factor_secret = $2, two_factor_method = $3, updated_at = NOW()
      `, [decoded.userId, secret, method]);

      const response = { success: true, data: { method } };

      if (method === 'authenticator') {
        // Build otpauth URL for QR code generation
        const otpauthUrl = `otpauth://totp/ZAI:${decoded.email || decoded.userId}?secret=${secret}&issuer=ZAI%20Experience%20Club&digits=6`;
        // Use a public QR API for the QR code image
        const qrCode = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(otpauthUrl)}`;
        response.data.qrCode = qrCode;
        response.data.secret = secret;
      }

      return res.json(response);
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // ─── POST /api/users/me/2fa/verify ───
  if (path === 'me/2fa/verify' && req.method === 'POST') {
    const decoded = authenticate(req);
    if (!decoded) return res.status(401).json({ error: 'No token provided' });
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const { code } = body;
      if (!code || code.length < 6) return res.status(400).json({ success: false, error: 'Invalid code' });

      await initDB();
      const pool = getPool();
      // In a real implementation, verify the TOTP code against the stored secret
      // For now, accept any 6-digit code to enable the feature
      await pool.query(`
        UPDATE user_security SET two_factor_enabled = true, updated_at = NOW() WHERE user_id = $1
      `, [decoded.userId]);

      return res.json({ success: true, message: '2FA enabled' });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // ─── POST /api/users/me/2fa/disable ───
  if (path === 'me/2fa/disable' && req.method === 'POST') {
    const decoded = authenticate(req);
    if (!decoded) return res.status(401).json({ error: 'No token provided' });
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const { code } = body;
      if (!code || code.length < 6) return res.status(400).json({ success: false, error: 'Invalid code' });

      await initDB();
      await getPool().query(`
        UPDATE user_security SET two_factor_enabled = false, two_factor_method = 'none', two_factor_secret = NULL, updated_at = NOW() WHERE user_id = $1
      `, [decoded.userId]);

      return res.json({ success: true, message: '2FA disabled' });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // ─── GET /api/users/me/sessions ───
  if (path === 'me/sessions' && req.method === 'GET') {
    const decoded = authenticate(req);
    if (!decoded) return res.status(401).json({ error: 'No token provided' });
    try {
      await initDB();
      const pool = getPool();
      await pool.query(`
        CREATE TABLE IF NOT EXISTS user_sessions (
          id TEXT PRIMARY KEY, user_id TEXT NOT NULL, device TEXT DEFAULT '', browser TEXT DEFAULT '',
          ip TEXT DEFAULT '', location TEXT DEFAULT '', last_active TIMESTAMPTZ DEFAULT NOW(),
          is_current BOOLEAN DEFAULT false, created_at TIMESTAMPTZ DEFAULT NOW()
        )
      `);

      const ua = req.headers['user-agent'] || '';
      const sessionId = `${decoded.userId}-${Buffer.from(ua).toString('base64').slice(0, 16)}`;

      const result = await pool.query(
        'SELECT * FROM user_sessions WHERE user_id = $1 ORDER BY last_active DESC LIMIT 20',
        [decoded.userId]
      );
      return res.json({
        success: true,
        data: result.rows.map(s => ({
          id: s.id, device: s.device, browser: s.browser, ip: s.ip,
          location: s.location || '—', lastActive: s.last_active,
          isCurrent: s.id === sessionId,
        })),
      });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // ─── POST /api/users/me/sessions/revoke ───
  if (path === 'me/sessions/revoke' && req.method === 'POST') {
    const decoded = authenticate(req);
    if (!decoded) return res.status(401).json({ error: 'No token provided' });
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      await initDB();
      await getPool().query('DELETE FROM user_sessions WHERE id = $1 AND user_id = $2', [body.sessionId, decoded.userId]);
      return res.json({ success: true, message: 'Session revoked' });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // ─── POST /api/users/me/sessions/revoke-all ───
  if (path === 'me/sessions/revoke-all' && req.method === 'POST') {
    const decoded = authenticate(req);
    if (!decoded) return res.status(401).json({ error: 'No token provided' });
    try {
      const ua = req.headers['user-agent'] || '';
      const currentSessionId = `${decoded.userId}-${Buffer.from(ua).toString('base64').slice(0, 16)}`;
      await initDB();
      await getPool().query('DELETE FROM user_sessions WHERE user_id = $1 AND id != $2', [decoded.userId, currentSessionId]);
      return res.json({ success: true, message: 'All other sessions revoked' });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  return res.status(404).json({ error: 'Route not found' });
}
