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

  const { memberId } = req.query;

  try {
    const response = await engageClient.get(`/users/${memberId}`);
    const member = response.data.data || response.data;

    if (!member) return res.status(404).json({ success: false, error: 'Member not found' });

    return res.json({
      success: true,
      data: {
        id: member.id,
        name: member.firstName && member.lastName
          ? `${member.firstName} ${member.lastName}`
          : member.name,
        avatar: generateAvatar(member.firstName, member.lastName),
        handle: member.handle || generateHandle(member.firstName, member.lastName),
        location: member.location,
        bio: member.bio || '',
        joinedAt: member.createdAt,
        tier: member.tier,
        products: member.products || [],
        eventsAttended: member.eventsAttended || 0,
        whatsapp: member.whatsappSubscribed || false,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}
