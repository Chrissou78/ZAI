const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const axios = require('axios');

// ============================================
// Login with WalletTwo
// ============================================
router.post('/login', async (req, res) => {
  try {
    const { token, wallet, userId } = req.body;

    console.log('✅ Login received:', { userId, wallet });

    if (!token || !wallet) {
      return res.status(400).json({ error: 'Missing token or wallet' });
    }

    // Exchange the WalletTwo code for a session token
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

    console.log('✅ Exchange successful:', JSON.stringify(exchangeResponse.data, null, 2));

    const sessionToken = exchangeResponse.data.token || exchangeResponse.data.accessToken;

    // Create JWT token for the app
    const jwtToken = jwt.sign(
      { userId, wallet, wallettwoToken: sessionToken },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    console.log('📝 JWT created for user:', userId);

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
    console.error('   Status:', error.response?.status);
    console.error('   Data:', JSON.stringify(error.response?.data, null, 2));
    res.status(500).json({ error: 'Login failed', message: error.message });
  }
});

// ============================================
// Logout
// ============================================
router.post('/logout', (req, res) => {
  console.log('👋 Logout request');
  res.json({ success: true, message: 'Logged out' });
});

// ============================================
// Verify Token
// ============================================
router.post('/verify', (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.replace('Bearer ', '');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    res.json({ success: true, user: decoded });
  } catch (error) {
    console.error('❌ Token verification error:', error.message);
    res.status(401).json({ error: 'Invalid token' });
  }
});

module.exports = router;
