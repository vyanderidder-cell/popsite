import * as THREE from '../lib/three.module.min.js';
import { mergeGeometries } from '../lib/BufferGeometryUtils.js';

const SIDE = [[0, -1, Math.PI], [1, 0, Math.PI / 2], [0, 1, 0], [-1, 0, -Math.PI / 2]];
const _M = new THREE.Matrix4(), _R = new THREE.Matrix4(), _T = new THREE.Matrix4(), _S = new THREE.Matrix4();
function frontFrame(b, out) {
  const s = SIDE[b.front];
  out.makeTranslation(b.cx, 0, b.cz); _R.makeRotationY(b.ang); out.multiply(_R);
  _T.makeTranslation(s[0] * (b.W / 2), 0, s[1] * (b.L / 2)); out.multiply(_T);
  _R.makeRotationY(s[2]); out.multiply(_R);
  return (b.front % 2 === 0 ? b.W : b.L);
}

/* ---------- enseignes peintes (un atlas, un seul appel de dessin) ---------- */
const OTHER = ['Pharmacie Lemoine', 'Tabac Presse', 'Boulangerie Martin', 'Café du Commerce', 'Librairie Vauban', 'Optique Garnier', 'Crêperie Ty Breizh', 'Quincaillerie Morel', 'Brasserie de la Place', 'Charcuterie Dumas', 'Le Bon Grain', 'Primeur Rossi', 'Auto-École Leroy', 'Fleurs du Marché', 'Cave à Vins', 'Bijouterie Faure', 'Pâtisserie Moreau', 'Laverie', 'Bureau de Poste', 'Maison de la Presse', 'Chocolaterie', 'Agence Immobilière', 'Pizzeria Bella', 'Cordonnerie', 'Droguerie', 'Salon de Thé', 'Boucherie Girard', 'Épicerie Fine', 'Herboristerie', 'Le Comptoir', 'Mercerie', 'Restaurant Le Lion', 'Bistrot Chez Paul', 'Caviste', 'Poissonnerie', 'Papeterie', 'Coiffure Élodie', 'Banque Populaire'];
const PAL = [['#1f3b2d', '#e8d9a8'], ['#4a1a1c', '#f0dfb8'], ['#1b2a44', '#e9d7a4'], ['#121212', '#d8b56a'], ['#3b2a1a', '#efe2c4'], ['#2a3b3f', '#f3e6c8']];
export function buildSigns(G, rnd) {
  const shops = G.B.filter(b => b.shop);
  let oi = 0;
  shops.forEach(b => { b.sign = b.name || OTHER[oi++ % OTHER.length]; });
  const CW = 512, CH = 96, COLS = 4, ROWS = Math.ceil(shops.length / COLS);
  const cv = document.createElement('canvas'); cv.width = CW * COLS; cv.height = CH * ROWS;
  const c = cv.getContext('2d');
  shops.forEach((b, i) => {
    const x = (i % COLS) * CW, y = Math.floor(i / COLS) * CH, p = PAL[i % PAL.length];
    c.fillStyle = p[0]; c.fillRect(x, y, CW, CH);
    const gr = c.createLinearGradient(0, y, 0, y + CH); gr.addColorStop(0, 'rgba(255,255,255,.08)'); gr.addColorStop(1, 'rgba(0,0,0,.25)'); c.fillStyle = gr; c.fillRect(x, y, CW, CH);
    c.strokeStyle = p[1]; c.globalAlpha = .7; c.lineWidth = 3; c.strokeRect(x + 7, y + 7, CW - 14, CH - 14); c.globalAlpha = 1;
    const txt = b.sign.toUpperCase();
    let fs = 50; c.font = `600 ${fs}px Georgia, 'Times New Roman', serif`;
    while (c.measureText(txt).width > CW - 50 && fs > 22) { fs -= 2; c.font = `600 ${fs}px Georgia, 'Times New Roman', serif`; }
    c.fillStyle = p[1]; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.shadowColor = 'rgba(0,0,0,.5)'; c.shadowOffsetY = 2; c.shadowBlur = 2;
    c.fillText(txt, x + CW / 2, y + CH / 2 + 2); c.shadowColor = 'transparent';
  });
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const P = [], N = [], UV = [], v = new THREE.Vector3(), n = new THREE.Vector3();
  shops.forEach((b, i) => {
    const len = frontFrame(b, _M), w = Math.min(len - 1.2, 1.2 + b.sign.length * .17), h = w / (CW / CH) * 1.05;
    const y0 = 3.18, z = .12, u0 = (i % COLS) / COLS, u1 = u0 + 1 / COLS, v1 = 1 - Math.floor(i / COLS) / ROWS, v0 = v1 - 1 / ROWS;
    const q = [[-w / 2, y0, z, u0, v0], [w / 2, y0, z, u1, v0], [w / 2, y0 + h, z, u1, v1], [-w / 2, y0, z, u0, v0], [w / 2, y0 + h, z, u1, v1], [-w / 2, y0 + h, z, u0, v1]];
    n.set(0, 0, 1).transformDirection(_M);
    q.forEach(p => { v.set(p[0], p[1], p[2]).applyMatrix4(_M); P.push(v.x, v.y, v.z); N.push(n.x, n.y, n.z); UV.push(p[3], p[4]); });
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2));
  const m = new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: .16, roughness: .55, metalness: 0 });
  const mesh = new THREE.Mesh(g, m); mesh.receiveShadow = true;
  return mesh;
}

/* ---------- jardinières fleuries ---------- */
function flowerBoxGeo() {
  const parts = [];
  const col = (g, r, gg, bb) => { const n = g.attributes.position.count, c = new Float32Array(n * 3); for (let i = 0; i < n; i++) c.set([r, gg, bb], i * 3); g.setAttribute('color', new THREE.BufferAttribute(c, 3)); return g; };
  const box = new THREE.BoxGeometry(1.15, .2, .24); box.translate(0, .92, .24); parts.push(col(box.toNonIndexed(), .45, .2, .12));
  const bro = new THREE.BoxGeometry(.06, .2, .06);
  for (const s of [-.45, .45]) { const k = bro.clone(); k.translate(s, .8, .16); parts.push(col(k.toNonIndexed(), .12, .12, .13)); }
  const FL = [[.85, .18, .2], [.95, .7, .8], [.95, .92, .85], [.9, .45, .1], [.65, .2, .55]];
  for (let i = 0; i < 7; i++) {
    const x = -.48 + i * .16, lf = new THREE.IcosahedronGeometry(.1 + (i % 2) * .03, 0); lf.translate(x, 1.07 + (i % 3) * .03, .25 + (i % 2 ? .04 : -.03)); parts.push(col(lf.toNonIndexed(), .12, .28, .1));
    if (i % 2 === 0) { const fl = new THREE.IcosahedronGeometry(.055, 0); fl.translate(x + .03, 1.16, .3); const f = FL[(i / 2) % FL.length | 0]; parts.push(col(fl.toNonIndexed(), f[0], f[1], f[2])); }
  }
  const g = mergeGeometries(parts); g.computeVertexNormals();
  return g;
}
export function buildFlowerBoxes(list, weatherize) {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .8 });
  weatherize(m, { wetR: .7 });
  const im = new THREE.InstancedMesh(flowerBoxGeo(), m, Math.max(1, list.length));
  list.forEach((M, i) => im.setMatrixAt(i, M));
  im.count = list.length; im.castShadow = true; im.receiveShadow = true; im.computeBoundingSphere();
  return im;
}

/* ---------- gouttières et descentes ---------- */
export function buildGutters(eaves, roofBB, weatherize) {
  const zinc = new THREE.MeshStandardMaterial({ color: 0x6b7077, roughness: .35, metalness: .7 });
  weatherize(zinc, { wetR: .6 });
  const gut = new THREE.CylinderGeometry(.07, .07, 1, 8, 1, true); gut.rotateX(Math.PI / 2);
  const pipe = new THREE.CylinderGeometry(.05, .05, 1, 8, 1, true); pipe.translate(0, .5, 0);
  const G1 = [], G2 = [];
  for (const e of eaves) {
    const bb = roofBB[e.key]; if (!bb) continue;
    const ex = bb.max.x - .12, ey = e.F * 3 + bb.min.y + .1, len = (bb.max.z - bb.min.z) - .3;
    for (const s of [-1, 1]) {
      _M.makeTranslation(e.b.cx, 0, e.b.cz); _R.makeRotationY(e.b.ang); _M.multiply(_R);
      _T.makeTranslation(e.ox + s * ex, ey, e.oz); _M.multiply(_T); _S.makeScale(1, 1, len); G1.push(_M.clone().multiply(_S));
      _M.makeTranslation(e.b.cx, 0, e.b.cz); _R.makeRotationY(e.b.ang); _M.multiply(_R);
      _T.makeTranslation(e.ox + s * (e.W / 2 + .12), 0, e.oz + s * (e.L / 2 - .25)); _M.multiply(_T); _S.makeScale(1, ey, 1); G2.push(_M.clone().multiply(_S));
    }
  }
  const a = new THREE.InstancedMesh(gut, zinc, Math.max(1, G1.length)), b = new THREE.InstancedMesh(pipe, zinc, Math.max(1, G2.length));
  G1.forEach((M, i) => a.setMatrixAt(i, M)); G2.forEach((M, i) => b.setMatrixAt(i, M));
  a.count = G1.length; b.count = G2.length;
  [a, b].forEach(o => { o.castShadow = true; o.computeBoundingSphere(); });
  return [a, b];
}

/* ---------- marches devant les portes ---------- */
export function buildSteps(doors, stoneMat) {
  const g = new THREE.BoxGeometry(1.35, .16, .55); g.translate(0, .08, .3);
  const im = new THREE.InstancedMesh(g, stoneMat, Math.max(1, doors.length));
  doors.forEach((d, i) => {
    _M.makeTranslation(d.b.cx, 0, d.b.cz); _R.makeRotationY(d.b.ang || 0); _M.multiply(_R);
    _T.makeTranslation(d.x, 0, d.z); _M.multiply(_T); _R.makeRotationY(d.rot); _M.multiply(_R);
    im.setMatrixAt(i, _M);
  });
  im.count = doors.length; im.castShadow = true; im.receiveShadow = true; im.computeBoundingSphere();
  return im;
}

/* ---------- bordures de trottoir près des endroits où la caméra s'approche ---------- */
export function buildCurbs(G, near, stoneMat) {
  const list = [];
  const focus = [[0, 0], [G.T.cx, G.T.cz]];
  const close = (x, z) => focus.some(f => Math.hypot(x - f[0], z - f[1]) < near);
  for (let k = -5; k <= 4; k++) {
    const c = 40 * k + 20;
    for (let j = -5; j <= 4; j++) {
      const a = 40 * j + 20, mid = a + 20;
      for (const ax of [0, 1]) for (const s of [-1, 1]) {
        const x = ax === 0 ? c + s * 3.9 : mid, z = ax === 0 ? mid : c + s * 3.9;
        if (!close(x, z)) continue;
        if (Math.abs(x) < 26 && Math.abs(z) < 26) continue;
        if (x > G.SQ2.x0 - 4.5 && x < G.SQ2.x1 + 4.5 && z > G.SQ2.z0 - 4.5 && z < G.SQ2.z1 + 4.5 && (ax === 0 ? (x > G.SQ2.x0 - 1 && x < G.SQ2.x1 + 1) : (z > G.SQ2.z0 - 1 && z < G.SQ2.z1 + 1))) continue;
        if (Math.hypot(x, z) > 205) continue;
        list.push({ x, z, ax });
      }
    }
  }
  const g = new THREE.BoxGeometry(.26, .13, 1); g.translate(0, .065, 0);
  const im = new THREE.InstancedMesh(g, stoneMat, Math.max(1, list.length));
  list.forEach((o, i) => {
    _M.makeTranslation(o.x, 0, o.z); if (o.ax === 1) { _R.makeRotationY(Math.PI / 2); _M.multiply(_R); }
    _S.makeScale(1, 1, 31.6); _M.multiply(_S); im.setMatrixAt(i, _M);
  });
  im.count = list.length; im.receiveShadow = true; im.computeBoundingSphere();
  return im;
}

/* ---------- ombres de contact sous les passants ---------- */
export function contactShadows(n) {
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
  const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(0,0,0,.75)'); gr.addColorStop(.5, 'rgba(0,0,0,.35)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  const g = new THREE.PlaneGeometry(1, 1); g.rotateX(-Math.PI / 2); g.translate(0, .02, 0);
  const m = new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, fog: false });
  const im = new THREE.InstancedMesh(g, m, Math.max(1, n)); im.frustumCulled = false; im.renderOrder = 2;
  return im;
}
