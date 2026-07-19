import { kv } from '@vercel/kv';
import { parse, serialize } from 'cookie';

export default async function handler(req, res) {
  const cookies = parse(req.headers.cookie || '');
  const token = cookies.sid;
  if (token) {
    await kv.del(`session:${token}`);
  }

  res.setHeader('Set-Cookie', serialize('sid', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: -1,
    sameSite: 'lax',
    path: '/',
  }));

  res.status(200).json({ message: 'Logged out' });
}
