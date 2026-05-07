export default async function handler(req, res) {
  const API_KEY = process.env.WALLETTWO_API_KEY;
  const BASE = 'https://api.wallettwo.com/blockchain/v1/api';
  const CHAIN_ID = process.env.CHAIN_ID || '137';

  const path = req.url.replace(/^\/api\/users\/?/, '');

  // GET /api/users/profile — return user info + wallet balance
  if (path === 'profile' && req.method === 'GET') {
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

      // Fetch native token balance
      const balanceRes = await fetch(
        `${BASE}/token/balance?address=${decoded.wallet}&chainId=${CHAIN_ID}`,
        { headers: { 'x-api-key': API_KEY } }
      );

      let balance = null;
      if (balanceRes.ok) {
        balance = await balanceRes.json();
      }

      return res.json({
        success: true,
        data: {
          userId: decoded.userId,
          wallet: decoded.wallet,
          balance: balance ? {
            native: balance.balance,
            symbol: balance.symbol,
            decimals: balance.decimals
          } : null
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
