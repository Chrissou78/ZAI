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

function maskPhoneNumber(phone) {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) {
    return digits.replace(/(\d{3})(\d{3})(\d{4})/, '+1 ($1) $2-$3');
  }
  return phone.replace(/(.{3})(.*)(.{3})/, '$1 *** $3');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const user = authenticate(req);
  if (!user) return res.status(401).json({ error: 'No token provided' });

  const { phoneNumber } = req.body;
  if (!phoneNumber) return res.status(400).json({ success: false, error: 'Phone number required' });

  try {
    await engageClient.put(`/users/${user.userId}`, {
      whatsappPhone: phoneNumber,
      whatsappSubscribed: true,
    });

    return res.json({
      success: true,
      message: 'WhatsApp subscription initiated',
      data: { userId: user.userId, phoneNumber: maskPhoneNumber(phoneNumber), subscribedAt: new Date().toISOString() },
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}
