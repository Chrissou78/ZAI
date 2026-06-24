import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

// ── Body parsing ──
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

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

// ── SPA fallback ──
app.get('*', (req, res) => {
  // Don't serve index.html for API routes that weren't matched
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

