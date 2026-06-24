import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

// ── Body parsing ──
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ── Inline authenticate middleware for standalone routes ──
import jwt from 'jsonwebtoken';

function authenticate(req, res, next) {
  try {
    var authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }
    var token = authHeader.split(' ')[1];
    var decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// ── Helper: adapt Vercel-style handler to Express ──
function vercelToExpress(handlerModule) {
  return async (req, res) => {
    try {
      const mod = await handlerModule();
      const handler = mod.default || mod;
      await handler(req, res);
    } catch (err) {
      console.error('API handler error:', err);
      if (!res.headersSent) {
        res.status(500).json({ success: false, error: 'Internal server error' });
      }
    }
  };
}

// ── Proxy & cache product images (public) ──
app.get('/img/*', function (req, res) {
  var imageUrl;
  try {
    imageUrl = decodeURIComponent(req.path.replace('/img/', ''));
  } catch (e) {
    return res.status(400).end();
  }

  if (!imageUrl || !(imageUrl.startsWith('https://') || imageUrl.startsWith('http://'))) {
    return res.status(400).end();
  }

  res.setHeader('Cache-Control', 'public, max-age=604800, immutable');

  var mod = require(imageUrl.startsWith('https') ? 'https' : 'http');

  var request = mod.get(imageUrl, { timeout: 10000 }, function (upstream) {
    if (upstream.statusCode !== 200) {
      upstream.resume();
      return res.status(upstream.statusCode || 502).end();
    }
    var ct = upstream.headers['content-type'];
    if (ct) res.setHeader('Content-Type', ct);
    upstream.pipe(res);
  });

  request.on('error', function (err) {
    console.error('[img-proxy] error:', err.message);
    if (!res.headersSent) res.status(502).end();
  });

  request.on('timeout', function () {
    request.destroy();
    if (!res.headersSent) res.status(504).end();
  });
});

// ── Authenticated image proxy for admin ──
app.get('/api/img-proxy', authenticate, function (req, res) {
  var imageUrl = req.query.url;
  if (!imageUrl || !(imageUrl.startsWith('https://') || imageUrl.startsWith('http://'))) {
    return res.status(400).json({ error: 'Missing or invalid url param' });
  }

  res.setHeader('Cache-Control', 'private, max-age=86400');

  var mod = require(imageUrl.startsWith('https') ? 'https' : 'http');

  var request = mod.get(imageUrl, { timeout: 10000 }, function (upstream) {
    if (upstream.statusCode !== 200) {
      upstream.resume();
      return res.status(upstream.statusCode || 502).end();
    }
    var ct = upstream.headers['content-type'] || 'image/jpeg';
    res.setHeader('Content-Type', ct);
    upstream.pipe(res);
  });

  request.on('error', function (err) {
    console.error('[img-proxy] error:', err.message);
    if (!res.headersSent) res.status(502).json({ error: 'Failed to fetch image' });
  });

  request.on('timeout', function () {
    request.destroy();
    if (!res.headersSent) res.status(504).json({ error: 'Timeout' });
  });
});

// ── API Routes ──
app.all('/api/auth/*', vercelToExpress(() => import('./api/auth/[...path].js')));
app.all('/api/products/*', vercelToExpress(() => import('./api/products/[...path].js')));
app.all('/api/events/*', vercelToExpress(() => import('./api/events/[...path].js')));
app.all('/api/events', vercelToExpress(() => import('./api/events/[...path].js')));
app.all('/api/community/*', vercelToExpress(() => import('./api/community/[...path].js')));
app.all('/api/users/*', vercelToExpress(() => import('./api/users/[...path].js')));
app.all('/api/wallettwo/*', vercelToExpress(() => import('./api/wallettwo/[...path].js')));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ success: true, timestamp: new Date().toISOString(), uptime: process.uptime() });
});

// ── Static files (Vite build) ──
const distPath = path.join(__dirname, 'apps', 'frontend', 'dist');
app.use(express.static(distPath));

// ── SPA fallback (MUST be last) ──
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ success: false, error: 'Endpoint not found' });
  }
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[ZAI] Server running on port ${PORT}`);
  console.log(`[ZAI] API: http://0.0.0.0:${PORT}/api`);
  console.log(`[ZAI] Frontend: http://0.0.0.0:${PORT}`);
});
