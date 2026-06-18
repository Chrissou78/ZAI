// api/products/[...path].js
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import {
  authenticate,
  applyRateLimit,
  signToken,
  sanitizeString,
  checkBodySize,
  JWT_SECRET,
} from '../middleware.js';

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

// ── Encrypt/decrypt helpers ──
function encryptBuffer(buffer) {
  const key = crypto.randomBytes(32);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
  const authTag = cipher.getAuthTag();
  const result = Buffer.concat([iv, authTag, encrypted]);
  return {
    encryptedBuffer: result,
    keyHex: key.toString('hex'),
  };
}

function decryptBuffer(encryptedBuffer, keyHex) {
  const key = Buffer.from(keyHex, 'hex');
  const iv = encryptedBuffer.subarray(0, 12);
  const authTag = encryptedBuffer.subarray(12, 28);
  const data = encryptedBuffer.subarray(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(data), decipher.final()]);
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

function getZaiContractsFromMap(rwaMap) {
  return new Set(rwaMap.keys());
}

// ── Known proof images (fallback when DB record exists but image URL needs resolution) ──
const KNOWN_PROOF_IMAGES = {
  'mpxr986qj1gvv250': 'https://ipfs.io/ipfs/QmfFQJEE9X9uKGGwDRf6fDZ8hPsKLKJUjwXLjVeYvjrAR7',
};

const API_KEY = () => process.env.WALLETTWO_API_KEY;
const BLOCKCHAIN_BASE = 'https://api.wallettwo.com/blockchain/v1/api';
const RWA_BASE = 'https://rwa.onchainlabs.ch/v1/api';
const CHAIN_ID = () => process.env.CHAIN_ID || '137';

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
  const timeout = setTimeout(() => controller.abort(), 4000);
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

// The Experience Card may be named "Experience Card" or "Experience Club
// Card". Match on both keywords so detection is consistent everywhere.
function isExperienceCardName(name) {
  const s = (name || '').toLowerCase();
  return s.includes('experience') && s.includes('card');
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

// ── Email notification ──
async function sendAdminNotificationEmail({ claimId, userName, productName, proofUrl }) {
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  const ADMIN_EMAIL = process.env.ADMIN_NOTIFICATION_EMAIL || 'christopher.fourquier@onchainlabs.ch';

  if (!RESEND_API_KEY) {
    console.log('[EMAIL] No RESEND_API_KEY configured — skipping email notification');
    return;
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'ZAI Club <noreply@zai.ch>',
      to: [ADMIN_EMAIL],
      subject: `[ZAI] New claim request from ${sanitizeString(userName)}`,
      html: `
        <h2>New Product Claim Request</h2>
        <p><strong>User:</strong> ${sanitizeString(userName)}</p>
        <p><strong>Product:</strong> ${sanitizeString(productName)}</p>
        <p><strong>Claim ID:</strong> ${sanitizeString(claimId)}</p>
        <p><strong>Proof of purchase:</strong><br/><img src="${sanitizeString(proofUrl)}" style="max-width:400px;border-radius:8px;" /></p>
        <p><a href="https://zai-club.vercel.app/admin">Review in Admin Panel →</a></p>
      `,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Email send failed: ${err}`);
  }
}

// ── Helper: resolve proof image URL ──
function resolveProofImageUrl(claimRow) {
  if (claimRow.proof_image_url && claimRow.proof_image_url.startsWith('http')) {
    return claimRow.proof_image_url;
  }
  if (KNOWN_PROOF_IMAGES[claimRow.id]) {
    return KNOWN_PROOF_IMAGES[claimRow.id];
  }
  if (claimRow.proof_image_cid) {
    return `https://ipfs.io/ipfs/${claimRow.proof_image_cid}`;
  }
  return '';
}

export default async function handler(req, res) {
  const fullPath = req.url.split('?')[0].replace(/^\/api\/products\/?/, '').replace(/\/$/, '');

  // ══════════════════════════════════════════════════════════════
  // GET /api/products/user/:userId
  // ══════════════════════════════════════════════════════════════
  const userMatch = fullPath.match(/^user\/(.+)$/);
  if (userMatch && req.method === 'GET') {
    const decoded = authenticate(req);
    if (!decoded) return res.status(401).json({ error: 'No token provided' });

    // ── Rate limit: 30 req/min ──
    if (applyRateLimit(req, res, 'products:r1', 30, 60000)) return;

    try {
      const wallet = decoded.wallet;
      const chainId = CHAIN_ID();

      console.log('[PRODUCTS] userId:', decoded.userId, 'wallet:', wallet, 'chainId:', chainId);

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

      // Keep the profile wallet in sync with the live session wallet. The
      // collection always follows decoded.wallet, so admin-side minting
      // (which falls back to the profile wallet) targets the same address.
      if (dbReady && pool) {
        try {
          await pool.query(
            `UPDATE user_profiles SET wallet = $1, updated_at = NOW()
             WHERE user_id = $2 AND (wallet IS NULL OR wallet <> $1)`,
            [wallet, decoded.userId]
          );
        } catch (syncErr) {
          console.error('[PRODUCTS] wallet sync skipped:', syncErr.message);
        }
      }

      // ── Steps 1 + 1b + 2 prep: run the on-chain NFT fetch and the
      // catalog lookups together so a cold request does not pay for them
      // one after another. ──
      const [nftResult, zaiRwaMap, currencyMap] = await Promise.all([
        apiFetch(BLOCKCHAIN_BASE, `/nft?address=${wallet}&chainId=${chainId}`),
        getZaiRwaMap(),
        getCurrencyMap(),
      ]);

      const { status: nftStatus, data: nftData } = nftResult;
      const rawNfts = (nftStatus === 200 && nftData?.result) ? nftData.result : [];
      console.log('[PRODUCTS] Blockchain returned', rawNfts.length, 'NFTs, status:', nftStatus);

      const zaiContracts = getZaiContractsFromMap(zaiRwaMap);

      // ── Filter to ZAI NFTs only, then parse ──
      const zaiNfts = zaiContracts.size > 0
        ? rawNfts.filter(nft => zaiContracts.has((nft.token_address || '').toLowerCase()))
        : rawNfts;

      // ── Build products. Prefer the cached RWA catalog (no network) for
      // known ZAI contracts and only fall back to a per-NFT IPFS metadata
      // fetch for NFTs we can't resolve from the catalog or embedded data.
      // This keeps the common path free of slow IPFS round-trips. ──
      const asValueObj = (field, fallback) => {
        if (field && typeof field === 'object' && 'value' in field) return field;
        if (typeof field === 'string' && field) return { value: field };
        if (typeof fallback === 'string' && fallback) return { value: fallback };
        return { value: '' };
      };

      const needsIpfs = [];
      for (const nft of zaiNfts) {
        const addr = (nft.token_address || '').toLowerCase();
        const rwa = zaiRwaMap.get(addr);
        if (!nft.metadata && rwa) {
          const rwaData = rwa.data || {};
          nft.metadata = JSON.stringify({
            name: rwa.name || 'ZAI Product',
            rwaId: rwa.id,
            rwa: { name: rwa.name },
            data: {
              image:       asValueObj(rwaData.image,       rwa.image),
              description: asValueObj(rwaData.description, rwa.description),
              price:       asValueObj(rwaData.price,       ''),
              currency:    asValueObj(rwaData.currency,    rwa.currencyId),
              materials:   asValueObj(rwaData.materials,   ''),
              collection:  asValueObj(rwaData.collection,  ''),
              insurance:   asValueObj(rwaData.insurance,   ''),
            },
          });
        } else if (!nft.metadata && nft.token_uri) {
          needsIpfs.push(nft);
        }
      }

      // Only unknown NFTs hit IPFS, in parallel with a bounded timeout.
      if (needsIpfs.length > 0) {
        await Promise.all(
          needsIpfs.map(async (nft) => {
            const fetched = await fetchTokenMetadata(nft.token_uri);
            if (fetched) nft.metadata = JSON.stringify(fetched);
          })
        );
      }

      const products = zaiNfts.map(nft => parseNftToProduct(nft, currencyMap));
            // ── Step 3: Enrich with DB data (insurance, claim dates) ──
      if (dbReady && pool) {
        try {
          const productIds = products.map(p => p.id);
          if (productIds.length > 0) {
            // Insurance registrations
            const insResult = await pool.query(
              `SELECT product_id, sas_status AS status, created_at FROM insurance_registrations
               WHERE user_id = $1 AND product_id = ANY($2)
               ORDER BY created_at DESC`,
              [decoded.userId, productIds]
            );
            const insMap = {};
            for (const row of insResult.rows) {
              if (!insMap[row.product_id]) insMap[row.product_id] = row;
            }
            for (const p of products) {
              if (insMap[p.id]) {
                p.insuranceStatus = insMap[p.id].status;
                p.insuranceDate = insMap[p.id].created_at;
              }
            }

            // Claim dates
            const claimResult = await pool.query(
              `SELECT product_id, claimed_at FROM product_claims
               WHERE user_id = $1 AND product_id = ANY($2)`,
              [decoded.userId, productIds]
            );
            const claimMap = {};
            for (const row of claimResult.rows) {
              claimMap[row.product_id] = row.claimed_at;
            }
            for (const p of products) {
              if (claimMap[p.id]) p.claimedAt = claimMap[p.id];
            }
          }
        } catch (dbErr) {
          console.error('[PRODUCTS] DB enrichment failed:', dbErr.message);
        }
      }

      // ── Step 3b: Back-fill missing claim dates from blockchain timestamp ──
      for (const p of products) {
        if (!p.claimedAt && p.metadata?.block_timestamp) {
          p.claimedAt = p.metadata.block_timestamp;
        }
      }

      console.log('[PRODUCTS] Returning', products.length, 'products for wallet', wallet);

      // Separate the Experience Card from the regular collection. The card
      // is a membership artifact, not a catalogue product, and the frontend
      // reads it from `experienceCard` to drive exclusive access.
      const experienceCard = products.find(p => isExperienceCardName(p.name)) || null;
      const collection = experienceCard
        ? products.filter(p => p.id !== experienceCard.id)
        : products;

      return res.json({
        success: true,
        data: collection,
        experienceCard,
        stats: {
          totalProducts: collection.length,
          hasExperienceCard: !!experienceCard,
        },
      });
    } catch (err) {
      console.error('[PRODUCTS] user products error:', err);
      return res.status(500).json({ error: 'Failed to fetch products', detail: err.message });
    }
  }

  // ══════════════════════════════════════════════════════════════
  // POST /api/products/:productId/activate-insurance
  // ══════════════════════════════════════════════════════════════
  const insuranceActivateMatch = fullPath.match(/^([^/]+)\/activate-insurance$/);
  if (insuranceActivateMatch && req.method === 'POST') {
    const decoded = authenticate(req);
    if (!decoded) return res.status(401).json({ error: 'Unauthorized' });

    // ── Rate limit: 5 req/min ──
    if (applyRateLimit(req, res, 'products:r2', 5, 60000)) return;

    // ── Body size guard ──
    if (checkBodySize(req, res, 1 * 1024 * 1024)) return; // 1 MB

    const productId = insuranceActivateMatch[1];

    try {
      const db = await getDB();
      if (!db) return res.status(503).json({ error: 'Database not available' });
      await db.initDB();
      const pool = db.getPool();

      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

      // Sanitize user-provided strings
      const sasPayload = {
        make: sanitizeString(body.make || ''),
        model: sanitizeString(body.model || ''),
        serialNumber: sanitizeString(body.serialNumber || ''),
        purchaseDate: sanitizeString(body.purchaseDate || ''),
        value: body.value,
        currency: sanitizeString(body.currency || 'CHF'),
      };

      // Check for existing registration
      const existing = await pool.query(
        `SELECT id, status FROM insurance_registrations
         WHERE user_id = $1 AND product_id = $2
         ORDER BY created_at DESC LIMIT 1`,
        [decoded.userId, productId]
      );

      let registrationId;
      if (existing.rows.length > 0) {
        registrationId = existing.rows[0].id;
        await pool.query(
          `UPDATE insurance_registrations
           SET status = 'pending', sas_payload = $1, updated_at = NOW()
           WHERE id = $2`,
          [JSON.stringify(sasPayload), registrationId]
        );
      } else {
        const insId = genId();
        await pool.query(
          `INSERT INTO insurance_registrations (id, user_id, product_id, status, sas_payload, created_at)
           VALUES ($1, $2, $3, 'pending', $4, NOW())`,
          [insId, decoded.userId, productId, JSON.stringify(sasPayload)]
        );
        registrationId = insId;
      }

      // Call SAS API
      try {
        const sasResult = await callSasApi(sasPayload);
        await pool.query(
          `UPDATE insurance_registrations SET status = 'active', sas_response = $1, updated_at = NOW() WHERE id = $2`,
          [JSON.stringify(sasResult), registrationId]
        );
        return res.json({ success: true, status: 'active', registrationId, sasResult });
      } catch (sasErr) {
        await pool.query(
          `UPDATE insurance_registrations SET status = 'error', sas_response = $1, updated_at = NOW() WHERE id = $2`,
          [JSON.stringify({ error: sasErr.message }), registrationId]
        );
        return res.status(502).json({ error: 'Insurance activation failed', detail: sasErr.message });
      }
    } catch (err) {
      console.error('[PRODUCTS] insurance activation error:', err);
      return res.status(500).json({ error: 'Internal error', detail: err.message });
    }
  }

  // ══════════════════════════════════════════════════════════════
  // GET /api/products/:productId/insurance
  // ══════════════════════════════════════════════════════════════
  const insuranceGetMatch = fullPath.match(/^([^/]+)\/insurance$/);
  if (insuranceGetMatch && req.method === 'GET') {
    const decoded = authenticate(req);
    if (!decoded) return res.status(401).json({ error: 'Unauthorized' });

    const productId = insuranceGetMatch[1];

    try {
      const db = await getDB();
      if (!db) return res.json({ success: true, data: null });
      await db.initDB();
      const pool = db.getPool();

      const result = await pool.query(
        `SELECT id, status, sas_payload, sas_response, created_at, updated_at
         FROM insurance_registrations
         WHERE user_id = $1 AND product_id = $2
         ORDER BY created_at DESC LIMIT 1`,
        [decoded.userId, productId]
      );

      return res.json({ success: true, data: result.rows[0] || null });
    } catch (err) {
      console.error('[PRODUCTS] insurance fetch error:', err);
      return res.status(500).json({ error: 'Internal error' });
    }
  }

  // ══════════════════════════════════════════════════════════════
  // GET /api/products/makes
  // ══════════════════════════════════════════════════════════════
  if (fullPath === 'makes' && req.method === 'GET') {
    const decoded = authenticate(req);
    if (!decoded) return res.status(401).json({ error: 'Unauthorized' });

    try {
      const makes = await fetchSasMakes();
      return res.json({ success: true, data: makes });
    } catch (err) {
      console.error('[PRODUCTS] fetchSasMakes error:', err);
      return res.status(500).json({ error: 'Failed to fetch makes' });
    }
  }

  // ══════════════════════════════════════════════════════════════
  // POST /api/products/claim — claim RWAs (batch store)
  // ══════════════════════════════════════════════════════════════
  if (fullPath === 'claim' && req.method === 'POST') {
    const decoded = authenticate(req);
    if (!decoded) return res.status(401).json({ error: 'Unauthorized' });

    // ── Rate limit: 10 req/min ──
    if (applyRateLimit(req, res, 'products:r3', 10, 60000)) return;

    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const { claims } = body; // array of { productId, tokenAddress, tokenId }

      if (!Array.isArray(claims) || claims.length === 0) {
        return res.status(400).json({ error: 'No claims provided' });
      }

      const db = await getDB();
      if (!db) return res.status(503).json({ error: 'Database not available' });
      await db.initDB();
      const pool = db.getPool();

      const results = [];
      for (const claim of claims) {
        const claimId = genId();
        try {
          await pool.query(
            `INSERT INTO product_claims (id, user_id, product_id, claimed_at)
             VALUES ($1, $2, $3, NOW())
             ON CONFLICT (user_id, product_id) DO NOTHING`,
            [claimId, decoded.userId, sanitizeString(claim.productId || '')]
          );
          results.push({ productId: claim.productId, success: true });
        } catch (claimErr) {
          results.push({ productId: claim.productId, success: false, error: claimErr.message });
        }
      }

      return res.json({ success: true, results });
    } catch (err) {
      console.error('[PRODUCTS] claim error:', err);
      return res.status(500).json({ error: 'Failed to process claims' });
    }
  }

  // ══════════════════════════════════════════════════════════════
  // GET /api/products/catalog
  // ══════════════════════════════════════════════════════════════
  if (fullPath === 'catalog' && req.method === 'GET') {
    try {
      const rwaMap = await getZaiRwaMap();
      const currencyMap = await getCurrencyMap();
      const catalog = [];

      for (const [addr, rwa] of rwaMap) {
        catalog.push({
          id: rwa.id,
          name: rwa.name || 'ZAI Product',
          contractAddress: addr,
          description: rwa.description || '',
          image: rwa.image || rwa.data?.image?.value || '',
          price: formatPrice(rwa.data?.price?.value || ''),
          currency: resolveCurrency(rwa.currencyId || rwa.data?.currency?.value || '', currencyMap),
        });
      }

      return res.json({ success: true, data: catalog });
    } catch (err) {
      console.error('[PRODUCTS] catalog error:', err);
      return res.status(500).json({ error: 'Failed to fetch catalog' });
    }
  }

  // ══════════════════════════════════════════════════════════════
  // GET /api/products/claimable
  // ══════════════════════════════════════════════════════════════
  if (fullPath === 'experience-card' && req.method === 'GET') {
    const decoded = authenticate(req);
    if (!decoded) return res.status(401).json({ error: 'Unauthorized' });
    try {
      const rwaMap = await getZaiRwaMap();
      const currencyMap = await getCurrencyMap();
      let card = null;
      for (const [addr, rwa] of rwaMap) {
        if (isExperienceCardName(rwa.name)) {
          card = {
            id: rwa.id,
            rwaId: rwa.id,
            name: rwa.name || 'ZAI Experience Club Card',
            contractAddress: addr,
            description: rwa.description || rwa.data?.description?.value || '',
            image: rwa.image || rwa.data?.image?.value || '',
            price: formatPrice(rwa.data?.price?.value || ''),
            currency: resolveCurrency(rwa.currencyId || rwa.data?.currency?.value || '', currencyMap),
          };
          break;
        }
      }
      return res.json({ success: true, data: card });
    } catch (err) {
      console.error('[PRODUCTS] experience-card error:', err);
      return res.status(500).json({ error: 'Failed to fetch Experience Card' });
    }
  }

  if (fullPath === 'claimable' && req.method === 'GET') {
    try {
      const rwaMap = await getZaiRwaMap();
      const currencyMap = await getCurrencyMap();
      const claimable = [];

      for (const [addr, rwa] of rwaMap) {
        // Skip experience card
        if (isExperienceCardName(rwa.name)) continue;

        claimable.push({
          id: rwa.id,
          rwaId: rwa.id,
          name: rwa.name || 'ZAI Product',
          contractAddress: addr,
          description: rwa.description || '',
          image: rwa.image || rwa.data?.image?.value || '',
          price: formatPrice(rwa.data?.price?.value || ''),
          priceRaw: rwa.data?.price?.value || '',
          currency: resolveCurrency(rwa.currencyId || rwa.data?.currency?.value || '', currencyMap),
        });
      }

      return res.json({ success: true, data: claimable });
    } catch (err) {
      console.error('[PRODUCTS] claimable error:', err);
      return res.status(500).json({ error: 'Failed to fetch claimable products' });
    }
  }

  // ══════════════════════════════════════════════════════════════
  // GET /api/products/nft/:nftId — poll NFT mint status
  // ══════════════════════════════════════════════════════════════
  const nftStatusMatch = fullPath.match(/^nft\/(.+)$/);
  if (nftStatusMatch && req.method === 'GET') {
    const decoded = authenticate(req);
    if (!decoded) return res.status(401).json({ error: 'Unauthorized' });

    const nftId = nftStatusMatch[1];

    try {
      const { status, data } = await apiFetch(RWA_BASE, `/nft/${nftId}`);
      return res.status(status).json(data || { error: 'Not found' });
    } catch (err) {
      console.error('[PRODUCTS] nft status error:', err);
      return res.status(500).json({ error: 'Failed to check NFT status' });
    }
  }

  // ══════════════════════════════════════════════════════════════
  // POST /api/products/claim-request — proof-of-purchase submission
  // ══════════════════════════════════════════════════════════════
  if (fullPath === 'claim-request' && req.method === 'POST') {
    const decoded = authenticate(req);
    if (!decoded) return res.status(401).json({ error: 'Unauthorized' });

    // ── Rate limit: 5 req/min ──
    if (applyRateLimit(req, res, 'products:r5', 5, 60000)) return;

    // ── Body size guard: 10 MB ──
    if (checkBodySize(req, res, 10 * 1024 * 1024)) return;

    try {
      const db = await getDB();
      if (!db) return res.status(503).json({ error: 'Database not available' });
      await db.initDB();
      const pool = db.getPool();

      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const {
        productId,
        productName,
        proofImage,      // base64 string
        proofImageCid,   // pre-uploaded IPFS CID
        preUploadedCid,  // phone-upload flow: IPFS CID
        preUploadedKey,  // phone-upload flow: encryption key
        note,
      } = body;

      // Product name/id are optional: the admin assigns the product at
      // validation time. What we require is a proof of purchase.
      if (!proofImage && !proofImageCid && !preUploadedCid) {
        return res.status(400).json({ error: 'Proof of purchase is required' });
      }

      // Sanitize user inputs
      const safeProductName = sanitizeString(productName || '');
      const safeNote = sanitizeString(note || '');

      // Resolve the submitter's name and email so admins can see who sent
      // the request instead of a bare user id.
      let userName = (decoded.name || `${decoded.givenName || ''} ${decoded.familyName || ''}`).trim();
      let userEmail = '';
      try {
        const up = await pool.query(
          `SELECT name, given_name, family_name, email FROM user_profiles WHERE user_id = $1`,
          [decoded.userId]
        );
        if (up.rows[0]) {
          userName = userName || up.rows[0].name || `${up.rows[0].given_name || ''} ${up.rows[0].family_name || ''}`.trim();
          userEmail = up.rows[0].email || '';
        }
      } catch { /* best effort */ }

      const claimId = genId();
      let imageCid = proofImageCid || preUploadedCid || '';
      let encryptionKey = preUploadedKey || '';
      let imageUrl = '';

      // If base64 image provided, encrypt and upload to Pinata
      if (proofImage && !imageCid) {
        const imgBuffer = Buffer.from(proofImage.replace(/^data:image\/\w+;base64,/, ''), 'base64');

        const { encryptedBuffer, keyHex } = encryptBuffer(imgBuffer);
        encryptionKey = keyHex;

        // Upload to Pinata
        const PINATA_JWT = process.env.PINATA_JWT;
        if (PINATA_JWT) {
          const formData = new FormData();
          const blob = new Blob([encryptedBuffer], { type: 'application/octet-stream' });
          formData.append('file', blob, `claim-${claimId}.enc`);
          formData.append('pinataMetadata', JSON.stringify({ name: `claim-proof-${claimId}` }));

          const pinRes = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${PINATA_JWT}` },
            body: formData,
          });

          if (pinRes.ok) {
            const pinData = await pinRes.json();
            imageCid = pinData.IpfsHash;
            imageUrl = `https://ipfs.io/ipfs/${imageCid}`;
          } else {
            console.error('[PRODUCTS] Pinata upload failed:', await pinRes.text());
          }
        }
      } else if (imageCid) {
        imageUrl = `https://ipfs.io/ipfs/${imageCid}`;
      }

      // Store in DB
      await pool.query(
        `INSERT INTO product_claim_requests
          (id, user_id, user_name, user_email, product_id, product_name, proof_image_cid, proof_image_url, encryption_key, note, wallet, status, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'pending', NOW())`,
        [
          claimId,
          decoded.userId,
          sanitizeString(userName || ''),
          sanitizeString(userEmail || ''),
          sanitizeString(productId || ''),
          safeProductName,
          sanitizeString(imageCid),
          sanitizeString(imageUrl),
          encryptionKey,
          safeNote,
          decoded.wallet || '',
        ]
      );

      // Send admin notification email (non-blocking)
      sendAdminNotificationEmail({
        claimId,
        userName: decoded.name || decoded.userId,
        productName: safeProductName,
        proofUrl: imageUrl,
      }).catch(err => console.error('[EMAIL] notification failed:', err.message));

      return res.json({ success: true, claimId, status: 'pending' });
    } catch (err) {
      console.error('[PRODUCTS] claim-request error:', err);
      return res.status(500).json({ error: 'Failed to submit claim request', detail: err.message });
    }
  }

  // ══════════════════════════════════════════════════════════════
  // GET /api/products/claim-requests
  // ══════════════════════════════════════════════════════════════
  if (fullPath === 'claim-requests' && req.method === 'GET') {
    const decoded = authenticate(req);
    if (!decoded) return res.status(401).json({ error: 'Unauthorized' });

    // ── Rate limit: 30 req/min ──
    if (applyRateLimit(req, res, 'products:r6', 30, 60000)) return;

    try {
      const db = await getDB();
      if (!db) return res.json({ success: true, data: [] });
      await db.initDB();
      const pool = db.getPool();

      const { searchParams } = new URL(req.url, `http://${req.headers.host}`);
      const mine = searchParams.get('mine');
      const statusFilter = searchParams.get('status');

      let query;
      let params;

      // ── Admin sees all; non-admin only sees their own ──
      const isAdminUser = await db.isAdmin(decoded);

      if (mine === 'true' || !isAdminUser) {
        // User's own claims
        query = `SELECT * FROM product_claim_requests WHERE user_id = $1 ORDER BY created_at DESC`;
        params = [decoded.userId];
      } else {
        // Admin: all claims
        query = `SELECT * FROM product_claim_requests ORDER BY created_at DESC`;
        params = [];
      }

      if (statusFilter) {
        if (params.length > 0) {
          query = query.replace('ORDER BY', `AND status = $2 ORDER BY`);
        } else {
          query = query.replace('ORDER BY', `WHERE status = $1 ORDER BY`);
        }
        params.push(sanitizeString(statusFilter));
      }

      const result = await pool.query(query, params);

      const data = result.rows.map(row => {
        const item = {
          id: row.id,
          userId: row.user_id,
          userName: row.user_name || '',
          userEmail: row.user_email || '',
          productId: row.product_id,
          productName: row.product_name,
          note: row.note,
          status: row.status,
          adminNote: row.admin_note,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          proofImageUrl: resolveProofImageUrl(row),
        };

        // Only admin gets the decryption key
        if (isAdminUser && row.encryption_key) {
          item.encryptionKey = row.encryption_key;
        }

        return item;
      });

      return res.json({ success: true, data });
    } catch (err) {
      console.error('[PRODUCTS] claim-requests error:', err);
      return res.status(500).json({ error: 'Failed to fetch claim requests' });
    }
  }

  // ══════════════════════════════════════════════════════════════
  // GET /api/products/claim-proof/:claimId — admin fetches decrypted proof
  // ══════════════════════════════════════════════════════════════
  const proofMatch = fullPath.match(/^claim-proof\/(.+)$/);
  if (proofMatch && req.method === 'GET') {
    const decoded = authenticate(req);
    if (!decoded) return res.status(401).json({ error: 'Unauthorized' });

    const claimId = proofMatch[1];

    try {
      const db = await getDB();
      if (!db) return res.status(503).json({ error: 'Database not available' });
      await db.initDB();
      const pool = db.getPool();

      const result = await pool.query(
        `SELECT * FROM product_claim_requests WHERE id = $1`,
        [claimId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Claim not found' });
      }

      const claim = result.rows[0];

      // ── Owner or admin check ──
      const isAdminUser = await db.isAdmin(decoded);
      if (claim.user_id !== decoded.userId && !isAdminUser) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      // If not encrypted, redirect to IPFS
      if (!claim.encryption_key) {
        const url = resolveProofImageUrl(claim);
        if (url) return res.redirect(url);
        return res.status(404).json({ error: 'No proof image available' });
      }

      // Fetch encrypted image from IPFS and decrypt
      const ipfsUrl = claim.proof_image_cid
        ? `https://ipfs.io/ipfs/${claim.proof_image_cid}`
        : claim.proof_image_url;

      if (!ipfsUrl) {
        return res.status(404).json({ error: 'No proof image available' });
      }

      const imgRes = await fetch(ipfsUrl);
      if (!imgRes.ok) {
        return res.status(502).json({ error: 'Failed to fetch proof image from IPFS' });
      }

      const encryptedBuffer = Buffer.from(await imgRes.arrayBuffer());
      const decryptedBuffer = decryptBuffer(encryptedBuffer, claim.encryption_key);

      res.setHeader('Content-Type', 'image/jpeg');
      res.setHeader('Cache-Control', 'private, max-age=300');
      return res.send(decryptedBuffer);
    } catch (err) {
      console.error('[PRODUCTS] claim-proof error:', err);
      return res.status(500).json({ error: 'Failed to retrieve proof image' });
    }
  }

  // ══════════════════════════════════════════════════════════════
  // POST /api/products/claim-requests/:id/validate
  // ══════════════════════════════════════════════════════════════
  const validateMatch = fullPath.match(/^claim-requests\/([^/]+)\/validate$/);
  if (validateMatch && req.method === 'POST') {
    const decoded = authenticate(req);
    if (!decoded) return res.status(401).json({ error: 'Unauthorized' });

    // ── Admin DB check ──
    const db = await getDB();
    if (!db) return res.status(503).json({ error: 'Database not available' });
    await db.initDB();
    const pool = db.getPool();

    const isAdminUser = await db.isAdmin(decoded);
    if (!isAdminUser) return res.status(403).json({ error: 'Admin access required' });

    // ── Rate limit: 20 req/min ──
    if (applyRateLimit(req, res, 'products:r7', 20, 60000)) return;

    const requestId = validateMatch[1];

    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const adminNote = sanitizeString(body.adminNote || '');

      // Fetch the claim request
      const claimResult = await pool.query(
        `SELECT * FROM product_claim_requests WHERE id = $1`,
        [requestId]
      );

      if (claimResult.rows.length === 0) {
        return res.status(404).json({ error: 'Claim request not found' });
      }

      const claimReq = claimResult.rows[0];

      if (claimReq.status !== 'pending') {
        return res.status(400).json({ error: `Claim is already ${claimReq.status}` });
      }

      // Determine which RWA to mint: the admin's selection wins, otherwise
      // the product id stored on the claim. This makes the admin's choice
      // authoritative and lets free-text claims (no stored id) still mint.
      const rwaIdToMint = (body.rwaId && String(body.rwaId).trim()) || claimReq.product_id || '';

      // Persist it so the claim record reflects what was minted.
      if (rwaIdToMint && rwaIdToMint !== claimReq.product_id) {
        await pool.query(
          `UPDATE product_claim_requests SET product_id = $1 WHERE id = $2`,
          [rwaIdToMint, requestId]
        );
      }

      // Trigger NFT mint if an RWA id is available
      let mintResult = null;
      let minted = false;
      if (rwaIdToMint) {
        try {
          // Prefer the wallet captured on the claim (the user's session
          // wallet, which is also what the collection queries). Fall back
          // to the profile wallet for older claims that predate this.
          let userWallet = claimReq.wallet;
          if (!userWallet) {
            const userResult = await pool.query(
              `SELECT wallet FROM user_profiles WHERE user_id = $1`,
              [claimReq.user_id]
            );
            userWallet = userResult.rows[0]?.wallet;
          }

          if (userWallet) {
            const { status: mintStatus, data: mintData } = await apiFetch(
              RWA_BASE,
              `/rwa/${rwaIdToMint}/mint`,
              {
                method: 'POST',
                body: JSON.stringify({ wallet: userWallet, address: userWallet }),
              }
            );

            const mintOk = mintStatus >= 200 && mintStatus < 300 && mintData?.success !== false;
            mintResult = {
              success: mintOk,
              status: mintStatus,
              data: mintData,
              error: mintOk
                ? undefined
                : (mintData?.message || mintData?.error || `Mint failed (HTTP ${mintStatus})`),
            };

            if (mintOk) {
              minted = true;
              await pool.query(
                `INSERT INTO product_claims (id, user_id, product_id, claimed_at)
                 VALUES ($1, $2, $3, NOW())
                 ON CONFLICT (user_id, product_id) DO NOTHING`,
                [genId(), claimReq.user_id, rwaIdToMint]
              );
            }
          } else {
            mintResult = { success: false, error: 'No wallet on file for this user' };
          }
        } catch (mintErr) {
          console.error('[PRODUCTS] Auto-mint after validation failed:', mintErr.message);
          mintResult = { success: false, error: mintErr.message };
        }
      } else {
        mintResult = { success: false, error: 'No product selected to mint' };
      }

      // Only mark the claim validated once the mint actually succeeded.
      // On failure the claim stays pending so the admin can fix the cause
      // and retry, or reject it, instead of it being stuck as "validated".
      if (minted) {
        await pool.query(
          `UPDATE product_claim_requests
           SET status = 'validated', admin_note = $1, updated_at = NOW()
           WHERE id = $2`,
          [adminNote, requestId]
        );
      } else {
        await pool.query(
          `UPDATE product_claim_requests
           SET admin_note = $1, updated_at = NOW()
           WHERE id = $2`,
          [adminNote, requestId]
        );
      }

      return res.json({
        success: true,
        status: minted ? 'validated' : 'pending',
        minted,
        mintResult,
      });
    } catch (err) {
      console.error('[PRODUCTS] validate error:', err);
      return res.status(500).json({ error: 'Failed to validate claim request' });
    }
  }

  // ══════════════════════════════════════════════════════════════
  // POST /api/products/claim-requests/:id/reject
  // ══════════════════════════════════════════════════════════════
  const rejectMatch = fullPath.match(/^claim-requests\/([^/]+)\/reject$/);
  if (rejectMatch && req.method === 'POST') {
    const decoded = authenticate(req);
    if (!decoded) return res.status(401).json({ error: 'Unauthorized' });

    // ── Admin DB check ──
    const db = await getDB();
    if (!db) return res.status(503).json({ error: 'Database not available' });
    await db.initDB();
    const pool = db.getPool();

    const isAdminUser = await db.isAdmin(decoded);
    if (!isAdminUser) return res.status(403).json({ error: 'Admin access required' });

    // ── Rate limit: 20 req/min ──
    if (applyRateLimit(req, res, 'products:r8', 20, 60000)) return;

    const requestId = rejectMatch[1];

    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const adminNote = sanitizeString(body.adminNote || body.reason || '');

      const result = await pool.query(
        `SELECT status FROM product_claim_requests WHERE id = $1`,
        [requestId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Claim request not found' });
      }

      if (result.rows[0].status === 'rejected') {
        return res.status(400).json({ error: 'Claim is already rejected' });
      }

      await pool.query(
        `UPDATE product_claim_requests
         SET status = 'rejected', admin_note = $1, updated_at = NOW()
         WHERE id = $2`,
        [adminNote, requestId]
      );

      return res.json({ success: true, status: 'rejected' });
    } catch (err) {
      console.error('[PRODUCTS] reject error:', err);
      return res.status(500).json({ error: 'Failed to reject claim request' });
    }
  }

  // ══════════════════════════════════════════════════════════════
  // GET /api/products/admin/pending-count
  // ══════════════════════════════════════════════════════════════
  if (fullPath === 'admin/pending-count' && req.method === 'GET') {
    const decoded = authenticate(req);
    if (!decoded) return res.status(401).json({ error: 'Unauthorized' });

    const db = await getDB();
    if (!db) return res.json({ success: true, count: 0 });
    await db.initDB();
    const pool = db.getPool();

    const isAdminUser = await db.isAdmin(decoded);
    if (!isAdminUser) return res.status(403).json({ error: 'Admin access required' });

    try {
      const result = await pool.query(
        `SELECT COUNT(*) as count FROM product_claim_requests WHERE status = 'pending'`
      );
      return res.json({ success: true, count: parseInt(result.rows[0].count, 10) });
    } catch (err) {
      console.error('[PRODUCTS] pending-count error:', err);
      return res.status(500).json({ error: 'Failed to get pending count' });
    }
  }

  // ══════════════════════════════════════════════════════════════
  // POST /api/products/claim-upload/create-token
  // ══════════════════════════════════════════════════════════════
  if (fullPath === 'claim-upload/create-token' && req.method === 'POST') {
    const decoded = authenticate(req);
    if (!decoded) return res.status(401).json({ error: 'Unauthorized' });

    // ── Rate limit: 10 req/min ──
    if (applyRateLimit(req, res, 'products:r9', 10, 60000)) return;

    try {
      const db = await getDB();
      if (!db) return res.status(503).json({ error: 'Database not available' });
      await db.initDB();
      const pool = db.getPool();

      const token = crypto.randomBytes(24).toString('hex');
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 min

      await pool.query(
        `CREATE TABLE IF NOT EXISTS upload_tokens (
          token TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          status TEXT DEFAULT 'pending',
          proof_image_cid TEXT,
          encryption_key TEXT,
          expires_at TIMESTAMPTZ NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW()
        )`
      );

      // Defensive migrations: a pre-existing table may lack newer columns,
      // and CREATE TABLE IF NOT EXISTS will not add them.
      await pool.query(`
        ALTER TABLE upload_tokens ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';
        ALTER TABLE upload_tokens ADD COLUMN IF NOT EXISTS proof_image_cid TEXT;
        ALTER TABLE upload_tokens ADD COLUMN IF NOT EXISTS encryption_key TEXT;
      `);

      await pool.query(
        `INSERT INTO upload_tokens (token, user_id, expires_at) VALUES ($1, $2, $3)`,
        [token, decoded.userId, expiresAt]
      );

      const baseUrl = `https://${req.headers.host}`;

      return res.json({
        success: true,
        token,
        uploadUrl: `${baseUrl}/api/products/claim-upload/${token}`,
        pageUrl: `${baseUrl}/api/products/claim-upload/${token}/page`,
        expiresAt: expiresAt.toISOString(),
      });
    } catch (err) {
      console.error('[PRODUCTS] create-token error:', err);
      return res.status(500).json({ error: 'Failed to create upload token' });
    }
  }

  // ══════════════════════════════════════════════════════════════
  // GET /api/products/claim-upload/:token/status
  // ══════════════════════════════════════════════════════════════
  const uploadStatusMatch = fullPath.match(/^claim-upload\/([^/]+)\/status$/);
  if (uploadStatusMatch && req.method === 'GET') {
    const token = uploadStatusMatch[1];

    try {
      const db = await getDB();
      if (!db) return res.status(503).json({ error: 'Database not available' });
      await db.initDB();
      const pool = db.getPool();

      const result = await pool.query(
        `SELECT status, proof_image_cid, encryption_key, expires_at FROM upload_tokens WHERE token = $1`,
        [token]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Token not found' });
      }

      const row = result.rows[0];

      if (new Date(row.expires_at) < new Date()) {
        return res.status(410).json({ error: 'Token expired' });
      }

      return res.json({
        success: true,
        status: row.status,
        proofImageCid: row.proof_image_cid || null,
        encryptionKey: row.encryption_key || null,
      });
    } catch (err) {
      console.error('[PRODUCTS] upload-status error:', err);
      return res.status(500).json({ error: 'Internal error' });
    }
  }

  // ══════════════════════════════════════════════════════════════
  // POST /api/products/claim-upload/:token — phone uploads encrypted image
  // ══════════════════════════════════════════════════════════════
  const uploadMatch = fullPath.match(/^claim-upload\/([^/]+)$/);
  if (uploadMatch && req.method === 'POST') {
    const token = uploadMatch[1];

    // ── Rate limit: 5 req/min (by token, not by IP since this is phone upload) ──
    if (applyRateLimit(req, res, 'products:r10', 5, 60000)) return;

    // ── Body size guard: 10 MB ──
    if (checkBodySize(req, res, 10 * 1024 * 1024)) return;

    try {
      const db = await getDB();
      if (!db) return res.status(503).json({ error: 'Database not available' });
      await db.initDB();
      const pool = db.getPool();

      const tokenResult = await pool.query(
        `SELECT * FROM upload_tokens WHERE token = $1`,
        [token]
      );

      if (tokenResult.rows.length === 0) {
        return res.status(404).json({ error: 'Token not found' });
      }

      const tokenRow = tokenResult.rows[0];

      if (new Date(tokenRow.expires_at) < new Date()) {
        return res.status(410).json({ error: 'Token expired' });
      }

      if (tokenRow.status === 'completed') {
        return res.status(409).json({ error: 'Image already uploaded' });
      }

      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const { image } = body; // base64 image

      if (!image) return res.status(400).json({ error: 'image is required' });

      const imgBuffer = Buffer.from(image.replace(/^data:image\/\w+;base64,/, ''), 'base64');
      const { encryptedBuffer, keyHex } = encryptBuffer(imgBuffer);

      // Upload to Pinata
      let cid = '';
      const PINATA_JWT = process.env.PINATA_JWT;

      if (PINATA_JWT) {
        const formData = new FormData();
        const blob = new Blob([encryptedBuffer], { type: 'application/octet-stream' });
        formData.append('file', blob, `upload-${token}.enc`);
        formData.append('pinataMetadata', JSON.stringify({ name: `claim-upload-${token}` }));

        const pinRes = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${PINATA_JWT}` },
          body: formData,
        });

        if (pinRes.ok) {
          const pinData = await pinRes.json();
          cid = pinData.IpfsHash;
        } else {
          console.error('[PRODUCTS] Pinata upload failed:', await pinRes.text());
          return res.status(502).json({ error: 'Image upload to IPFS failed' });
        }
      } else {
        return res.status(503).json({ error: 'IPFS upload not configured' });
      }

      // Update token record
      await pool.query(
        `UPDATE upload_tokens
         SET status = 'completed', proof_image_cid = $1, encryption_key = $2
         WHERE token = $3`,
        [cid, keyHex, token]
      );

      return res.json({ success: true, cid });
    } catch (err) {
      console.error('[PRODUCTS] claim-upload error:', err);
      return res.status(500).json({ error: 'Failed to upload image' });
    }
  }

  // ══════════════════════════════════════════════════════════════
  // GET /api/products/claim-upload/:token/page — self-contained camera UI
  // ══════════════════════════════════════════════════════════════
  const uploadPageMatch = fullPath.match(/^claim-upload\/([^/]+)\/page$/);
  if (uploadPageMatch && req.method === 'GET') {
    const token = uploadPageMatch[1];

    // Verify token exists and is valid
    try {
      const db = await getDB();
      if (db) {
        await db.initDB();
        const pool = db.getPool();
        const result = await pool.query(
          `SELECT expires_at, status FROM upload_tokens WHERE token = $1`,
          [token]
        );

        if (result.rows.length === 0) {
          res.setHeader('Content-Type', 'text/html');
          return res.status(404).send('<html><body><h1>Link expired or invalid</h1></body></html>');
        }

        if (new Date(result.rows[0].expires_at) < new Date()) {
          res.setHeader('Content-Type', 'text/html');
          return res.status(410).send('<html><body><h1>This upload link has expired</h1></body></html>');
        }

        if (result.rows[0].status === 'completed') {
          res.setHeader('Content-Type', 'text/html');
          return res.status(200).send('<html><body><h1>Image already uploaded</h1><p>You can close this page.</p></body></html>');
        }
      }
    } catch (err) {
      console.error('[PRODUCTS] upload-page token check failed:', err.message);
    }

    const uploadUrl = `https://${req.headers.host}/api/products/claim-upload/${token}`;

    const html = `<!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>ZAI – Upload Proof of Purchase</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: #f5f4f0; color: #0a0a0a;
          display: flex; flex-direction: column; align-items: center;
          min-height: 100vh; padding: 32px 16px;
        }

        .logo {
          margin-bottom: 24px;
        }

        h1 {
          font-size: 18px; font-weight: 600; letter-spacing: 0.12em;
          text-transform: uppercase; margin-bottom: 6px; color: #0a0a0a;
        }
        p {
          font-size: 13px; color: #6a6a6a; margin-bottom: 24px;
          text-align: center; line-height: 1.5; max-width: 300px;
        }

        .preview {
          max-width: 100%; max-height: 280px; border-radius: 8px;
          margin-bottom: 20px; display: none;
          border: 1px solid #e0ddd6;
        }

        input[type=file] { display: none; }

        .btn-row {
          display: flex; gap: 12px; width: 100%; max-width: 340px;
          margin-bottom: 16px;
        }

        .pick-btn {
          flex: 1; display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          padding: 22px 12px; border: 2px dashed #e0ddd6; border-radius: 8px;
          background: #fff; cursor: pointer; transition: border-color 0.2s;
          text-decoration: none;
        }
        .pick-btn:hover, .pick-btn:active { border-color: #0a0a0a; }

        .pick-btn .icon { margin-bottom: 8px; }
        .pick-btn .label {
          font-size: 12px; font-weight: 600; color: #0a0a0a;
          letter-spacing: 0.04em;
        }
        .pick-btn .sub {
          font-size: 10px; color: #6a6a6a; margin-top: 2px;
        }

        .btn {
          display: inline-block; padding: 14px 32px; border-radius: 4px;
          font-size: 11px; font-weight: 600; border: none; cursor: pointer;
          letter-spacing: 0.15em; text-transform: uppercase;
          font-family: inherit; transition: background 0.2s;
        }
        .btn-primary { background: #0a0a0a; color: #f5f4f0; }
        .btn-primary:hover { background: #2e2e2e; }
        .btn-primary:disabled { background: #ccc; color: #999; cursor: not-allowed; }

        .btn-outline {
          background: transparent; color: #0a0a0a;
          border: 1px solid #e0ddd6; font-size: 11px;
          padding: 10px 20px; border-radius: 4px; cursor: pointer;
          letter-spacing: 0.1em; text-transform: uppercase;
          font-weight: 500; font-family: inherit; transition: all 0.2s;
        }
        .btn-outline:hover { border-color: #0a0a0a; }

        #uploadBtn { display: none; margin-top: 4px; }

        .status { margin-top: 20px; font-size: 13px; color: #6a6a6a; text-align: center; }
        .success { color: #0a0a0a; font-size: 15px; font-weight: 600; }
        .error { color: #7A222E; }

        .divider {
          width: 40px; height: 1px; background: #e0ddd6; margin: 0 0 24px;
        }
      </style>
    </head>
    <body>

      <!-- ZAI Mark -->
      <div class="logo">
        <svg width="36" height="36" viewBox="0 0 35 35" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M24.4032 15.5546C24.4032 14.215 25.4329 13.1253 26.7025 13.1253H32.6908C33.9604 13.1253 34.9901 14.215 34.9901 15.5546V19.4435C34.9901 20.7831 33.9604 21.8728 32.6908 21.8728H26.7025C25.4329 21.8728 24.4032 20.7831 24.4032 19.4435V15.5546ZM12.6665 2.29837C12.6665 1.02873 13.6962 -0.000976562 14.9658 -0.000976562H20.0344C21.304 -0.000976562 22.3337 1.02873 22.3337 2.29837V32.6897C22.3337 33.9593 21.304 34.989 20.0344 34.989H14.9658C13.6962 34.989 12.6665 33.9593 12.6665 32.6897V2.29837ZM0.00012207 21.8728L3.00926 16.3144C3.28918 15.8045 3.09924 15.3946 2.58938 15.3946H0.00012207C0.0201164 14.135 1.03983 13.1253 2.29947 13.1253H10.5871V13.1553L7.54797 18.7537C7.26805 19.2635 7.45799 19.6734 7.96785 19.6734H10.5871C10.5271 20.8931 9.5274 21.8728 8.28776 21.8728H0.00012207Z" fill="#0a0a0a"/>
        </svg>
      </div>

      <h1>Upload Proof</h1>
      <p>Take or select a photo of your proof of purchase to claim your product.</p>
      <div class="divider"></div>

      <img id="preview" class="preview" />

      <div class="btn-row" id="buttons">
        <!-- Camera button -->
        <label class="pick-btn" id="cameraLabel">
          <span class="icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2v11z" stroke="#0a0a0a" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              <circle cx="12" cy="13" r="4" stroke="#0a0a0a" stroke-width="1.5"/>
            </svg>
          </span>
          <span class="label">Take Photo</span>
          <span class="sub">Open camera</span>
          <input type="file" id="cameraInput" accept="image/*" capture="environment" />
        </label>

        <!-- Gallery button -->
        <label class="pick-btn">
          <span class="icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" stroke="#0a0a0a" stroke-width="1.5"/>
              <circle cx="8.5" cy="8.5" r="1.5" fill="#0a0a0a"/>
              <polyline points="21 15 16 10 5 21" stroke="#0a0a0a" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </span>
          <span class="label">Gallery</span>
          <span class="sub">Choose image</span>
          <input type="file" id="galleryInput" accept="image/*" />
        </label>
      </div>

      <button id="uploadBtn" class="btn btn-primary">Submit Proof</button>
      <button id="retakeBtn" class="btn-outline" style="display:none; margin-top:8px;">Choose Another</button>
      <div id="status" class="status"></div>

      <script>
        const uploadUrl = "${uploadUrl}";
        let selectedFile = null;

        function handleFile(e) {
          const file = e.target.files[0];
          if (!file) return;
          selectedFile = file;
          const reader = new FileReader();
          reader.onload = (ev) => {
            document.getElementById('preview').src = ev.target.result;
            document.getElementById('preview').style.display = 'block';
            document.getElementById('buttons').style.display = 'none';
            document.getElementById('uploadBtn').style.display = 'inline-block';
            document.getElementById('retakeBtn').style.display = 'inline-block';
          };
          reader.readAsDataURL(file);
        }

        document.getElementById('cameraInput').addEventListener('change', handleFile);
        document.getElementById('galleryInput').addEventListener('change', handleFile);

        document.getElementById('retakeBtn').addEventListener('click', () => {
          selectedFile = null;
          document.getElementById('preview').style.display = 'none';
          document.getElementById('preview').src = '';
          document.getElementById('buttons').style.display = 'flex';
          document.getElementById('uploadBtn').style.display = 'none';
          document.getElementById('retakeBtn').style.display = 'none';
          document.getElementById('status').textContent = '';
          document.getElementById('cameraInput').value = '';
          document.getElementById('galleryInput').value = '';
        });

        document.getElementById('uploadBtn').addEventListener('click', async () => {
          if (!selectedFile) return;
          const btn = document.getElementById('uploadBtn');
          const status = document.getElementById('status');
          btn.disabled = true;
          btn.textContent = 'UPLOADING...';
          status.textContent = '';

          try {
            const reader = new FileReader();
            reader.onload = async (ev) => {
              try {
                const res = await fetch(uploadUrl, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ image: ev.target.result }),
                });
                const data = await res.json();
                if (data.success) {
                  document.getElementById('buttons').style.display = 'none';
                  btn.style.display = 'none';
                  document.getElementById('retakeBtn').style.display = 'none';
                  status.innerHTML = \`
                    <div style="margin-top: 8px;">
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="margin-bottom: 8px;">
                        <circle cx="12" cy="12" r="10" stroke="#0a0a0a" stroke-width="1.5"/>
                        <polyline points="8 12 11 15 16 9" stroke="#0a0a0a" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
                      </svg>
                      <div class="success">Uploaded successfully</div>
                      <p style="font-size: 12px; color: #6a6a6a; margin-top: 6px;">You can close this page and return to your dashboard.</p>
                    </div>\`;
                } else {
                  throw new Error(data.error || 'Upload failed');
                }
              } catch (err) {
                status.innerHTML = '<span class="error">' + err.message + '</span>';
                btn.disabled = false;
                btn.textContent = 'SUBMIT PROOF';
              }
            };
            reader.readAsDataURL(selectedFile);
          } catch (err) {
            status.innerHTML = '<span class="error">' + err.message + '</span>';
            btn.disabled = false;
            btn.textContent = 'SUBMIT PROOF';
          }
        });
      </script>
    </body>
    </html>`;

    res.setHeader('Content-Type', 'text/html');
    return res.send(html);
  }

  // ══════════════════════════════════════════════════════════════
  // GET /api/products/:productId — simple product fetch (catch-all)
  // ══════════════════════════════════════════════════════════════
  if (fullPath && req.method === 'GET') {
    return res.json({ success: true, productId: fullPath });
  }

  // ── 404 fallback ──
  return res.status(404).json({ error: 'Not found', path: fullPath, method: req.method });
}