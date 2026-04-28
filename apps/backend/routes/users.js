const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');

// ============================================
// Get Current User
// ============================================
router.get('/me', authMiddleware, (req, res) => {
  try {
    res.json({
      success: true,
      user: req.user,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get user' });
  }
});

// ============================================
// Update User Profile
// ============================================
router.put('/me', authMiddleware, (req, res) => {
  try {
    const { firstName, lastName, email, phone } = req.body;

    // In production, save to database
    const updatedUser = {
      ...req.user,
      firstName: firstName || req.user.firstName,
      lastName: lastName || req.user.lastName,
      email: email || req.user.email,
      phone: phone || req.user.phone,
    };

    res.json({
      success: true,
      user: updatedUser,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// ============================================
// Get User by ID
// ============================================
router.get('/:userId', authMiddleware, (req, res) => {
  try {
    const { userId } = req.params;

    // In production, fetch from database
    res.json({
      success: true,
      user: {
        id: userId,
        firstName: 'User',
        lastName: '',
        email: '',
        tier: 'member',
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'User not found' });
  }
});

module.exports = router;
