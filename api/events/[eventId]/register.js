import jwt from 'jsonwebtoken';
import axios from 'axios';

const engageClient = axios.create({
  baseURL: process.env.ENGAGE_API_BASE || 'https://api.engage.onchainlabs.ch',
  headers: {
    'Authorization': `Bearer ${process.env.WALLETTWO_API_KEY}`,
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

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

  const { eventId } = req.query;

  try {
    const response = await engageClient.post(`/events/${eventId}/attendees`, {
      userId: user.userId,
      registeredAt: new Date().toISOString(),
    });
    const registration = response.data.data || response.data;
    return res.json({ success: true, message: 'Registered successfully', data: registration });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}
