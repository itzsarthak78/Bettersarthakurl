import { kv } from '@vercel/kv';
import bcrypt from 'bcryptjs';
import { serialize } from 'cookie';
import { randomBytes } from 'crypto';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const user = await kv.get(`user:${email}`);
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  // Create session token
  const token = randomBytes(32).toString('hex');
  await kv.set(`session:${token}`, email, { ex: 60 * 60 * 24 * 30 }); // 30 days

  // Set cookie
  res.setHeader('Set-Cookie', serialize('sid', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 30,
    sameSite: 'lax',
    path: '/',
  }));

  res.status(200).json({ message: 'Logged in', user: { name: user.name, email } });
}
