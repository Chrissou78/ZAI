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

  const { serialNumber, nfcCardId } = req.body;

  if (!serialNumber && !nfcCardId) {
    return res.status(400).json({ success: false, error: 'Either serialNumber or nfcCardId is required' });
  }

  // TODO: Replace with actual Engage API call
  return res.json({
    success: true,
    message: 'Product claimed successfully',
    data: { serialNumber: serialNumber || nfcCardId },
  });
}
