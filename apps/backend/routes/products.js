const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/auth');

/**
 * POST /api/products/claim
 * Claim a product via serial number or NFC
 */
router.post('/claim', authenticateToken, async (req, res) => {
  try {
    const { serialNumber, nfcCardId } = req.body;
    const userId = req.user.userId;

    if (!serialNumber && !nfcCardId) {
      return res.status(400).json({
        success: false,
        error: 'Either serialNumber or nfcCardId is required'
      });
    }

    const claimedProduct = await claimProductInEngage(userId, {
      serialNumber: serialNumber || nfcCardId,
      claimedAt: new Date().toISOString()
    });

    res.json({
      success: true,
      message: 'Product claimed successfully',
      data: {
        id: claimedProduct.id,
        name: claimedProduct.name,
        serialNumber: claimedProduct.serialNumber,
        claimedAt: claimedProduct.claimedAt,
        warranty: {
          active: true,
          expiresAt: addYears(new Date(), 2),
          years: 2
        },
        insurance: {
          active: false,
          activatedAt: null
        }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/products
 * Get all products (for marketplace)
 */
router.get('/', async (req, res) => {
  try {
    const products = await getProductsFromEngage();
    
    res.json({
      success: true,
      data: products,
      count: products.length
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/products/user/:userId
 * Get user's claimed products
 */
router.get('/user/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Fix: JWT stores userId, not id
    if (req.user.userId !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Unauthorized' });
    }

    const products = await getUserProductsFromEngage(userId);
    
    const transformedProducts = products.map(product => ({
      id: product.id,
      name: product.name,
      type: product.type,
      color: product.color,
      size: product.size,
      serialNumber: product.serialNumber,
      claimedAt: product.claimedAt,
      warranty: {
        active: new Date(product.warrantyExpiresAt) > new Date(),
        expiresAt: product.warrantyExpiresAt,
        years: 2
      },
      insurance: {
        active: product.insuranceActive || false,
        activatedAt: product.insuranceActivatedAt || null
      },
      specs: product.specs || {},
      image: product.image || null
    }));

    res.json({
      success: true,
      data: transformedProducts,
      count: transformedProducts.length,
      stats: {
        totalProducts: transformedProducts.length,
        withInsurance: transformedProducts.filter(p => p.insurance.active).length
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/products/:productId/activate-insurance
 * Activate insurance for a claimed product
 */
router.post('/:productId/activate-insurance', authenticateToken, async (req, res) => {
  try {
    const { productId } = req.params;
    const userId = req.user.userId;

    const updatedProduct = await activateInsuranceInEngage(userId, productId);

    res.json({
      success: true,
      message: 'Insurance activated',
      data: {
        productId: updatedProduct.id,
        insurance: {
          active: true,
          activatedAt: new Date().toISOString()
        }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/products/:productId
 * Get product details
 */
router.get('/:productId', async (req, res) => {
  try {
    const { productId } = req.params;

    const product = await getProductFromEngage(productId);

    res.json({
      success: true,
      data: product
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// Helper Functions (integrate with Engage API)
// ============================================

async function getUserProductsFromEngage(userId) {
  // TODO: Replace with actual Engage API call
  return [];
}

async function getProductsFromEngage() {
  // TODO: Replace with actual Engage API call
  return [];
}

async function claimProductInEngage(userId, productData) {
  // TODO: Replace with actual Engage API call
  return {};
}

async function activateInsuranceInEngage(userId, productId) {
  // TODO: Replace with actual Engage API call
  return {};
}

async function getProductFromEngage(productId) {
  // TODO: Replace with actual Engage API call
  return {};
}

function addYears(date, years) {
  const result = new Date(date);
  result.setFullYear(result.getFullYear() + years);
  return result.toISOString();
}

module.exports = router;