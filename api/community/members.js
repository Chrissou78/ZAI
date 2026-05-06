import axios from 'axios';

const engageClient = axios.create({
  baseURL: process.env.ENGAGE_API_BASE || 'https://api.engage.onchainlabs.ch',
  headers: {
    'Authorization': `Bearer ${process.env.WALLETTWO_API_KEY}`,
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

function generateAvatar(firstName, lastName) {
  const f = firstName?.charAt(0).toUpperCase() || '';
  const l = lastName?.charAt(0).toUpperCase() || '';
  return (f + l) || 'U';
}

function generateHandle(firstName, lastName) {
  const first = (firstName || '').toLowerCase();
  const last = (lastName || '').toLowerCase();
  return `${first}.${last}`.replace(/\.+/g, '.').replace(/^\.|\.$/, '');
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { limit = 50, offset = 0, search } = req.query;
    const parsedLimit = Math.min(parseInt(limit) || 50, 100);
    const parsedOffset = parseInt(offset) || 0;

    const params = { limit: parsedLimit, offset: parsedOffset };
    if (search) params.search = search;

    const response = await engageClient.get('/users', { params });
    const members = response.data.data || response.data || [];

    const transformedMembers = members.map(member => ({
      id: member.id,
      name: member.firstName && member.lastName
        ? `${member.firstName} ${member.lastName}`
        : member.name || 'User',
      avatar: generateAvatar(member.firstName, member.lastName),
      handle: member.handle || generateHandle(member.firstName, member.lastName),
      location: member.location || 'Unknown',
      joinedAt: member.createdAt,
      tier: member.tier || 'member',
      productsCount: member.products?.length || 0,
      eventsAttended: member.eventsAttended || 0,
    }));

    return res.json({
      success: true,
      data: transformedMembers,
      pagination: { limit: parsedLimit, offset: parsedOffset, total: transformedMembers.length, hasMore: transformedMembers.length === parsedLimit },
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}
