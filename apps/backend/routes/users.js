const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const engageAPI = require('../services/engageAPI');

// ============================================
// Get Current User
// ============================================
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await engageAPI.getUser(req.user.userId);
    
    if (!user) {
      return res.json({ success: true, user: req.user });
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        givenName: user.givenName,
        familyName: user.familyName,
        email: user.email,
        phoneNumber: user.phoneNumber,
        address: user.address,
        city: user.city,
        country: user.country,
        postalCode: user.postalCode,
        birthdate: user.birthdate,
        isPublic: user.isPublic,
        role: user.role,
        walletAddress: user.wallet,
        createdAt: user.createdAt,
        emailVerified: user.emailVerified,
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get user' });
  }
});

// ============================================
// Update User Profile
// ============================================
router.put('/me', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const updateData = req.body;

    const updatedUser = await engageAPI.updateUser(userId, updateData);

    res.json({
      success: true,
      user: updatedUser,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// ============================================
// Get User Settings
// ============================================
router.get('/me/settings', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;

    // TODO: Fetch settings from Engage or a settings store
    // For now return defaults
    res.json({
      success: true,
      data: {
        notifications: {
          eventInvitations: true,
          membershipUpdates: true,
          productLaunches: false,
          partnerOffers: false,
          productUpdates: true,
          eventReminders: true,
        },
        privacy: {
          partnerDataSharing: true,
          analytics: false,
          profileVisibility: true,
          communityVisibility: false,
        },
        card: {
          nfcActive: true,
          autoLoginOnTap: true,
        },
        region: {
          country: 'Switzerland',
          currency: 'CHF',
          language: 'English',
        },
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to load settings' });
  }
});

// ============================================
// Update User Settings
// ============================================
router.put('/me/settings', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { notifications, privacy, card, region } = req.body;

    // TODO: Save settings to Engage or a settings store
    console.log('Saving settings for user:', userId, req.body);

    res.json({
      success: true,
      message: 'Settings saved',
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to save settings' });
  }
});

// ============================================
// Request Card Replacement
// ============================================
router.post('/me/request-card-replacement', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;

    // TODO: Create card replacement request in Engage or support system
    console.log('Card replacement requested for user:', userId);

    res.json({
      success: true,
      message: 'Card replacement request submitted',
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to request card replacement' });
  }
});

// ============================================
// Get User by ID
// ============================================
router.get('/:userId', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await engageAPI.getUser(userId);

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        givenName: user.givenName,
        familyName: user.familyName,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'User not found' });
  }
});

// ============================================
// Get User Products
// ============================================
router.get('/:userId/products', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (req.user.userId !== userId) {
      return res.status(403).json({ success: false, error: 'Unauthorized' });
    }

    const products = await engageAPI.getUserProducts(userId);
    
    res.json({
      success: true,
      data: products,
      stats: {
        total: products.length,
        withInsurance: products.filter(p => p.insurance?.active).length
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// Claim Product
// ============================================
router.post('/:userId/products/claim', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;
    const { serialNumber } = req.body;

    if (req.user.userId !== userId) {
      return res.status(403).json({ success: false, error: 'Unauthorized' });
    }

    const claimed = await engageAPI.claimProduct(userId, serialNumber);
    
    res.json({
      success: true,
      message: 'Product claimed successfully',
      data: claimed
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;