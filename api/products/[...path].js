import jwt from 'jsonwebtoken';

function authenticate(req) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return null;
  try { return jwt.verify(token, process.env.JWT_SECRET); } catch { return null; }
}

export default async function handler(req, res) {
  const path = Array.isArray(req.query.path) ? req.query.path.join('/') : req.query.path || '';

  // GET /api/products
  if (path === '' && req.method === 'GET') {
    return res.json({ success: true, data: [], count: 0 });
  }

  // POST /api/products/claim
  if (path === 'claim' && req.method === 'POST') {
    const user = authenticate(req);
    if (!user) return res.status(401).json({ error: 'No token provided' });
    const { serialNumber, nfcCardId } = req.body;
    if (!serialNumber && !nfcCardId) return res.status(400).json({ success: false, error: 'Either serialNumber or nfcCardId is required' });
    return res.json({ success: true, message: 'Product claimed successfully', data: { serialNumber: serialNumber || nfcCardId } });
  }

  // GET /api/products/user/:userId
  const userMatch = path.match(/^user\/([^/]+)$/);
  if (userMatch && req.method === 'GET') {
    const user = authenticate(req);
    if (!user) return res.status(401).json({ error: 'No token provided' });
    if (user.userId !== userMatch[1] && user.role !== 'admin') return res.status(403).json({ success: false, error: 'Unauthorized' });
    return res.json({ success: true, data: [], count: 0, stats: { totalProducts: 0, withInsurance: 0 } });
  }

  // POST /api/products/:productId/activate-insurance
  const insuranceMatch = path.match(/^([^/]+)\/activate-insurance$/);
  if (insuranceMatch && req.method === 'POST') {
    const user = authenticate(req);
    if (!user) return res.status(401).json({ error: 'No token provided' });
    return res.json({ success: true, message: 'Insurance activated', data: { productId: insuranceMatch[1], insurance: { active: true, activatedAt: new Date().toISOString() } } });
  }

  // GET /api/products/:productId
  const productMatch = path.match(/^([^/]+)$/);
  if (productMatch && req.method === 'GET') {
    return res.json({ success: true, data: { id: productMatch[1] } });
  }

  return res.status(404).json({ error: 'Route not found' });
}
