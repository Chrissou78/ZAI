export default async function handler(req, res) {
  const API_KEY = process.env.WALLETTWO_API_KEY;
  const BASE = 'https://api.wallettwo.com/blockchain/v1/api';
  const CHAIN_ID = process.env.CHAIN_ID || '137';

  const path = req.url.replace(/^\/api\/events\/?/, '');

  // GET /api/events — fetch wallet transaction history
  if ((!path || path === '') && req.method === 'GET') {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    try {
      const jwt = await import('jsonwebtoken');
      const decoded = jwt.default.verify(
        authHeader.split(' ')[1],
        process.env.JWT_SECRET || 'fallback-secret'
      );

      const limit = req.query?.limit || 100;
      const cursor = req.query?.cursor || '';

      let url = `${BASE}/wallet/history?address=${decoded.wallet}&chainId=${CHAIN_ID}&limit=${limit}`;
      if (cursor) url += `&cursor=${cursor}`;

      const response = await fetch(url, {
        headers: { 'x-api-key': API_KEY }
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        return res.status(response.status).json({
          success: false,
          error: err.message || 'Failed to fetch events'
        });
      }

      const data = await response.json();

      // Map transaction history to your frontend's "events" format
      const events = (data.result || []).map(tx => ({
        id: tx.hash,
        type: tx.from_address?.toLowerCase() === decoded.wallet?.toLowerCase()
          ? 'sent' : 'received',
        from: tx.from_address,
        to: tx.to_address,
        value: tx.value,
        timestamp: tx.block_timestamp,
        hash: tx.hash
      }));

      return res.json({
        success: true,
        data: events,
        pagination: {
          page: data.page,
          pageSize: data.page_size,
          cursor: data.cursor
        }
      });
    } catch (err) {
      if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Invalid or expired token' });
      }
      return res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }

  return res.status(404).json({ error: 'Route not found' });
}
