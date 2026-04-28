const jwt = require('jsonwebtoken');

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');

  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.replace('Bearer ', '');

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret');

    if (req.method === 'PUT') {
      const { 
        name,
        givenName, 
        familyName, 
        email, 
        phoneNumber, 
        address, 
        city, 
        country, 
        postalCode,
        birthdate,
        isPublic
      } = req.body;

      console.log('📝 Updating profile for user:', decoded.userId);

      return res.status(200).json({
        success: true,
        message: 'Profile updated successfully',
        user: { 
          ...decoded, 
          name,
          givenName, 
          familyName, 
          email, 
          phoneNumber, 
          address, 
          city, 
          country, 
          postalCode,
          birthdate,
          isPublic
        },
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('❌ Profile error:', error.message);
    return res.status(401).json({ error: 'Invalid token' });
  }
}
