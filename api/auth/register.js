import { kv } from '@vercel/kv';
import bcrypt from 'bcryptjs';
import { serialize } from 'cookie';
import { randomBytes } from 'crypto';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { name, email, password, howFound } = req.body;
  if (!name || !email || !password || !howFound) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  // Check if user exists
  const existing = await kv.get(`user:${email}`);
  if (existing) {
    return res.status(409).json({ error: 'User already exists' });
  }

  const hashed = await bcrypt.hash(password, 10);
  const user = { name, email, password: hashed, howFound, created_at: new Date().toISOString() };
  await kv.set(`user:${email}`, user);

  // Create session and set cookie
  const token = randomBytes(32).toString('hex');
  await kv.set(`session:${token}`, email, { ex: 60 * 60 * 24 * 30 });
  res.setHeader('Set-Cookie', serialize('sid', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 30,
    sameSite: 'lax',
    path: '/',
  }));

  res.status(201).json({ message: 'Registered', user: { name, email } });
}
