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

    const { token } = body;

    if (!token) {
      return res.status(400).json({ error: 'Missing token' });
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

    console.log('✅ Exchange successful:', JSON.stringify(exchangeResponse.data, null, 2));

    const sessionToken = exchangeResponse.data.token || exchangeResponse.data.accessToken;
    const userId = exchangeResponse.data.userId || exchangeResponse.data.user?.id || exchangeResponse.data.session?.id;
    const walletAddress = exchangeResponse.data.wallet || exchangeResponse.data.address || 'unknown';

    if (!sessionToken || !userId) {
      console.error('❌ Missing sessionToken or userId in response');
      return res.status(400).json({ error: 'Invalid exchange response' });
    }

    // Fetch user profile from WalletTwo
    console.log('📥 Fetching user profile...');
    const profileUrl = `${baseUrl}/auth/api/auth/get-session`;
    const profileResponse = await axios.get(profileUrl, {
      headers: {
        'Authorization': `Bearer ${sessionToken}`,
        'Content-Type': 'application/json',
      },
    });

    console.log('✅ Profile received:', JSON.stringify(profileResponse.data, null, 2));

    const userProfile = profileResponse.data || {};

    const jwtToken = jwt.sign(
      { userId, wallet: walletAddress, wallettwoToken: sessionToken },
      process.env.JWT_SECRET || 'fallback-secret',
      { expiresIn: '7d' }
    );

    return res.status(200).json({
      success: true,
      jwtToken,
      user: {
        id: userId,
        walletAddress: userProfile.wallet || walletAddress,
        firstName: userProfile.firstName || userProfile.given_name || 'User',
        lastName: userProfile.lastName || userProfile.family_name || '',
        email: userProfile.email || '',
        phone: userProfile.phone || '',
        verified: userProfile.verified || false,
        tier: 'member',
      },
    });
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('   Response:', error.response?.data);
    return res.status(500).json({ error: error.message });
  }
}
