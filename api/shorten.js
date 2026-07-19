import { kv } from '@vercel/kv';
import bcrypt from 'bcryptjs';
import { parse } from 'cookie';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { url, custom, password } = req.body;
  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  // Validate URL
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error();
  } catch {
    return res.status(400).json({ error: 'Invalid URL. Must start with http:// or https://' });
  }

  // Determine slug
  let slug = custom?.trim() || null;
  if (slug) {
    if (!/^[a-zA-Z0-9_-]{2,30}$/.test(slug)) {
      return res.status(400).json({ error: 'Alias must be 2-30 letters, numbers, _ or -' });
    }
    const existing = await kv.get(`short:${slug}`);
    if (existing) {
      return res.status(409).json({ error: 'Alias already taken. Choose another.' });
    }
  } else {
    let attempts = 0;
    do {
      slug = Math.random().toString(36).substring(2, 8);
      attempts++;
      if (attempts > 10) slug = 'l' + Date.now().toString(36);
    } while (await kv.get(`short:${slug}`));
  }

  // Store original URL
  await kv.set(`short:${slug}`, url);

  // Store password hash if provided
  if (password && password.length > 0) {
    const saltRounds = 10;
    const hashed = await bcrypt.hash(password, saltRounds);
    await kv.set(`password:${slug}`, hashed);
  }

  // Increment total links counter
  await kv.incr('stats:total_links');

  // ----- Associate slug with the logged‑in user (if any) -----
  const cookies = parse(req.headers.cookie || '');
  const token = cookies.sid;
  if (token) {
    const email = await kv.get(`session:${token}`);
    if (email) {
      await kv.sadd(`user_links:${email}`, slug);
    }
  }

  const shortUrl = `https://${req.headers.host}/${slug}`;
  return res.status(200).json({ short: shortUrl });
}
