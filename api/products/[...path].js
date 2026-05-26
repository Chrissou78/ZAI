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

/* ─────────────────────────────────────────────────────────
 * ZAI RWA map — caches FULL RWA objects keyed by contract
 * address so we can fall back to catalog data when the
 * blockchain-embedded metadata or token_uri is missing.
 * ───────────────────────────────────────────────────────── */
let zaiRwaCache = null;
let zaiRwaCacheTime = 0;

async function getZaiRwaMap() {
  if (zaiRwaCache && Date.now() - zaiRwaCacheTime < 3600000) return zaiRwaCache;
  try {
    const { status, data } = await apiFetch(RWA_BASE, '/rwa?limit=200');
    if (status === 200 && data) {
      const rwas = Array.isArray(data) ? data : (data.rwas || data.data || data.result || []);
      const map = new Map();
      for (const rwa of rwas) {
        if (rwa.smartContractAddress) {
          map.set(rwa.smartContractAddress.toLowerCase(), rwa);
        }
      }
      zaiRwaCache = map;
      zaiRwaCacheTime = Date.now();
      console.log('[PRODUCTS] ZAI RWA map loaded:', map.size, 'entries');
      return map;
    }
  } catch (err) {
    console.error('[PRODUCTS] RWA fetch failed:', err.message);
  }
  return new Map();
}

// Backward-compatible helper — returns the same Set the old getZaiContracts() did
function getZaiContractsFromMap(rwaMap) {
  return new Set(rwaMap.keys());
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
  // 4. Parse metadata (embedded → token_uri → RWA catalog fallback)
  // 5. Enrich with insurance from DB
  // 6. Enrich with claimedAt from DB (product_claims table)
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

      // ── Step 1b: Get known ZAI RWA data (full objects, not just addresses) ──
      const zaiRwaMap = await getZaiRwaMap();
      const zaiContracts = getZaiContractsFromMap(zaiRwaMap);

      // ── Step 2: Filter to ZAI NFTs only, then parse ──
      const currencyMap = await getCurrencyMap();
      const products = [];

      for (const nft of rawNfts) {
        if (zaiContracts.size > 0) {
          const addr = (nft.token_address || '').toLowerCase();
          if (!zaiContracts.has(addr)) continue;
        }

        // Try fetching metadata from token_uri if not already embedded
        if (!nft.metadata && nft.token_uri) {
          console.log('[PRODUCTS] Fetching metadata from token_uri:', nft.token_uri);
          const fetched = await fetchTokenMetadata(nft.token_uri);
          if (fetched) {
            nft.metadata = JSON.stringify(fetched);
          }
        }

        // ★ FALLBACK: If metadata is still missing (token_uri returned 404
        //   or had no data), use the RWA catalog data matched by contract address.
        if (!nft.metadata) {
          const addr = (nft.token_address || '').toLowerCase();
          const rwa = zaiRwaMap.get(addr);
          if (rwa) {
            console.log('[PRODUCTS] Falling back to RWA catalog data for', addr, '→', rwa.name);
            const rwaData = rwa.data || {};
            nft.metadata = JSON.stringify({
              name: rwa.name || 'ZAI Product',
              rwaId: rwa.id,
              rwa: { name: rwa.name },
              data: {
                image:       rwaData.image       || { value: rwa.image || '' },
                description: rwaData.description || { value: rwa.description || '' },
                price:       rwaData.price       || { value: '' },
                currency:    rwaData.currency    || { value: rwa.currencyId || '' },
                materials:   rwaData.materials   || { value: '' },
                collection:  rwaData.collection  || { value: '' },
                insurance:   rwaData.insurance   || { value: '' },
              },
            });
          } else {
            console.warn('[PRODUCTS] No metadata and no RWA match for', (nft.token_address || '').toLowerCase(), '— product will have no image');
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
      const enriched = products.map(p => ({
        ...p,
        claimedAt: claimMap[p.id] || p.claimedAt || null,
        insurance: insuranceMap[p.id] || { active: false, status: null, certificateId: null },
      }));

      // ── Step 5b: Auto-backfill claim dates from blockchain timestamps ──
      if (dbReady && pool) {
        for (const p of enriched) {
          if (p.claimedAt && !claimMap[p.id]) {
            try {
              await pool.query(
                `INSERT INTO product_claims (id, user_id, product_id, claimed_at, created_at)
                 VALUES ($1, $2, $3, $4, NOW())
                 ON CONFLICT (user_id, product_id) DO NOTHING`,
                [genId(), decoded.userId, p.id, new Date(p.claimedAt)]
              );
            } catch (bfErr) {
              console.error('[PRODUCTS] Backfill claim date failed for', p.id, ':', bfErr.message);
            }
          }
        }
      }

      // Separate the experience card from regular products
      const EXPERIENCE_CARD_NAMES = ['experience card', 'experience club', 'club card', 'nfc card', 'loyalty card'];
      const experienceCard = enriched.find(p => {
        const n = (p.name || '').toLowerCase();
        const rn = (p.rwaName || '').toLowerCase();
        return EXPERIENCE_CARD_NAMES.some(ex => n.includes(ex) || rn.includes(ex));
      }) || null;

      const regularProducts = enriched.filter(p => {
        const n = (p.name || '').toLowerCase();
        const rn = (p.rwaName || '').toLowerCase();
        return !EXPERIENCE_CARD_NAMES.some(ex => n.includes(ex) || rn.includes(ex));
      });

      return res.json({
        success: true,
        data: regularProducts,
        experienceCard,
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
          zaiRwaMapSize: zaiRwaMap.size,
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
        const rwas = Array.isArray(data) ? data : (data.rwas || data.data || data.result || []);
        const catalog = rwas.map(r => ({
          id: r.id,
          name: r.name,
          type: r.type,
          contractAddress: r.smartContractAddress,
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
  // GET /api/products/claimable
  // Returns all claimable RWAs (excluding experience card) with
  // their unclaimed NFT count and images
  // ══════════════════════════════════════════════════════════════
  if (fullPath === 'claimable' && req.method === 'GET') {
    try {
      const currencyMap = await getCurrencyMap();

      // Fetch all claimable RWAs
      const { status, data } = await apiFetch(RWA_BASE, '/rwa?isClaimable=true&limit=200');
      if (status !== 200 || !data) {
        return res.status(502).json({ success: false, error: 'Failed to fetch RWA list' });
      }

      const rwas = Array.isArray(data) ? data : (data.rwas || data.data || data.result || []);
      const EXPERIENCE_CARD_CONTRACT = '0x3ec471e2a682381ee75b395eff068e04b6b5da5d';

      const results = [];
      for (const r of rwas) {
        const addr = (r.smartContractAddress || '').toLowerCase();
        // Exclude experience cards
        if (addr === EXPERIENCE_CARD_CONTRACT) continue;

        // Extract fields from RWA data
        const rwaData = r.data || {};
        const rawImage = rwaData.image?.value || r.image || '';
        const rawDescription = rwaData.description?.value || r.description || '';
        const rawPrice = rwaData.price?.value || r.price || '';
        const rawCurrency = rwaData.currency?.value || r.currencyId || '';
        const rawCollection = rwaData.collection?.value || '';
        const rawMaterials = rwaData.materials?.value || '';

        results.push({
          rwaId: r.id,
          name: r.name || 'ZAI Product',
          smartContractAddress: r.smartContractAddress || '',
          chainId: r.chainId || null,
          image: rawImage,
          description: rawDescription,
          price: formatPrice(rawPrice),
          priceRaw: rawPrice,
          currency: resolveCurrency(rawCurrency, currencyMap),
          collection: rawCollection,
          materials: rawMaterials,
          available: true,
          nft: null,
        });
      }

      return res.json({
        success: true,
        data: results,
        stats: {
          total: results.length,
          available: results.length,
        },
      });
    } catch (err) {
      console.error('[PRODUCTS] claimable error:', err);
      return res.status(500).json({ success: false, error: err.message || 'Failed to load claimable products' });
    }
  }

  // ══════════════════════════════════════════════════════════════
  // POST /api/products/claim-nft
  // Proxies the WalletTwo RWA claim endpoint
  // Body: { rwaId, nftId, secret }
  // ══════════════════════════════════════════════════════════════
  if (fullPath === 'claim-nft' && req.method === 'POST') {
    const decoded = authenticate(req);
    if (!decoded) return res.status(401).json({ error: 'Authentication required' });

    const { rwaId } = req.body || {};
    if (!rwaId) return res.status(400).json({ error: 'rwaId is required' });

    const wallet = decoded.wallet;
    if (!wallet) return res.status(400).json({ error: 'No wallet found in token' });

    try {
      // ── Step 1: Call the new mint endpoint ──
      const { status: mintStatus, data: mintData } = await apiFetch(
        RWA_BASE,
        `/rwa/${rwaId}/mint`,
        {
          method: 'POST',
          body: JSON.stringify({ wallet }),
        }
      );

      if (mintStatus !== 200 || !mintData?.nft) {
        const errMsg = mintData?.message || mintData?.error || `Mint API returned ${mintStatus}`;
        console.error('[PRODUCTS] Mint failed:', errMsg, mintData);
        return res.status(mintStatus === 200 ? 500 : mintStatus).json({
          success: false,
          error: errMsg,
        });
      }

      const nft = mintData.nft;
      console.log('[PRODUCTS] Mint queued:', { nftId: nft.id, rwaId, serial: nft.serial });

      // ── Step 2: Record claim in DB (non-fatal) ──
      try {
        const db = await getDB();
        if (db) {
          await db.initDB();
          const pool = db.getPool();
          await pool.query(
            `INSERT INTO product_claims (id, user_id, product_id, wallet, product_name, claimed_at)
             VALUES ($1, $2, $3, $4, $5, NOW())
             ON CONFLICT (user_id, product_id) DO NOTHING`,
            [nft.id || genId(), decoded.userId, rwaId, wallet, '']
          );
          console.log('[PRODUCTS] DB claim record saved');
        }
      } catch (dbErr) {
        console.error('[PRODUCTS] DB claim record failed:', dbErr.message);
      }

      return res.json({
        success: true,
        nftId: nft.id,
        serial: nft.serial,
        rwaId: nft.rwaId,
        message: 'NFT created and queued for minting',
      });
    } catch (err) {
      console.error('[PRODUCTS] claim-nft error:', err);
      return res.status(500).json({ success: false, error: err.message || 'Mint failed' });
    }
  }

  // ══════════════════════════════════════════════════════════════
  // GET /api/products/nft/:nftId
  // Polls WalletTwo for NFT minting status
  // ══════════════════════════════════════════════════════════════
  const nftMatch = fullPath.match(/^nft\/(.+)$/);
  if (nftMatch && req.method === 'GET') {
    const nftId = nftMatch[1];
    try {
      const { status, data } = await apiFetch(RWA_BASE, `/nft/${nftId}`);
      if (status !== 200) {
        return res.status(status).json({ success: false, error: 'Failed to fetch NFT status' });
      }
      return res.json({ success: true, data: data });
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
