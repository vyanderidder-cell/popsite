import * as THREE from '../lib/three.module.min.js';
import { GLTFLoader } from '../lib/GLTFLoader.js';
import { clone as skClone } from '../lib/SkeletonUtils.js';
import { loadPacked } from './packed.js';

/* ---------- habits procéduraux sur le corps de base ---------- */
const COATS = [0x1c2433, 0x5a1d18, 0x4a4a52, 0x161616, 0x23382e, 0x2b2f45, 0x3a3f47, 0x6e6a62, 0x1f3550, 0x4b1f33, 0x2f3b2a];
const PANTS = [0x15171c, 0x22252c, 0x2c2a26, 0x1a2233, 0x3a352d];
const SCARF = [0x8c2a1f, 0xb08a3e, 0x2c4f7a, 0x6e6e6e, 0x7a1f3d, 0x1f5a4a];
const UMB = [0x111216, 0x16223f, 0x5e1414, 0x24321f, 0x6f5a3a, 0x2a2a2e, 0x7c1a2a, 0x0f2f3a];
const HAIRC = [0x2a1a10, 0x140e0a, 0x5a3a1e, 0x8a6a3e, 0x3d2a1a, 0x6e6e6e, 0x101010];

function clothe(mat, P) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uCoat = { value: new THREE.Color(P.coat) };
    sh.uniforms.uPants = { value: new THREE.Color(P.pants) };
    sh.uniforms.uScarf = { value: new THREE.Color(P.scarf) };
    sh.uniforms.uLong = { value: P.long };
    sh.uniforms.uScarfOn = { value: P.scarfOn };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vBind;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvBind = position;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vBind;uniform vec3 uCoat,uPants,uScarf;uniform float uLong,uScarfOn;')
      .replace('#include <map_fragment>', `#include <map_fragment>
        float clothMask = 0.; vec3 clothCol = vec3(0.);
        {
          vec3 b = vBind; float ax = abs(b.x);
          float shoe = 1. - smoothstep(.17, .2, b.y);
          float legs = (1. - smoothstep(.97, 1.0, b.y)) * (1. - smoothstep(.27, .3, ax));
          float torso = smoothstep(.86, .9, b.y) * (1. - smoothstep(1.47, 1.5, b.y)) * (1. - smoothstep(.69, .72, ax));
          float coatLow = smoothstep(uLong - .02, uLong, b.y) * (1. - smoothstep(.27, .3, ax));
          float neck = smoothstep(1.43, 1.46, b.y) * (1. - smoothstep(1.53, 1.56, b.y)) * (1. - smoothstep(.09, .11, ax)) * uScarfOn;
          float coat = max(torso, coatLow * step(b.y, 1.0));
          vec3 cc = uCoat * (.82 + .18 * smoothstep(.3, 1.4, b.y));
          // boutonnage et col
          cc *= 1. - .35 * (1. - smoothstep(.006, .012, abs(b.x))) * step(b.z, 0.) * torso;
          clothCol = mix(uPants, cc, coat);
          clothCol = mix(clothCol, vec3(.03, .025, .02), shoe);
          clothCol = mix(clothCol, uScarf, neck);
          clothMask = clamp(max(max(legs, coat), max(shoe, neck)), 0., 1.);
          diffuseColor.rgb = mix(diffuseColor.rgb, clothCol, clothMask);
        }`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, .58, clothMask);')
      .replace('mapN.xy *= normalScale;', 'mapN.xy *= normalScale * (1. - clothMask * .88);');
  };
  mat.customProgramCacheKey = () => 'clothe1';
}

function umbrellaGeo() {
  const segs = 8, rings = 4, R = .52, Hc = .19, pos = [], idx = [];
  pos.push(0, Hc + .02, 0);
  for (let r = 1; r <= rings; r++) {
    const f = r / rings;
    for (let s = 0; s < segs * 2; s++) {
      const a = s / (segs * 2) * Math.PI * 2, rib = s % 2 === 0;
      const rr = R * f * (rib ? 1 : .955 - .03 * f);
      const y = Hc * (1 - f * f) - (rib ? 0 : .015 * f);
      pos.push(Math.cos(a) * rr, y, Math.sin(a) * rr);
    }
  }
  const N = segs * 2;
  for (let s = 0; s < N; s++) idx.push(0, 1 + (s + 1) % N, 1 + s);
  for (let r = 1; r < rings; r++) {
    const a0 = 1 + (r - 1) * N, a1 = 1 + r * N;
    for (let s = 0; s < N; s++) {
      const s1 = (s + 1) % N;
      idx.push(a0 + s, a0 + s1, a1 + s1, a0 + s, a1 + s1, a1 + s);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}


function coatShader(mat, P) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uIn = { value: new THREE.Color(P.scarfOn ? P.scarf : 0x9a958c) };
    sh.uniforms.uBelt = { value: P.long < 1 ? 1 : 0 };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vBind;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvBind = position;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vBind;uniform vec3 uIn;uniform float uBelt;')
      .replace('#include <map_fragment>', `#include <map_fragment>
        { vec3 b = vBind; float front = step(0., b.z) * (1. - step(.3, abs(b.x)));
          float vee = front * step(1.33, b.y) * (1. - smoothstep(.0, .01, abs(b.x) - (b.y - 1.33) * .3));
          float seam = front * (1. - smoothstep(.004, .009, abs(b.x))) * step(b.y, 1.22);
          float belt = uBelt * front * (1. - smoothstep(.02, .03, abs(b.y - .97)));
          float btn = front * step(.9, b.y) * step(b.y, 1.2) * (1. - smoothstep(.008, .012, length(vec2(abs(b.x) - .045, fract(b.y * 9.) - .5) * vec2(1., .11))));
          float hem = 1. - smoothstep(.0, .03, b.y - .55);
          diffuseColor.rgb = mix(diffuseColor.rgb, uIn, vee);
          diffuseColor.rgb *= 1. - .55 * seam - .4 * belt - .5 * btn;
          diffuseColor.rgb *= 1. - .25 * hem * uBelt;
          diffuseColor.rgb *= .9 + .1 * smoothstep(.5, 1.4, b.y);
        }`);
  };
  mat.customProgramCacheKey = () => 'coat1';
}

/* ---------- manteau : coque convexe tranche par tranche autour du corps, poids de peau transférés ---------- */
function hull2(pts) {
  pts.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = [];
  for (const p of pts) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
  for (let i = pts.length - 1; i >= 0; i--) { const p = pts[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
  up.pop(); lo.pop(); return lo.concat(up);
}
function radial(hull, cx, cy, K) {
  const r = [];
  for (let k = 0; k < K; k++) {
    const a = k / K * Math.PI * 2, dx = Math.cos(a), dy = Math.sin(a);
    let best = 0;
    for (let i = 0; i < hull.length; i++) {
      const p = hull[i], q = hull[(i + 1) % hull.length];
      const ex = q[0] - p[0], ey = q[1] - p[1], den = dx * ey - dy * ex;
      if (Math.abs(den) < 1e-9) continue;
      const t = ((p[0] - cx) * ey - (p[1] - cy) * ex) / den, u = ((p[0] - cx) * dy - (p[1] - cy) * dx) / den;
      if (t > 0 && u >= -1e-6 && u <= 1 + 1e-6) best = Math.max(best, t);
    }
    r.push(best);
  }
  return r;
}
function smoothRings(R, it) {
  for (let n = 0; n < it; n++) {
    const C = R.map(a => a.slice());
    for (let i = 0; i < R.length; i++) for (let k = 0; k < R[i].length; k++) {
      const K = R[i].length, a = C[i][(k + K - 1) % K], b = C[i][(k + 1) % K];
      const u = C[Math.max(0, i - 1)][k], d = C[Math.min(R.length - 1, i + 1)][k];
      R[i][k] = C[i][k] * .4 + (a + b) * .15 + (u + d) * .15;
    }
  }
}
function buildCoat(body, long) {
  const g = body.geometry, P = g.attributes.position, SI = g.attributes.skinIndex, SW = g.attributes.skinWeight, n = P.count;
  const X = new Float32Array(n), Y = new Float32Array(n), Z = new Float32Array(n);
  for (let i = 0; i < n; i++) { X[i] = P.getX(i); Y[i] = P.getY(i); Z[i] = P.getZ(i); }
  const verts = [], rings = [];
  const K = 22, off = .021;
  // torse (+ jupe de manteau si long)
  const yTop = 1.47, yBot = long ? .52 : .82, step = .03;
  const ys = []; for (let y = yTop; y >= yBot - 1e-6; y -= step) ys.push(y);
  const R = [], CX = [], CZ = [];
  for (const y of ys) {
    const pts = [];
    const xl = y > 1.18 ? .22 : y > .95 ? .3 : .34;
    for (let i = 0; i < n; i++) if (Math.abs(Y[i] - y) < .022 && Math.abs(X[i]) < xl) pts.push([X[i], Z[i]]);
    if (pts.length < 3) { R.push(R.length ? R[R.length - 1].slice() : new Array(K).fill(.15)); CX.push(0); CZ.push(0); continue; }
    let cx = 0, cz = 0; pts.forEach(p => { cx += p[0]; cz += p[1]; }); cx /= pts.length; cz /= pts.length;
    const h = hull2(pts);
    const flare = y < .9 ? (.9 - y) * .16 : 0;
    R.push(radial(h, cx, cz, K).map(r => r + off + flare)); CX.push(0); CZ.push(cz);
  }
  smoothRings(R, 3);
  ys.forEach((y, i) => { const ring = []; for (let k = 0; k < K; k++) { const a = k / K * Math.PI * 2; ring.push([CX[i] + Math.cos(a) * R[i][k], y, CZ[i] + Math.sin(a) * R[i][k]]); } rings.push(ring); });
  // col qui se resserre
  const collar = rings[0].map(p => [p[0] * .45, yTop + .07, CZ[0] + (p[2] - CZ[0]) * .5]);
  rings.unshift(collar);
  const tubes = [rings];
  // manches
  for (const s of [-1, 1]) {
    const Ks = 12, xs = [], RR = [], CY = [], CZs = [];
    for (let x = .17; x <= .72; x += .03) xs.push(x);
    for (const x of xs) {
      const pts = [];
      for (let i = 0; i < n; i++) if (Math.abs(X[i] * s - x) < .02 && Y[i] > 1.18) pts.push([Y[i], Z[i]]);
      if (pts.length < 3) { RR.push(RR.length ? RR[RR.length - 1].slice() : new Array(Ks).fill(.06)); CY.push(CY.length ? CY[CY.length - 1] : 1.4); CZs.push(0); continue; }
      let cy = 0, cz = 0; pts.forEach(p => { cy += p[0]; cz += p[1]; }); cy /= pts.length; cz /= pts.length;
      RR.push(radial(hull2(pts), cy, cz, Ks).map(r => r + .022)); CY.push(cy); CZs.push(cz);
    }
    smoothRings(RR, 2);
    const sl = xs.map((x, i) => { const ring = []; for (let k = 0; k < Ks; k++) { const a = k / Ks * Math.PI * 2; ring.push([x * s, CY[i] + Math.cos(a) * RR[i][k], CZs[i] + Math.sin(a) * RR[i][k]]); } return ring; });
    tubes.push(s > 0 ? sl : sl);
  }
  // maillage
  const pos = [], idx = [];
  for (const T of tubes) {
    const base = pos.length / 3, Kt = T[0].length;
    T.forEach(r => r.forEach(p => pos.push(p[0], p[1], p[2])));
    for (let i = 0; i < T.length - 1; i++) for (let k = 0; k < Kt; k++) {
      const a = base + i * Kt + k, b = base + i * Kt + (k + 1) % Kt, c = base + (i + 1) * Kt + (k + 1) % Kt, d = base + (i + 1) * Kt + k;
      idx.push(a, b, c, a, c, d);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  // orienter les normales vers l'extérieur
  const nn = geo.attributes.normal;
  let flip = 0; for (let i = 0; i < nn.count; i++) { const x = pos[i * 3], z = pos[i * 3 + 2]; flip += nn.getX(i) * x + nn.getZ(i) * z; }
  if (flip < 0) { for (let i = 0; i < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; } geo.setIndex(idx); geo.computeVertexNormals(); }
  // transfert des poids de peau (sommet du corps le plus proche ; bas du manteau mêlé au bassin)
  const m = pos.length / 3, si = new Uint16Array(m * 4), sw = new Float32Array(m * 4);
  let pelvisIdx = body.skeleton.bones.findIndex(b => b.name === 'pelvis');
  for (let j = 0; j < m; j++) {
    const x = pos[j * 3], y = pos[j * 3 + 1], z = pos[j * 3 + 2];
    let bi = 0, bd = 1e9;
    for (let i = 0; i < n; i++) { const dx = X[i] - x, dy = Y[i] - y, dz = Z[i] - z, d = dx * dx + dy * dy + dz * dz; if (d < bd) { bd = d; bi = i; } }
    const w = {};
    for (let c = 0; c < 4; c++) { const ix = SI.getComponent(bi, c), wv = SW.getComponent(bi, c); if (wv > 0) w[ix] = (w[ix] || 0) + wv; }
    if (y < .92 && Math.abs(x) < .4) { const t = Math.min(1, (.92 - y) / .25) * .6; for (const k2 in w) w[k2] *= 1 - t; w[pelvisIdx] = (w[pelvisIdx] || 0) + t; }
    const arr = Object.entries(w).sort((a, b) => b[1] - a[1]).slice(0, 4); let sum = 0; arr.forEach(e => sum += e[1]);
    arr.forEach((e, c) => { si[j * 4 + c] = +e[0]; sw[j * 4 + c] = e[1] / sum; });
  }
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
  geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
  return geo;
}

/* ---------- chargement ---------- */
export async function loadPeople(base, renderer) {
  const L = new GLTFLoader();
  const [gm, gf, gh, aj] = await Promise.all([
    loadPacked(L, base + 'c/Superhero_Male_FullBody.json'),
    loadPacked(L, base + 'c/Superhero_Female_FullBody.json'),
    loadPacked(L, base + 'c/hair.json'),
    fetch(base + 'c/anims.json').then(r => r.json())
  ]);
  const TL = new THREE.TextureLoader();
  const skin = {
    m: [null, TL.load(base + 'c/T_Superhero_Male_Light.webp')],
    f: [null, TL.load(base + 'c/T_Superhero_Female_Light.webp')]
  };
  [skin.m[1], skin.f[1]].forEach(t => { t.flipY = false; t.colorSpace = THREE.SRGBColorSpace; });

  const clips = {};
  aj.forEach(c => { c.tracks = c.tracks.filter(t => !/^Rig\./.test(t.name)); clips[c.name] = THREE.AnimationClip.parse(c); });
  // marche « parapluie » : jambes de la marche, bras droit figé dans la pose de la torche
  const torch = clips.Idle_Torch_Loop, armRe = /(clavicle_l|upperarm_l|lowerarm_l|hand_l|_0\d_l)\./;
  // pose de maintien : bras gauche de la « torche » corrigé par IK à deux os (main devant la poitrine)
  const armQ = {};
  {
    const tmp = skClone(gm.scene), B = {};
    tmp.traverse(o => { if (o.isBone) B[o.name] = o; });
    const mx = new THREE.AnimationMixer(tmp); mx.clipAction(torch).play(); mx.update(0); tmp.updateMatrixWorld(true);
    const wp = o => o.getWorldPosition(new THREE.Vector3());
    const S = wp(B.upperarm_l), E = wp(B.lowerarm_l), H = wp(B.hand_l);
    const a = S.distanceTo(E), b = E.distanceTo(H);
    const T = new THREE.Vector3(.16, 1.19, .27);
    let d = Math.min(S.distanceTo(T), a + b - 1e-3);
    const dir = T.clone().sub(S).normalize();
    const pole = new THREE.Vector3(1, -1.3, -.5).normalize();
    const pp = pole.clone().sub(dir.clone().multiplyScalar(pole.dot(dir))).normalize();
    const cA = (a * a + d * d - b * b) / (2 * a * d), sA = Math.sqrt(Math.max(0, 1 - cA * cA));
    const E2 = S.clone().add(dir.clone().multiplyScalar(a * cA)).add(pp.clone().multiplyScalar(a * sA));
    const turn = (bone, from, to) => {
      const q = new THREE.Quaternion().setFromUnitVectors(from.clone().normalize(), to.clone().normalize());
      const wq = bone.getWorldQuaternion(new THREE.Quaternion());
      const nq = q.multiply(wq);
      const pq = bone.parent.getWorldQuaternion(new THREE.Quaternion());
      bone.quaternion.copy(pq.invert().multiply(nq)); tmp.updateMatrixWorld(true);
    };
    turn(B.upperarm_l, E.clone().sub(S), E2.clone().sub(S));
    const E3 = wp(B.lowerarm_l), H3 = wp(B.hand_l);
    turn(B.lowerarm_l, H3.clone().sub(E3), T.clone().sub(E3));
    // poignet : remettre la main dans l'axe de l'avant-bras, légèrement relevée
    armQ.upperarm_l = B.upperarm_l.quaternion.clone(); armQ.lowerarm_l = B.lowerarm_l.quaternion.clone();
  }
  function holdVariant(src, name) {
    const tracks = src.tracks.filter(t => !armRe.test(t.name)).map(t => t.clone());
    torch.tracks.filter(t => armRe.test(t.name)).forEach(t => {
      const bn = t.name.split('.')[0];
      const q = armQ[bn] ? armQ[bn] : new THREE.Quaternion().fromArray(t.values, 0);
      tracks.push(new THREE.QuaternionKeyframeTrack(t.name, [0], q.toArray()));
    });
    return new THREE.AnimationClip(name, src.duration, tracks);
  }
  clips.WalkUmb = holdVariant(clips.Walk_Loop, 'WalkUmb');
  clips.WalkFormalUmb = holdVariant(clips.Walk_Formal_Loop, 'WalkFormalUmb');
  clips.IdleUmb = holdVariant(clips.Idle_Loop, 'IdleUmb');
  clips.TalkUmb = holdVariant(clips.Idle_Talking_Loop, 'TalkUmb');

  const hair = {};
  gh.scene.traverse(o => { if (o.isMesh) hair[o.name] = o; });

  const proto = { m: gm.scene, f: gf.scene };
  [gm.scene, gf.scene].forEach(s => s.traverse(o => {
    if (o.isMesh) { o.frustumCulled = false; o.castShadow = false; o.receiveShadow = true; }
  }));
  // poignée du parapluie (main gauche, pose « torche ») + manteaux générés depuis le corps
  const grip = {}, coats = {};
  for (const k of ['m', 'f']) {
    const tmp = skClone(proto[k]);
    const mx = new THREE.AnimationMixer(tmp);
    mx.clipAction(clips.IdleUmb).play(); mx.update(0);
    tmp.updateMatrixWorld(true);
    const B = {}; tmp.traverse(o => { if (o.isBone) B[o.name] = o; });
    const hp = new THREE.Vector3(), kp = new THREE.Vector3(), headp = new THREE.Vector3();
    B.hand_l.getWorldPosition(hp); B.middle_01_l.getWorldPosition(kp); B.Head.getWorldPosition(headp);
    const gp = hp.clone().lerp(kp, .75);
    const target = new THREE.Vector3(headp.x * .45 + gp.x * .55, 2.06 - (k === 'f' ? .04 : 0), headp.z * .45 + gp.z * .55);
    const dir = target.clone().sub(gp); const len = dir.length(); dir.normalize();
    const qw = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    const qh = new THREE.Quaternion(); B.hand_l.getWorldQuaternion(qh);
    const inv = new THREE.Matrix4().copy(B.hand_l.matrixWorld).invert();
    grip[k] = { q: qh.clone().invert().multiply(qw), p: gp.clone().applyMatrix4(inv), len };
    let body = null; proto[k].traverse(o => { if (o.isSkinnedMesh && /Superhero/i.test(o.material.name || '')) body = o; });
    coats[k] = { short: buildCoat(body, false), long: buildCoat(body, true) };
  }
  return { proto, clips, hair, skin, grip, coats, umbGeo: umbrellaGeo() };
}

/* ---------- foule ---------- */
const UP = new THREE.Vector3(0, 1, 0);
export function makeCrowd(P, specs, scene, rnd) {
  const crowd = [];
  const shaftGeo = new THREE.CylinderGeometry(.009, .009, .92, 5); shaftGeo.translate(0, .46, 0);
  const shaftMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: .4, metalness: .6 });
  for (const s of specs) {
    const sex = s.sex;
    const root = skClone(P.proto[sex]);
    const pick = a => a[Math.floor(rnd() * a.length)];
    const look = {
      coat: pick(COATS), pants: pick(PANTS), scarf: pick(SCARF),
      long: sex === 'f' ? (rnd() < .75 ? .55 : 9) : (rnd() < .45 ? .55 : 9), scarfOn: rnd() < .45 ? 1 : 0
    };
    let body = null, head = null, handR = null; const p0 = {};
    root.traverse(o => {
      if (o.isSkinnedMesh && /Superhero/i.test(o.material.name || '')) body = o;
      if (o.isBone && o.name === 'Head') head = o;
      if (o.isBone && o.name === 'hand_l') handR = o;
    });
    const drop = [];
    root.traverse(o => {
      if (o.isSkinnedMesh) {
        o.material = o.material.clone();
        if (/Eye/i.test(o.material.name || '')) o.material.color.multiplyScalar(.25);
        if (/Hair_1|Brow/i.test(o.material.name || '') && o !== body) drop.push(o);
      }
    });
    drop.forEach(o => o.parent.remove(o));
    if (body) {
      if (rnd() < .55) body.material.map = P.skin[sex][1] || body.material.map;
      clothe(body.material, look);
    }
    if (body) {
      const cg = P.coats[sex][look.long < 1 ? 'long' : 'short'];
      const cm = new THREE.MeshStandardMaterial({ color: look.coat, roughness: .6, metalness: 0 });
      coatShader(cm, look);
      const coat = new THREE.SkinnedMesh(cg, cm);
      coat.bind(body.skeleton, body.bindMatrix);
      coat.frustumCulled = false; coat.receiveShadow = true;
      body.parent.add(coat);
      p0.coat = coat;
    }
    // cheveux
    const hs = sex === 'm' ? ['Hair_SimpleParted', 'Hair_Buzzed', 'Hair_SimpleParted', 'Hair_Beard'] : ['Hair_Long', 'Hair_Buns', 'Hair_Long', 'Hair_BuzzedFemale'];
    const hname = pick(hs);
    if (head && body && P.hair[hname]) {
      const sk = body.skeleton, hi = sk.bones.indexOf(head);
      const Lm = new THREE.Matrix4().multiplyMatrices(sk.boneInverses[hi], body.bindMatrix);
      const add = (nm) => {
        const h = new THREE.Mesh(P.hair[nm].geometry, P.hair[nm].material.clone());
        h.material.color.setHex(pick(HAIRC)).multiplyScalar(2.2);
        h.matrixAutoUpdate = false; h.matrix.copy(Lm); h.frustumCulled = false;
        head.add(h);
      };
      add(hname);
      if (hname === 'Hair_Beard') add('Hair_Buzzed');
    }
    const p = { root, spec: s, umb: null, mixer: new THREE.AnimationMixer(root), s: s.s0 || 0, act: null };
    if (s.umb && handR) {
      const g = new THREE.Group();
      const can = new THREE.Mesh(P.umbGeo, new THREE.MeshStandardMaterial({ color: pick(UMB), roughness: .32, metalness: 0, side: THREE.DoubleSide }));
      const gq = P.grip[sex];
      can.position.y = gq.len; can.frustumCulled = false;
      const sh = new THREE.Mesh(shaftGeo, shaftMat); sh.frustumCulled = false; sh.position.y = -.1; sh.scale.y = (gq.len + .1) / .92;
      g.add(can, sh);
      g.quaternion.copy(gq.q);
      g.position.copy(gq.p);
      handR.add(g);
      p.umb = g;
    }
    const clip = P.clips[s.clip] || P.clips.WalkUmb;
    p.act = p.mixer.clipAction(clip);
    p.act.play();
    p.act.time = rnd() * clip.duration;
    p.mixer.timeScale = s.ts || 1;
    root.position.set(s.x || 0, 0, s.z || 0);
    root.rotation.y = s.ry || 0;
    scene.add(root);
    crowd.push(p);
  }
  return crowd;
}

/* trajectoires : ligne qui boucle loin hors champ, cercle, ou immobile */
const v3 = new THREE.Vector3();
export function stepCrowd(crowd, dt, at, cam, frustum) {
  for (const p of crowd) {
    const s = p.spec;
    let x = s.x, z = s.z, ry = s.ry;
    if (s.kind === 'line') {
      p.s += dt * s.v;
      const u = ((p.s % s.len) + s.len) % s.len - s.len / 2;
      x = s.x + s.dx * u; z = s.z + s.dz * u; ry = Math.atan2(s.dx, s.dz);
    } else if (s.kind === 'circle') {
      p.s += dt * s.v / s.r;
      const a = p.s * s.dir;
      x = s.x + Math.cos(a) * s.r; z = s.z + Math.sin(a) * s.r;
      ry = Math.atan2(-Math.sin(a) * s.dir, Math.cos(a) * s.dir);
    }
    p.root.position.set(x, 0, z);
    p.root.rotation.y = ry;
    const d = Math.hypot(x - cam.position.x, z - cam.position.z);
    v3.set(x, 1, z);
    const vis = d < 260 && frustum.containsPoint(v3) || d < 6;
    p.root.visible = d < 260;
    if (vis && d < 140) p.mixer.update(dt);
  }
}

export function setDry(crowd, P, dry) {
  for (const p of crowd) {
    if (!p.umb) continue;
    p.umb.visible = !dry;
    const clip = P.clips[dry ? p.spec.clipDry : p.spec.clip];
    if (!clip) continue;
    const a = p.mixer.clipAction(clip);
    if (a === p.act) continue;
    a.reset(); a.play(); a.time = p.act.time % clip.duration;
    p.act.crossFadeTo(a, .6, false); p.act = a;
  }
}
