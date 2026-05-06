export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { limit = 30, offset = 0 } = req.query;

  return res.json({
    success: true,
    data: [],
    pagination: { limit: parseInt(limit), offset: parseInt(offset), hasMore: false },
  });
}
