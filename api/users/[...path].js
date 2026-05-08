import jwt from 'jsonwebtoken';

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
  if (!authHeader?.startsWith('Bearer '))  return null;
  try {
    return jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET || 'fallback-secret');
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  const path = req.url.split('?')[0].replace('/api/users/', '').replace(/\/$/, '');

  // ─── GET /api/users/profile ───
  if (path === 'profile' && req.method === 'GET') {
    const decoded = authenticate(req);
    if (!decoded) return res.status(401).json({ error: 'No token provided' });
    return res.json({ success: true, data: { userId: decoded.userId, wallet: decoded.wallet } });
  }

  // ─── GET /api/users/me ───
  if (path === 'me' && req.method === 'GET') {
    const decoded = authenticate(req);
    if (!decoded) return res.status(401).json({ error: 'No token provided' });
    return res.json({
      success: true,
      data: {
        id: decoded.userId,
        userId: decoded.userId,
        wallet: decoded.wallet,
        name: decoded.name || '',
        givenName: decoded.givenName || '',
        familyName: decoded.familyName || '',
        email: decoded.email || '',
        phoneNumber: decoded.phoneNumber || '',
        address: decoded.address || '',
        city: decoded.city || '',
        country: decoded.country || '',
        postalCode: decoded.postalCode || '',
        birthdate: decoded.birthdate || null,
        isPublic: decoded.isPublic || false,
      },
    });
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
      const newToken = jwt.sign(
        {
          userId: decoded.userId, wallet: decoded.wallet, wallettwoToken: decoded.wallettwoToken,
          name: updatedUser.name, givenName: updatedUser.givenName, familyName: updatedUser.familyName,
          email: updatedUser.email, phoneNumber: updatedUser.phoneNumber, address: updatedUser.address,
          city: updatedUser.city, country: updatedUser.country, postalCode: updatedUser.postalCode,
          birthdate: updatedUser.birthdate, isPublic: updatedUser.isPublic,
          settings: decoded.settings || DEFAULT_SETTINGS,
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
    // Settings are stored inside the JWT; return them or defaults
    const settings = decoded.settings || DEFAULT_SETTINGS;
    return res.json({ success: true, data: settings });
  }

  // ─── PUT /api/users/me/settings ───
  if (path === 'me/settings' && req.method === 'PUT') {
    const decoded = authenticate(req);
    if (!decoded) return res.status(401).json({ error: 'No token provided' });
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const currentSettings = decoded.settings || DEFAULT_SETTINGS;
      const updatedSettings = {
        notifications: { ...currentSettings.notifications, ...(body.notifications || {}) },
        privacy: { ...currentSettings.privacy, ...(body.privacy || {}) },
        card: { ...currentSettings.card, ...(body.card || {}) },
        region: { ...currentSettings.region, ...(body.region || {}) },
      };

      // Re-sign JWT with settings embedded
      const newToken = jwt.sign(
        {
          userId: decoded.userId, wallet: decoded.wallet, wallettwoToken: decoded.wallettwoToken,
          name: decoded.name, givenName: decoded.givenName, familyName: decoded.familyName,
          email: decoded.email, phoneNumber: decoded.phoneNumber, address: decoded.address,
          city: decoded.city, country: decoded.country, postalCode: decoded.postalCode,
          birthdate: decoded.birthdate, isPublic: decoded.isPublic,
          settings: updatedSettings,
        },
        process.env.JWT_SECRET || 'fallback-secret',
        { expiresIn: '7d' }
      );

      return res.json({ success: true, message: 'Settings saved', jwtToken: newToken, data: updatedSettings });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // ─── POST /api/users/me/request-card-replacement ───
  if (path === 'me/request-card-replacement' && req.method === 'POST') {
    const decoded = authenticate(req);
    if (!decoded) return res.status(401).json({ error: 'No token provided' });
    // Placeholder — log and acknowledge
    console.log(`Card replacement requested by ${decoded.userId}`);
    return res.json({ success: true, message: 'Card replacement request submitted' });
  }

  return res.status(404).json({ error: 'Route not found' });
}
