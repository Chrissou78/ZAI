const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const engageAPI = require('../services/engageAPI');

// ============================================
// Get Events
// ============================================
router.get('/', async (req, res) => {
  try {
    const { status = 'upcoming' } = req.query;
    const events = await engageAPI.getEvents(status);
    
    res.json({
      success: true,
      data: events
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// Register for Event
// ============================================
router.post('/:eventId/register', authMiddleware, async (req, res) => {
  try {
    const { eventId } = req.params;
    const userId = req.user.userId;

    const registration = await engageAPI.registerEvent(userId, eventId);
    
    res.json({
      success: true,
      message: 'Registered successfully',
      data: registration
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;