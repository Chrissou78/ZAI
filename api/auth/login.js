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
    console.log('   URL:', exchangeUrl);
    console.log('   API Key:', process.env.WALLETTWO_API_KEY ? '***' : 'NOT SET');

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

    console.log('✅ Exchange successful:', exchangeResponse.data);

    const sessionToken = exchangeResponse.data.token || exchangeResponse.data.accessToken || exchangeResponse.data.session_token;
    
    if (!sessionToken) {
      console.error('❌ No session token in response');
      return res.status(400).json({ error: 'No session token in exchange response' });
    }

    const jwtToken = jwt.sign(
      { userId, wallet, wallettwoToken: sessionToken },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );

    console.log('📝 JWT created');

    res.status(200).json({
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
    console.error('   Status:', error.response?.status);
    console.error('   Data:', error.response?.data);
    res.status(500).json({ error: 'Login failed', message: error.message });
  }
}
