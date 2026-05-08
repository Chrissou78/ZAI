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

// Ensure user_profiles row exists (upsert from JWT data on first access)
async function ensureProfile(decoded) {
  const pool = getPool();
  const existing = await pool.query('SELECT user_id FROM user_profiles WHERE user_id = $1', [decoded.userId]);
  if (existing.rows.length === 0) {
    await pool.query(
      `INSERT INTO user_profiles (user_id, wallet, name, given_name, family_name, email, phone_number, address, city, country, postal_code, birthdate, is_public)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [
        decoded.userId, decoded.wallet || '',
        decoded.name || '', decoded.givenName || '', decoded.familyName || '',
        decoded.email || '', decoded.phoneNumber || '',
        decoded.address || '', decoded.city || '', decoded.country || '',
        decoded.postalCode || '', decoded.birthdate || null, decoded.isPublic || false,
      ]
    );
  }
}

// Ensure user_settings row exists
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
      return res.json({
        success: true,
        data: { userId: row.user_id, wallet: row.wallet },
      });
    } catch (err) {
      // Fallback to JWT data if DB not available
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
          id: row.user_id,
          userId: row.user_id,
          wallet: row.wallet,
          name: row.name,
          givenName: row.given_name,
          familyName: row.family_name,
          email: row.email,
          phoneNumber: row.phone_number,
          address: row.address,
          city: row.city,
          country: row.country,
          postalCode: row.postal_code,
          birthdate: row.birthdate,
          isPublic: row.is_public,
        },
      });
    } catch (err) {
      // Fallback to JWT
      return res.json({
        success: true,
        data: {
          id: decoded.userId, userId: decoded.userId, wallet: decoded.wallet,
          name: decoded.name || '', givenName: decoded.givenName || '',
          familyName: decoded.familyName || '', email: decoded.email || '',
          phoneNumber: decoded.phoneNumber || '', address: decoded.address || '',
          city: decoded.city || '', country: decoded.country || '',
          postalCode: decoded.postalCode || '', birthdate: decoded.birthdate || null,
          isPublic: decoded.isPublic || false,
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
      const updatableFields = ['name','givenName','familyName','email','phoneNumber','address','city','country','postalCode','birthdate','isPublic'];
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
           is_public=$12, updated_at=NOW()
         WHERE user_id=$1`,
        [
          decoded.userId,
          updatedUser.name, updatedUser.givenName, updatedUser.familyName,
          updatedUser.email, updatedUser.phoneNumber,
          updatedUser.address, updatedUser.city, updatedUser.country,
          updatedUser.postalCode, updatedUser.birthdate || null,
          updatedUser.isPublic || false,
        ]
      );

      const newToken = jwt.sign(
        {
          userId: decoded.userId, wallet: decoded.wallet, wallettwoToken: decoded.wallettwoToken,
          name: updatedUser.name, givenName: updatedUser.givenName, familyName: updatedUser.familyName,
          email: updatedUser.email, phoneNumber: updatedUser.phoneNumber, address: updatedUser.address,
          city: updatedUser.city, country: updatedUser.country, postalCode: updatedUser.postalCode,
          birthdate: updatedUser.birthdate, isPublic: updatedUser.isPublic,
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
        data: {
          notifications: row.notifications,
          privacy: row.privacy,
          card: row.card,
          region: row.region,
        },
      });
    } catch (err) {
      // Fallback: return defaults
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

      // Merge with existing settings
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

  return res.status(404).json({ error: 'Route not found' });
}
