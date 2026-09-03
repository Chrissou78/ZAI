import jwt from 'jsonwebtoken';

// ══════════════════════════════════════════════════════════════
// JWT_SECRET — CRITICAL: no fallback. Crash if missing.
// ══════════════════════════════════════════════════════════════
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error(
    '[SECURITY] JWT_SECRET environment variable is NOT set. '
    + 'Refusing to start. Set a strong random secret (64+ chars) in your .env / Vercel dashboard.'
  );
}

export { JWT_SECRET };

// ══════════════════════════════════════════════════════════════
// In-memory rate limiter (per Vercel instance; swap for Redis
// when moving to dedicated server)
// ══════════════════════════════════════════════════════════════
const rateLimitStore = new Map();
const CLEANUP_INTERVAL = 60_000;
let lastCleanup = Date.now();

function cleanupExpired() {
  if (Date.now() - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = Date.now();
  const now = Date.now();
  for (const [key, entry] of rateLimitStore) {
    if (now > entry.resetAt) rateLimitStore.delete(key);
  }
}

export function rateLimit(key, maxRequests = 30, windowMs = 60_000) {
  cleanupExpired();
  const now = Date.now();
  let entry = rateLimitStore.get(key);
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + windowMs };
    rateLimitStore.set(key, entry);
  }
  entry.count++;
  if (entry.count > maxRequests) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    return { allowed: false, retryAfter };
  }
  return { allowed: true };
}

export function getClientIp(req) {
  return (
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.headers['x-real-ip'] ||
    req.socket?.remoteAddress ||
    'unknown'
  );
}

export function applyRateLimit(req, res, route, maxRequests = 30, windowMs = 60_000) {
  const ip = getClientIp(req);
  const key = `${ip}:${route}`;
  const result = rateLimit(key, maxRequests, windowMs);
  if (!result.allowed) {
    res.setHeader('Retry-After', result.retryAfter);
    res.status(429).json({ error: 'Too many requests. Please try again later.' });
    return true;
  }
  return false;
}

// ══════════════════════════════════════════════════════════════
// CORS
//
// The app is reachable on several hostnames (experience.zai.ch,
// experience.zai.swiss, zai.onchainlabs.ch, the Vercel deployment), and the
// frontend may be served from one while VITE_API_URL points at another — which
// makes every API call cross-origin. Only the events and store handlers ever
// set CORS headers, so login broke with "No 'Access-Control-Allow-Origin'
// header" the moment the app was opened on a new domain.
//
// Access-Control-Allow-Origin takes ONE origin or "*", never a comma-separated
// list, so multiple domains require echoing back the caller's origin after
// checking it against an allowlist. Vary: Origin keeps a CDN from caching one
// domain's header and serving it to another.
//
// Set ALLOWED_ORIGINS (comma-separated) to add a domain without a code change.
// ══════════════════════════════════════════════════════════════
const DEFAULT_ALLOWED_ORIGINS = [
  'https://experience.zai.ch',
  'https://experience.zai.swiss',
  'https://zai.onchainlabs.ch',
  'https://zai-chi.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000',
];

export function allowedOrigins() {
  const fromEnv = (process.env.ALLOWED_ORIGINS || '')
    .split(',').map(s => s.trim()).filter(Boolean);
  return fromEnv.length ? fromEnv : DEFAULT_ALLOWED_ORIGINS;
}

/**
 * Apply CORS headers and answer preflights.
 * Returns true if the request was a preflight and has been fully handled —
 * callers must `return` immediately in that case.
 */
export function applyCors(req, res) {
  const origin = req.headers.origin;
  if (origin && allowedOrigins().includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return true;
  }
  return false;
}

// ══════════════════════════════════════════════════════════════
// JWT helpers — enforced secret, no fallback
// ══════════════════════════════════════════════════════════════
export function authenticate(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return null;
  try {
    return jwt.verify(authHeader.split(' ')[1], JWT_SECRET);
  } catch {
    return null;
  }
}

export function signToken(payload, expiresIn = '1h') {
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
}

// ══════════════════════════════════════════════════════════════
// Input sanitization
// ══════════════════════════════════════════════════════════════
export function sanitizeString(str) {
  if (typeof str !== 'string') return str;
  return str
    .replace(/<\/?[^>]+(>|$)/g, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .trim();
}

export function sanitizeObject(obj, fields) {
  if (!obj || typeof obj !== 'object') return obj;
  const result = { ...obj };
  for (const field of fields) {
    if (result[field] !== undefined) {
      result[field] = sanitizeString(result[field]);
    }
  }
  return result;
}

// ══════════════════════════════════════════════════════════════
// Body size guard (code-level, for base64 image uploads)
// ══════════════════════════════════════════════════════════════
export function checkBodySize(req, res, maxBytes = 10 * 1024 * 1024) {
  const contentLength = parseInt(req.headers['content-length'] || '0', 10);
  if (contentLength > maxBytes) {
    res.status(413).json({ error: `Request body too large. Max ${Math.round(maxBytes / 1024 / 1024)}MB.` });
    return true;
  }
  if (req.body) {
    const bodySize = typeof req.body === 'string'
      ? req.body.length
      : JSON.stringify(req.body).length;
    if (bodySize > maxBytes) {
      res.status(413).json({ error: `Request body too large. Max ${Math.round(maxBytes / 1024 / 1024)}MB.` });
      return true;
    }
  }
  return false;
}
