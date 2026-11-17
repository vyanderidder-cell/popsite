import * as THREE from '../lib/three.module.min.js';
import { GLTFLoader } from '../lib/GLTFLoader.js';
import { mergeGeometries } from '../lib/BufferGeometryUtils.js';
import { loadPacked } from './packed.js';

export async function loadKit(url) {
  const g = await loadPacked(new GLTFLoader(), url);
  const kit = {};
  g.scene.updateMatrixWorld(true);
  g.scene.children.forEach(o => {
    const prims = [];
    o.traverse(m => { if (m.isMesh) prims.push({ geo: m.geometry, mat: m.material, mtx: m.matrixWorld.clone() }); });
    kit[o.name] = prims;
  });
  // chaîne d'angle en pierre (léger) : blocs alternés
  let rock = null; for (const n in kit) for (const p of kit[n]) if (p.mat.name === 'MI_RockTrim') rock = p.mat;
  if (rock) {
    const parts = [];
    for (let i = 0; i < 6; i++) { const big = i % 2 === 0, bx = new THREE.BoxGeometry(big ? .5 : .34, .5, big ? .34 : .5); bx.translate(big ? .08 : 0, .25 + i * .5, big ? 0 : .08); parts.push(bx); }
    const q = mergeGeometries(parts);
    kit.Quoin = [{ geo: q, mat: rock, mtx: new THREE.Matrix4() }];
  }
  // versions légères pour le loin : toit en prisme, pignon plat, vitre seule
  const I = new THREE.Matrix4();
  let tiles = null, plaster = null;
  for (const n in kit) for (const p of kit[n]) { if (p.mat.name === 'MI_RoundTiles') tiles = p.mat; if (p.mat.name === 'MI_Plaster') plaster = p.mat; }
  for (const n of Object.keys(kit)) {
    const m = /^Roof_RoundTiles_(\d+)x(\d+)$/.exec(n);
    if (m && tiles) {
      const bb = new THREE.Box3(); kit[n].forEach(p => { p.geo.computeBoundingBox(); bb.union(p.geo.boundingBox); });
      const ex = bb.max.x, ey = bb.min.y + .2, ry = bb.max.y - .3, z0 = bb.min.z + .1, z1 = bb.max.z - .1, sl = Math.hypot(ex, ry - ey);
      const P = [], U = [];
      for (const s of [-1, 1]) {
        P.push(s * ex, ey, z0, 0, ry, z0, 0, ry, z1, s * ex, ey, z0, 0, ry, z1, s * ex, ey, z1);
        U.push(z0 / 2, 0, z0 / 2, sl / 2, z1 / 2, sl / 2, z0 / 2, 0, z1 / 2, sl / 2, z1 / 2, 0);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2)); g.computeVertexNormals();
      kit['Cheap_' + n] = [{ geo: g, mat: tiles, mtx: I }];
    }
    const f = /^Roof_Front_Brick(\d+)$/.exec(n);
    if (f && plaster) {
      const bb = new THREE.Box3(); kit[n].forEach(p => { p.geo.computeBoundingBox(); bb.union(p.geo.boundingBox); });
      const w = +f[1] / 2, hh = bb.max.y - .35;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute([-w, 0, 0, w, 0, 0, 0, hh, 0], 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute([-w / 2, 0, w / 2, 0, 0, hh / 2], 2)); g.computeVertexNormals();
      kit['Cheap_' + n] = [{ geo: g, mat: plaster, mtx: I }];
    }
  }
  for (const w of ['Wide_Round', 'Wide_Flat']) if (kit['Window_' + w + '1']) kit['GlassOnly_' + w] = kit['Window_' + w + '1'].filter(p => p.mat.name === 'MI_WindowGlass');
  // vitre seule, à plat sur une façade (maisons lointaines)
  let glass = null, brick = null;
  for (const n in kit) for (const p of kit[n]) { if (p.mat.name === 'MI_WindowGlass') glass = p.mat; if (p.mat.name === 'MI_UnevenBrick') brick = p.mat; }
  if (glass) { const q = new THREE.PlaneGeometry(1.05, 1.45); q.translate(0, 1.88, .04); kit.WinQuad = [{ geo: q, mat: glass, mtx: I }]; }
  Object.defineProperty(kit, '__shellMats', { value: { Plaster: plaster, UnevenBrick: brick }, enumerable: false });
  return kit;
}
/* coque de maison lointaine : 4 murs, UV en mètres (même échelle que les modules) */
function shellGeo(W, L, Hh) {
  const P = [], U = [], w = W / 2, l = L / 2;
  const face = (ax, az, bx, bz, len) => { P.push(ax, 0, az, bx, 0, bz, bx, Hh, bz, ax, 0, az, bx, Hh, bz, ax, Hh, az); U.push(0, 0, len / 2, 0, len / 2, Hh / 3, 0, 0, len / 2, Hh / 3, 0, Hh / 3); };
  face(-w, l, w, l, W); face(w, l, w, -l, L); face(w, -l, -w, -l, W); face(-w, -l, -w, l, L);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2)); g.computeVertexNormals();
  return g;
}
export function shellModule(kit, set, W, L, F) {
  const key = `Shell_${set}_${W}x${L}x${F}`;
  if (!kit[key]) kit[key] = [{ geo: shellGeo(W, L, F * 3), mat: kit.__shellMats[set] || kit.__shellMats.Plaster, mtx: new THREE.Matrix4() }];
  return key;
}

/* --------- instanciation : une InstancedMesh par (module, primitive) --------- */
const _m = new THREE.Matrix4(), _r = new THREE.Matrix4(), _t = new THREE.Matrix4();
class Placer {
  constructor(kit) { this.kit = kit; this.items = {}; }
  add(name, M, tint, glow) {
    if (!this.kit[name]) { console.warn('module manquant', name); return; }
    (this.items[name] || (this.items[name] = [])).push({ m: M.clone(), tint: tint, glow: glow });
  }
  build(group, mats) {
    let tris = 0, calls = 0;
    for (const name in this.items) {
      const list = this.items[name];
      for (const p of this.kit[name]) {
        const mname = p.mat.name, mat = mats[mname] || p.mat;
        const im = new THREE.InstancedMesh(p.geo, mat, list.length);
        const isTint = mname === 'MI_Plaster', isGlass = mname === 'MI_WindowGlass';
        const c = new THREE.Color();
        list.forEach((it, i) => {
          _m.multiplyMatrices(it.m, p.mtx); im.setMatrixAt(i, _m);
          if (isTint) im.setColorAt(i, c.setHex(it.tint || 0xffffff));
          if (isGlass) { const g = it.glow || [0, 0, 0]; im.setColorAt(i, c.setRGB(g[0], g[1], g[2])); }
        });
        im.castShadow = !isGlass; im.receiveShadow = true;
        im.computeBoundingSphere();
        im.name = name + ':' + mname;
        group.add(im);
        tris += (p.geo.index ? p.geo.index.count : p.geo.attributes.position.count) / 3 * list.length; calls++;
      }
    }
    return { tris, calls };
  }
}

function mat4(b, lx, ly, lz, rot, sx, sy, sz) {
  _m.makeTranslation(b.cx, 0, b.cz);
  _r.makeRotationY(b.ang || 0); _m.multiply(_r);
  _t.makeTranslation(lx, ly, lz); _m.multiply(_t);
  _r.makeRotationY(rot || 0); _m.multiply(_r);
  if (sx) { _t.makeScale(sx, sy, sz); _m.multiply(_t); }
  return _m;
}

const SIDE = [
  { n: [0, -1], rot: Math.PI }, { n: [1, 0], rot: Math.PI / 2 }, { n: [0, 1], rot: 0 }, { n: [-1, 0], rot: -Math.PI / 2 }
];
/* positions des modules le long d'un côté d'un rectangle W×L centré en (ox, oz) */
function sideSlots(W, L, k, ox, oz) {
  const out = [];
  if (k === 0 || k === 2) { const n = W / 2, z = (k === 0 ? -L / 2 : L / 2) + oz; for (let i = 0; i < n; i++) out.push([ox - W / 2 + 1 + 2 * i, z]); if (k === 0) out.reverse(); }
  else { const n = L / 2, x = (k === 1 ? W / 2 : -W / 2) + ox; for (let i = 0; i < n; i++) out.push([x, oz - L / 2 + 1 + 2 * i]); if (k === 3) out.reverse(); }
  return out;
}

function warmGlow(rnd, strong) {
  const k = (strong ? 2.6 + rnd() * .8 : .7 + rnd() * 1.5) * .3, h = rnd();
  if (!strong && h < .07) return [.35 * k, .45 * k, .8 * k];
  return [1 * k, (.48 + h * .16) * k, (.17 + h * .1) * k];
}

export function buildVillage(kit, G, mats, rnd, NEAR) {
  // détail complet seulement là où la caméra s'approche : la place et le garage
  const far = b => Math.hypot(b.cx - 2, b.cz - 0) > NEAR && Math.hypot(b.cx - G.T.cx, b.cz - G.T.cz) > NEAR * .8;
  // au loin : seules quelques fenêtres allumées gardent une ouverture
  const lodLit = (b, k, i, f) => (Math.sin(b.cx * 12.9 + b.cz * 78.2 + k * 3.1 + i * 1.7 + f * 5.3) * 43758.5453 % 1 + 1) % 1 < .3 ? warmGlow(rnd, false) : null;
  const P = new Placer(kit);
  const extras = { lanterns: [], chims: [], awnings: [], doors: [], signs: [], sills: [], eaves: [] };

  function wallSet(style, floor) {
    if (style === 'stone') return 'UnevenBrick';
    if (style === 'timber') return floor === 0 ? 'UnevenBrick' : 'Plaster';
    return 'Plaster';
  }
  function placeWall(b, x, z, rot, y, type, tint, opts) {
    const M = mat4(b, x, y, z, rot);
    P.add(type, M, tint);
    if (opts && opts.win) {
      P.add(opts.win, M, tint, opts.glow);
      if (opts.shut) P.add(opts.shut, M, tint);
    }
    if (opts && opts.door) {
      const D = mat4(b, x, y, z, rot);
      _t.makeTranslation(-.53, 0, -.04); D.multiply(_t);
      P.add(opts.door, D);
    }
  }

  function block(b, W, L, F, ox, oz, style, isShop, frontK, opt) {
    const tint = b.tint || 0xffffff, lod = b.lod;
    if (lod) {
      const set = style === 'stone' ? 'UnevenBrick' : 'Plaster';
      P.add(shellModule(kit, set, W, L, F), mat4(b, ox, 0, oz, 0), tint);
      for (let k = 0; k < 4; k++) {
        const slots = sideSlots(W, L, k, ox, oz), rot = SIDE[k].rot, front = k === frontK;
        const hid = (k === 0 || k === 2) && b.nF ? b.nF[k] : 0;
        for (let f = hid; f < F; f++) for (let i = 0; i < slots.length; i++) {
          const [x, z] = slots[i];
          const shopFront = isShop && f === 0 && front;
          const lw = shopFront ? warmGlow(rnd, true) : lodLit(b, k, i, f);
          if (lw) P.add('WinQuad', mat4(b, x, f * 3, z, rot), 0, lw);
          else if ((i + f + k) % 2 === 0) P.add('WinQuad', mat4(b, x, f * 3, z, rot), 0, [0, 0, 0]);
        }
      }
      P.add(`Cheap_Roof_RoundTiles_${W}x${L}`, mat4(b, ox, F * 3, oz, 0));
      if (!b.nF || b.nF[0] < F + 2) P.add(`Cheap_Roof_Front_Brick${W}`, mat4(b, ox, F * 3, oz - L / 2, Math.PI), tint);
      if (!b.nF || b.nF[2] < F + 2) P.add(`Cheap_Roof_Front_Brick${W}`, mat4(b, ox, F * 3, oz + L / 2, 0), tint);
      return;
    }
    for (let k = 0; k < 4; k++) {
      const slots = sideSlots(W, L, k, ox, oz), rot = SIDE[k].rot, n = slots.length;
      const front = k === frontK, gable = k === 0 || k === 2, row = !!b.nF, back = row && k === 3;
      const doorI = front ? Math.min(n - 1, Math.floor((n - 1) / 2 + rnd())) : -1;
      const hid = gable && b.nF ? b.nF[k] : 0;
      for (let f = hid; f < F; f++) {
        const set = wallSet(style, f), y = f * 3;
        for (let i = 0; i < n; i++) {
          if (opt && opt.skip && opt.skip(k, i, f)) continue;
          const [x, z] = slots[i];
          const wantWin = front ? (f === 0 ? (isShop ? i !== doorI : (i + f) % 2 === 0 || rnd() < .45) : (row ? rnd() < .93 : rnd() < .85))
            : back ? (f === 0 ? rnd() < .25 : rnd() < .55) : f === 0 ? rnd() < .3 : rnd() < (gable ? (row ? .35 : .65) : .5);
          if (lod) {
            const lw = lodLit(b, k, i, f);
            if (lw || (isShop && f === 0 && front)) { placeWall(b, x, z, rot, y, `Wall_${set}_Window_${b.round ? 'Wide_Round' : 'Wide_Flat'}`, tint, { win: 'GlassOnly_' + (b.round ? 'Wide_Round' : 'Wide_Flat'), glow: lw || warmGlow(rnd, true) }); continue; }
            placeWall(b, x, z, rot, y, set === 'UnevenBrick' ? 'Wall_UnevenBrick_Straight' : f === 0 ? 'Wall_Plaster_Straight_Base' : (style === 'timber' ? 'Wall_Plaster_WoodGrid' : 'Wall_Plaster_Straight'), tint);
            continue;
          }
          if (f === 0 && i === doorI) {
            const rd = b.round;
            placeWall(b, x, z, rot, y, `Wall_${set}_Door_${rd ? 'Round' : 'Flat'}`, tint, { door: rd ? 'Door_1_Round' : 'Door_1_Flat' });
            extras.doors.push({ b, x, z, rot });
            continue;
          }
          if (wantWin) {
            const thin = !front && rnd() < .45;
            const kind = thin ? 'Thin_Round' : (isShop && f === 0) ? 'Wide_Flat' : b.round ? 'Wide_Round' : 'Wide_Flat';
            const SG = [[.55, .12, .1], [.12, .2, .6], [.5, .38, .08], [.15, .4, .2]];
            const lit = b.stained ? SG[(i + f + k) % 4] : (isShop && f === 0) ? warmGlow(rnd, true) : rnd() < .4 ? warmGlow(rnd, false) : null;
            let shut = null;
            if (!(isShop && f === 0)) {
              if (b.shut < .55 && rnd() < .75) shut = thin ? 'WindowShutters_Thin_Round_Open' : kind === 'Wide_Round' ? 'WindowShutters_Wide_Round_Open' : 'WindowShutters_Wide_Flat_Open';
              else if (b.shut < .7 && !lit && kind === 'Wide_Round') shut = 'WindowShutters_Wide_Round_Closed';
            }
            placeWall(b, x, z, rot, y, `Wall_${set}_Window_${kind}`, tint, { win: kind === 'Thin_Round' ? 'Window_Thin_Round1' : kind === 'Wide_Flat' ? 'Window_Wide_Flat1' : 'Window_Wide_Round1', glow: lit, shut });
            if (f >= 1 && kind !== 'Thin_Round' && !b.stained && rnd() < .42) extras.sills.push(mat4(b, x, y, z, rot).clone());
          } else {
            let t = set === 'UnevenBrick' ? 'Wall_UnevenBrick_Straight' : (style === 'timber' && f > 0) ? 'Wall_Plaster_WoodGrid' : f === 0 ? 'Wall_Plaster_Straight_Base' : 'Wall_Plaster_Straight';
            placeWall(b, x, z, rot, y, t, tint);
          }
        }
      }
    }
    // angles
    if (!lod) for (let f = 0; f < F; f++) for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      if (b.nF && f < b.nF[sz < 0 ? 0 : 2]) continue;
      const st = wallSet(style, f);
      P.add(st === 'UnevenBrick' ? 'Quoin' : 'Corner_Exterior_Wood', mat4(b, ox + sx * W / 2, f * 3, oz + sz * L / 2, sx > 0 ? (sz > 0 ? 0 : Math.PI / 2) : (sz > 0 ? -Math.PI / 2 : Math.PI)));
    }
    // toit + pignons
    if (!lod && b.tint !== undefined && !b.stained) extras.eaves.push({ b, W, L, F, ox, oz, key: `${W}x${L}` });
    const cr = lod ? 'Cheap_' : '';
    P.add(`${cr}Roof_RoundTiles_${W}x${L}`, mat4(b, ox, F * 3, oz, 0));
    if (!b.nF || b.nF[0] < F + 2) P.add(`${cr}Roof_Front_Brick${W}`, mat4(b, ox, F * 3, oz - L / 2, Math.PI), tint);
    if (!b.nF || b.nF[2] < F + 2) P.add(`${cr}Roof_Front_Brick${W}`, mat4(b, ox, F * 3, oz + L / 2, 0), tint);
  }

  for (const b of G.B) {
    const isShop = !!b.shop;
    b.lod = far(b);
    block(b, b.W, b.L, b.F, 0, 0, b.style, isShop, b.front);
    if (b.annex) block(b, 4, 6, 1, 5, 0, b.style === 'stone' ? 'stone' : 'plaster', false, 1, null);
    if (b.chim) {
      const sz = rnd() < .5 ? -1 : 1, cz = sz * (b.L / 2 - .7), lx = 0, base = b.F * 3 + (b.W === 6 ? 2.7 : 3.5);
      const ch = rnd() < .5 ? 'Prop_Chimney' : 'Prop_Chimney2';
      if (!b.lod) P.add(ch, mat4(b, lx, base, cz, 0));
      const c = Math.cos(b.ang), s = Math.sin(b.ang);
      extras.chims.push([b.cx + lx * c + cz * s, base + 3.2, b.cz - lx * s + cz * c]);
    }
  }

  // église + clocher (pierre)
  const CH = Object.assign({ ang: 0, tint: 0xd7cbb6, round: true, shut: 1 }, G.CH);
  CH.stained = true;
  block(CH, CH.W, CH.L, CH.F, 0, 0, 'stone', false, 1, { skip: (k, i, f) => false });
  const TWb = Object.assign({ ang: 0, tint: 0xd7cbb6, round: true, shut: 1 }, G.TW);
  for (let f = 0; f < TWb.F; f++) for (let k = 0; k < 4; k++) {
    sideSlots(4, 4, k, 0, 0).forEach(([x, z]) => {
      const top = f >= TWb.F - 2;
      if (top) placeWall(TWb, x, z, SIDE[k].rot, f * 3, 'Wall_UnevenBrick_Window_Thin_Round', 0xffffff, { win: 'Window_Thin_Round1', glow: f === TWb.F - 1 ? [.7, .4, .16] : null });
      else placeWall(TWb, x, z, SIDE[k].rot, f * 3, 'Wall_UnevenBrick_Straight', 0xffffff);
    });
  }
  for (let f = 0; f < TWb.F; f++) for (const sx of [-1, 1]) for (const sz of [-1, 1]) P.add('Quoin', mat4(TWb, sx * 2, f * 3, sz * 2, sx > 0 ? (sz > 0 ? 0 : Math.PI / 2) : (sz > 0 ? -Math.PI / 2 : Math.PI)));
  P.add('Roof_Tower_RoundTiles', mat4(TWb, 0, TWb.F * 3, 0, 0));

  const group = new THREE.Group();
  const stats = P.build(group, mats);
  return { group, extras, stats };
}

/* --------- lampadaires, lanternes murales --------- */
export function lampGeometries() {
  const post = [];
  const base = new THREE.CylinderGeometry(.17, .22, .55, 10); base.translate(0, .275, 0); post.push(base);
  const p = new THREE.CylinderGeometry(.055, .085, 3.9, 10); p.translate(0, 2.4, 0); post.push(p);
  const ring = new THREE.CylinderGeometry(.11, .11, .08, 10); ring.translate(0, 4.32, 0); post.push(ring);
  const cap = new THREE.ConeGeometry(.3, .26, 4); cap.rotateY(Math.PI / 4); cap.translate(0, 4.95, 0); post.push(cap);
  const fin = new THREE.SphereGeometry(.05, 8, 6); fin.translate(0, 5.12, 0); post.push(fin);
  for (const a of [0, 1, 2, 3]) { const bar = new THREE.BoxGeometry(.025, .5, .025); bar.translate(.2, 4.6, 0); bar.rotateY(a * Math.PI / 2 + Math.PI / 4); post.push(bar); }
  const postG = mergeGeometries(post.map(g => g.toNonIndexed()));
  const glass = new THREE.CylinderGeometry(.22, .14, .48, 4, 1, true); glass.rotateY(Math.PI / 4); glass.translate(0, 4.6, 0);
  const wallL = [];
  const arm = new THREE.BoxGeometry(.04, .04, .32); arm.translate(0, .12, .16); wallL.push(arm);
  const wcap = new THREE.ConeGeometry(.16, .14, 4); wcap.rotateY(Math.PI / 4); wcap.translate(0, .3, .34); wallL.push(wcap);
  const wallG = mergeGeometries(wallL.map(g => g.toNonIndexed()));
  const wglass = new THREE.CylinderGeometry(.11, .075, .26, 4, 1, true); wglass.rotateY(Math.PI / 4); wglass.translate(0, .1, .34);
  return { postG, glass, wallG, wglass };
}

/* --------- arbres --------- */
export function treeGeometries() {
  const blob = (r, x, y, z, seed) => {
    const g = new THREE.IcosahedronGeometry(r, 2), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const vx = p.getX(i), vy = p.getY(i), vz = p.getZ(i);
      const n = Math.sin(vx * 3.1 + seed) * Math.sin(vy * 2.7 + seed * 2) * Math.sin(vz * 3.3 + seed * 3);
      const k = 1 + .22 * n;
      p.setXYZ(i, vx * k + x, vy * k * .85 + y, vz * k + z);
    }
    return g;
  };
  const crown = mergeGeometries([blob(2.1, 0, 5.2, 0, 1), blob(1.6, 1.2, 4.4, .6, 2), blob(1.5, -1.1, 4.6, -.5, 3), blob(1.4, .2, 6.3, -.3, 4), blob(1.3, -.4, 4.2, 1.2, 5)].map(g => g.toNonIndexed()));
  crown.computeVertexNormals();
  const trunk = new THREE.CylinderGeometry(.14, .26, 4.4, 7); trunk.translate(0, 2.2, 0);
  const cone = [];
  for (let i = 0; i < 4; i++) { const c = new THREE.ConeGeometry(2.6 - i * .5, 3.2, 9, 1, true); c.translate(0, 2.4 + i * 1.7, 0); cone.push(c.toNonIndexed()); }
  const pine = mergeGeometries(cone); pine.computeVertexNormals();
  return { crown, trunk, pine };
}

/* --------- fontaine --------- */
export function fountainGeometry() {
  const prof = [[0, .02], [2.55, .02], [2.75, .05], [2.8, .62], [2.65, .7], [2.45, .7], [2.4, .25], [0, .25]].map(v => new THREE.Vector2(v[0], v[1]));
  const basin = new THREE.LatheGeometry(prof, 8);
  const col = [[0, .2], [.42, .2], [.38, .5], [.26, .7], [.24, 1.6], [.32, 1.75], [1.15, 1.95], [1.2, 2.08], [1.05, 2.12], [.3, 2.0], [.2, 2.2], [.16, 2.9], [.24, 3.05], [.1, 3.3], [0, 3.38]].map(v => new THREE.Vector2(v[0], v[1]));
  const column = new THREE.LatheGeometry(col, 16);
  const stone = mergeGeometries([basin.toNonIndexed(), column.toNonIndexed()]);
  stone.computeVertexNormals();
  const water = new THREE.CircleGeometry(2.42, 32); water.rotateX(-Math.PI / 2); water.translate(0, .58, 0);
  const water2 = new THREE.CircleGeometry(1.08, 24); water2.rotateX(-Math.PI / 2); water2.translate(0, 2.02, 0);
  return { stone, water: mergeGeometries([water, water2]) };
}

/* --------- auvents des commerces (bandes) --------- */
export function awningGeometry() {
  // largeur 1 (mise à l'échelle), profondeur 1.4, pente
  const g = new THREE.BufferGeometry();
  const P = [], U = [], I = [];
  const quad = (a, b, c, d, ua, ub, uc, ud) => { const o = P.length / 3; P.push(...a, ...b, ...c, ...d); U.push(...ua, ...ub, ...uc, ...ud); I.push(o, o + 1, o + 2, o, o + 2, o + 3); };
  quad([-.5, 0, 0], [.5, 0, 0], [.5, -.5, 1.4], [-.5, -.5, 1.4], [0, 0], [1, 0], [1, 1], [0, 1]);
  quad([-.5, -.5, 1.4], [.5, -.5, 1.4], [.5, -.82, 1.42], [-.5, -.82, 1.42], [0, 1], [1, 1], [1, 1.25], [0, 1.25]);
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
  g.setIndex(I); g.computeVertexNormals();
  return g;
}
