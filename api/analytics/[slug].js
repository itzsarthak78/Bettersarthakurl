import { kv } from '@vercel/kv';
import { parse } from 'cookie';

export default async function handler(req, res) {
  const { slug } = req.query;

  if (!slug || typeof slug !== 'string') {
    return res.status(400).json({ error: 'Slug required' });
  }

  // ----- Check if user is authenticated and owns this slug -----
  const cookies = parse(req.headers.cookie || '');
  const token = cookies.sid;
  if (!token) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const email = await kv.get(`session:${token}`);
  if (!email) {
    return res.status(401).json({ error: 'Invalid session' });
  }

  // Verify that this slug belongs to the user
  const userSlugs = await kv.smembers(`user_links:${email}`);
  if (!userSlugs.includes(slug)) {
    return res.status(403).json({ error: 'You do not own this link' });
  }

  // ----- Fetch analytics data (same as before) -----
  try {
    const [
      total,
      uniqueCount,
      devices,
      browsers,
      countries,
      lastClick,
      recentClicks
    ] = await Promise.all([
      kv.get(`stats:clicks:${slug}`),
      kv.scard(`analytics:unique:${slug}`),
      kv.hgetall(`analytics:devices:${slug}`),
      kv.hgetall(`analytics:browsers:${slug}`),
      kv.hgetall(`analytics:countries:${slug}`),
      kv.get(`analytics:last_click:${slug}`),
      kv.lrange(`analytics:recent:${slug}`, 0, 49)
    ]);

    const history = recentClicks.map(item => {
      try { return JSON.parse(item); } catch { return null; }
    }).filter(Boolean);

    // Build 7-day chart data
    const now = new Date();
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    const dailyData = {};
    for (let i = 0; i < 7; i++) {
      const d = new Date(sevenDaysAgo);
      d.setDate(d.getDate() + i);
      const key = d.toISOString().split('T')[0];
      dailyData[key] = 0;
    }
    history.forEach(click => {
      const date = new Date(click.timestamp);
      const key = date.toISOString().split('T')[0];
      if (dailyData.hasOwnProperty(key)) dailyData[key] += 1;
    });
    const chartData = Object.keys(dailyData).map(key => ({
      date: key,
      clicks: dailyData[key]
    }));

    res.status(200).json({
      slug,
      total: parseInt(total || 0, 10),
      uniqueVisitors: uniqueCount || 0,
      lastClick: lastClick || null,
      devices: devices || {},
      browsers: browsers || {},
      countries: countries || {},
      history: history.slice(0, 20),
      chartData
    });

  } catch (error) {
    console.error('Analytics API error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
