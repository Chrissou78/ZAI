import axios from 'axios';

const engageClient = axios.create({
  baseURL: process.env.ENGAGE_API_BASE || 'https://api.engage.onchainlabs.ch',
  headers: {
    'Authorization': `Bearer ${process.env.WALLETTWO_API_KEY}`,
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { status = 'upcoming' } = req.query;
    const response = await engageClient.get('/events', { params: { status } });
    const events = response.data.data || response.data || [];
    return res.json({ success: true, data: events });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}
