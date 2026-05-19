import jwt from 'jsonwebtoken';

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
const RWA_BASE = 'https://api.wallettwo.com/rwa/v1/api';
const BLOCKCHAIN_BASE = 'https://api.wallettwo.com/blockchain/v1/api';
const CHAIN_ID = () => process.env.CHAIN_ID || '137';

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

// ── Fetch with timeout and API key ──
async function rwaFetch(path, opts = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(`${RWA_BASE}${path}`, {
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
    return { status: res.status, data };
  } catch (err) {
    clearTimeout(timeout);
    console.error(`rwaFetch ${path} failed:`, err.message);
    return { status: 503, data: null };
  }
}

async function blockchainFetch(path) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(`${BLOCKCHAIN_BASE}${path}`, {
      signal: controller.signal,
      headers: { 'x-api-key': API_KEY() },
    });
    clearTimeout(timeout);
    const data = await res.json().catch(() => null);
    return { status: res.status, data };
  } catch (err) {
    clearTimeout(timeout);
    console.error(`blockchainFetch ${path} failed:`, err.message);
    return { status: 503, data: null };
  }
}

// ── SAS insurance API ──
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

// ── Resolve NFT metadata image URL ──
function resolveImageUrl(nft, rwa) {
  // 1. Check nft-level data
  if (nft.rwa_nft_data && nft.rwa_nft_data.length > 0) {
    for (const d of nft.rwa_nft_data) {
      if (d.key === 'image' || d.key === 'imageUrl' || d.key === 'img') {
        if (d.value) return d.value;
      }
    }
  }
  // 2. Check RWA-level data
  if (rwa?.data) {
    for (const key of ['image', 'imageUrl', 'img', 'coverImage']) {
      if (rwa.data[key]?.value) return rwa.data[key].value;
    }
  }
  return '';
}

function resolveDescription(nft, rwa) {
  if (nft.rwa_nft_data && nft.rwa_nft_data.length > 0) {
    for (const d of nft.rwa_nft_data) {
      if (d.key === 'description' || d.key === 'desc') {
        if (d.value) return d.value;
      }
    }
  }
  if (rwa?.data) {
    for (const key of ['description', 'desc']) {
      if (rwa.data[key]?.value) return rwa.data[key].value;
    }
  }
  return '';
}

function resolveDataField(nft, rwa, fieldNames) {
  if (nft.rwa_nft_data && nft.rwa_nft_data.length > 0) {
    for (const d of nft.rwa_nft_data) {
      if (fieldNames.includes(d.key) && d.value) return d.value;
    }
  }
  if (rwa?.data) {
    for (const key of fieldNames) {
      if (rwa.data[key]?.value) return rwa.data[key].value;
    }
  }
  return '';
}

export default async function handler(req, res) {
  const fullPath = req.url.split('?')[0].replace(/^\/api\/products\/?/, '').replace(/\/$/, '');

  // ─── GET /api/products/user/:userId — list user's products via RWA API ───
  const userMatch = fullPath.match(/^user\/(.+)$/);
  if (userMatch && req.method === 'GET') {
    const decoded = authenticate(req);
    if (!decoded) return res.status(401).json({ error: 'No token provided' });

    try {
      // ★ DB setup (non-fatal) ★
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

      const wallet = decoded.wallet?.toLowerCase();
      let products = [];
      let rwaList = [];
      let allContractAddresses = [];

      console.log('[PRODUCTS] === Starting product fetch ===');
      console.log('[PRODUCTS] User:', decoded.userId, 'Wallet:', wallet);
      console.log('[PRODUCTS] Chain ID:', CHAIN_ID());
      console.log('[PRODUCTS] API Key present:', !!API_KEY());
      console.log('[PRODUCTS] API Key first 8 chars:', API_KEY()?.slice(0, 8));

      // ── Step 1: Get all company RWAs ──
      console.log('[PRODUCTS] Step 1: Fetching RWAs from', `${RWA_BASE}/rwa?limit=200`);
      const { status: rwaStatus, data: rwaData } = await rwaFetch('/rwa?limit=200');
      console.log('[PRODUCTS] RWA response status:', rwaStatus);
      console.log('[PRODUCTS] RWA response data:', JSON.stringify(rwaData)?.slice(0, 500));

      if (rwaStatus === 200 && rwaData?.rwas) {
        rwaList = rwaData.rwas;
        allContractAddresses = rwaList
          .filter(r => r.smartContractAddress)
          .map(r => ({ name: r.name, address: r.smartContractAddress, chainId: r.chainId }));
        console.log('[PRODUCTS] Found', rwaList.length, 'RWAs, contracts:', JSON.stringify(allContractAddresses));
      } else {
        console.log('[PRODUCTS] ⚠ RWA fetch failed or empty. Status:', rwaStatus);
      }

      // ── Step 2: Get user's on-chain NFTs from blockchain endpoint ──
      let userNftsByContract = {};
      if (wallet) {
        const blockchainUrl = `/nft?address=${wallet}&chainId=${CHAIN_ID()}`;
        console.log('[PRODUCTS] Step 2: Fetching on-chain NFTs from', `${BLOCKCHAIN_BASE}${blockchainUrl}`);
        const { status: nftStatus, data: nftData } = await blockchainFetch(blockchainUrl);
        console.log('[PRODUCTS] Blockchain response status:', nftStatus);
        console.log('[PRODUCTS] Blockchain response keys:', nftData ? Object.keys(nftData) : 'null');
        console.log('[PRODUCTS] Blockchain raw (first 500):', JSON.stringify(nftData)?.slice(0, 500));

        if (nftStatus === 200 && nftData?.result) {
          console.log('[PRODUCTS] Found', nftData.result.length, 'on-chain NFTs');
          for (const nft of nftData.result) {
            const addr = (nft.token_address || '').toLowerCase();
            if (!userNftsByContract[addr]) userNftsByContract[addr] = [];
            userNftsByContract[addr].push(nft);
            console.log('[PRODUCTS]   NFT contract:', addr, 'tokenId:', nft.token_id, 'name:', nft.name || nft.normalized_metadata?.name);
          }
        } else {
          console.log('[PRODUCTS] ⚠ Blockchain NFT fetch failed or empty. Status:', nftStatus);
        }

        console.log('[PRODUCTS] User holds NFTs on', Object.keys(userNftsByContract).length, 'contracts:', Object.keys(userNftsByContract));
      } else {
        console.log('[PRODUCTS] ⚠ No wallet found in JWT');
      }

      // ── Step 3: Match user holdings with RWAs ──
      console.log('[PRODUCTS] Step 3: Matching holdings with RWAs');
      if (rwaList.length === 0) {
        console.log('[PRODUCTS] ⚠ No RWAs to match against — trying blockchain-only fallback');

        // ★ FALLBACK: If no RWAs, show all on-chain NFTs directly ★
        for (const [contractAddr, holdings] of Object.entries(userNftsByContract)) {
          for (const holding of holdings) {
            const meta = holding.normalized_metadata || {};
            products.push({
              id: `${contractAddr}-${holding.token_id}`,
              name: meta.name || holding.name || 'ZAI Product',
              description: meta.description || '',
              image: meta.image || '',
              type: '',
              color: '',
              size: '',
              model: '',
              serialNumber: holding.token_id,
              claimedAt: null,
              tokenAddress: contractAddr,
              tokenId: holding.token_id,
              contractType: holding.contract_type || '',
              symbol: holding.symbol || '',
              rwaId: null,
              rwaName: null,
              metadata: meta,
            });
          }
        }
        console.log('[PRODUCTS] Fallback produced', products.length, 'products from on-chain data');
      } else {
        for (const rwa of rwaList) {
          const contractAddr = (rwa.smartContractAddress || '').toLowerCase();
          if (!contractAddr) { console.log('[PRODUCTS]   Skipping RWA', rwa.name, '— no contract'); continue; }

          const userHoldings = userNftsByContract[contractAddr];
          console.log('[PRODUCTS]   RWA:', rwa.name, 'contract:', contractAddr, 'user holds:', userHoldings?.length || 0);

          if (!userHoldings || userHoldings.length === 0) continue;

          let rwaDetail = rwa;
          try {
            const { status: detStatus, data: detData } = await rwaFetch(`/rwa/${rwa.id}`);
            if (detStatus === 200 && detData) rwaDetail = detData;
          } catch {}

          let rwaNfts = [];
          try {
            const { status: nftsStatus, data: nftsData } = await rwaFetch(`/rwa/${rwa.id}/nfts?claimed=true&limit=200`);
            if (nftsStatus === 200 && nftsData?.nfts) rwaNfts = nftsData.nfts;
          } catch {}

          const rwaNftBySerial = {};
          for (const rn of rwaNfts) rwaNftBySerial[rn.serial] = rn;

          for (const holding of userHoldings) {
            const tokenId = holding.token_id;
            const blockchainMeta = holding.normalized_metadata || {};
            const matchedRwaNft = rwaNftBySerial[tokenId] || rwaNfts.find(n => n.serial === tokenId) || null;

            const image = resolveImageUrl(matchedRwaNft || {}, rwaDetail) || blockchainMeta.image || '';
            const description = resolveDescription(matchedRwaNft || {}, rwaDetail) || blockchainMeta.description || '';
            const name = blockchainMeta.name || rwaDetail.name || 'ZAI Product';
            const color = resolveDataField(matchedRwaNft || {}, rwaDetail, ['color', 'colour']);
            const size = resolveDataField(matchedRwaNft || {}, rwaDetail, ['size', 'length']);
            const model = resolveDataField(matchedRwaNft || {}, rwaDetail, ['model']);

            products.push({
              id: `${contractAddr}-${tokenId}`,
              name, description, image, type: rwaDetail.type || '',
              color, size, model,
              serialNumber: matchedRwaNft?.serial || tokenId,
              claimedAt: matchedRwaNft?.mintedAt || null,
              tokenAddress: contractAddr, tokenId,
              contractType: holding.contract_type || '',
              symbol: holding.symbol || '',
              rwaId: rwa.id, rwaName: rwaDetail.name,
              metadata: {
                ...blockchainMeta,
                ...(matchedRwaNft?.rwa_nft_data || []).reduce((acc, d) => { acc[d.key] = d.value; return acc; }, {}),
                ...(rwaDetail.data ? Object.fromEntries(Object.entries(rwaDetail.data).map(([k, v]) => [k, v.value])) : {}),
              },
            });
          }
        }
      }

      console.log('[PRODUCTS] Total products matched:', products.length);

      // ── Step 4: Insurance ──
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
                active: row.sas_status === 'success', status: row.sas_status,
                certificateId: row.sas_certificate_id, transactionId: row.sas_transaction_id,
                activatedAt: row.created_at,
              };
            }
          }
        } catch (insErr) {
          console.error('[PRODUCTS] Insurance query failed:', insErr.message);
        }
      }

      // ── Step 5: Return ──
      const enrichedProducts = products.map(p => ({
        ...p,
        insurance: insuranceMap[p.id] || { active: false, status: null, certificateId: null },
        warranty: { active: true, expiresAt: null, years: 2 },
      }));

      console.log('[PRODUCTS] === Returning', enrichedProducts.length, 'products ===');

      return res.json({
        success: true,
        data: enrichedProducts,
        stats: {
          totalProducts: enrichedProducts.length,
          activeInsurance: Object.values(insuranceMap).filter(i => i.active).length,
          pendingClaims: 0,
        },
        _debug: {
          chainId: CHAIN_ID(),
          wallet: decoded.wallet,
          rwaCount: rwaList.length,
          rwaStatus,
          allContractAddresses,
          onChainContracts: Object.keys(userNftsByContract),
          onChainNftCount: Object.values(userNftsByContract).flat().length,
          productsFound: enrichedProducts.length,
          dbConnected: dbReady,
        },
      });
    } catch (err) {
      console.error('[PRODUCTS] FATAL ERROR:', err);
      if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Invalid or expired token' });
      }
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

  // ─── POST /api/products/claim — claim via RWA API ───
  if (fullPath === 'claim' && req.method === 'POST') {
    const decoded = authenticate(req);
    if (!decoded) return res.status(401).json({ error: 'No token provided' });
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const { ids, secrets, serialNumber } = body;

      // If ids + secrets are provided, use the RWA claim endpoint
      if (ids && secrets && decoded.wallet) {
        const { status, data } = await rwaFetch('/nft/claim', {
          method: 'POST',
          body: JSON.stringify({ ids, secrets, wallet: decoded.wallet }),
        });
        if (status >= 400) {
          return res.status(status).json({ success: false, error: data?.message || 'Claim failed' });
        }
        return res.json({ success: true, message: 'NFTs queued for minting', data });
      }

      // Fallback: serial number claim (placeholder)
      return res.json({ success: true, message: 'Product claim submitted', data: { serialNumber, userId: decoded.userId } });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // ─── GET /api/products/catalog — list all company RWAs (public catalog) ───
  if (fullPath === 'catalog' && req.method === 'GET') {
    try {
      const { status, data } = await rwaFetch('/rwa?limit=200');
      if (status !== 200 || !data?.rwas) {
        return res.json({ success: true, data: [], _providerOffline: true });
      }
      return res.json({
        success: true,
        data: data.rwas.map(r => ({
          id: r.id,
          name: r.name,
          type: r.type,
          contractAddress: r.smartContractAddress,
          chainId: r.chainId,
          isBuyable: r.isBuyable,
          isClaimable: r.isClaimable,
          data: r.data || {},
        })),
      });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // ─── GET /api/products/:productId ───
  const productMatch = fullPath.match(/^([^/]+)$/);
  if (productMatch && req.method === 'GET') {
    return res.json({ success: true, data: { id: productMatch[1] } });
  }

  return res.status(404).json({ error: 'Route not found' });
}
