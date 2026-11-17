import * as THREE from '../lib/three.module.min.js';
import { GLTFLoader } from '../lib/GLTFLoader.js';
import { loadPacked } from './packed.js';

/* bibliothèques : nom -> primitives (géométrie, matériau, matrice locale) */
export async function loadLib(url) {
  const g = await loadPacked(new GLTFLoader(), url), lib = {};
  g.scene.updateMatrixWorld(true);
  g.scene.children.forEach(o => {
    const prims = [];
    o.traverse(m => { if (m.isMesh) prims.push({ geo: m.geometry, mat: m.material, mtx: m.matrixWorld.clone() }); });
    lib[o.name] = prims;
  });
  return lib;
}

class Batch {
  constructor(lib) { this.lib = lib; this.items = {}; }
  add(name, x, y, z, ry, s) {
    if (!this.lib[name]) return;
    const M = new THREE.Matrix4().makeRotationY(ry || 0);
    if (s) M.multiply(new THREE.Matrix4().makeScale(s, s, s));
    M.setPosition(x, y || 0, z);
    (this.items[name] || (this.items[name] = [])).push(M);
  }
  build(group, prep) {
    const T = new THREE.Matrix4();
    for (const name in this.items) {
      const list = this.items[name];
      for (const p of this.lib[name]) {
        const im = new THREE.InstancedMesh(p.geo, prep(p.mat), list.length);
        list.forEach((M, i) => im.setMatrixAt(i, T.multiplyMatrices(M, p.mtx)));
        im.castShadow = true; im.receiveShadow = true; im.computeBoundingSphere(); im.name = 'decor:' + name;
        group.add(im);
      }
    }
  }
}

const roadDist = v => { const m = (((v - 20) % 40) + 40) % 40; return Math.min(m, 40 - m); };

export function placeDecor(props, nature, G, opt, prepMat) {
  const rnd = G.rnd, group = new THREE.Group();
  const P = new Batch(props), N = new Batch(nature);
  const FO = G.FO, T = G.T, near = opt.near;
  const isNear = (x, z, r) => Math.hypot(x - 2, z) < (r || near) || Math.hypot(x - T.cx, z - T.cz) < (r || near) * .9;
  const inHouse = (x, z, pad) => G.B.some(b => {
    const c = Math.cos(b.ang), s = Math.sin(b.ang), dx = x - b.cx, dz = z - b.cz;
    const lx = dx * c - dz * s, lz = dx * s + dz * c;
    const ex = b.annex ? 7.2 : b.W / 2;
    return lx > -b.W / 2 - pad && lx < ex + pad && Math.abs(lz) < b.L / 2 + pad;
  });
  const onRoad = (x, z) => Math.min(roadDist(x), roadDist(z)) < 4.4;
  const inSquare = (x, z) => (Math.abs(x) < 24 && Math.abs(z) < 24) || (x > G.SQ2.x0 && x < G.SQ2.x1 && z > G.SQ2.z0 && z < G.SQ2.z1);

  /* ---- place : bancs autour de la fontaine, étals du marché ---- */
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * Math.PI * 2 + .26, r = 11.2;
    P.add('Bench', FO.cx + Math.cos(a) * r, 0, FO.cz + Math.sin(a) * r, -a + Math.PI / 2);
  }
  const stalls = [[-14, 20.5, Math.PI, 'Stall_Empty'], [-8.5, 20.8, Math.PI, 'Stall_Cart_Empty'], [-20.5, 10, -Math.PI / 2, 'Stall_Empty'], [76, 30, Math.PI, 'Stall_Cart_Empty'], [90, 50, 0, 'Stall_Empty']];
  stalls.forEach(s => {
    P.add(s[3], s[0], 0, s[1], s[2]);
    const ox = Math.cos(s[2]), oz = -Math.sin(s[2]);
    P.add(rnd() < .5 ? 'Crate_Wooden' : 'Barrel', s[0] + ox * 1.3 + oz * .2, 0, s[1] - oz * 1.3 + ox * .2, rnd() * 6, .85);
    if (rnd() < .6) P.add('FarmCrate_Apple', s[0] - ox * .3, .02, s[1] + oz * .3 + .9, s[2]);
  });
  // petite place du garage : bancs, arbres en fond
  [[70, 30, Math.PI / 2], [70, 50, Math.PI / 2]].forEach(p => P.add('Bench', p[0], 0, p[1], p[2]));
  [[93, 28], [93, 52]].forEach(p => N.add('CommonTree_3', p[0], 0, p[1], rnd() * 6, 1));
  // drapeaux sur la façade de l'église côté place
  P.add('Banner_1', G.CH.cx + G.CH.W / 2 + .05, 6.2, G.CH.cz - 3, 0); P.add('Banner_2', G.CH.cx + G.CH.W / 2 + .05, 6.2, G.CH.cz + 3, 0);

  /* ---- devantures proches : tonneaux, cageots, terrasses, pots ---- */
  const SIDE = [[0, -1, Math.PI], [1, 0, Math.PI / 2], [0, 1, 0], [-1, 0, -Math.PI / 2]];
  for (const b of G.B) {
    if (b.lod || !isNear(b.cx, b.cz)) continue;
    const s = SIDE[b.front], c = Math.cos(b.ang), sn = Math.sin(b.ang);
    const W = (b.front % 2 === 0 ? b.W : b.L), hx = s[0] * (b.W / 2), hz = s[1] * (b.L / 2);
    const tx = s[1] !== 0 ? 1 : 0, tz = s[0] !== 0 ? 1 : 0;   // tangente locale de la façade
    const at = (u, out) => { const lx = hx + tx * u + s[0] * out, lz = hz + tz * u + s[1] * out; return [b.cx + lx * c + lz * sn, b.cz - lx * sn + lz * c]; };
    const face = b.ang + s[2];
    const food = /resto|commerce/.test(b.cat || '') || /Café|Bistrot|Brasserie|Restaurant|Pizzeria|Crêperie|Salon de Thé|Comptoir/.test(b.sign || '');
    if (b.shop) {
      const e1 = at(W / 2 - .7, .55), e2 = at(-W / 2 + .7, .55);
      P.add(rnd() < .5 ? 'Barrel' : 'Crate_Wooden', e1[0], 0, e1[1], rnd() * 6, .8);
      if (rnd() < .6) P.add(rnd() < .5 ? 'Barrel' : 'Bucket_Wooden_1', e2[0], 0, e2[1], rnd() * 6);
      if (food && rnd() < .8) {
        const t0 = at(W / 2 - 2.2, 1.6);
        P.add('Table_Large', t0[0], 0, t0[1], face + Math.PI / 2, .7);
        const ca = at(W / 2 - 1.5, 1.6), cb = at(W / 2 - 2.9, 1.6);
        P.add('Chair_1', ca[0], 0, ca[1], face - Math.PI / 2); P.add('Chair_1', cb[0], 0, cb[1], face + Math.PI / 2);
      } else if (rnd() < .5) {
        const t0 = at(-W / 2 + 1.8, .7);
        P.add('Table_Large', t0[0], 0, t0[1], face, .6);
        P.add(rnd() < .5 ? 'FarmCrate_Apple' : 'FarmCrate_Carrot', t0[0], .49, t0[1], face);
      }
    } else if (rnd() < .55) {
      const v = at((rnd() - .5) * (W - 2), .4);
      P.add(rnd() < .7 ? 'Vase_2' : 'Bucket_Wooden_1', v[0], 0, v[1], rnd() * 6, .8 + rnd() * .3);
    }
    // buissons au pied des murs latéraux
    for (let k = 0; k < 4; k++) {
      if (k === b.front || rnd() < .45) continue;
      const sk = SIDE[k], lx = sk[0] * (b.W / 2 + .6) + (sk[1] !== 0 ? (rnd() - .5) * (b.W - 1) : 0), lz = sk[1] * (b.L / 2 + .6) + (sk[0] !== 0 ? (rnd() - .5) * (b.L - 1) : 0);
      const x = b.cx + lx * c + lz * sn, z = b.cz - lx * sn + lz * c;
      if (onRoad(x, z) || inHouse(x, z, .2)) continue;
      N.add(rnd() < .35 ? 'Bush_Common_Flowers' : 'Bush_Common', x, 0, z, rnd() * 6, .7 + rnd() * .5);
    }
  }
  // garage : tonneaux d'huile et caisses
  { const s = SIDE[T.front], c = Math.cos(T.ang), sn = Math.sin(T.ang);
    for (let i = 0; i < 3; i++) { const lx = s[0] * (T.W / 2 + .7) + (s[1] !== 0 ? -T.W / 2 + .8 + i * .75 : 0), lz = s[1] * (T.L / 2 + .7) + (s[0] !== 0 ? -T.L / 2 + .8 + i * .75 : 0); P.add('Barrel', T.cx + lx * c + lz * sn, 0, T.cz - lx * sn + lz * c, i, .85); } }

  /* ---- arbres : vrais arbres sur la place et dans les rues proches, silhouettes simples au loin ---- */
  const far = [];
  for (const t of G.TREES) {
    if (t[3] === 1) { far.push(t); continue; }
    if (t[3] === 2 && !isNear(t[0], t[1], near * 1.7)) { far.push(t); continue; }
    const kind = ['CommonTree_1', 'CommonTree_3', 'CommonTree_5'][Math.floor(rnd() * 3)];
    N.add(kind, t[0], 0, t[1], rnd() * 6.3, (t[3] === 0 ? 1.05 : .85) + rnd() * .3);
  }
  // touffes d'herbe et fleurs dans les cours proches
  let tries = 0, placed = 0;
  while (placed < opt.grass && tries < opt.grass * 12) {
    tries++;
    const f = rnd() < .55 ? [2, 0] : [T.cx, T.cz], a = rnd() * 6.283, r = Math.sqrt(rnd()) * near * 1.1;
    const x = f[0] + Math.cos(a) * r, z = f[1] + Math.sin(a) * r;
    if (onRoad(x, z) || inSquare(x, z) || inHouse(x, z, .3)) continue;
    const q = rnd();
    N.add(q < .62 ? 'Grass_Common_Short' : q < .8 ? 'Grass_Wispy_Short' : q < .9 ? 'Plant_7' : q < .96 ? 'Fern_1' : 'Flower_4_Group', x, 0, z, rnd() * 6.3, .7 + rnd() * .5);
    placed++;
  }
  // massifs fleuris aux coins de la place
  [[-21, 21], [21, -21], [-21, -21]].forEach(p => { N.add('Flower_3_Group', p[0], 0, p[1], rnd() * 6, 1.1); N.add('Bush_Common_Flowers', p[0] + 1.6, 0, p[1] - 1.2, rnd() * 6, .9); });
  // rochers dans les champs
  for (let i = 0; i < 40; i++) { const a = rnd() * 6.283, r = 225 + rnd() * 160; N.add(rnd() < .5 ? 'Rock_Medium_1' : 'Rock_Medium_2', Math.cos(a) * r, 0, Math.sin(a) * r, rnd() * 6, 1 + rnd() * 1.5); }

  P.build(group, prepMat); N.build(group, prepMat);
  return { group, farTrees: far };
}
