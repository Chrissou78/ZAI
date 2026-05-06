export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { productId } = req.query;

  // TODO: Replace with actual Engage API call
  return res.json({ success: true, data: { id: productId } });
}
