/* PopSite — lien de maquette (toute la maquette tient dans l'adresse, aucun serveur) et QR code */

export const SITE_URL = 'https://popsite.vercel.app';
/* adresse publique du site : le domaine réel une fois en ligne, l'adresse Vercel dans l'aperçu */
export const siteBase = () => (window.claude || location.protocol === 'file:') ? SITE_URL : location.origin;

const b64u = bytes => {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const unb64u = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));

const KEYS = ['name', 'kindLabel', 'group', 'city', 'addr', 'phone', 'email', 'social', 'hours', 'tagline', 'intro', 'services', 'rating', 'reviews', 'cta', 'style', 'lat', 'lon', 'by'];

export async function encodeModel(m) {
  const arr = KEYS.map(k => m[k] == null ? '' : m[k]);
  if (typeof arr[16] === 'number') arr[16] = +arr[16].toFixed(5);
  if (typeof arr[17] === 'number') arr[17] = +arr[17].toFixed(5);
  const bytes = new TextEncoder().encode(JSON.stringify(arr));
  if (window.CompressionStream) {
    try {
      const st = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate-raw'));
      return 'z' + b64u(new Uint8Array(await new Response(st).arrayBuffer()));
    } catch (e) { }
  }
  return 'j' + b64u(bytes);
}
export async function decodeModel(s) {
  let bytes = unb64u(s.slice(1));
  if (s[0] === 'z') {
    const st = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    bytes = new Uint8Array(await new Response(st).arrayBuffer());
  }
  const arr = JSON.parse(new TextDecoder().decode(bytes)), m = {};
  KEYS.forEach((k, i) => { m[k] = arr[i]; });
  m.lat = typeof m.lat === 'number' ? m.lat : 0; m.lon = typeof m.lon === 'number' ? m.lon : 0;
  m.hours = Array.isArray(m.hours) ? m.hours.slice(0, 7).map(String) : null;
  m.services = Array.isArray(m.services) ? m.services.slice(0, 12).map(String) : [];
  ['name', 'kindLabel', 'group', 'city', 'addr', 'phone', 'email', 'social', 'tagline', 'intro', 'rating', 'reviews', 'cta', 'style', 'by'].forEach(k => { m[k] = String(m[k] == null ? '' : m[k]).slice(0, 600); });
  return m;
}
export async function shareUrl(m) { return siteBase() + '/m.html#' + await encodeModel(m); }

/* QR code : bibliothèque qrcode-generator (MIT) chargée à la demande depuis un CDN */
let qrLib = null;
function loadQr() {
  if (qrLib) return qrLib;
  const tryLoad = src => new Promise((ok, ko) => { const s = document.createElement('script'); s.src = src; s.async = true; s.onload = () => window.qrcode ? ok(window.qrcode) : ko(); s.onerror = ko; document.head.appendChild(s); });
  qrLib = tryLoad('https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js').catch(() => tryLoad('https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js'));
  qrLib.catch(() => { qrLib = null; });
  return qrLib;
}
export async function qrSvg(text, dark = '#0a0f1a', light = '#ffffff') {
  const qrcode = await loadQr();
  const q = qrcode(0, 'L'); q.addData(text); q.make();
  const n = q.getModuleCount(), m = 2, size = n + m * 2;
  let d = '';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) d += `M${c + m} ${r + m}h1v1h-1z`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges" role="img" aria-label="QR code du lien"><rect width="${size}" height="${size}" fill="${light}"/><path d="${d}" fill="${dark}"/></svg>`;
}
