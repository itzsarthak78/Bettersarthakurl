import { kv } from '@vercel/kv';
import { parse } from 'cookie';

export default async function handler(req, res) {
  const cookies = parse(req.headers.cookie || '');
  const token = cookies.sid;
  if (!token) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const email = await kv.get(`session:${token}`);
  if (!email) {
    return res.status(401).json({ error: 'Invalid session' });
  }

  const user = await kv.get(`user:${email}`);
  if (!user) {
    return res.status(401).json({ error: 'User not found' });
  }

  res.status(200).json({ user: { name: user.name, email } });
}
