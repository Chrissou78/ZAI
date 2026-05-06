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
  const user = authenticate(req);
  if (!user) return res.status(401).json({ error: 'No token provided' });

  if (req.method === 'GET') {
    return res.json({
      success: true,
      data: {
        notifications: {
          eventInvitations: true,
          membershipUpdates: true,
          productLaunches: false,
          partnerOffers: false,
          productUpdates: true,
          eventReminders: true,
        },
        privacy: {
          partnerDataSharing: true,
          analytics: false,
          profileVisibility: true,
          communityVisibility: false,
        },
        card: { nfcActive: true, autoLoginOnTap: true },
        region: { country: 'Switzerland', currency: 'CHF', language: 'English' },
      },
    });
  }

  if (req.method === 'PUT') {
    console.log('Saving settings for user:', user.userId, req.body);
    return res.json({ success: true, message: 'Settings saved' });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
