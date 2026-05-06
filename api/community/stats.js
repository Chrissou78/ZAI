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
    const [membersRes, eventsRes] = await Promise.all([
      engageClient.get('/users', { params: { limit: 10000, offset: 0 } }),
      engageClient.get('/events', { params: { status: 'upcoming' } }),
    ]);

    const allMembers = membersRes.data.data || membersRes.data || [];
    const events = eventsRes.data.data || eventsRes.data || [];

    const membersByRegion = allMembers.reduce((acc, member) => {
      const region = member.location?.split(',').pop()?.trim() || 'Unknown';
      acc[region] = (acc[region] || 0) + 1;
      return acc;
    }, {});

    return res.json({
      success: true,
      data: {
        totalMembers: allMembers.length,
        connectedInstagram: allMembers.filter(m => m.instagramHandle).length,
        totalPhotos: 0,
        eventsThisMonth: events.length,
        membersByRegion,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}
