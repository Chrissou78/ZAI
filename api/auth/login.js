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

    // Exchange token for session
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

    console.log('✅ Exchange successful:', JSON.stringify(exchangeResponse.data, null, 2));

    const sessionToken = exchangeResponse.data.session?.token;
    const sessionUserId = exchangeResponse.data.session?.id || userId;

    if (!sessionToken) {
      console.error('❌ Missing sessionToken in exchange response');
      return res.status(400).json({ error: 'Invalid exchange response' });
    }

    console.log('📥 Fetching user profile with sessionToken...');

    // Call your own profile endpoint with the session token
    const profileResponse = await axios.get(
      `${process.env.VERCEL_URL || 'https://zai-chi.vercel.app'}/api/auth/wallettwo/profile`,
      {
        headers: {
          'Authorization': `Bearer ${sessionToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('✅ Profile response:', JSON.stringify(profileResponse.data, null, 2));

    const userProfile = profileResponse.data?.data || {};

    // Sign JWT
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
        firstName: userProfile.firstName || 'User',
        lastName: userProfile.lastName || '',
        email: userProfile.email || '',
        phone: userProfile.phone || '',
        verified: userProfile.verified || false,
        tier: userProfile.tier || 'member',
      },
    });
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('   Response:', error.response?.data);
    return res.status(500).json({ error: error.message });
  }
}
