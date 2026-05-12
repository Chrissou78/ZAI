import jwt from 'jsonwebtoken';

// Lazy DB import — don't crash if DB is unavailable
let dbModule = null;
async function getDB() {
  if (!dbModule) {
    try {
      dbModule = await import('../db.js');
    } catch (e) {
      console.error('DB module import failed:', e.message);
    }
  }
  return dbModule;
}

const API_KEY = () => process.env.WALLETTWO_API_KEY;
const BASE = 'https://api.wallettwo.com/blockchain/v1/api';
const CHAIN_ID = () => process.env.CHAIN_ID || '137';

// ── Only show NFTs from the ZAI contract ──
const ZAI_CONTRACT = '0xedd1a9446a2c0e50a8287c9527bf2a7498bfbc55';
const ZAI_EXPERIENCE_CARD_CONTRACT = '0x3ec471e2a682381ee75b395eff068e04b6b5da5d';

function authenticate(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return null;
  try {
    return jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET || 'fallback-secret');
  } catch {
    return null;
  }
}

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

async function callSasApi(payload) {
  const sasUrl = process.env.SAS_API_URL;
  const sasUser = process.env.SAS_USERNAME;
  const sasPass = process.env.SAS_PASSWORD;
  if (!sasUrl || !sasUser || !sasPass) {
    throw new Error('SAS API not configured — missing SAS_API_URL, SAS_USERNAME, or SAS_PASSWORD');
  }
  const basicAuth = Buffer.from(`${sasUser}:${sasPass}`).toString('base64');
  const response = await fetch(`${sasUrl}/postdata`, {
    method: 'POST',
    headers: { 'Authorization': `Basic ${basicAuth}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  if (!response.ok || data.status === 'error') {
    const errorDetail = (data.errors || []).map(e => e.detail || e.description).join('; ');
    throw new Error(errorDetail || `SAS API error (HTTP ${response.status})`);
  }
  return data;
}

async function fetchSasMakes() {
  const sasUrl = process.env.SAS_API_URL;
  const sasUser = process.env.SAS_USERNAME;
  const sasPass = process.env.SAS_PASSWORD;
  if (!sasUrl || !sasUser || !sasPass) return [];
  const basicAuth = Buffer.from(`${sasUser}:${sasPass}`).toString('base64');
  const response = await fetch(`${sasUrl}/getMakes`, {
    headers: { 'Authorization': `Basic ${basicAuth}` },
  });
  if (!response.ok) return [];
  return response.json();
}

export default async function handler(req, res) {
  const fullPath = req.url.split('?')[0].replace(/^\/api\/products\/?/, '').replace(/\/$/, '');

  // ─── GET /api/products/user/:userId — list user's ZAI products ───
  const userMatch = fullPath.match(/^user\/(.+)$/);
  if (userMatch && req.method === 'GET') {
    const decoded = authenticate(req);
    if (!decoded) return res.status(401).json({ error: 'No token provided' });

    try {
      // ★ Try DB but don't let it crash the request ★
      let pool = null;
      let dbReady = false;
      try {
        const db = await getDB();
        if (db) {
          await db.initDB();
          pool = db.getPool();
          dbReady = true;
        }
      } catch (dbErr) {
        console.error('DB init failed (non-fatal):', dbErr.message);
      }

      // Fetch NFTs from WalletTwo
      let products = [];
      let rawNftCount = 0;
      let allAddresses = []; // ★ debug: collect all token_address values
      try {
        const nftUrl = `${BASE}/nft?address=${decoded.wallet}&chainId=${CHAIN_ID()}`;
        console.log('Fetching NFTs from:', nftUrl);

        const response = await fetch(nftUrl, {
          headers: { 'x-api-key': API_KEY() },
        });

        if (response.ok) {
          const data = await response.json();
          const allNfts = data.result || [];
          rawNftCount = allNfts.length;

          // ★ Collect all unique contract addresses for debugging ★
          allAddresses = [...new Set(allNfts.map(nft => nft.token_address))];

          products = allNfts
            .filter(nft => {
              const addr = (nft.token_address || '').toLowerCase();
              return addr === ZAI_CONTRACT;
            })
            .map(nft => ({
              id: `${nft.token_address}-${nft.token_id}`,
              name: nft.normalized_metadata?.name || nft.name || 'ZAI Product',
              description: nft.normalized_metadata?.description || '',
              image: nft.normalized_metadata?.image || '',
              tokenAddress: nft.token_address,
              tokenId: nft.token_id,
              contractType: nft.contract_type,
              symbol: nft.symbol,
              metadata: nft.normalized_metadata || {},
            }));
        } else {
          const errText = await response.text();
          console.error('WalletTwo NFT API error:', response.status, errText);
        }
      } catch (nftErr) {
        console.error('NFT fetch error (non-fatal):', nftErr.message);
      }

      // Fetch insurance from DB (only if DB is ready)
      let insuranceMap = {};
      if (dbReady && pool) {
        try {
          const productIds = products.map(p => p.id);
          if (productIds.length > 0) {
            const insResult = await pool.query(
              `SELECT product_id, sas_status, sas_certificate_id, sas_transaction_id, created_at
               FROM insurance_registrations WHERE user_id = $1 AND product_id = ANY($2)`,
              [decoded.userId, productIds]
            );
            for (const row of insResult.rows) {
              insuranceMap[row.product_id] = {
                active: row.sas_status === 'success',
                status: row.sas_status,
                certificateId: row.sas_certificate_id,
                transactionId: row.sas_transaction_id,
                activatedAt: row.created_at,
              };
            }
          }

          const localInsResult = await pool.query(
            `SELECT product_id, sas_status, sas_certificate_id, sas_transaction_id, device_data, created_at
             FROM insurance_registrations WHERE user_id = $1`,
            [decoded.userId]
          );
          for (const row of localInsResult.rows) {
            if (!insuranceMap[row.product_id]) {
              insuranceMap[row.product_id] = {
                active: row.sas_status === 'success',
                status: row.sas_status,
                certificateId: row.sas_certificate_id,
                transactionId: row.sas_transaction_id,
                activatedAt: row.created_at,
              };
            }
          }
        } catch (insErr) {
          console.error('Insurance DB query failed (non-fatal):', insErr.message);
        }
      }

      // Merge insurance data
      const enrichedProducts = products.map(p => ({
        ...p,
        insurance: insuranceMap[p.id] || { active: false, status: null, certificateId: null },
        warranty: { active: true, expiresAt: null, years: 2 },
      }));

      const activeInsurance = Object.values(insuranceMap).filter(i => i.active).length;

      return res.json({
        success: true,
        data: enrichedProducts,
        stats: {
          totalProducts: enrichedProducts.length,
          activeInsurance,
          pendingClaims: 0,
        },
        // ★ Debug info — remove after confirming it works ★
        _debug: {
          chainId: CHAIN_ID(),
          wallet: decoded.wallet,
          rawNftCount,
          filteredCount: products.length,
          zaiContract: ZAI_CONTRACT,
          allContractAddresses: allAddresses,
          dbConnected: dbReady,
        },
      });
    } catch (err) {
      if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Invalid or expired token' });
      }
      console.error('Products API error:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // ─── POST /api/products/:productId/activate-insurance ───
  const insuranceMatch = fullPath.match(/^([^/]+)\/activate-insurance$/);
  if (insuranceMatch && req.method === 'POST') {
    const decoded = authenticate(req);
    if (!decoded) return res.status(401).json({ error: 'No token provided' });

    try {
      const db = await getDB();
      if (!db) return res.status(503).json({ success: false, error: 'Database unavailable' });
      await db.initDB();
      const pool = db.getPool();

      const productId = insuranceMatch[1];
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

      const existing = await pool.query(
        'SELECT id, sas_status FROM insurance_registrations WHERE user_id = $1 AND product_id = $2',
        [decoded.userId, productId]
      );
      if (existing.rows[0]?.sas_status === 'success') {
        return res.status(400).json({ success: false, error: 'Insurance already active for this product' });
      }

      const profileResult = await pool.query('SELECT * FROM user_profiles WHERE user_id = $1', [decoded.userId]);
      const profile = profileResult.rows[0];

      const customer = {
        salutation: body.salutation || profile?.salutation || 1,
        firstname: body.firstname || profile?.given_name || '',
        lastname: body.lastname || profile?.family_name || '',
        address1: body.address1 || profile?.address || '',
        zip: parseInt(body.zip || profile?.postal_code) || 0,
        city: body.city || profile?.city || '',
        country: body.country || profile?.country || 'CH',
        language: body.language || profile?.language || 'en',
        email: body.email || profile?.email || '',
        phone: body.phone || profile?.phone_number || '',
      };

      const missingCustomer = [];
      if (!customer.firstname) missingCustomer.push('firstname');
      if (!customer.lastname) missingCustomer.push('lastname');
      if (!customer.address1) missingCustomer.push('address');
      if (!customer.zip) missingCustomer.push('zip');
      if (!customer.city) missingCustomer.push('city');
      if (!customer.country) missingCustomer.push('country');
      if (missingCustomer.length > 0) {
        return res.status(400).json({
          success: false, error: 'Missing required profile fields for insurance',
          missingFields: missingCustomer, message: `Please complete your profile: ${missingCustomer.join(', ')}`,
        });
      }

      const device = {
        type: parseInt(body.deviceType) || 1,
        make: { ID: parseInt(body.makeId) || 1, name: body.makeName || 'zai' },
        model: body.model || '',
        serial: body.serial || '',
        itemnumber: body.itemnumber || '',
        price: parseFloat(body.price) || 0,
        length: parseInt(body.length) || 0,
        purchasingdate: body.purchasingdate || new Date().toISOString().split('T')[0],
      };

      const missingDevice = [];
      if (!device.model) missingDevice.push('model');
      if (!device.serial) missingDevice.push('serial');
      if (!device.price) missingDevice.push('price');
      if (missingDevice.length > 0) {
        return res.status(400).json({
          success: false, error: 'Missing required device fields for insurance',
          missingFields: missingDevice, message: `Please provide device details: ${missingDevice.join(', ')}`,
        });
      }

      const sasProductIds = (process.env.SAS_PRODUCT_IDS || '9').split(',').map(id => ({ ID: parseInt(id.trim()) }));
      const sasPayload = {
        partner: { ID: parseInt(process.env.SAS_PARTNER_ID) || 1, reference: `${customer.firstname} ${customer.lastname}`, storename: 'ZAI Experience Club', storelocation: 'Online' },
        customer, device, products: sasProductIds,
      };

      const regId = existing.rows[0]?.id || genId();

      if (existing.rows[0]) {
        await pool.query(
          `UPDATE insurance_registrations SET sas_status='pending', customer_data=$2, device_data=$3, products_data=$4, error_detail=NULL, updated_at=NOW() WHERE id=$1`,
          [regId, JSON.stringify(sasPayload.customer), JSON.stringify(sasPayload.device), JSON.stringify(sasPayload.products)]
        );
      } else {
        await pool.query(
          `INSERT INTO insurance_registrations (id, user_id, product_id, sas_status, customer_data, device_data, products_data) VALUES ($1,$2,$3,'pending',$4,$5,$6)`,
          [regId, decoded.userId, productId, JSON.stringify(sasPayload.customer), JSON.stringify(sasPayload.device), JSON.stringify(sasPayload.products)]
        );
      }

      try {
        const sasResult = await callSasApi(sasPayload);
        await pool.query(
          `UPDATE insurance_registrations SET sas_status='success', sas_transaction_id=$2, sas_certificate_id=$3, updated_at=NOW() WHERE id=$1`,
          [regId, sasResult.transactionid, sasResult.certificateid]
        );
        return res.json({ success: true, message: 'Insurance activated successfully', data: { transactionId: sasResult.transactionid, certificateId: sasResult.certificateid, status: 'success' } });
      } catch (sasErr) {
        await pool.query(`UPDATE insurance_registrations SET sas_status='error', error_detail=$2, updated_at=NOW() WHERE id=$1`, [regId, sasErr.message]);
        return res.status(502).json({ success: false, error: 'Insurance provider error', detail: sasErr.message });
      }
    } catch (err) {
      console.error('Insurance activation error:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // ─── GET /api/products/:productId/insurance ───
  const insuranceStatusMatch = fullPath.match(/^([^/]+)\/insurance$/);
  if (insuranceStatusMatch && req.method === 'GET') {
    const decoded = authenticate(req);
    if (!decoded) return res.status(401).json({ error: 'No token provided' });
    try {
      const db = await getDB();
      if (!db) return res.json({ success: true, data: { active: false, status: null } });
      await db.initDB();
      const result = await db.getPool().query(
        'SELECT * FROM insurance_registrations WHERE user_id = $1 AND product_id = $2 ORDER BY created_at DESC LIMIT 1',
        [decoded.userId, insuranceStatusMatch[1]]
      );
      if (!result.rows[0]) return res.json({ success: true, data: { active: false, status: null } });
      const row = result.rows[0];
      return res.json({ success: true, data: { active: row.sas_status === 'success', status: row.sas_status, certificateId: row.sas_certificate_id, transactionId: row.sas_transaction_id, error: row.error_detail, activatedAt: row.created_at } });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // ─── GET /api/products/makes ───
  if (fullPath === 'makes' && req.method === 'GET') {
    try {
      const makes = await fetchSasMakes();
      return res.json({ success: true, data: makes });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // ─── POST /api/products/claim ───
  if (fullPath === 'claim' && req.method === 'POST') {
    const decoded = authenticate(req);
    if (!decoded) return res.status(401).json({ error: 'No token provided' });
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    return res.json({ success: true, message: 'Product claim submitted', data: { serialNumber: body.serialNumber, userId: decoded.userId } });
  }

  // ─── GET /api/products/:productId ───
  const productMatch = fullPath.match(/^([^/]+)$/);
  if (productMatch && req.method === 'GET') {
    return res.json({ success: true, data: { id: productMatch[1] } });
  }

  return res.status(404).json({ error: 'Route not found' });
}
