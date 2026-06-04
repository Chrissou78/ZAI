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
