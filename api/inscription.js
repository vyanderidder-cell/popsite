// PopSite : enregistre une inscription ou une demande « Préviens-moi » (Vercel Blob, accès privé à la lecture côté serveur)
import { put } from '@vercel/blob';

const seen = new Map();

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  // contrôle de santé réservé à l'admin : /api/inscription?key=...&test=1 enregistre une ligne « test »
  if (req.method === 'GET' && process.env.ADMIN_KEY && req.query && req.query.key === process.env.ADMIN_KEY && req.query.test) {
    try { await put('inscrits/' + Date.now() + '-test.json', JSON.stringify({ at: new Date().toISOString(), source: 'test', email: 'test@popsite', prenom: 'Test', ville: '' }), { access: 'public', contentType: 'application/json', addRandomSuffix: true }); return res.status(200).json({ ok: true }); }
    catch (e) { return res.status(500).json({ ok: false, error: String(e && e.message || e) }); }
  }
  if (req.method !== 'POST') return res.status(405).json({ ok: false });
  let b = req.body;
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch (e) { b = {}; } }
  b = b || {};
  if (b.site) return res.status(200).json({ ok: true }); // piège à robots
  const email = String(b.email || '').trim().toLowerCase().slice(0, 200);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ ok: false });
  // anti-rafale très simple (par instance)
  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0];
  const now = Date.now(), last = seen.get(ip) || 0;
  if (now - last < 3000) return res.status(429).json({ ok: false });
  seen.set(ip, now);
  const source = ['inscription', 'pro'].includes(b.source) ? b.source : 'autre';
  const rec = { at: new Date().toISOString(), source, email, prenom: String(b.prenom || '').slice(0, 80), ville: String(b.ville || '').slice(0, 80) };
  try {
    await put(`inscrits/${now}-${source}.json`, JSON.stringify(rec), { access: 'public', contentType: 'application/json', addRandomSuffix: true });
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('blob', e && e.message);
    return res.status(500).json({ ok: false });
  }
}
