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
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const user = authenticate(req);
  if (!user) return res.status(401).json({ error: 'No token provided' });

  const { productId } = req.query;

  // TODO: Replace with actual Engage API call
  return res.json({
    success: true,
    message: 'Insurance activated',
    data: { productId, insurance: { active: true, activatedAt: new Date().toISOString() } },
  });
}
