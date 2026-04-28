const axios = require('axios');

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'No token provided' });
  }
  const token = authHeader.replace('Bearer ', '');
  req.user = { token };
  next();
}

export default async function handler(req, res) {
  authMiddleware(req, res, async () => {
    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
      const accessToken = req.user.token;
      const baseUrl = process.env.WALLETTWO_API_URL || 'https://api.wallettwo.com';
      const userInfoUrl = `${baseUrl}/auth/api/auth/get-session`;

      const response = await axios.get(userInfoUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      const userInfo = response.data || {};

      res.json({
        success: true,
        data: {
          firstName: userInfo.firstName || 'User',
          lastName: userInfo.lastName || '',
          email: userInfo.email || '',
          phone: userInfo.phone || '',
          verified: userInfo.verified || false,
          tier: 'member',
        },
      });
    } catch (error) {
      console.error('❌ Profile fetch error:', error.message);
      res.json({
        success: true,
        data: {
          firstName: 'User',
          lastName: '',
          email: '',
          phone: '',
          verified: false,
          tier: 'member',
        },
      });
    }
  });
}
