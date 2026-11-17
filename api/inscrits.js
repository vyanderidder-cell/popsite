// PopSite : liste des inscrits, réservée à qui a la clé ADMIN_KEY
import { list } from '@vercel/blob';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const key = req.headers['x-admin-key'] || '';
  if (!process.env.ADMIN_KEY || key !== process.env.ADMIN_KEY) return res.status(401).json({ ok: false });
  try {
    const blobs = [];
    let cursor;
    do {
      const r = await list({ prefix: 'inscrits/', cursor, limit: 1000 });
      blobs.push(...r.blobs); cursor = r.hasMore ? r.cursor : undefined;
    } while (cursor);
    const rows = (await Promise.all(blobs.map(b => fetch(b.url).then(r => r.json()).catch(() => null)))).filter(Boolean);
    rows.sort((a, b) => String(b.at).localeCompare(String(a.at)));
    return res.status(200).json({ ok: true, rows });
  } catch (e) {
    console.error('blob', e && e.message);
    return res.status(500).json({ ok: false });
  }
}
