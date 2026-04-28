const express = require('express');
const router = express.Router();
const axios = require('axios');
const jwt = require('jsonwebtoken');

// ============================================
// Login with WalletTwo
// ============================================
router.post('/login', async (req, res) => {
  try {
    const { token, wallet, userId } = req.body;

    if (!token || !wallet) {
      return res.status(400).json({ error: 'Missing token or wallet' });
    }

    console.log('✅ Login received:', { userId, wallet });
    console.log('📤 Exchanging token with WalletTwo...');

    const baseUrl = process.env.WALLETTWO_API_URL || 'https://api.wallettwo.com';
    const authUrl = `${baseUrl}/auth`;
    const exchangeUrl = `${authUrl}/api/auth/one-time-token/verify`;

    const exchangeResponse = await axios.post(exchangeUrl, {
      token: token,
    });

    console.log('📥 Exchange response received');

    const sessionToken = exchangeResponse.data?.session?.token;
    const userData = exchangeResponse.data?.user;

    if (!sessionToken || !userData) {
      console.error('❌ Missing session token or user data');
      return res.status(400).json({ error: 'Failed to exchange token' });
    }

    console.log('✅ Got session token and user data');
    console.log('👤 User:', userData.email);

    const jwtToken = jwt.sign(
      { 
        userId: userData.id, 
        wallet: userData.wallet, 
        token: sessionToken,
        wallettwoToken: sessionToken,
        email: userData.email,
        name: userData.name,
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      jwtToken: jwtToken,
      user: {
        id: userData.id,
        walletAddress: userData.wallet,  // Add this
        wallet: userData.wallet,          // Keep this too
        firstName: userData.givenName || userData.name?.split(' ')[0] || 'User',
        lastName: userData.familyName || userData.name?.split(' ')[1] || '',
        email: userData.email || '',
        phone: userData.phoneNumber || '',
        verified: userData.emailVerified || false,
        tier: 'member',
        address: userData.address,
        city: userData.city,
        country: userData.country,
        postalCode: userData.postalCode,
      },
    });
  } catch (error) {
    console.error('❌ Login error:', error.message);
    console.error('Response:', error.response?.data);
    res.status(500).json({ error: 'Login failed', message: error.message });
  }
});

// ============================================
// Logout
// ============================================
router.post('/logout', (req, res) => {
  console.log('🚪 User logged out');
  res.json({ success: true });
});

// ============================================
// Verify Token
// ============================================
router.post('/verify', (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    res.json({ success: true, user: decoded });
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

module.exports = router;
