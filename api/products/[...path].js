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

let currencyCache = null;
let currencyCacheTime = 0;

async function getCurrencyMap() {
  if (currencyCache && Date.now() - currencyCacheTime < 3600000) return currencyCache;
  try {
    const { status, data } = await apiFetch(BLOCKCHAIN_BASE, '/currencies');
    if (status === 200 && data) {
      const map = {};
      const currencies = Array.isArray(data) ? data : (data.data || data.currencies || []);
      for (const c of currencies) {
        if (c.id && c.code) map[c.id] = c.code;
        if (c.id && c.symbol) map[c.id] = c.symbol;
      }
      currencyCache = map;
      currencyCacheTime = Date.now();
      console.log('[PRODUCTS] Currency map loaded:', Object.keys(map).length, 'entries');
      return map;
    }
  } catch (err) {
    console.error('[PRODUCTS] Currency API failed:', err.message);
  }
  return { 'b60f590b-2855-4b3c-a78a-8cac203e4768': 'CHF' };
}

let zaiContractCache = null;
let zaiContractCacheTime = 0;

async function getZaiContracts() {
  if (zaiContractCache && Date.now() - zaiContractCacheTime < 3600000) return zaiContractCache;
  try {
    const { status, data } = await apiFetch(RWA_BASE, '/rwa?limit=200');
    if (status === 200 && data) {
      const rwas = Array.isArray(data) ? data : (data.data || data.result || []);
      const contracts = new Set();
      for (const rwa of rwas) {
        if (rwa.contractAddress) contracts.add(rwa.contractAddress.toLowerCase());
      }
      zaiContractCache = contracts;
      zaiContractCacheTime = Date.now();
      console.log('[PRODUCTS] ZAI contracts loaded:', contracts.size);
      return contracts;
    }
  } catch (err) {
    console.error('[PRODUCTS] RWA contract fetch failed:', err.message);
  }
  return new Set();
}

const API_KEY = () => process.env.WALLETTWO_API_KEY;
const BLOCKCHAIN_BASE = 'https://api.wallettwo.com/blockchain/v1/api';
const RWA_BASE = 'https://rwa.onchainlabs.ch/v1/api';
const CHAIN_ID = () => process.env.CHAIN_ID || '137';

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

async function apiFetch(base, path, opts = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const url = `${base}${path}`;
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
    const text = await res.text();
    let data = null;
    try { data = JSON.parse(text); } catch {}
    return { status: res.status, data };
  } catch (err) {
    clearTimeout(timeout);
    console.error(`[API] ${base}${path} FAILED:`, err.message);
    return { status: 503, data: null };
  }
}

async function fetchTokenMetadata(tokenUri) {
  if (!tokenUri) return null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(tokenUri, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    clearTimeout(timeout);
    return null;
  }
}

const CURRENCY_MAP = {
  'b60f590b-2855-4b3c-a78a-8cac203e4768': 'CHF',
};

function resolveCurrency(raw, currencyMap) {
  if (!raw) return 'CHF';
  if (raw.length <= 5 && /^[A-Z]+$/.test(raw)) return raw;
  return currencyMap[raw] || 'CHF';
}

function formatPrice(raw) {
  if (!raw) return '';
  const num = parseFloat(raw);
  if (isNaN(num)) return raw;
  return num % 1 === 0
    ? num.toLocaleString('en-CH')
    : num.toLocaleString('en-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function parseNftToProduct(nft, currencyMap) {
  let meta = {};

  if (nft.metadata) {
    try {
      meta = typeof nft.metadata === 'string' ? JSON.parse(nft.metadata) : nft.metadata;
    } catch {}
  }

  const rwaData = meta.data || {};
  const tokenAddress = (nft.token_address || '').toLowerCase();
  const tokenId = nft.token_id || '';

  const rawImage = rwaData.image?.value || '';
  const rawDescription = rwaData.description?.value || '';
  const rawPrice = rwaData.price?.value || '';
  const rawCurrency = rwaData.currency?.value || '';
  const rawMaterials = rwaData.materials?.value || '';
  const rawCollection = rwaData.collection?.value || '';
  const rawInsurance = rwaData.insurance?.value || '';

  const name = meta.name || nft.name || 'ZAI Product';
  const type = meta.type || nft.contract_type || '';
  const serial = meta.serial || tokenId;
  const rwaId = meta.rwaId || null;
  const rwaName = meta.rwa?.name || nft.name || '';
  const isClaimed = meta.isClaimed || false;

  return {
    id: `${tokenAddress}-${tokenId}`,
    name,
    description: rawDescription,
    image: rawImage,
    price: formatPrice(rawPrice),
    priceRaw: rawPrice,
    currency: resolveCurrency(rawCurrency, currencyMap || CURRENCY_MAP),
    materials: rawMaterials,
    collection: rawCollection,
    hasInsurance: rawInsurance === '1' || rawInsurance === 'true',
    type,
    tokenAddress,
    tokenId,
    symbol: nft.symbol || '',
    serialNumber: serial,
    rwaId,
    rwaName,
    chainId: null,
    // claimedAt will be overridden by DB value in the GET route
    // Use block_timestamp as fallback for products claimed before DB tracking existed
    claimedAt: nft.block_timestamp || null,
    isClaimed,
    tokenUri: nft.token_uri || '',
    metadata: Object.fromEntries(
      Object.entries(rwaData).map(([k, v]) => {
        const val = v?.value || v;
        if (k === 'currency') return [k, resolveCurrency(val, currencyMap || CURRENCY_MAP)];
        return [k, val];
      })
    ),
  };
}

// SAS helpers
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

export default async function handler(req, res) {
  const fullPath = req.url.split('?')[0].replace(/^\/api\/products\/?/, '').replace(/\/$/, '');

  // ══════════════════════════════════════════════════════════════
  // GET /api/products/user/:userId
  //
  // 1. Fetch user's NFTs from blockchain API by wallet
  // 2. Get known ZAI contract addresses from RWA API
  // 3. Filter to ZAI NFTs only
  // 4. Parse metadata
  // 5. For NFTs with null metadata, fetch from token_uri
  // 6. Enrich with insurance from DB
  // 7. Enrich with claimedAt from DB (product_claims table)
  // ══════════════════════════════════════════════════════════════
  const userMatch = fullPath.match(/^user\/(.+)$/);
  if (userMatch && req.method === 'GET') {
    const decoded = authenticate(req);
    if (!decoded) return res.status(401).json({ error: 'No token provided' });

    try {
      const wallet = decoded.wallet;
      const chainId = CHAIN_ID();

      console.log('[PRODUCTS] userId:', decoded.userId, 'wallet:', wallet, 'chainId:', chainId);

      // DB (non-fatal)
      let pool = null;
      let dbReady = false;
      try {
        const db = await getDB();
        if (db) { await db.initDB(); pool = db.getPool(); dbReady = true; }
      } catch (dbErr) {
        console.error('[PRODUCTS] DB init failed:', dbErr.message);
      }

      if (!wallet) {
        return res.json({ success: true, data: [], stats: { totalProducts: 0 }, _debug: { error: 'No wallet in JWT' } });
      }

      // ── Step 1: Fetch on-chain NFTs ──
      const { status: nftStatus, data: nftData } = await apiFetch(
        BLOCKCHAIN_BASE,
        `/nft?address=${wallet}&chainId=${chainId}`
      );

      const rawNfts = (nftStatus === 200 && nftData?.result) ? nftData.result : [];
      console.log('[PRODUCTS] Blockchain returned', rawNfts.length, 'NFTs, status:', nftStatus);

      // ── Step 1b: Get known ZAI contract addresses ──
      const zaiContracts = await getZaiContracts();

      // ── Step 2: Filter to ZAI NFTs only, then parse ──
      const currencyMap = await getCurrencyMap();
      const products = [];

      for (const nft of rawNfts) {
        if (zaiContracts.size > 0) {
          const addr = (nft.token_address || '').toLowerCase();
          if (!zaiContracts.has(addr)) continue;
        }

        if (!nft.metadata && nft.token_uri) {
          console.log('[PRODUCTS] Fetching metadata from token_uri:', nft.token_uri);
          const fetched = await fetchTokenMetadata(nft.token_uri);
          if (fetched) {
            nft.metadata = JSON.stringify(fetched);
          }
        }

        const product = parseNftToProduct(nft, currencyMap);
        products.push(product);
      }

      console.log('[PRODUCTS] Products parsed:', products.length, '(filtered from', rawNfts.length, 'NFTs)');

      // ── Step 3: Insurance from DB ──
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

      // ── Step 4: Claim dates from DB ──
      let claimMap = {};
      if (dbReady && pool && products.length > 0) {
        try {
          const productIds = products.map(p => p.id);
          const claimResult = await pool.query(
            `SELECT product_id, claimed_at FROM product_claims WHERE user_id = $1 AND product_id = ANY($2)`,
            [decoded.userId, productIds]
          );
          for (const row of claimResult.rows) {
            claimMap[row.product_id] = row.claimed_at;
          }
        } catch (claimErr) {
          console.error('[PRODUCTS] Claim date query failed:', claimErr.message);
        }
      }

      // ── Step 5: Return enriched products ──
      // DB claimed_at is the source of truth; blockchain timestamp is fallback
      const enriched = products.map(p => ({
        ...p,
        claimedAt: claimMap[p.id] || p.claimedAt || null,
        insurance: insuranceMap[p.id] || { active: false, status: null, certificateId: null },
      }));

      return res.json({
        success: true,
        data: enriched,
        stats: {
          totalProducts: enriched.length,
          activeInsurance: Object.values(insuranceMap).filter(i => i.active).length,
          pendingClaims: 0,
        },
        _debug: {
          chainId,
          wallet,
          blockchainStatus: nftStatus,
          rawNftCount: rawNfts.length,
          zaiContractsLoaded: zaiContracts.size,
          productsFound: enriched.length,
          dbConnected: dbReady,
          claimDatesFound: Object.keys(claimMap).length,
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

  // ══════════════════════════════════════════════════════════════
  // POST /api/products/:productId/activate-insurance
  // ══════════════════════════════════════════════════════════════
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
        return res.status(400).json({ success: false, error: 'Insurance already active' });
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
        return res.status(400).json({ success: false, error: 'Missing profile fields', missingFields: missingCustomer });
      }

      const device = {
        deviceType: body.deviceType || 1,
        makeName: body.makeName || 'zai',
        makeId: body.makeId || 1,
        model: body.model || '',
        serial: body.serial || '',
        price: parseFloat(body.price) || 0,
        length: body.length || '',
        purchasingdate: body.purchasingdate || new Date().toISOString().split('T')[0],
      };

      const sasProductIds = (process.env.SAS_PRODUCT_IDS || '').split(',').map(Number).filter(Boolean);
      const sasPartnerId = parseInt(process.env.SAS_PARTNER_ID) || 0;

      const sasPayload = {
        customer,
        device: {
          ...device,
          productIds: sasProductIds,
          partnerId: sasPartnerId,
        },
      };

      const regId = existing.rows[0]?.id || genId();
      if (existing.rows[0]) {
        await pool.query(
          `UPDATE insurance_registrations SET sas_status='pending', sas_payload=$2, updated_at=NOW() WHERE id=$1`,
          [regId, JSON.stringify(sasPayload)]
        );
      } else {
        await pool.query(
          `INSERT INTO insurance_registrations (id, user_id, product_id, sas_status, sas_payload, created_at, updated_at)
           VALUES ($1, $2, $3, 'pending', $4, NOW(), NOW())`,
          [regId, decoded.userId, productId, JSON.stringify(sasPayload)]
        );
      }

      try {
        const sasResult = await callSasApi(sasPayload);
        const certId = sasResult.certificateId || sasResult.certificate_id || null;
        const txId = sasResult.transactionId || sasResult.transaction_id || null;

        await pool.query(
          `UPDATE insurance_registrations SET sas_status='success', sas_certificate_id=$2, sas_transaction_id=$3, sas_response=$4, updated_at=NOW() WHERE id=$1`,
          [regId, certId, txId, JSON.stringify(sasResult)]
        );

        return res.json({
          success: true,
          data: { certificateId: certId, transactionId: txId },
          message: 'Insurance activated successfully',
        });
      } catch (sasErr) {
        await pool.query(
          `UPDATE insurance_registrations SET sas_status='error', sas_response=$2, updated_at=NOW() WHERE id=$1`,
          [regId, JSON.stringify({ error: sasErr.message })]
        );
        return res.status(502).json({ success: false, error: sasErr.message, detail: 'SAS API call failed' });
      }
    } catch (err) {
      console.error('[PRODUCTS] Insurance activation error:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // ══════════════════════════════════════════════════════════════
  // GET /api/products/:productId/insurance
  // ══════════════════════════════════════════════════════════════
  const insStatusMatch = fullPath.match(/^([^/]+)\/insurance$/);
  if (insStatusMatch && req.method === 'GET') {
    const decoded = authenticate(req);
    if (!decoded) return res.status(401).json({ error: 'No token provided' });
    try {
      const db = await getDB();
      if (!db) return res.status(503).json({ success: false, error: 'Database unavailable' });
      await db.initDB();
      const pool = db.getPool();
      const result = await pool.query(
        `SELECT sas_status, sas_certificate_id, sas_transaction_id, created_at
         FROM insurance_registrations WHERE user_id = $1 AND product_id = $2
         ORDER BY created_at DESC LIMIT 1`,
        [decoded.userId, insStatusMatch[1]]
      );
      const row = result.rows[0];
      return res.json({
        success: true,
        data: row ? {
          active: row.sas_status === 'success',
          status: row.sas_status,
          certificateId: row.sas_certificate_id,
          transactionId: row.sas_transaction_id,
          activatedAt: row.created_at,
        } : { active: false, status: null },
      });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // ══════════════════════════════════════════════════════════════
  // GET /api/products/makes
  // ══════════════════════════════════════════════════════════════
  if (fullPath === 'makes' && req.method === 'GET') {
    try {
      const makes = await fetchSasMakes();
      return res.json({ success: true, data: makes });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // ══════════════════════════════════════════════════════════════
  // POST /api/products/claim
  //
  // After a successful RWA claim, save the claim date in the DB
  // so the dashboard shows accurate "claimed X ago" timestamps.
  // ══════════════════════════════════════════════════════════════
  if (fullPath === 'claim' && req.method === 'POST') {
    const decoded = authenticate(req);
    if (!decoded) return res.status(401).json({ error: 'No token provided' });
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const { ids, secrets, wallet } = body || {};

      if (!ids || !secrets || !wallet) {
        return res.status(400).json({ success: false, error: 'Missing required fields: ids, secrets, wallet' });
      }
      if (!Array.isArray(ids) || !Array.isArray(secrets) || ids.length !== secrets.length) {
        return res.status(400).json({ success: false, error: 'ids and secrets must be arrays of equal length' });
      }

      const { status, data } = await apiFetch(RWA_BASE, '/nft/claim', {
        method: 'POST',
        body: JSON.stringify({ ids, secrets, wallet }),
      });

      if (status === 200 && data?.success !== false) {
        // ── Save claim timestamp in DB ──
        try {
          const db = await getDB();
          if (db) {
            await db.initDB();
            const pool = db.getPool();
            const claimedProducts = data?.data || data?.result || [];
            for (let i = 0; i < ids.length; i++) {
              const rwaId = ids[i];
              // Build the product_id the same way parseNftToProduct does:
              // contractAddress-tokenId. We may not know the exact contract+tokenId yet
              // at claim time, so store the rwaId — we'll also try to match by wallet later.
              // For claimed NFTs returned in the response, use their actual address+tokenId.
              const claimed = Array.isArray(claimedProducts) ? claimedProducts[i] : null;
              const productId = claimed?.token_address && claimed?.token_id
                ? `${claimed.token_address.toLowerCase()}-${claimed.token_id}`
                : `rwa-${rwaId}`;
              const productName = claimed?.name || claimed?.metadata?.name || '';

              await pool.query(
                `INSERT INTO product_claims (id, user_id, product_id, wallet, product_name, claimed_at)
                 VALUES ($1, $2, $3, $4, $5, NOW())
                 ON CONFLICT (user_id, product_id) DO NOTHING`,
                [genId(), decoded.userId, productId, wallet, productName]
              );
            }
            console.log('[PRODUCTS] Claim dates saved for', ids.length, 'product(s)');
          }
        } catch (dbErr) {
          // Non-fatal: claim succeeded on-chain, just DB write failed
          console.error('[PRODUCTS] Claim DB write failed (non-fatal):', dbErr.message);
        }

        return res.json({ success: true, data });
      } else {
        return res.status(status || 500).json({ success: false, error: data?.error || data?.message || 'Claim failed' });
      }
    } catch (err) {
      console.error('[PRODUCTS] Claim error:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // ══════════════════════════════════════════════════════════════
  // GET /api/products/catalog
  // ══════════════════════════════════════════════════════════════
  if (fullPath === 'catalog' && req.method === 'GET') {
    try {
      const { status, data } = await apiFetch(RWA_BASE, '/rwa?limit=200');
      if (status === 200 && data) {
        const rwas = Array.isArray(data) ? data : (data.data || data.result || []);
        const catalog = rwas.map(r => ({
          id: r.id,
          name: r.name,
          type: r.type,
          contractAddress: r.contractAddress,
          chainId: r.chainId,
          isBuyable: r.isBuyable || false,
          isClaimable: r.isClaimable || false,
          data: r.data || null,
        }));
        return res.json({ success: true, data: catalog });
      }
      return res.json({ success: true, data: [] });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // ══════════════════════════════════════════════════════════════
  // GET /api/products/:productId
  // ══════════════════════════════════════════════════════════════
  if (fullPath && !fullPath.includes('/') && req.method === 'GET') {
    return res.json({ success: true, data: { id: fullPath } });
  }

  return res.status(404).json({ error: 'Route not found' });
}
