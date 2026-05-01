const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/auth');
const engageAPI = require('../services/engageAPI');

/**
 * GET /api/community/members
 */
router.get('/members', async (req, res) => {
  try {
    const { limit = 50, offset = 0, search } = req.query;
    const parsedLimit = Math.min(parseInt(limit) || 50, 100);
    const parsedOffset = parseInt(offset) || 0;

    const members = await engageAPI.getUsers(parsedLimit, parsedOffset, search);

    const transformedMembers = members.map(member => ({
      id: member.id,
      name: member.firstName && member.lastName 
        ? `${member.firstName} ${member.lastName}` 
        : member.name || 'User',
      avatar: generateAvatar(member.firstName, member.lastName),
      handle: member.handle || generateHandle(member.firstName, member.lastName),
      location: member.location || 'Unknown',
      joinedAt: member.createdAt,
      tier: member.tier || 'member',
      productsCount: member.products?.length || 0,
      eventsAttended: member.eventsAttended || 0
    }));

    res.json({
      success: true,
      data: transformedMembers,
      pagination: {
        limit: parsedLimit,
        offset: parsedOffset,
        total: transformedMembers.length,
        hasMore: transformedMembers.length === parsedLimit
      }
    });
  } catch (error) {
    console.error('Error in /members:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/community/members/:memberId
 */
router.get('/members/:memberId', async (req, res) => {
  try {
    const { memberId } = req.params;

    const member = await engageAPI.getUser(memberId);

    if (!member) {
      return res.status(404).json({ success: false, error: 'Member not found' });
    }

    res.json({
      success: true,
      data: {
        id: member.id,
        name: member.firstName && member.lastName 
          ? `${member.firstName} ${member.lastName}` 
          : member.name,
        avatar: generateAvatar(member.firstName, member.lastName),
        handle: member.handle || generateHandle(member.firstName, member.lastName),
        location: member.location,
        bio: member.bio || '',
        joinedAt: member.createdAt,
        tier: member.tier,
        products: member.products || [],
        eventsAttended: member.eventsAttended || 0,
        whatsapp: member.whatsappSubscribed || false
      }
    });
  } catch (error) {
    console.error('Error in /members/:memberId:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/community/feed
 */
router.get('/feed', async (req, res) => {
  try {
    const { limit = 30, offset = 0 } = req.query;

    // For now, return empty feed since Instagram integration needs separate setup
    res.json({
      success: true,
      data: [],
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: false
      }
    });
  } catch (error) {
    console.error('Error in /feed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/community/whatsapp/subscribe
 */
router.post('/whatsapp/subscribe', authenticateToken, async (req, res) => {
  try {
    const { phoneNumber } = req.body;
    const userId = req.user.userId;

    if (!phoneNumber) {
      return res.status(400).json({
        success: false,
        error: 'Phone number required'
      });
    }

    const subscription = await engageAPI.saveWhatsAppSubscription(userId, phoneNumber);

    await engageAPI.updateUser(userId, {
      whatsappPhone: phoneNumber,
      whatsappSubscribed: true
    });

    res.json({
      success: true,
      message: 'WhatsApp subscription initiated',
      data: {
        userId,
        phoneNumber: maskPhoneNumber(phoneNumber),
        subscribedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error subscribing WhatsApp:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/community/stats
 */
router.get('/stats', async (req, res) => {
  try {
    const allMembers = await engageAPI.getUsers(10000, 0);
    const events = await engageAPI.getEvents('upcoming');

    const stats = {
      totalMembers: allMembers.length,
      connectedInstagram: allMembers.filter(m => m.instagramHandle).length,
      totalPhotos: 0,
      eventsThisMonth: events.length,
      membersByRegion: groupMembersByRegion(allMembers)
    };

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error in /stats:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// Helper Functions
// ============================================

function generateAvatar(firstName, lastName) {
  const f = firstName?.charAt(0).toUpperCase() || '';
  const l = lastName?.charAt(0).toUpperCase() || '';
  return (f + l) || 'U';
}

function generateHandle(firstName, lastName) {
  const first = (firstName || '').toLowerCase();
  const last = (lastName || '').toLowerCase();
  return `${first}.${last}`.replace(/\.+/g, '.').replace(/^\.|\.$/, '');
}

function maskPhoneNumber(phone) {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) {
    return digits.replace(/(\d{3})(\d{3})(\d{4})/, '+1 ($1) $2-$3');
  }
  return phone.replace(/(.{3})(.*)(.{3})/, '$1 *** $3');
}

function groupMembersByRegion(members) {
  return members.reduce((acc, member) => {
    const region = member.location?.split(',').pop()?.trim() || 'Unknown';
    acc[region] = (acc[region] || 0) + 1;
    return acc;
  }, {});
}

module.exports = router;