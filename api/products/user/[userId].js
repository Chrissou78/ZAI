import jwt from 'jsonwebtoken';

function authenticate(req) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return null;
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const user = authenticate(req);
  if (!user) return res.status(401).json({ error: 'No token provided' });

  const { userId } = req.query;

  if (user.userId !== userId && user.role !== 'admin') {
    return res.status(403).json({ success: false, error: 'Unauthorized' });
  }

  // TODO: Replace with actual Engage API call
  return res.json({
    success: true,
    data: [],
    count: 0,
    stats: { totalProducts: 0, withInsurance: 0 },
  });
}
