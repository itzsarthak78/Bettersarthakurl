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

  // Get user's slugs from a set
  const slugs = await kv.smembers(`user_links:${email}`);
  const links = await Promise.all(slugs.map(async (slug) => {
    const original = await kv.get(`short:${slug}`);
    const clicks = await kv.get(`stats:clicks:${slug}`) || 0;
    return { slug, original, clicks };
  }));

  res.status(200).json({ links });
}
