// Devanture : importe une image ou une vidéo générée (lien signé temporaire) dans le stockage du site. Réservé à l'admin.
import { put } from '@vercel/blob';
import sharp from 'sharp';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const q = req.query || {};
  if (!process.env.ADMIN_KEY || q.key !== process.env.ADMIN_KEY) return res.status(401).json({ ok: false });
  const name = String(q.name || '').replace(/[^a-z0-9-]/gi, '');
  if (!name || !/^https:\/\/[a-z0-9.-]*elevenlabs/i.test(String(q.url || ''))) return res.status(400).json({ ok: false });
  try {
    const r = await fetch(q.url);
    if (!r.ok) return res.status(502).json({ ok: false, status: r.status });
    const buf = Buffer.from(await r.arrayBuffer());
    const opt = { access: 'public', addRandomSuffix: false, allowOverwrite: true, cacheControlMaxAge: 31536000 };
    if (q.kind === 'video') {
      const v = await put(`media/${name}.mp4`, buf, { ...opt, contentType: 'video/mp4' });
      return res.status(200).json({ ok: true, video: v.url, bytes: buf.length });
    }
    const big = await sharp(buf).resize({ width: 2048, withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
    const small = await sharp(buf).resize({ width: 1100 }).webp({ quality: 76 }).toBuffer();
    const a = await put(`media/${name}.webp`, big, { ...opt, contentType: 'image/webp' });
    const b = await put(`media/${name}-m.webp`, small, { ...opt, contentType: 'image/webp' });
    return res.status(200).json({ ok: true, big: a.url, small: b.url, sizes: [big.length, small.length] });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e && e.message || e) });
  }
}
