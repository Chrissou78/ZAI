import jwt from 'jsonwebtoken';
import { getPool, initDB } from '../db.js';
import { createHmac, randomBytes } from 'crypto';
import { authenticate, applyRateLimit, signToken, sanitizeString, sanitizeObject, JWT_SECRET } from '../middleware.js';

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
    eventInvitations: true, membershipUpdates: true, productLaunches: false,
    partnerOffers: false, productUpdates: true, eventReminders: true,
  },
  privacy: {
    partnerDataSharing: true, analytics: false, profileVisibility: true, communityVisibility: false,
  },
  card: { nfcActive: true, autoLoginOnTap: true },
  region: { country: 'Switzerland', currency: 'CHF', language: 'English' },
};

// ── Removed local authenticate() — now imported from middleware.js ──

async function ensureProfile(decoded) {
  const pool = getPool();
  const existing = await pool.query('SELECT user_id FROM user_profiles WHERE user_id = $1', [decoded.userId]);
  if (existing.rows.length === 0) {
    await pool.query(
      `INSERT INTO user_profiles (user_id, wallet, name, given_name, family_name, email, phone_number, address, city, country, postal_code, birthdate, is_public, salutation, language)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
      [
        decoded.userId, decoded.wallet || '',
        sanitizeString(decoded.name || ''), sanitizeString(decoded.givenName || ''), sanitizeString(decoded.familyName || ''),
        decoded.email || '', decoded.phoneNumber || '',
        sanitizeString(decoded.address || ''), sanitizeString(decoded.city || ''), sanitizeString(decoded.country || ''),
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
          salutation: row.salutation, language: row.language, image: row.image || null,
          welcomeGiftSeen: row.welcome_gift_seen === true,
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
    if (applyRateLimit(req, res, 'users:profile', 20, 60_000)) return;
    const decoded = authenticate(req);
    if (!decoded) return res.status(401).json({ error: 'No token provided' });
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const sanitizedBody = sanitizeObject(body, ['name','givenName','familyName','address','city','country']);
      const updatableFields = ['name','givenName','familyName','email','phoneNumber','address','city','country','postalCode','birthdate','isPublic','salutation','language','image'];

      await initDB();
      await ensureProfile(decoded);

      // ── Merge omitted fields against the DB row, NOT the JWT ──
      // This UPDATE always writes all 14 columns, so whatever we resolve
      // here for an omitted field is what gets persisted. The JWT only
      // carries userId/wallet/name/givenName/familyName, so falling back to
      // it (the previous behaviour) resolved every other field to '' and
      // silently wiped the user's saved address/city/country/postalCode/
      // birthdate/phone/isPublic/salutation/image whenever a caller sent a
      // partial body. That is how changing the language in Settings — which
      // resends only the fields the client happens to hold — could blank out
      // a profile, and it's the same root cause behind two profile-picture
      // wipes fixed earlier. Reading current values first makes partial
      // updates safe for every caller instead of requiring each one to
      // remember to resend all 14 fields.
      const currentRow = (await getPool().query(
        'SELECT * FROM user_profiles WHERE user_id = $1', [decoded.userId]
      )).rows[0] || {};
      const COLUMN_FOR_FIELD = {
        name: 'name', givenName: 'given_name', familyName: 'family_name',
        email: 'email', phoneNumber: 'phone_number', address: 'address',
        city: 'city', country: 'country', postalCode: 'postal_code',
        birthdate: 'birthdate', isPublic: 'is_public', salutation: 'salutation',
        language: 'language', image: 'image',
      };

      const updatedUser = { id: decoded.userId, userId: decoded.userId, wallet: decoded.wallet };
      for (const field of updatableFields) {
        if (sanitizedBody[field] !== undefined) {
          updatedUser[field] = sanitizedBody[field];
        } else {
          const existing = currentRow[COLUMN_FOR_FIELD[field]];
          updatedUser[field] = existing !== undefined && existing !== null
            ? existing
            : (decoded[field] || '');
        }
      }

      await getPool().query(
        `UPDATE user_profiles SET
           name=$2, given_name=$3, family_name=$4, email=$5, phone_number=$6,
           address=$7, city=$8, country=$9, postal_code=$10, birthdate=$11,
           is_public=$12, salutation=$13, language=$14, image=$15, updated_at=NOW()
         WHERE user_id=$1`,
        [
          decoded.userId,
          updatedUser.name, updatedUser.givenName, updatedUser.familyName,
          updatedUser.email, updatedUser.phoneNumber,
          updatedUser.address, updatedUser.city, updatedUser.country,
          updatedUser.postalCode, updatedUser.birthdate || null,
          updatedUser.isPublic || false, parseInt(updatedUser.salutation) || 0,
          updatedUser.language || 'en', updatedUser.image ?? null,
        ]
      );

      const newToken = signToken(
        {
          userId: decoded.userId, wallet: decoded.wallet, wallettwoToken: decoded.wallettwoToken,
          name: updatedUser.name, givenName: updatedUser.givenName, familyName: updatedUser.familyName,
        },
        '1h'
      );

      return res.json({ success: true, message: 'Profile updated successfully', jwtToken: newToken, user: updatedUser });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // ─── POST /api/users/me/welcome-gift-seen ───
  // Marks the one-time welcome-gift modal as shown. Its own endpoint rather
  // than a field on PUT /me: that handler rewrites all 14 profile columns and
  // has already caused two field-wipe bugs, so a fire-and-forget UI flag has
  // no business going through it.
  if (path === 'me/welcome-gift-seen' && method === 'POST') {
    if (applyRateLimit(req, res, 'users:welcome-gift', 10, 60_000)) return;
    const decoded = authenticate(req);
    if (!decoded) return res.status(401).json({ error: 'No token provided' });
    try {
      await initDB();
      await ensureProfile(decoded);
      await getPool().query(
        'UPDATE user_profiles SET welcome_gift_seen = true, updated_at = NOW() WHERE user_id = $1',
        [decoded.userId]
      );
      return res.json({ success: true });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // ─── POST /api/users/me/avatar ───
  if (path === 'me/avatar' && method === 'POST') {
    if (applyRateLimit(req, res, 'users:avatar', 10, 60_000)) return;
    const decoded = authenticate(req);
    if (!decoded) return res.status(401).json({ error: 'No token provided' });
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const { image } = body || {};
      if (!image) return res.status(400).json({ success: false, error: 'Image is required (base64)' });

      const mimeMatch = image.match(/^data:(image\/[a-zA-Z]+);base64,/);
      const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
      const allowedTypes = ['image/jpeg', 'image/png', 'image/tiff'];
      if (!allowedTypes.includes(mimeType)) {
        return res.status(400).json({ success: false, error: 'Only JPG, PNG, and TIFF images are allowed' });
      }

      const base64Data = image.replace(/^data:image\/[a-zA-Z]+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');

      if (buffer.length > 5 * 1024 * 1024) return res.status(400).json({ success: false, error: 'Image must be under 5 MB' });

      if (!process.env.PINATA_JWT) {
        return res.status(500).json({ success: false, error: 'PINATA_JWT env variable is not set' });
      }

      const ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/tiff': 'tiff' }[mimeType];
      const boundary = '----PinataFormBoundary' + Date.now().toString(36);
      const fileName = `avatar-${decoded.userId}-${Date.now()}.${ext}`;
      const header = `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${fileName}"\r\nContent-Type: ${mimeType}\r\n\r\n`;
      const footer = `\r\n--${boundary}--\r\n`;

      const multipartBody = Buffer.concat([
        Buffer.from(header, 'utf-8'),
        buffer,
        Buffer.from(footer, 'utf-8'),
      ]);

      let pinataRes;
      try {
        pinataRes = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.PINATA_JWT}`,
            'Content-Type': `multipart/form-data; boundary=${boundary}`,
          },
          body: multipartBody,
        });
      } catch (fetchErr) {
        return res.status(500).json({ success: false, error: 'Pinata fetch failed', detail: fetchErr.message });
      }

      if (!pinataRes.ok) {
        const errText = await pinataRes.text().catch(() => 'could not read response');
        return res.status(500).json({
          success: false,
          error: 'Pinata rejected upload',
          pinataStatus: pinataRes.status,
          detail: errText,
        });
      }

      let pinataData;
      try {
        pinataData = await pinataRes.json();
      } catch (jsonErr) {
        return res.status(500).json({ success: false, error: 'Pinata response not JSON', detail: jsonErr.message });
      }

      const cid = pinataData.IpfsHash;
      if (!cid) {
        return res.status(500).json({ success: false, error: 'No CID returned', detail: JSON.stringify(pinataData) });
      }

      const gateway = process.env.PINATA_GATEWAY || 'gateway.pinata.cloud';
      const imageUrl = `https://${gateway}/ipfs/${cid}`;

      await initDB();
      await ensureProfile(decoded);
      await getPool().query(
        'UPDATE user_profiles SET image=$1, updated_at=NOW() WHERE user_id=$2',
        [imageUrl, decoded.userId]
      );

      return res.json({ success: true, data: { image: imageUrl } });
    } catch (err) {
      return res.status(500).json({ success: false, error: 'Unexpected error', detail: err.message });
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
        settings: { notifications: row.notifications, privacy: row.privacy, card: row.card, region: row.region },
      });
    } catch (err) {
      return res.json({ success: true, settings: DEFAULT_SETTINGS });
    }
  }

  // ─── PUT /api/users/me/settings ───
  if (path === 'me/settings' && method === 'PUT') {
    if (applyRateLimit(req, res, 'users:settings', 20, 60_000)) return;
    const decoded = authenticate(req);
    if (!decoded) return res.status(401).json({ error: 'No token provided' });
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      await initDB();
      await ensureProfile(decoded);
      await ensureSettings(decoded.userId);
      await getPool().query(
        `UPDATE user_settings SET notifications=$2, privacy=$3, card=$4, region=$5, updated_at=NOW() WHERE user_id=$1`,
        [decoded.userId, JSON.stringify(body.notifications || {}), JSON.stringify(body.privacy || {}), JSON.stringify(body.card || {}), JSON.stringify(body.region || {})]
      );
      return res.json({ success: true, message: 'Settings saved' });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // ─── GET /api/users/me/security ───
  if (path === 'me/security' && method === 'GET') {
    const decoded = authenticate(req);
    if (!decoded) return res.status(401).json({ error: 'No token provided' });
    try {
      await initDB();
      await ensureSecurity(decoded.userId);
      const secResult = await getPool().query('SELECT * FROM user_security WHERE user_id = $1', [decoded.userId]);
      const secRow = secResult.rows[0] || {};
      const sessResult = await getPool().query('SELECT * FROM user_sessions WHERE user_id = $1 ORDER BY last_active DESC', [decoded.userId]);
      return res.json({
        success: true,
        security: {
          twoFactorEnabled: secRow.two_factor_enabled || false,
          twoFactorMethod: secRow.two_factor_method || 'none',
          lastPasswordChange: secRow.last_password_change || null,
        },
        sessions: sessResult.rows.map(s => ({
          id: s.id, device: s.device, browser: s.browser, ipAddress: s.ip_address,
          lastActive: s.last_active, createdAt: s.created_at, isCurrent: false,
        })),
      });
    } catch (err) {
      return res.json({ success: true, security: { twoFactorEnabled: false, twoFactorMethod: 'none', lastPasswordChange: null }, sessions: [] });
    }
  }

  // ─── POST /api/users/me/2fa/setup ───
  if (path === 'me/2fa/setup' && method === 'POST') {
    const decoded = authenticate(req);
    if (!decoded) return res.status(401).json({ error: 'No token provided' });
    try {
      await initDB();
      await ensureSecurity(decoded.userId);
      const secret = generateSecret();
      await getPool().query(
        `UPDATE user_security SET two_factor_secret=$2, two_factor_method='authenticator', updated_at=NOW() WHERE user_id=$1`,
        [decoded.userId, secret]
      );
      const email = decoded.email || decoded.name || decoded.userId;
      const qrCodeUrl = totpKeyUri(email, 'ZAI Club', secret);
      return res.json({ success: true, secret, qrCodeUrl });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // ─── POST /api/users/me/2fa/verify ───
  if (path === 'me/2fa/verify' && method === 'POST') {
    const decoded = authenticate(req);
    if (!decoded) return res.status(401).json({ error: 'No token provided' });
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      await initDB();
      const secResult = await getPool().query('SELECT two_factor_secret FROM user_security WHERE user_id = $1', [decoded.userId]);
      const secret = secResult.rows[0]?.two_factor_secret;
      if (!secret) return res.status(400).json({ error: '2FA not set up' });
      if (!verifyTOTP(body.code, secret)) return res.status(400).json({ error: 'Invalid verification code' });
      await getPool().query(
        `UPDATE user_security SET two_factor_enabled=true, updated_at=NOW() WHERE user_id=$1`,
        [decoded.userId]
      );
      return res.json({ success: true, message: '2FA enabled successfully' });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // ─── POST /api/users/me/2fa/disable ───
  if (path === 'me/2fa/disable' && method === 'POST') {
    const decoded = authenticate(req);
    if (!decoded) return res.status(401).json({ error: 'No token provided' });
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      await initDB();
      const secResult = await getPool().query('SELECT two_factor_secret FROM user_security WHERE user_id = $1', [decoded.userId]);
      const secret = secResult.rows[0]?.two_factor_secret;
      if (!secret) return res.status(400).json({ error: '2FA not enabled' });
      if (!verifyTOTP(body.code, secret)) return res.status(400).json({ error: 'Invalid code' });
      await getPool().query(
        `UPDATE user_security SET two_factor_enabled=false, two_factor_method='none', two_factor_secret=NULL, updated_at=NOW() WHERE user_id=$1`,
        [decoded.userId]
      );
      return res.json({ success: true, message: '2FA disabled' });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // ─── POST /api/users/me/change-password ───
  if (path === 'me/change-password' && method === 'POST') {
    if (applyRateLimit(req, res, 'users:password', 5, 60_000)) return;
    const decoded = authenticate(req);
    if (!decoded) return res.status(401).json({ error: 'No token provided' });
    try {
      await initDB();
      await ensureSecurity(decoded.userId);
      await getPool().query(
        `UPDATE user_security SET last_password_change=NOW(), updated_at=NOW() WHERE user_id=$1`,
        [decoded.userId]
      );
      return res.json({ success: true, message: 'Password updated' });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(404).json({ error: 'Route not found' });
}
