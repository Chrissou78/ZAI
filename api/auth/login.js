const jwt = require('jsonwebtoken');
const axios = require('axios');

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { token, wallet, userId } = req.body;

    console.log('✅ Login received:', { userId, wallet });

    if (!token || !wallet) {
      return res.status(400).json({ error: 'Missing token or wallet' });
    }

    const baseUrl = process.env.WALLETTWO_API_URL || 'https://api.wallettwo.com';
    const exchangeUrl = `${baseUrl}/auth/api/auth/one-time-token/verify`;

    console.log('🔄 Exchanging token with WalletTwo...');

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

    console.log('✅ Exchange successful');

    const sessionToken = exchangeResponse.data.token || exchangeResponse.data.accessToken;
    const jwtToken = jwt.sign(
      { userId, wallet, wallettwoToken: sessionToken },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      jwtToken,
      user: {
        id: userId,
        walletAddress: wallet,
        firstName: 'User',
        lastName: '',
        email: '',
        phone: '',
        verified: false,
        tier: 'member',
      },
    });
  } catch (error) {
    console.error('❌ Login error:', error.message);
    res.status(500).json({ error: 'Login failed', message: error.message });
  }
}
