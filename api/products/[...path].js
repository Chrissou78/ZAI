export default async function handler(req, res) {
  const API_KEY = process.env.WALLETTWO_API_KEY;
  const BASE = 'https://api.wallettwo.com/blockchain/v1/api';
  const CHAIN_ID = process.env.CHAIN_ID || '137'; // Polygon default

  const path = req.url.replace(/^\/api\/products\/?/, '');

  // GET /api/products/user/:userId
  // userId here is actually the wallet address or we resolve it from the JWT
  const userMatch = path.match(/^user\/(.+)$/);
  if (userMatch && req.method === 'GET') {
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

      const walletAddress = decoded.wallet;

      // Fetch NFTs from WalletTwo API
      const response = await fetch(
        `${BASE}/nft?address=${walletAddress}&chainId=${CHAIN_ID}`,
        { headers: { 'x-api-key': API_KEY } }
      );

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        return res.status(response.status).json({
          success: false,
          error: err.message || 'Failed to fetch products'
        });
      }

      const data = await response.json();

      // Map NFT results to your frontend's expected "products" format
      const products = (data.result || []).map(nft => ({
        id: `${nft.token_address}-${nft.token_id}`,
        name: nft.normalized_metadata?.name || nft.name || 'Unknown Product',
        description: nft.normalized_metadata?.description || '',
        image: nft.normalized_metadata?.image || '',
        tokenAddress: nft.token_address,
        tokenId: nft.token_id,
        contractType: nft.contract_type,
        symbol: nft.symbol,
        metadata: nft.normalized_metadata || {}
      }));

      return res.json({
        success: true,
        data: products,
        stats: {
          totalProducts: products.length,
          activeInsurance: 0,
          pendingClaims: 0
        },
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
      console.error('Products API error:', err);
      return res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }

  // GET /api/products/:productId — single product detail
  const productMatch = path.match(/^([^/]+)$/);
  if (productMatch && req.method === 'GET') {
    // For now, return the ID; later you could query a specific NFT
    return res.json({ success: true, data: { id: productMatch[1] } });
  }

  return res.status(404).json({ error: 'Route not found' });
}
