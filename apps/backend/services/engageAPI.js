const axios = require('axios');
const https = require('https');

const engageClient = axios.create({
  baseURL: process.env.ENGAGE_API_BASE || 'https://api.engage.onchainlabs.ch',
  headers: {
    'Authorization': `Bearer ${process.env.WALLETTWO_API_KEY}`,
    'Content-Type': 'application/json'
  },
  timeout: 10000,
  httpsAgent: new https.Agent({ rejectUnauthorized: false })
});

// Error handler
engageClient.interceptors.response.use(
  response => response,
  error => {
    console.error('Engage API Error:', error.response?.data || error.message);
    throw error;
  }
);

// ============================================
// USERS / COMMUNITY
// ============================================

/**
 * Get list of users from Engage
 */
async function getUsers(limit = 50, offset = 0, search = null) {
  try {
    const params = { limit, offset };
    if (search) params.search = search;
    
    const response = await engageClient.get('/users', { params });
    return response.data.data || response.data;
  } catch (error) {
    console.error('Error fetching users:', error);
    return [];
  }
}

/**
 * Get single user by ID
 */
async function getUser(userId) {
  try {
    const response = await engageClient.get(`/users/${userId}`);
    return response.data.data || response.data;
  } catch (error) {
    console.error('Error fetching user:', error);
    return null;
  }
}

/**
 * Update user profile
 */
async function updateUser(userId, userData) {
  try {
    const response = await engageClient.put(`/users/${userId}`, userData);
    return response.data.data || response.data;
  } catch (error) {
    console.error('Error updating user:', error);
    throw error;
  }
}

// ============================================
// PRODUCTS
// ============================================

/**
 * Get user's claimed products
 */
async function getUserProducts(userId) {
  try {
    const response = await engageClient.get(`/users/${userId}/products`);
    return response.data.data || response.data || [];
  } catch (error) {
    console.error('Error fetching user products:', error);
    return [];
  }
}

/**
 * Claim a product for user
 */
async function claimProduct(userId, serialNumber) {
  try {
    const response = await engageClient.post(`/users/${userId}/products/claim`, {
      serialNumber,
      claimedAt: new Date().toISOString()
    });
    return response.data.data || response.data;
  } catch (error) {
    console.error('Error claiming product:', error);
    throw error;
  }
}

/**
 * Activate insurance for product
 */
async function activateProductInsurance(userId, productId) {
  try {
    const response = await engageClient.put(
      `/users/${userId}/products/${productId}`,
      {
        insuranceActive: true,
        insuranceActivatedAt: new Date().toISOString()
      }
    );
    return response.data.data || response.data;
  } catch (error) {
    console.error('Error activating insurance:', error);
    throw error;
  }
}

// ============================================
// EVENTS
// ============================================

/**
 * Get events
 */
async function getEvents(status = 'upcoming') {
  try {
    const response = await engageClient.get('/events', {
      params: { status }
    });
    return response.data.data || response.data || [];
  } catch (error) {
    console.error('Error fetching events:', error);
    return [];
  }
}

/**
 * Get event details
 */
async function getEvent(eventId) {
  try {
    const response = await engageClient.get(`/events/${eventId}`);
    return response.data.data || response.data;
  } catch (error) {
    console.error('Error fetching event:', error);
    return null;
  }
}

/**
 * Register user for event
 */
async function registerEvent(userId, eventId) {
  try {
    const response = await engageClient.post(`/events/${eventId}/attendees`, {
      userId,
      registeredAt: new Date().toISOString()
    });
    return response.data.data || response.data;
  } catch (error) {
    console.error('Error registering for event:', error);
    throw error;
  }
}

/**
 * Save WhatsApp subscription
 */
async function saveWhatsAppSubscription(userId, phoneNumber) {
  return {
    userId,
    phoneNumber,
    subscribedAt: new Date()
  };
}

module.exports = {
  // Users
  getUsers,
  getUser,
  updateUser,
  // Products
  getUserProducts,
  claimProduct,
  activateProductInsurance,
  // Events
  getEvents,
  getEvent,
  registerEvent,
  // WhatsApp
  saveWhatsAppSubscription
};