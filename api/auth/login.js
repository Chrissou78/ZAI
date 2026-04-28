const jwt = require('jsonwebtoken');
const axios = require('axios');

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Parse body if it's a string
    let body = req.body;
    if (typeof body === 'string') {
      body = JSON.parse(body);
    }

    const { token, wallet, userId } = body;

    console.log('✅ Login received:', { userId, wallet, token: token ? '***' : 'MISSING' });

    if (!token || !wallet || !userId) {
      console.error('❌ Missing required fields:', { token: !!token, wallet: !!wallet, userId: !!userId });
      return res.status(400).json({ error: 'Missing token, wallet, or userId' });
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
      process.env.JWT_SECRET || 'fallback-secret',
      { expiresIn: '7d' }
    );

    console.log('📝 JWT created');

    return res.status(200).json({
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
    console.error('❌ Error:', error.message);
    return res.status(500).json({ error: error.message });
  }
}
