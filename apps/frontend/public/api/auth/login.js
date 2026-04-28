export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { token, wallet, userId } = req.body;
    const jwt = require('jsonwebtoken');
    const axios = require('axios');

    const baseUrl = process.env.WALLETTWO_API_URL || 'https://api.wallettwo.com';
    const exchangeUrl = `${baseUrl}/auth/api/auth/one-time-token/verify`;

    const exchangeResponse = await axios.post(
      exchangeUrl,
      { token },
      {
        headers: {
          'Authorization': `Bearer ${process.env.WALLETTWO_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const sessionToken = exchangeResponse.data.token || exchangeResponse.data.accessToken;
    const jwtToken = jwt.sign(
      { userId, wallet, wallettwoToken: sessionToken },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      jwtToken,
      user: { id: userId, walletAddress: wallet, firstName: 'User', tier: 'member' },
    });
  } catch (error) {
    res.status(500).json({ error: 'Login failed', message: error.message });
  }
}
