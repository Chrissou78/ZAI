import jwt from 'jsonwebtoken';

let dbModule = null;
async function getDB() {
  if (!dbModule) {
    try { dbModule = await import('../db.js'); } catch (e) {
      console.error('DB module import failed:', e.message);
    }
  }
  return dbModule;
}

const API_KEY = () => process.env.WALLETTWO_API_KEY;
const RWA_BASE = 'https://api.wallettwo.com/rwa/v1/api';

function authenticate(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return null;
  try {
    return jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET || 'fallback-secret');
  } catch { return null; }
}

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

// ── Fetch helper with timeout ──
async function rwaFetch(path, opts = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const url = `${RWA_BASE}${path}`;
    console.log('[RWA]', opts.method || 'GET', url);
    const res = await fetch(url, {
      ...opts,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY(),
        ...(opts.headers || {}),
      },
    });
    clearTimeout(timeout);
    const data = await res.json().catch(() => null);
    console.log('[RWA] Response:', res.status, data ? JSON.stringify(data).slice(0, 300) : 'null');
    return { status: res.status, data };
  } catch (err) {
    clearTimeout(timeout);
    console.error(`[RWA] ${path} FAILED:`, err.message);
    return { status: 503, data: null };
  }
}

// ── SAS insurance helpers ──
async function callSasApi(payload) {
  const sasUrl = process.env.SAS_API_URL;
  const sasUser = process.env.SAS_USERNAME;
  const sasPass = process.env.SAS_PASSWORD;
  if (!sasUrl || !sasUser || !sasPass) throw new Error('SAS API not configured');
  const basicAuth = Buffer.from(`${sasUser}:${sasPass}`).toString('base64');
  const response = await fetch(`${sasUrl}/postdata`, {
    method: 'POST',
    headers: { 'Authorization': `Basic ${basicAuth}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  if (!response.ok || data.status === 'error') {
    const detail = (data.errors || []).map(e => e.detail || e.description).join('; ');
    throw new Error(detail || `SAS API error (HTTP ${response.status})`);
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

// ── Resolve metadata fields from rwa_nft_data + rwa.data ──
function resolveField(nftData, rwaData, keys) {
  // 1. NFT-level data (array of {key, value})
  if (nftData && nftData.length > 0) {
    for (const d of nftData) {
      if (keys.includes(d.key) && d.value) return d.value;
    }
  }
  // 2. RWA-level data (object: { key: { value, fieldType } })
  if (rwaData) {
    for (const k of keys) {
      if (rwaData[k]?.value) return rwaData[k].value;
    }
  }
  return '';
}

export default async function handler(req, res) {
  const fullPath = req.url.split('?')[0].replace(/^\/api\/products\/?/, '').replace(/\/$/, '');

  // ═══════════════════════════════════════════════════════════
  // GET /api/products/user/:userId — list user's NFT products
  // ═══════════════════════════════════════════════════════════
  //
  // Flow:
  //   1. GET /rwa          → all company RWA contracts
  //   2. GET /nft?claimed=true → all claimed NFTs across company
  //   3. Filter NFTs whose mintedBy matches the user
  //   4. For each matched NFT, resolve image + description from
  //      rwa_nft_data (NFT level) and rwa.data (RWA level)
  //   5. Enrich with insurance data from DB
  //
  const userMatch = fullPath.match(/^user\/(.+)$/);
  if (userMatch && req.method === 'GET') {
    const decoded = authenticate(req);
    if (!decoded) return res.status(401).json({ error: 'No token provided' });

    try {
      console.log('[PRODUCTS] ═══ Start ═══');
      console.log('[PRODUCTS] userId:', decoded.userId, 'wallet:', decoded.wallet);

      // DB (non-fatal)
      let pool = null;
      let dbReady = false;
      try {
        const db = await getDB();
        if (db) { await db.initDB(); pool = db.getPool(); dbReady = true; }
      } catch (dbErr) {
        console.error('[PRODUCTS] DB init failed (non-fatal):', dbErr.message);
      }

      // ── Step 1: Get all company RWAs ──
      const { status: rwaStatus, data: rwaData } = await rwaFetch('/rwa?limit=200');
      const rwaList = (rwaStatus === 200 && rwaData?.rwas) ? rwaData.rwas : [];

      console.log('[PRODUCTS] Step 1 — RWAs:', rwaList.length, 'status:', rwaStatus);
      if (rwaList.length === 0) {
        console.log('[PRODUCTS] ⚠ No RWAs found. rwaData:', JSON.stringify(rwaData)?.slice(0, 200));
      }

      // Build a quick-lookup map: rwaId -> rwa
      const rwaById = {};
      for (const rwa of rwaList) rwaById[rwa.id] = rwa;

      // ── Step 2: Get ALL claimed NFTs across the company ──
      let allNfts = [];
      let offset = 0;
      const limit = 200;
      let hasMore = true;

      while (hasMore) {
        const { status: nftStatus, data: nftData } = await rwaFetch(`/nft?claimed=true&limit=${limit}&offset=${offset}`);
        if (nftStatus === 200 && nftData?.nfts) {
          allNfts = allNfts.concat(nftData.nfts);
          hasMore = nftData.nfts.length === limit;
          offset += limit;
        } else {
          console.log('[PRODUCTS] ⚠ NFT fetch failed at offset', offset, 'status:', nftStatus);
          hasMore = false;
        }
      }

      console.log('[PRODUCTS] Step 2 — Total claimed NFTs across company:', allNfts.length);

      // ── Step 3: Filter to NFTs belonging to this user ──
      // Match by mintedBy (userId) OR by wallet address on the RWA's chain
      const userId = decoded.userId;
      const wallet = (decoded.wallet || '').toLowerCase();

      const userNfts = allNfts.filter(nft => {
        if (nft.mintedBy === userId) return true;
        if (wallet && nft.mintedBy?.toLowerCase() === wallet) return true;
        return false;
      });

      console.log('[PRODUCTS] Step 3 — User NFTs:', userNfts.length);
      if (userNfts.length === 0 && allNfts.length > 0) {
        // Log a sample to help debug matching
        const sample = allNfts.slice(0, 3).map(n => ({ id: n.id, mintedBy: n.mintedBy, rwaId: n.rwaId }));
        console.log('[PRODUCTS] Sample NFTs mintedBy values:', JSON.stringify(sample));
        console.log('[PRODUCTS] Looking for userId:', userId, 'or wallet:', wallet);
      }

      // ── Step 4: Build product list with metadata ──
      const products = [];

      for (const nft of userNfts) {
        const rwa = rwaById[nft.rwaId] || nft.rwa || {};
        const rwaData = rwa.data || {};
        const nftData = nft.rwa_nft_data || [];

        const image = resolveField(nftData, rwaData, ['image', 'imageUrl', 'img', 'coverImage']);
        const description = resolveField(nftData, rwaData, ['description', 'desc']);
        const name = resolveField(nftData, rwaData, ['name', 'title']) || rwa.name || 'ZAI Product';
        const color = resolveField(nftData, rwaData, ['color', 'colour']);
        const size = resolveField(nftData, rwaData, ['size', 'length']);
        const model = resolveField(nftData, rwaData, ['model']);

        const contractAddr = (rwa.smartContractAddress || '').toLowerCase();

        products.push({
          id: `${contractAddr || nft.rwaId}-${nft.serial}`,
          name,
          description,
          image,
          type: rwa.type || '',
          color,
          size,
          model,
          serialNumber: nft.serial,
          nftId: nft.id,
          rwaId: nft.rwaId,
          rwaName: rwa.name || '',
          tokenAddress: contractAddr,
          chainId: rwa.chainId || null,
          claimedAt: nft.mintedAt,
          mintedTx: nft.mintedTx,
          isClaimed: nft.isClaimed,
          metadata: {
            ...nftData.reduce((acc, d) => { acc[d.key] = d.value; return acc; }, {}),
            ...(rwaData ? Object.fromEntries(Object.entries(rwaData).map(([k, v]) => [k, v.value])) : {}),
          },
        });
      }

      console.log('[PRODUCTS] Step 4 — Products built:', products.length);

      // ── Step 5: Insurance from DB ──
      let insuranceMap = {};
      if (dbReady && pool && products.length > 0) {
        try {
          const productIds = products.map(p => p.id);
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
        } catch (insErr) {
          console.error('[PRODUCTS] Insurance query failed:', insErr.message);
        }
      }

      // ── Step 6: Return ──
      const enriched = products.map(p => ({
        ...p,
        insurance: insuranceMap[p.id] || { active: false, status: null, certificateId: null },
        warranty: { active: true, expiresAt: null, years: 2 },
      }));

      console.log('[PRODUCTS] ═══ Returning', enriched.length, 'products ═══');

      return res.json({
        success: true,
        data: enriched,
        stats: {
          totalProducts: enriched.length,
          activeInsurance: Object.values(insuranceMap).filter(i => i.active).length,
          pendingClaims: 0,
        },
        _debug: {
          rwaCount: rwaList.length,
          rwaStatus,
          totalClaimedNfts: allNfts.length,
          userNftsMatched: userNfts.length,
          userId,
          wallet,
          dbConnected: dbReady,
        },
      });
    } catch (err) {
      console.error('[PRODUCTS] FATAL:', err);
      if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Invalid or expired token' });
      }
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // ═══════════════════════════════════════════════════════════
  // POST /api/products/:productId/activate-insurance
  // ═══════════════════════════════════════════════════════════
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
          success: false, error: 'Missing required profile fields',
          missingFields: missingCustomer,
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
          success: false, error: 'Missing required device fields',
          missingFields: missingDevice,
        });
      }

      const sasProductIds = (process.env.SAS_PRODUCT_IDS || '9').split(',').map(id => ({ ID: parseInt(id.trim()) }));
      const sasPayload = {
        partner: {
          ID: parseInt(process.env.SAS_PARTNER_ID) || 1,
          reference: `${customer.firstname} ${customer.lastname}`,
          storename: 'ZAI Experience Club',
          storelocation: 'Online',
        },
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
        return res.json({
          success: true, message: 'Insurance activated',
          data: { transactionId: sasResult.transactionid, certificateId: sasResult.certificateid, status: 'success' },
        });
      } catch (sasErr) {
        await pool.query(`UPDATE insurance_registrations SET sas_status='error', error_detail=$2, updated_at=NOW() WHERE id=$1`, [regId, sasErr.message]);
        return res.status(502).json({ success: false, error: 'Insurance provider error', detail: sasErr.message });
      }
    } catch (err) {
      console.error('[INSURANCE] Error:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // ═══════════════════════════════════════════════════════════
  // GET /api/products/:productId/insurance
  // ═══════════════════════════════════════════════════════════
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
      return res.json({
        success: true,
        data: {
          active: row.sas_status === 'success', status: row.sas_status,
          certificateId: row.sas_certificate_id, transactionId: row.sas_transaction_id,
          error: row.error_detail, activatedAt: row.created_at,
        },
      });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // ═══════════════════════════════════════════════════════════
  // GET /api/products/makes
  // ═══════════════════════════════════════════════════════════
  if (fullPath === 'makes' && req.method === 'GET') {
    try {
      const makes = await fetchSasMakes();
      return res.json({ success: true, data: makes });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // ═══════════════════════════════════════════════════════════
  // POST /api/products/claim — claim NFTs via RWA API
  // ═══════════════════════════════════════════════════════════
  if (fullPath === 'claim' && req.method === 'POST') {
    const decoded = authenticate(req);
    if (!decoded) return res.status(401).json({ error: 'No token provided' });
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const { ids, secrets } = body;
      const wallet = decoded.wallet;

      if (!ids || !secrets || !wallet) {
        return res.status(400).json({ success: false, error: 'ids, secrets, and wallet are required' });
      }
      if (ids.length !== secrets.length) {
        return res.status(400).json({ success: false, error: 'ids and secrets must have the same length' });
      }

      const { status, data } = await rwaFetch('/nft/claim', {
        method: 'POST',
        body: JSON.stringify({ ids, secrets, wallet }),
      });

      if (status >= 400) {
        return res.status(status).json({ success: false, error: data?.message || 'Claim failed', detail: data });
      }

      return res.json({ success: true, message: 'NFTs queued for minting', data });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // ═══════════════════════════════════════════════════════════
  // GET /api/products/catalog — all company RWAs (public)
  // ═══════════════════════════════════════════════════════════
  if (fullPath === 'catalog' && req.method === 'GET') {
    try {
      const { status, data } = await rwaFetch('/rwa?limit=200');
      if (status !== 200 || !data?.rwas) {
        return res.json({ success: true, data: [], _debug: { rwaStatus: status, rwaResponse: data } });
      }
      return res.json({
        success: true,
        data: data.rwas.map(r => ({
          id: r.id, name: r.name, type: r.type,
          contractAddress: r.smartContractAddress, chainId: r.chainId,
          isBuyable: r.isBuyable, isClaimable: r.isClaimable,
          data: r.data || {},
        })),
      });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // ═══════════════════════════════════════════════════════════
  // GET /api/products/:productId — single NFT detail
  // ═══════════════════════════════════════════════════════════
  const productMatch = fullPath.match(/^([^/]+)$/);
  if (productMatch && req.method === 'GET') {
    // Try to look up via RWA NFT API
    try {
      const { status, data } = await rwaFetch(`/nft/${productMatch[1]}`);
      if (status === 200 && data) {
        return res.json({ success: true, data });
      }
    } catch {}
    return res.json({ success: true, data: { id: productMatch[1] } });
  }

  return res.status(404).json({ error: 'Route not found' });
}
