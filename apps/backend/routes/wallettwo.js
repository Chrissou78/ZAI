const express = require('express');
const router = express.Router();
const axios = require('axios');
const authMiddleware = require('../middleware/auth');

// ============================================
// Get User Info from WalletTwo
// ============================================
router.get('/profile', authMiddleware, async (req, res) => {
  try {
    const accessToken = req.user.wallettwoToken || req.user.token;

    console.log('📥 Fetching user info from WalletTwo...');

    if (!accessToken) {
      console.error('❌ No access token');
      return res.status(401).json({ error: 'No access token' });
    }

    const baseUrl = process.env.WALLETTWO_API_URL || 'https://api.wallettwo.com';
    const authUrl = `${baseUrl}/auth`;
    const userInfoUrl = `${authUrl}/api/auth/get-session`;

    console.log('🔗 URL:', userInfoUrl);

    const response = await axios.get(userInfoUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    console.log('✅ User info received:', JSON.stringify(response.data, null, 2));

    const userInfo = response.data || {};

    res.json({
      success: true,
      data: {
        id: req.user.userId,
        walletAddress: req.user.wallet,
        firstName: userInfo.firstName || userInfo.given_name || 'User',
        lastName: userInfo.lastName || userInfo.family_name || '',
        email: userInfo.email || '',
        phone: userInfo.phone || '',
        verified: userInfo.verified || false,
        tier: 'member',
      },
    });
  } catch (error) {
    console.error('❌ Profile fetch error:', error.message);
    
    // Return basic user data on error
    res.json({
      success: true,
      data: {
        id: req.user.userId,
        walletAddress: req.user.wallet,
        firstName: 'User',
        lastName: '',
        email: '',
        phone: '',
        verified: false,
        tier: 'member',
      },
    });
  }
});

// ============================================
// Exchange WalletTwo Token
// ============================================
router.post('/exchange', async (req, res) => {
  try {
    const { code } = req.body;

    console.log('🔄 Exchanging WalletTwo token...');

    if (!code) {
      console.error('❌ No code provided');
      return res.status(400).json({ error: 'No code provided' });
    }

    const baseUrl = process.env.WALLETTWO_API_URL || 'https://api.wallettwo.com';
    const exchangeUrl = `${baseUrl}/auth/api/auth/one-time-token/verify`;

    console.log('🔗 Exchange URL:', exchangeUrl);
    console.log('🔑 Using API Key:', process.env.WALLETTWO_API_KEY ? '***' : 'NOT SET');

    const response = await axios.post(
      exchangeUrl,
      { token: code },
      {
        headers: {
          'Authorization': `Bearer ${process.env.WALLETTWO_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('✅ Exchange successful:', JSON.stringify(response.data, null, 2));

    res.json({
      success: true,
      data: response.data,
    });
  } catch (error) {
    console.error('❌ Exchange error:', error.message);
    console.error('   Status:', error.response?.status);
    console.error('   Data:', JSON.stringify(error.response?.data, null, 2));
    res.status(500).json({ error: 'Exchange failed', message: error.message });
  }
});

module.exports = router;
