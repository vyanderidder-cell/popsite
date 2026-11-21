/* Devanture — le village : rues, maisons, commerces, église, arbres, sol, radar, balises.
   Les bâtiments sont les modèles Blender (models.js), posés sur des emprises tirées au hasard. */
import * as THREE from 'three';
import { mergeGeometries } from '../vendor/three/addons/utils/BufferGeometryUtils.js';
import { HOUSES, SHOPS, CHURCH } from './models.js';

export const AMBER = new THREE.Color(1.0, 0.62, 0.22);
export const SCAN = new THREE.Color(0.36, 0.8, 1.0);

export function rng(seed) {
  return function () {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

/* ---------- rues ---------- */
const ROADS = [
  { w: 2.9, pts: [[-66, 9], [-38, 5], [-14, 2], [0, 0], [15, -1.5], [37, -6.5], [66, -15]] },
  { w: 2.4, pts: [[0, 0], [-2.5, -14], [-8, -33], [-13, -62]] },
  { w: 2.4, pts: [[0, 0], [3.5, 15], [12, 34], [21, 62]] },
  { w: 2.2, pts: [[-14, 2], [-23, 19], [-39, 35], [-55, 52]] },
  { w: 2.2, pts: [[15, -1.5], [27, -17], [41, -35], [56, -54]] },
  { w: 2.0, pts: [[3.5, 15], [-11, 25], [-27, 27], [-48, 22]] }
];
const SQUARE_R = 7.4;

function sampleRoads() {
  return ROADS.map(r => {
    const c = new THREE.CatmullRomCurve3(r.pts.map(p => new THREE.Vector3(p[0], 0, p[1])), false, 'centripetal');
    const len = c.getLength();
    return { w: r.w, curve: c, len, pts: c.getSpacedPoints(Math.ceil(len / 1.5)) };
  });
}

/* tests de place : distance aux rues et recouvrement des bâtiments (rectangles orientés) */
function corners(cx, cz, rot, w, d) {
  const c = Math.cos(rot), s = Math.sin(rot), out = [];
  for (const [u, v] of [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]]) out.push([cx + u * c + v * s, cz - u * s + v * c]);
  return out;
}
function samplePts(cx, cz, rot, w, d) {
  const c = Math.cos(rot), s = Math.sin(rot), out = [];
  for (let i = 0; i <= 2; i++) for (let j = 0; j <= 2; j++) { const u = (i / 2 - 0.5) * w, v = (j / 2 - 0.5) * d; out.push([cx + u * c + v * s, cz - u * s + v * c]); }
  return out;
}
function segDist(px, pz, ax, az, bx, bz) {
  const vx = bx - ax, vz = bz - az, l = vx * vx + vz * vz, t = l ? Math.max(0, Math.min(1, ((px - ax) * vx + (pz - az) * vz) / l)) : 0;
  return Math.hypot(px - ax - vx * t, pz - az - vz * t);
}
function roadClear(roads, pts, margin) {
  for (const [x, z] of pts) {
    if (Math.hypot(x, z) < SQUARE_R + margin) return false;
    for (const r of roads) for (let i = 1; i < r.pts.length; i++) if (segDist(x, z, r.pts[i - 1].x, r.pts[i - 1].z, r.pts[i].x, r.pts[i].z) < r.w + margin) return false;
  }
  return true;
}
function overlap(A, B) { // SAT sur deux rectangles
  for (const P of [A, B]) for (let i = 0; i < 4; i++) {
    const p1 = P[i], p2 = P[(i + 1) % 4], nx = p2[1] - p1[1], nz = p1[0] - p2[0];
    let a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity;
    for (const q of A) { const t = q[0] * nx + q[1] * nz; a0 = Math.min(a0, t); a1 = Math.max(a1, t); }
    for (const q of B) { const t = q[0] * nx + q[1] * nz; b0 = Math.min(b0, t); b1 = Math.max(b1, t); }
    if (a1 <= b0 || b1 <= a0) return false;
  }
  return true;
}
const EXT = 72;

/* ---------- teintes : chaque maison reçoit ses couleurs de façade, de volets et de devanture ---------- */
const WALLS = ['#E8DCC0', '#D9B27A', '#EFE9DE', '#E3C2AE', '#E6CF8F', '#E4DED2', '#E9D3B0', '#D8C9A8', '#CDBB9C', '#F0E2C8', '#DCC6A0', '#E7D7C9'];
const SHUTTERS = ['#5D7A8C', '#5E7D56', '#8E3A32', '#8A8F94', '#7FA3B8', '#8C2F2F', '#2F5C7A', '#6E8B6A', '#A9B7AE', '#4F6A80'];
const FRONTS = ['#2F4F3E', '#1F3A52', '#6B2D2D', '#3D3D45', '#5A4632', '#2E5A5A'];

/* ---------- géométries simples (réverbères, arbres) ---------- */
function prep(g, delay, m) {
  if (g.index) g = g.toNonIndexed();
  g.deleteAttribute('uv');
  if (m) g.applyMatrix4(m);
  const n = g.attributes.position.count, d = new Float32Array(n).fill(delay);
  g.setAttribute('aDelay', new THREE.BufferAttribute(d, 1));
  return g;
}
function colored(g, col) {
  const n = g.attributes.position.count, c = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { c[i * 3] = col.r; c[i * 3 + 1] = col.g; c[i * 3 + 2] = col.b; }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return g;
}

const NAMES = [
  ['Garage Perrin', 'Mécanique auto'], ['Pizza Nino', 'Pizzeria'], ['Coiffure Mylène', 'Salon de coiffure'], ['Boucherie Vasseur', 'Boucherie'],
  ['La Table d\'Odile', 'Restaurant'], ['Fleurs de Lise', 'Fleuriste'], ['Menuiserie Roche', 'Menuisier'], ['Au Pain Doré', 'Boulangerie'],
  ['Cordonnerie Ali', 'Cordonnier'], ['Bar du Centre', 'Café'], ['Institut Clara', 'Esthéticienne'], ['Optique Marchal', 'Opticien'],
  ['Le Fournil', 'Boulangerie'], ['Pressing Ducret', 'Pressing'], ['Auto-école Bruno', 'Auto-école'], ['Épicerie Leroux', 'Épicerie'],
  ['Atelier Fanny', 'Couturière'], ['Kebab Istanbul', 'Restauration rapide'], ['Plomberie Gaudin', 'Plombier'], ['Tabac Presse', 'Tabac'],
  ['Barber Max', 'Barbier'], ['Chez Paulette', 'Brasserie'], ['Ongles Lily', 'Onglerie'], ['Vélo Martin', 'Réparation vélo'],
  ['Caviste Bernard', 'Caviste'], ['Fromagerie Joly', 'Fromager'], ['Pharmacie', 'Pharmacie'], ['Banque', 'Agence']
];

export function buildWorld(seed = 7, opts = {}) {
  const R = rng(seed), lite = !!opts.lite, MD = opts.models;
  const roads = sampleRoads();
  const B = [], boxes = []; // bâtiments et leurs emprises
  const delayOf = (x, z) => 0.15 + Math.hypot(x, z) / 70 * 1.6 + R() * 0.25;
  const free = (cx, cz, rot, w, d, gap) => {
    if (!roadClear(roads, samplePts(cx, cz, rot, w, d), 0.45)) return false;
    const C = corners(cx, cz, rot, w + gap, d + gap);
    for (const o of boxes) if (Math.abs(o.x - cx) < 16 && Math.abs(o.z - cz) < 16 && overlap(C, o.c)) return false;
    return true;
  };
  const claim = (cx, cz, rot, w, d) => boxes.push({ x: cx, z: cz, c: corners(cx, cz, rot, w, d) });

  function tryBuilding(cx, cz, rot, w, d, kind, roadIdx) {
    if (Math.hypot(cx, cz) > EXT - 6) return null;
    if (!free(cx, cz, rot, w, d, 0.1)) return null;
    claim(cx, cz, rot, w, d);
    const floors = Math.hypot(cx, cz) < 22 ? 2 + (R() < 0.45 ? 1 : 0) : 1 + (R() < 0.6 ? 1 : 0);
    const b = { x: cx, z: cz, rot, w, d, h: 2.6 + floors * 2.55 + R() * 0.4, floors, kind, road: roadIdx, shop: false, target: false };
    B.push(b); return b;
  }

  // église, juste derrière la place, clocher et portail tournés vers elle
  const cs = MD[CHURCH].box.getSize(new THREE.Vector3());
  const church = { x: -15.5, z: -13.5, rot: 0.42, w: cs.x + 0.4, d: cs.z + 0.2 };
  claim(church.x, church.z, church.rot, church.w, church.d);

  // tour de la place : façades tournées vers le centre
  {
    let a = 0.0;
    while (a < Math.PI * 2 - 0.05) {
      const w = 3.8 + R() * 2.2, d = 5.8 + R() * 2, rr = SQUARE_R + 0.9 + d / 2;
      const ang = a + (w / 2) / rr, cx = Math.cos(ang) * rr, cz = Math.sin(ang) * rr;
      const rot = Math.atan2(-cx, -cz); // +z local vers le centre
      if (tryBuilding(cx, cz, rot, w, d, 'house', -1)) a += (w + 0.2) / rr; else a += 0.05;
    }
  }
  // le long des rues
  roads.forEach((r, ri) => {
    for (const side of [1, -1]) {
      let s = 0;
      while (s < r.len - 3) {
        const w = 3.6 + R() * 3.0, d = 5.2 + R() * 2.8;
        const u = Math.min(1, (s + w / 2) / r.len), p = r.curve.getPointAt(u), t = r.curve.getTangentAt(u);
        const nx = -t.z * side, nz = t.x * side; // normale vers l'extérieur
        const off = r.w + 0.6 + d / 2, cx = p.x + nx * off, cz = p.z + nz * off;
        const rot = Math.atan2(-nx, -nz);
        const far = Math.hypot(cx, cz);
        const gapP = far > 46 ? 0.22 : far > 32 ? 0.06 : 0;
        if (R() < gapP) { s += 2 + R() * 6; continue; }
        if (tryBuilding(cx, cz, rot, w, d, 'house', ri)) s += w + (far > 34 ? 0.3 + R() * 1.4 : 0.12 + R() * 0.2); else s += 0.5;
      }
    }
  });

  // remplissage : maisons de deuxième rang entre les rues, près du centre
  for (let k = 0; k < 900; k++) {
    const ang = R() * Math.PI * 2, rr = 12 + Math.pow(R(), 1.2) * 30, cx = Math.cos(ang) * rr, cz = Math.sin(ang) * rr;
    let best = 1e9, bx = 0, bz = 0;
    for (const r of roads) for (const p of r.pts) { const dd = (p.x - cx) ** 2 + (p.z - cz) ** 2; if (dd < best) { best = dd; bx = p.x; bz = p.z; } }
    if (Math.sqrt(best) > 16) continue;
    const rot = Math.atan2(bx - cx, bz - cz) + (R() - 0.5) * 0.3;
    tryBuilding(cx, cz, rot, 3.8 + R() * 2.6, 5.4 + R() * 2.4, 'back', -2);
  }
  // commerces : rez-de-chaussée vitré
  for (const b of B) {
    const far = Math.hypot(b.x, b.z);
    const pShop = b.road === -2 ? 0 : b.road === -1 ? 0.85 : b.road === 0 ? (far < 40 ? 0.72 : 0.3) : (far < 32 ? 0.62 : 0.22);
    if (R() < pShop) b.shop = true;
  }
  // le commerce vedette : sur la place, façade tournée vers la caméra d'arrivée
  const camDir = new THREE.Vector2(0.62, 0.78).normalize();
  let hero = null, best = -2;
  for (const b of B) {
    if (b.road !== -1) continue;
    const fx = Math.sin(b.rot), fz = Math.cos(b.rot), dot = fx * camDir.x + fz * camDir.y;
    const vis = -b.x * camDir.x - b.z * camDir.y; // côté opposé à la caméra : on voit la façade
    const sc = dot + vis * 0.03;
    if (sc > best) { best = sc; hero = b; }
  }
  hero.shop = true; hero.hero = true; hero.w = Math.max(hero.w, 5.4);
  // couloir de vue devant la vitrine vedette : la place reste dégagée pour la caméra
  {
    const fx = Math.sin(hero.rot), fz = Math.cos(hero.rot), L = 30, Wd = 13;
    const cx = hero.x + fx * (hero.d / 2 + L / 2 + 0.3), cz = hero.z + fz * (hero.d / 2 + L / 2 + 0.3);
    const C = corners(cx, cz, hero.rot, Wd, L);
    for (let i = B.length - 1; i >= 0; i--) { const b = B[i]; if (b !== hero && overlap(C, corners(b.x, b.z, b.rot, b.w, b.d))) B.splice(i, 1); }
  }
  // cibles : commerces sans site
  const shops = B.filter(b => b.shop);
  shops.sort((a, b) => Math.hypot(a.x, a.z) - Math.hypot(b.x, b.z));
  // 22 commerces sans site (le chiffre du texte) dès qu'il y a assez de commerces ; le hasard ne saute
  // que le surplus
  let nT = 0, skip = shops.length - 22;
  for (const b of shops) {
    if (b.hero || (nT < 22 && (skip <= 0 || R() < 0.66))) { b.target = true; nT++; } else skip--;
  }
  const targets = shops.filter(b => b.target);
  targets.sort((a, b) => (b.hero ? 1 : 0) - (a.hero ? 1 : 0));
  targets.forEach((b, i) => { b.name = NAMES[i % NAMES.length][0]; b.cat = NAMES[i % NAMES.length][1]; });

  /* ---------- bâtiments : le modèle Blender le plus proche de chaque emprise ---------- */
  const lamps = [], poles = [], trees = [], trunks = [];
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), Y = new THREE.Vector3(0, 1, 0), S1 = new THREE.Vector3(1, 1, 1);
  const place = (x, y, z, rot) => M.compose(new THREE.Vector3(x, y, z), Q.setFromAxisAngle(Y, rot), S1).clone();
  const RM = rng(seed * 31 + 5), pick = a => new THREE.Color(a[Math.floor(RM() * a.length)]);
  const items = [];
  for (const b of B) {
    b.delay = delayOf(b.x, b.z);
    const wantTall = b.floors >= 2;
    let best = null, bs = Infinity;
    for (const n of b.shop ? SHOPS : HOUSES) {
      const md = MD[n];
      const s = Math.abs(Math.log(b.w / md.w)) + Math.abs(Math.log(b.d / md.d)) + (md.tall === wantTall ? 0 : 0.3) + RM() * 0.25;
      if (s < bs) { bs = s; best = md; }
    }
    // l'emprise tirée au hasard devient l'échelle du modèle (légère, ±15 % en général)
    const sx = b.w / best.w, sz = b.d / best.d, sy = Math.min(1.1, Math.max(0.88, Math.sqrt(sx * sz)));
    b.model = best.name; b.top = best.top * sy;
    b.m = new THREE.Matrix4().compose(new THREE.Vector3(b.x, 0, b.z), new THREE.Quaternion().setFromAxisAngle(Y, b.rot), new THREE.Vector3(sx, sy, sz));
    const roofK = 0.86 + RM() * 0.24;
    items.push({ model: best.name, m: b.m, delay: b.delay, tint: { Mur: pick(WALLS), Volet: pick(SHUTTERS), Porte: b.shop ? pick(FRONTS) : null, roofK } });
  }
  {
    const c = church, dl = delayOf(c.x, c.z);
    c.m = new THREE.Matrix4().compose(new THREE.Vector3(c.x, 0, c.z), new THREE.Quaternion().setFromAxisAngle(Y, c.rot), S1);
    items.push({ model: CHURCH, m: c.m, delay: dl, tint: null });
  }
  const targetSlots = targets.map(b => ({ b, delay: b.delay }));
  // réverbères le long des rues
  roads.forEach((r, ri) => {
    const step = ri === 0 ? 10 : 12;
    for (let s = 6, k = 0; s < r.len - 4; s += step, k++) {
      const u = s / r.len, p = r.curve.getPointAt(u), t = r.curve.getTangentAt(u), side = k % 2 ? 1 : -1;
      const x = p.x - t.z * side * (r.w + 0.25), z = p.z + t.x * side * (r.w + 0.25);
      if (Math.hypot(x, z) > EXT - 8 || Math.hypot(x, z) < SQUARE_R + 1) continue;
      const dl = delayOf(x, z) + 0.3;
      poles.push(prep(new THREE.CylinderGeometry(0.05, 0.07, 3.4, 5), dl, place(x, 1.7, z, 0)));
      lamps.push(colored(prep(new THREE.BoxGeometry(0.28, 0.16, 0.28), dl, place(x, 3.45, z, 0)), new THREE.Color(1.0, 0.84, 0.64).multiplyScalar(2.4)));
    }
  });
  // arbres en périphérie
  const nTrees = lite ? 40 : 70;
  for (let i = 0, tries = 0; i < nTrees && tries < 5000; tries++) {
    const a = R() * Math.PI * 2, rr = 26 + Math.pow(R(), 0.8) * 42, x = Math.cos(a) * rr, z = Math.sin(a) * rr;
    if (!free(x, z, 0, 1.6, 1.6, 0.4)) continue;
    claim(x, z, 0, 1.6, 1.6);
    const sc = 0.7 + R() * 0.7, dl = delayOf(x, z) + 0.2;
    trees.push(prep(new THREE.ConeGeometry(1.05 * sc, 3.4 * sc, 6, 1), dl, place(x, 0.5 + 1.7 * sc, z, R() * 6)));
    trunks.push(prep(new THREE.CylinderGeometry(0.1, 0.13, 1.0, 5), dl, place(x, 0.5, z, 0)));
    i++;
  }

  return { B, hero, targets, targetSlots, shops, roads, church, items,
    geo: {
      lamps: mergeGeometries(lamps), poles: mergeGeometries(poles),
      trees: trees.length ? mergeGeometries(trees) : null, trunks: trunks.length ? mergeGeometries(trunks) : null
    } };
}

/* ---------- sol : rues, place, ombres de contact ---------- */
export function groundTexture(world, size = 2048) {
  const cv = document.createElement('canvas'); cv.width = cv.height = size;
  const g = cv.getContext('2d'), k = size / (EXT * 2), P = (x, z) => [(x + EXT) * k, (z + EXT) * k];
  g.fillStyle = '#0c1730'; g.fillRect(0, 0, size, size);
  // grain du sol
  const img = g.getImageData(0, 0, size, size), d = img.data, R = rng(3);
  for (let i = 0; i < d.length; i += 4) { const v = (R() - 0.5) * 7; d[i] += v; d[i + 1] += v; d[i + 2] += v * 1.3; }
  g.putImageData(img, 0, 0);
  // rues
  g.lineCap = 'round'; g.lineJoin = 'round';
  for (const [col, extra] of [['#0a1329', 1.4], ['#17284a', 0], ['#1c2f55', -0.9]]) {
    for (const r of world.roads) {
      g.strokeStyle = col; g.lineWidth = Math.max(1, (r.w * 2 + extra) * k);
      g.beginPath(); r.pts.forEach((p, i) => { const [x, y] = P(p.x, p.z); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.stroke();
    }
  }
  // place pavée
  const [cx, cy] = P(0, 0);
  g.fillStyle = '#1c2f55'; g.beginPath(); g.arc(cx, cy, SQUARE_R * k, 0, Math.PI * 2); g.fill();
  g.strokeStyle = 'rgba(120,160,210,.07)'; g.lineWidth = 0.08 * k;
  for (let r = 1.2; r < SQUARE_R; r += 1.1) { g.beginPath(); g.arc(cx, cy, r * k, 0, Math.PI * 2); g.stroke(); }
  // ombres de contact sous les bâtiments
  g.save(); g.filter = `blur(${Math.round(0.9 * k)}px)`; g.fillStyle = 'rgba(2,5,11,.85)';
  for (const b of world.B) {
    g.save(); const [x, y] = P(b.x, b.z); g.translate(x, y); g.rotate(-b.rot);
    g.fillRect((-b.w / 2 - 0.5) * k, (-b.d / 2 - 0.5) * k, (b.w + 1) * k, (b.d + 1) * k); g.restore();
  }
  { const c = world.church; g.save(); const [x, y] = P(c.x, c.z); g.translate(x, y); g.rotate(-c.rot); g.fillRect((-c.w / 2 - 0.3) * k, (-c.d / 2 - 0.3) * k, (c.w + 0.6) * k, (c.d + 0.6) * k); g.restore(); }
  g.restore();
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  return { tex, ext: EXT };
}

/* ---------- matériaux ---------- */
export function riseUniforms() { return { uIntro: { value: 0 } }; }
export function withRise(mat, U, key, rim) {
  mat.onBeforeCompile = sh => {
    sh.uniforms.uIntro = U.uIntro;
    if (rim) {
      sh.uniforms.uRim = { value: rim };
      sh.fragmentShader = 'uniform vec3 uRim;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        { float fr = pow(1.0 - clamp(abs(dot(normal, normalize(vViewPosition))), 0.0, 1.0), 2.6); totalEmissiveRadiance += uRim * fr; }`);
    }
    sh.vertexShader = 'attribute float aDelay;\nuniform float uIntro;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      float kk = clamp((uIntro - aDelay) / 1.15, 0.0, 1.0);
      kk = 1.0 - pow(1.0 - kk, 3.0);
      transformed.y *= max(kk, 0.0001);`);
  };
  mat.customProgramCacheKey = () => 'rise-' + key;
  return mat;
}

/* carreaux et vitrines qui s'allument : chaque carreau (attribut aWin) et chaque bâtiment (position de
   l'instance) tirent leur propre lumière. mode : 'win' maisons, 'church' vitraux, 'shop' vitrines. */
const GLOW = {
  win: 'vGlow = r < 0.26 ? vec3(1.0, 0.72, 0.42) * (0.85 + r2 * 0.75) : (r < 0.29 ? vec3(0.45, 0.62, 1.0) : vec3(0.0));',
  church: 'vGlow = vec3(1.0, 0.8, 0.55) * (1.0 + r2 * 0.5);',
  shop: 'vGlow = vec3(0.6, 0.78, 1.0) * (0.75 + r2 * 0.5);'
};
export function glowMaterial(U, mode) {
  const mat = new THREE.MeshStandardMaterial({ color: 0x5a6a80, roughness: 0.3, metalness: 0, envMapIntensity: 0.5 });
  mat.onBeforeCompile = sh => {
    sh.uniforms.uIntro = U.uIntro;
    sh.vertexShader = 'attribute float aDelay;\nattribute float aWin;\nuniform float uIntro;\nvarying vec3 vGlow;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      float kk = clamp((uIntro - aDelay) / 1.15, 0.0, 1.0);
      kk = 1.0 - pow(1.0 - kk, 3.0);
      transformed.y *= max(kk, 0.0001);
      vec3 ip = vec3(0.0);
      #ifdef USE_INSTANCING
        ip = instanceMatrix[3].xyz;
      #endif
      float r = fract(sin(aWin * 91.7 + dot(ip.xz, vec2(12.9898, 78.233))) * 43758.5453);
      float r2 = fract(r * 37.13);
      ${GLOW[mode]}
      vGlow *= smoothstep(0.55, 1.0, kk);`);
    sh.fragmentShader = 'varying vec3 vGlow;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n  totalEmissiveRadiance += vGlow;');
  };
  mat.customProgramCacheKey = () => 'glow-' + mode;
  return mat;
}

/* radar au sol */
export function radarMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uSweep: { value: 0 }, uAlpha: { value: 0 }, uR: { value: 44 }, uCol: { value: SCAN.clone() }, uTime: { value: 0 } },
    vertexShader: `varying vec2 vP; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vP = w.xz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform float uSweep, uAlpha, uR, uTime; uniform vec3 uCol; varying vec2 vP;
      void main(){
        float r = length(vP); if (r > uR + 0.5) discard;
        float a = atan(vP.y, vP.x);
        float d = mod(uSweep - a, 6.2831853);
        float fade = smoothstep(uR, uR * 0.15, r);
        float trail = exp(-d * 2.6) * 0.32 * fade;
        float edge = smoothstep(0.03, 0.0, d) * 1.1 * fade;
        float rr = abs(r - 8.0 * floor(r / 8.0 + 0.5));
        float rings = smoothstep(0.07, 0.0, rr) * 0.16 * fade;
        float outer = smoothstep(0.12, 0.0, abs(r - uR)) * 0.5;
        float ticks = step(0.985, fract(a / 6.2831853 * 72.0)) * smoothstep(1.4, 0.0, abs(r - uR + 1.0)) * 0.5;
        float v = (trail + edge + rings + outer + ticks) * uAlpha;
        gl_FragColor = vec4(uCol * v, 1.0);
      }`
  });
}

/* balises : colonne de lumière + halo au sol avec onde */
export function beaconMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uTime: { value: 0 }, uCol: { value: AMBER.clone() } },
    vertexShader: `attribute float aLevel; varying float vL; varying float vY;
      void main(){ vL = aLevel; vY = uv.y; gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position,1.0); }`,
    fragmentShader: `uniform vec3 uCol; uniform float uTime; varying float vL; varying float vY;
      void main(){ float a = pow(1.0 - vY, 2.2) * vL; gl_FragColor = vec4(uCol * a * 2.2, 1.0); }`
  });
}
export function poolMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uCol: { value: AMBER.clone() } },
    vertexShader: `attribute float aLevel; attribute float aPhase; varying float vL; varying float vPh; varying vec2 vUv;
      void main(){ vL = aLevel; vPh = aPhase; vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position,1.0); }`,
    fragmentShader: `uniform vec3 uCol; uniform float uTime; varying float vL; varying float vPh; varying vec2 vUv;
      void main(){
        float r = length(vUv - 0.5) * 2.0;
        float glow = exp(-r * r * 7.0) * 0.32;
        float t = fract(uTime * 0.42 + vPh);
        float ring = smoothstep(0.035, 0.0, abs(r - t)) * (1.0 - t) * 1.4;
        float v = (glow + ring) * vL * smoothstep(1.0, 0.85, r);
        gl_FragColor = vec4(uCol * v, 1.0);
      }`
  });
}
/* flocons / poussière dans l'air */
export function snow(count, R) {
  const g = new THREE.BufferGeometry(), p = new Float32Array(count * 3), s = new Float32Array(count);
  for (let i = 0; i < count; i++) { p[i * 3] = (R() - 0.5) * 130; p[i * 3 + 1] = R() * 40; p[i * 3 + 2] = (R() - 0.5) * 130; s[i] = 0.4 + R(); }
  g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('aS', new THREE.BufferAttribute(s, 1));
  const m = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uPx: { value: 1 }, uAlpha: { value: 0 } },
    vertexShader: `attribute float aS; uniform float uTime, uPx; varying float vA;
      void main(){ vec3 p = position; p.y = mod(p.y - uTime * (0.6 + aS * 0.7), 40.0); p.x += sin(uTime * 0.3 + p.y * 0.2 + aS * 6.0) * 1.2;
        vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv;
        gl_PointSize = uPx * (1.2 + aS * 2.2) * (30.0 / -mv.z); vA = smoothstep(0.0, 4.0, p.y) * smoothstep(40.0, 30.0, p.y); }`,
    fragmentShader: `uniform float uAlpha; varying float vA; void main(){ vec2 c = gl_PointCoord - 0.5; float d = length(c); if (d > 0.5) discard;
        gl_FragColor = vec4(vec3(0.75, 0.86, 1.0) * smoothstep(0.5, 0.0, d) * vA * uAlpha * 0.55, 1.0); }`
  });
  return new THREE.Points(g, m);
}
