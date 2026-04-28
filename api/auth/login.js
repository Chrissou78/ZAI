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
      console.error('❌ Missing fields:', { token: !!token, userId: !!userId, wallet: !!wallet });
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

    const sessionToken = exchangeResponse.data.session?.token;
    const sessionUserId = exchangeResponse.data.session?.id || userId;
    const userProfile = exchangeResponse.data.user || {};

    if (!sessionToken) {
      console.error('❌ Missing sessionToken');
      return res.status(400).json({ error: 'Invalid exchange response' });
    }

    console.log('✅ User profile extracted');

    const jwtToken = jwt.sign(
      { userId: sessionUserId, wallet, wallettwoToken: sessionToken },
      process.env.JWT_SECRET || 'fallback-secret',
      { expiresIn: '7d' }
    );

    return res.status(200).json({
      success: true,
      jwtToken,
      user: {
        id: sessionUserId,
        walletAddress: wallet,
        firstName: userProfile.givenName || userProfile.name?.split(' ')[0] || '',
        lastName: userProfile.familyName || '',
        email: userProfile.email || '',
        phone: userProfile.phoneNumber || '',
        address: userProfile.address || '',
        city: userProfile.city || '',
        country: userProfile.country || '',
        postalCode: userProfile.postalCode || '',
        verified: userProfile.emailVerified || false,
        tier: 'member',
      },
    });
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('   Status:', error.response?.status);
    console.error('   Data:', error.response?.data);
    return res.status(500).json({ error: error.message, details: error.response?.data });
  }
}
