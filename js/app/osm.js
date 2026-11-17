/* Devanture — recherche réelle : géocodage (Géoplateforme IGN, repli Nominatim) et commerces OpenStreetMap (Overpass) */
import { kindOf, kindInfo, demoScan, DEMO_LABEL } from './data.js';

export const NET = { blocked: false };
const OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];

async function get(url, opt = {}, ms = 25000) {
  const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, { ...opt, signal: ctl.signal });
    if (!r.ok) { const e = new Error('HTTP ' + r.status); e.status = r.status; throw e; }
    return await r.json();
  } catch (e) {
    // fetch bloqué par la page (aperçu) ou hors ligne : TypeError sans statut
    if (e instanceof TypeError) NET.blocked = true;
    throw e;
  } finally { clearTimeout(to); }
}

/* ---------- géocodage ---------- */
export async function geocode(q, auto) {
  q = q.trim();
  if (!q) return [];
  if (NET.blocked) return demoPlaces(q);
  try {
    const u = 'https://data.geopf.fr/geocodage/search?index=address&type=municipality&limit=6' + (auto ? '&autocomplete=1' : '') + '&q=' + encodeURIComponent(q);
    const j = await get(u, {}, 8000);
    const out = (j.features || []).map(f => ({
      label: f.properties.city || f.properties.name || f.properties.label,
      sub: [f.properties.postcode, (f.properties.context || '').split(',').slice(1).join(',').trim()].filter(Boolean).join(' · '),
      lat: f.geometry.coordinates[1], lon: f.geometry.coordinates[0]
    }));
    if (out.length) return out;
  } catch (e) { if (NET.blocked) return demoPlaces(q); }
  try {
    const j = await get('https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=6&accept-language=fr&q=' + encodeURIComponent(q), {}, 9000);
    return j.map(p => ({ label: p.name || p.display_name.split(',')[0], sub: p.display_name.split(',').slice(1, 3).join(',').trim(), lat: +p.lat, lon: +p.lon }));
  } catch (e) { if (NET.blocked) return demoPlaces(q); throw e; }
}
const demoPlaces = q => [{ label: DEMO_LABEL, sub: 'Aperçu hors ligne · « ' + q + ' »', lat: 46.5641, lon: 4.672, demo: true }];

/* ---------- requête des commerces ---------- */
const AMEN = 'restaurant|cafe|bar|pub|biergarten|fast_food|ice_cream|pharmacy|doctors|dentist|veterinary|driving_school|car_wash|taxi';
const OFF = 'estate_agent|accountant|tax_advisor|lawyer|notary|architect|travel_agent|insurance';
const TOUR = 'hotel|motel|guest_house|chalet|apartment|camp_site|hostel';
const HEAL = 'physiotherapist|osteopath|alternative|optometrist';

function poiQuery(lat, lon, r) {
  const A = `(around:${r},${lat.toFixed(6)},${lon.toFixed(6)})`;
  return `[out:json][timeout:45];
(
  nwr["shop"]["shop"!="vacant"]["name"]${A};
  nwr["craft"]["name"]${A};
  nwr["amenity"~"^(${AMEN})$"]["name"]${A};
  nwr["office"~"^(${OFF})$"]["name"]${A};
  nwr["tourism"~"^(${TOUR})$"]["name"]${A};
  nwr["healthcare"~"^(${HEAL})$"]["name"]${A};
  nwr["leisure"="fitness_centre"]["name"]${A};
);
out center tags;`;
}
function roadQuery(lat, lon, r) {
  const big = r > 2200, A = `(around:${Math.round(r * 1.08)},${lat.toFixed(6)},${lon.toFixed(6)})`;
  const cls = big ? 'motorway|trunk|primary|secondary|tertiary|unclassified' : 'motorway|trunk|primary|secondary|tertiary|unclassified|residential|living_street|pedestrian';
  return `[out:json][timeout:45];way["highway"~"^(${cls})$"]${A};out geom qt;`;
}
async function overpass(q, ms) {
  let last;
  for (const ep of OVERPASS) {
    try { return await get(ep, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'data=' + encodeURIComponent(q) }, ms); }
    catch (e) { last = e; if (NET.blocked) throw e; }
  }
  throw last;
}

const ROAD_CLASS = { motorway: 1, trunk: 1, primary: 1, secondary: 2, tertiary: 2, unclassified: 3, residential: 3, living_street: 3, pedestrian: 3 };
export function parseRoads(j) {
  return (j.elements || []).filter(e => e.geometry && e.geometry.length > 1).map(e => ({ c: ROAD_CLASS[e.tags && e.tags.highway] || 3, p: e.geometry.map(g => [g.lat, g.lon]) }));
}

function distM(a, b, c, d) {
  const R = 6371000, r = Math.PI / 180, x = (d - b) * r * Math.cos((a + c) / 2 * r), y = (c - a) * r;
  return Math.sqrt(x * x + y * y) * R;
}

/* site : 'site' | 'brand' (enseigne nationale) | 'social' (réseaux seulement) | 'none' */
export function webStatus(t) {
  if (t.website || t['contact:website'] || t.url || t['website:menu'] || t['brand:website']) return 'site';
  if (t.brand || t['brand:wikidata'] || t.operator && /^(SNCF|La Poste|Crédit|BNP|Société Générale|Caisse|Banque)/i.test(t.operator)) return 'brand';
  if (t['contact:facebook'] || t.facebook || t['contact:instagram'] || t.instagram) return 'social';
  return 'none';
}

export function parsePois(j, lat, lon) {
  const seen = new Set(), items = [];
  for (const e of j.elements || []) {
    const t = e.tags || {}; if (!t.name || t.shop === 'vacant' || t.disused || t['disused:shop']) continue;
    const id = e.type[0] + e.id; if (seen.has(id)) continue; seen.add(id);
    const k = kindOf(t); if (!k) continue;
    const la = e.lat != null ? e.lat : e.center && e.center.lat, lo = e.lon != null ? e.lon : e.center && e.center.lon;
    if (la == null) continue;
    const addr = [t['addr:housenumber'], t['addr:street'] || t['addr:place']].filter(Boolean).join(' ');
    const keep = {};
    ['name', 'opening_hours', 'phone', 'contact:phone', 'mobile', 'contact:mobile', 'email', 'contact:email', 'contact:facebook', 'facebook', 'contact:instagram', 'instagram', 'cuisine', 'addr:postcode', 'addr:city', 'description', 'wheelchair', 'outdoor_seating', 'takeaway', 'delivery', 'shop', 'amenity', 'craft', 'office', 'tourism', 'healthcare'].forEach(n => { if (t[n]) keep[n] = t[n]; });
    items.push({ id, name: t.name, kind: k, tags: keep, lat: la, lon: lo, dist: Math.round(distM(lat, lon, la, lo)), addr, city: t['addr:city'] || '', web: webStatus(t) });
  }
  return items;
}

/* potentiel 1..3 : coordonnées présentes, activité où un site rapporte, réseaux seulement = déjà soucieux de visibilité */
export function score(it) {
  const t = it.tags || {}, info = kindInfo(it.kind);
  let s = 0;
  if (t.phone || t['contact:phone'] || t.mobile || t['contact:mobile']) s += 1;
  if (t.opening_hours) s += .8;
  if (t.email || t['contact:email']) s += .4;
  if (it.web === 'social') s += .8;
  if (['resto', 'hebergement', 'artisan', 'beaute'].includes(info.g)) s += .7;
  if (info.reg) s -= .8;
  return s >= 2 ? 3 : s >= 1 ? 2 : 1;
}

export function phoneOf(t) { return t.phone || t['contact:phone'] || t.mobile || t['contact:mobile'] || ''; }
export function emailOf(t) { return t.email || t['contact:email'] || ''; }
export function safeUrl(u) {
  u = String(u || '').trim();
  if (/^https?:\/\//i.test(u)) return u;
  if (/^(www\.)?(facebook|instagram)\.com\//i.test(u)) return 'https://' + u;
  return '';
}
export function socialOf(t) { return safeUrl(t['contact:facebook'] || t.facebook || t['contact:instagram'] || t.instagram); }

/* scan complet. onStep(phase) : 'pois' puis 'roads' */
export async function scan(place, radius, onStep) {
  if (place.demo || NET.blocked) return finish(demoScan(radius), radius, true);
  onStep && onStep('pois');
  const roadsP = overpass(roadQuery(place.lat, place.lon, radius), 60000).then(parseRoads).catch(() => []);
  let pj;
  try { pj = await overpass(poiQuery(place.lat, place.lon, radius), 60000); }
  catch (e) { if (NET.blocked) return finish(demoScan(radius), radius, true); throw e; }
  const items = parsePois(pj, place.lat, place.lon);
  onStep && onStep('roads');
  const roads = await roadsP;
  return finish({ center: { lat: place.lat, lon: place.lon }, label: place.label, items, roads }, radius, false);
}
function finish(res, radius, demo) {
  res.items.forEach(it => { it.score = score(it); });
  res.items.sort((a, b) => (b.score - a.score) || (a.dist - b.dist));
  return { ...res, radius, demo, at: Date.now() };
}
