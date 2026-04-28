const jwt = require('jsonwebtoken');
const axios = require('axios');

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      body = JSON.parse(body);
    }

    const { token, userId, wallet } = body;

    if (!token || !userId || !wallet) {
      return res.status(400).json({ error: 'Missing token, userId, or wallet' });
    }

    console.log('🔄 Exchanging WalletTwo token...');

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

    console.log('✅ Exchange successful');

    // Extract from nested structure
    const sessionToken = exchangeResponse.data.session?.token;
    const userInfo = exchangeResponse.data.user || {};
    const sessionUserId = exchangeResponse.data.session?.userId || userId;

    if (!sessionToken) {
      console.error('❌ No session token in response');
      return res.status(400).json({ error: 'No session token in response' });
    }

    const jwtToken = jwt.sign(
      { userId: sessionUserId, wallet, wallettwoToken: sessionToken },
      process.env.JWT_SECRET || 'fallback-secret',
      { expiresIn: '7d' }
    );

    console.log('✅ Login successful, JWT created');

    return res.status(200).json({
      success: true,
      jwtToken,
      user: {
        id: sessionUserId,
        walletAddress: userInfo.wallet || wallet,
        firstName: userInfo.givenName || userInfo.name?.split('.')[0] || 'User',
        lastName: userInfo.familyName || '',
        email: userInfo.email || '',
        phone: userInfo.phoneNumber || '',
        verified: userInfo.emailVerified || false,
        tier: 'member',
      },
    });
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('   Response:', error.response?.data);
    return res.status(500).json({ error: error.message });
  }
}
