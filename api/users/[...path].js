import jwt from 'jsonwebtoken';

export default async function handler(req, res) {
  const path = req.url.split('?')[0].replace('/api/users/', '').replace(/\/$/, '');

  // GET /api/users/profile
  if (path === 'profile' && req.method === 'GET') {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    try {
      const decoded = jwt.verify(
        authHeader.split(' ')[1],
        process.env.JWT_SECRET || 'fallback-secret'
      );

      return res.json({
        success: true,
        data: {
          userId: decoded.userId,
          wallet: decoded.wallet,
        },
      });
    } catch (err) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
  }

  // GET /api/users/me
  if (path === 'me' && req.method === 'GET') {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    try {
      const decoded = jwt.verify(
        authHeader.split(' ')[1],
        process.env.JWT_SECRET || 'fallback-secret'
      );

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
    } catch (err) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
  }

  // PUT /api/users/me
  if (path === 'me' && req.method === 'PUT') {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    try {
      const decoded = jwt.verify(
        authHeader.split(' ')[1],
        process.env.JWT_SECRET || 'fallback-secret'
      );

      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

      const updatableFields = [
        'name', 'givenName', 'familyName', 'email',
        'phoneNumber', 'address', 'city', 'country',
        'postalCode', 'birthdate', 'isPublic',
      ];

      const updatedUser = {
        id: decoded.userId,
        userId: decoded.userId,
        wallet: decoded.wallet,
      };

      for (const field of updatableFields) {
        updatedUser[field] = body[field] !== undefined ? body[field] : (decoded[field] || '');
      }

      const newToken = jwt.sign(
        {
          userId: decoded.userId,
          wallet: decoded.wallet,
          wallettwoToken: decoded.wallettwoToken,
          givenName: updatedUser.givenName,
          familyName: updatedUser.familyName,
          name: updatedUser.name,
          email: updatedUser.email,
          phoneNumber: updatedUser.phoneNumber,
          address: updatedUser.address,
          city: updatedUser.city,
          country: updatedUser.country,
          postalCode: updatedUser.postalCode,
          birthdate: updatedUser.birthdate,
          isPublic: updatedUser.isPublic,
        },
        process.env.JWT_SECRET || 'fallback-secret',
        { expiresIn: '7d' }
      );

      return res.json({
        success: true,
        message: 'Profile updated successfully',
        jwtToken: newToken,
        user: updatedUser,
      });
    } catch (err) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
  }

  return res.status(404).json({ error: 'Route not found' });
}
