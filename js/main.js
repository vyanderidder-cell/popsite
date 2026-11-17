import * as THREE from '../lib/three.module.min.js';
import { EffectComposer } from '../lib/EffectComposer.js';
import { RenderPass } from '../lib/RenderPass.js';
import { UnrealBloomPass } from '../lib/UnrealBloomPass.js';
import { ShaderPass } from '../lib/ShaderPass.js';
import { OutputPass } from '../lib/OutputPass.js';
import { FXAAShader } from '../lib/FXAAShader.js';
import { generate } from './gen.js';
import { loadKit, buildVillage, lampGeometries, treeGeometries, fountainGeometry, awningGeometry } from './houses.js';
import { loadPeople, makeCrowd, stepCrowd, setDry } from './people.js';
import { loadLib, placeDecor } from './decor.js';
import { buildSigns, buildFlowerBoxes, buildGutters, buildSteps, buildCurbs, contactShadows } from './details.js';
import { U, NL, patchFog, attachShared, weatherize, nightEnvironment, glassMaterial, groundMaterial, skyMaterial, rainMesh, splashMesh, snowMesh, leafMesh, smokeMesh, spriteMesh, beamMesh, radarWall, screenPrecipShader, swayTrees } from './fx.js';

const BASE = new URL('../', import.meta.url).href;
const cv = document.getElementById('city'), ov = document.getElementById('over'), sceneEl = document.getElementById('scene'), ctx = ov.getContext('2d');
const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const fine = window.matchMedia('(pointer: fine)').matches;
let W = 1, H = 1, DPR = 1, ODPR = 1, QUAL = 1, RS = 1, AC = 0, paused = false;
const lerp = (a, b, t) => a + (b - a) * t, clamp = (v, a, b) => Math.min(b, Math.max(a, v)), smooth = t => t * t * (3 - 2 * t);
const MOBILE = window.innerWidth < 820 || window.matchMedia('(pointer: coarse)').matches;

/* ---- profil de qualité : PC costaud / PC léger / mobile ---- */
let TIER = MOBILE ? 'low' : 'high';
(function () {
  if (MOBILE) return;
  try {
    const c = document.createElement('canvas'), gl = c.getContext('webgl2') || c.getContext('webgl');
    const dri = gl && gl.getExtension('WEBGL_debug_renderer_info'), rn = dri ? String(gl.getParameter(dri.UNMASKED_RENDERER_WEBGL)) : '';
    if (/intel|iris|uhd|hd graphics|mali|adreno|powervr|vega [0-9]\b|radeon\(tm\) graphics/i.test(rn)) TIER = 'mid';
    if (/swiftshader|llvmpipe|software|basic render/i.test(rn) && !window.__fullQ) TIER = 'mid';
    const lc = gl && gl.getExtension('WEBGL_lose_context'); if (lc) lc.loseContext();
  } catch (e) { }
  if ((navigator.hardwareConcurrency || 8) <= 4) TIER = 'mid';
})();
const CFG = {
  high: { px: 1.7e6, crowd: .7, shadow: 4096, bloom: true, fps: 60, near: 56, curbs: 120, grass: 420 },
  mid: { px: 1.05e6, crowd: .5, shadow: 2048, bloom: true, fps: 60, near: 44, curbs: 90, grass: 220 },
  low: { px: .5e6, crowd: .28, shadow: 0, bloom: false, fps: 30, near: 30, curbs: 50, grass: 70 }
}[TIER];
const G = generate(CFG.crowd);
const { B, NONE, T, SITES, DX, DZ, PX, PZ } = G;
const CAMP = [[15, 19], [T.cx + DX * 30 + PX * 9, T.cz + DZ * 30 + PZ * 9]];
const LAMPS = G.LAMPS.filter(l => CAMP.every(c => Math.hypot(l[0] - c[0], l[1] - c[1]) > 7));

/* ================= rendu ================= */
let renderer = null, glOK = false, ready = false;
try {
  renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: false, powerPreference: 'high-performance', stencil: false });
  glOK = !!renderer.capabilities.isWebGL2;
} catch (e) { console.error(e); }
if (!glOK) cv.style.display = 'none';

patchFog();
const world = new THREE.Scene();
world.fog = new THREE.FogExp2(0x222a40, .0036);
const camera = new THREE.PerspectiveCamera(50, 1, .4, 3000);
let composer = null, bloom = null, precip = null, fxaa = null;
if (glOK) {
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.shadowMap.enabled = CFG.shadow > 0;
  renderer.shadowMap.type = TIER === 'high' ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
  renderer.shadowMap.autoUpdate = false;
  const rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: 0 });
  composer = new EffectComposer(renderer, rt);
  composer.addPass(new RenderPass(world, camera));
  if (CFG.bloom) { bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), .34, .12, 1.0); composer.addPass(bloom); }
  precip = new ShaderPass(screenPrecipShader());
  composer.addPass(precip);
  composer.addPass(new OutputPass());
  fxaa = new ShaderPass(FXAAShader);
  composer.addPass(fxaa);
}

/* ---- lumières ---- */
const hemi = new THREE.HemisphereLight(0x4a5c94, 0x0c0c10, .5);
world.add(hemi);
const moon = new THREE.DirectionalLight(0x9fb2ff, .62);
moon.position.set(200, 225, 150); moon.target.position.set(0, 0, 0);
moon.castShadow = CFG.shadow > 0;
moon.shadow.mapSize.set(CFG.shadow || 512, CFG.shadow || 512);
Object.assign(moon.shadow.camera, { left: -235, right: 235, top: 235, bottom: -235, near: 20, far: 900 });
moon.shadow.bias = -.0004; moon.shadow.normalBias = .04;
world.add(moon, moon.target);
const PL = [];
for (let i = 0; i < NL; i++) { const p = new THREE.PointLight(0xffa557, 0, 0, 2); p.position.set(0, -50, 0); world.add(p); PL.push(p); }

/* ---- éléments immédiats (avant le chargement des modèles) ---- */
const sky = new THREE.Mesh(new THREE.SphereGeometry(2400, 32, 16), skyMaterial());
sky.frustumCulled = false; sky.renderOrder = -1; world.add(sky);
const NP = MOBILE ? 1800 : TIER === 'mid' ? 3600 : 5000;
const rain = rainMesh(NP), splash = splashMesh(MOBILE ? 300 : 900), snow = snowMesh(MOBILE ? 1200 : 3000), leaves = leafMesh(MOBILE ? 0 : 200);
world.add(rain, splash, snow, leaves);
const MAXS = NONE.length * 2 + SITES.length + 400;
const sprites = spriteMesh(MAXS), beams = beamMesh(NONE.length), rwall = radarWall();
world.add(sprites, beams, rwall);
// poussières en suspension (fixes dans le tampon)
const SPRP = sprites.geometry.attributes.position.array, SPRC = sprites.geometry.attributes.aCol.array, SPRH = sprites.geometry.attributes.aPh.array;
const DUST0 = NONE.length * 2 + SITES.length;
for (let i = 0; i < 400; i++) { const da = Math.random() * 6.2832, dr = Math.sqrt(Math.random()) * 320, k = DUST0 + i; SPRP.set([Math.cos(da) * dr, 6 + Math.random() * 110, Math.sin(da) * dr], k * 3); SPRC.set([.5, .64, .95, .28 + Math.random() * .3], k * 4); SPRH[k] = .05 + Math.random(); }

// collines lointaines
(function () {
  const n = 90, hs = [], P = [];
  for (let k = 0; k <= n; k++) hs.push(40 + 90 * Math.abs(Math.sin(k * .37) + .6 * Math.sin(k * .83 + 1.3) + .4 * Math.sin(k * 1.9)));
  hs[n] = hs[0];
  for (let k = 0; k < n; k++) {
    const a0 = k / n * 6.2832, a1 = (k + 1) / n * 6.2832, c0 = Math.cos(a0), s0 = Math.sin(a0), c1 = Math.cos(a1), s1 = Math.sin(a1);
    P.push(c0 * 1250, 0, s0 * 1250, c1 * 1250, 0, s1 * 1250, c1 * 1650, hs[k + 1], s1 * 1650, c0 * 1250, 0, s0 * 1250, c1 * 1650, hs[k + 1], s1 * 1650, c0 * 1650, hs[k], s0 * 1650);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.computeVertexNormals();
  const m = new THREE.MeshStandardMaterial({ color: 0x0b1018, roughness: 1, side: THREE.DoubleSide }); attachShared(m);
  world.add(new THREE.Mesh(g, m));
})();

/* ---- chargement du village + foule ---- */
const elLoad = document.getElementById('loadv'), elLoadP = document.getElementById('loadp');
let loadMax = 0;
THREE.DefaultLoadingManager.onProgress = (u, l, t) => { const p = Math.min(.97, l / Math.max(t, 1)); if (p > loadMax) { loadMax = p; if (elLoadP) elLoadP.textContent = Math.round(p * 100) + ' %'; if (elLoad) elLoad.style.setProperty('--p', p.toFixed(3)); } };
const loadDone = () => { const po = document.getElementById('poster'); if (po) setTimeout(() => { po.classList.add('gone'); setTimeout(() => po.remove(), 1600); }, 900); if (elLoad) { elLoad.style.setProperty('--p', '1'); if (elLoadP) elLoadP.textContent = '100 %'; setTimeout(() => elLoad.classList.add('done'), 350); } };
if (!glOK && elLoad) elLoad.classList.add('done');
let crowd = [], P = null, WORLD = null, blobs = null;
async function build() {
  const [kit, people, props, nature] = await Promise.all([loadKit(BASE + 'kit/kit.json'), loadPeople(BASE, renderer), loadLib(BASE + 'pk/props.json'), loadLib(BASE + 'pk/nature.json')]);
  const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  world.environment = nightEnvironment(renderer);
  // matériaux du kit
  const mats = {};
  for (const name in kit) for (const p of kit[name]) {
    const m = p.mat; if (mats[m.name]) continue;
    ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap'].forEach(k => { if (m[k]) m[k].anisotropy = aniso; });
    if (m.name === 'MI_WindowGlass') { mats[m.name] = glassMaterial(); continue; }
    m.envMapIntensity = /RoundTiles/.test(m.name) ? .55 : .35;
    // occlusion ambiante peinte dans les textures ORM (coins, joints, sous les rebords)
    if (/Plaster|RockTrim/.test(m.name) && m.roughnessMap && !m.aoMap) { m.aoMap = m.roughnessMap; m.aoMapIntensity = .9; }
    weatherize(m, m.name === 'MI_RoundTiles' ? { wetR: .75, moss: 1 } : /Plaster|Brick|RockTrim/.test(m.name) ? { grime: 1 } : null);
    mats[m.name] = m;
  }
  const V = buildVillage(kit, G, mats, G.rnd, CFG.near);
  world.add(V.group);
  // détails de rue : enseignes, jardinières, gouttières, marches, bordures
  const roofBB = {};
  for (const n in kit) { const r = /^Roof_RoundTiles_(\d+x\d+)$/.exec(n); if (r) { const bb = new THREE.Box3(); kit[n].forEach(p => { p.geo.computeBoundingBox(); bb.union(p.geo.boundingBox); }); roofBB[r[1]] = bb; } }
  const curbStone = new THREE.MeshStandardMaterial({ color: 0x77736c, roughness: .85 }); weatherize(curbStone, { grime: 1, wetR: .5 });
  world.add(buildSigns(G, G.rnd), buildFlowerBoxes(V.extras.sills, weatherize), ...buildGutters(V.extras.eaves, roofBB, weatherize), buildSteps(V.extras.doors, curbStone), buildCurbs(G, CFG.curbs, curbStone));
  // sol
  const ub = kit.Floor_UnevenBrick ? kit.Floor_UnevenBrick[0].mat : mats.MI_UnevenBrick;
  const tex = k => { const t = ub[k].clone(); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1300, 1300); t.anisotropy = aniso; t.needsUpdate = true; return t; };
  const gm = groundMaterial({ color: tex('map'), normal: ub.normalMap ? tex('normalMap') : null, rough: ub.roughnessMap ? tex('roughnessMap') : null });
  const gg = new THREE.PlaneGeometry(1400, 1400, 1, 1); gg.rotateX(-Math.PI / 2);
  gm.envMapIntensity = .7;
  const ground = new THREE.Mesh(gg, gm); ground.receiveShadow = true; world.add(ground);
  // lampadaires + lanternes
  const LG = lampGeometries();
  const metal = new THREE.MeshStandardMaterial({ color: 0x15171a, roughness: .38, metalness: .75 }); weatherize(metal);
  const lampGlass = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffb466, emissiveIntensity: 5, side: THREE.DoubleSide }); attachShared(lampGlass);
  const posts = new THREE.InstancedMesh(LG.postG, metal, LAMPS.length), heads = new THREE.InstancedMesh(LG.glass, lampGlass, LAMPS.length);
  const M = new THREE.Matrix4();
  LAMPS.forEach((l, i) => { M.makeRotationY(i * 1.7).setPosition(l[0], 0, l[1]); posts.setMatrixAt(i, M); heads.setMatrixAt(i, M); });
  posts.castShadow = true; world.add(posts, heads);
  const lant = [];
  V.extras.doors.forEach(d => { if (d.b.tint === undefined) return; lant.push(d); });
  const wl = new THREE.InstancedMesh(LG.wallG, metal, lant.length), wg = new THREE.InstancedMesh(LG.wglass, lampGlass, lant.length);
  const R = new THREE.Matrix4(), Tm = new THREE.Matrix4();
  WORLD = { lanterns: [] };
  lant.forEach((d, i) => {
    M.makeTranslation(d.b.cx, 0, d.b.cz); R.makeRotationY(d.b.ang || 0); M.multiply(R); Tm.makeTranslation(d.x, 2.45, d.z); M.multiply(Tm); R.makeRotationY(d.rot); M.multiply(R); Tm.makeTranslation(.98, 0, .08); M.multiply(Tm);
    wl.setMatrixAt(i, M); wg.setMatrixAt(i, M);
    const v = new THREE.Vector3(0, .1, .34).applyMatrix4(M); WORLD.lanterns.push([v.x, v.y, v.z]);
  });
  world.add(wl, wg);
  // auvents rayés des commerces
  const shops = B.filter(b => b.shop);
  const awG = awningGeometry();
  const awM = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .55, side: THREE.DoubleSide });
  awM.onBeforeCompile = sh => {
    for (const k in U) sh.uniforms[k] = U[k];
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vAw;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvAw=uv;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec2 vAw;')
      .replace('#include <color_fragment>', '#include <color_fragment>\nfloat st=step(.5,fract(vAw.x*9.));diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.8,.76,.68),st);if(vAw.y>1.){float sc=step(.5,fract(vAw.x*18.+.25));diffuseColor.rgb*=mix(1.,.8,sc);}');
  };
  weatherize(awM);
  const aw = new THREE.InstancedMesh(awG, awM, shops.length);
  const AWC = [0x7a1e1e, 0x1e3f6b, 0x2f5a35, 0x6b4a1e, 0x4a1e4a, 0x1e5a5a];
  const SIDE = [[0, -1, Math.PI], [1, 0, Math.PI / 2], [0, 1, 0], [-1, 0, -Math.PI / 2]];
  const c = new THREE.Color();
  shops.forEach((b, i) => {
    const s = SIDE[b.front], len = (b.front % 2 === 0 ? b.W : b.L) - .5;
    M.makeTranslation(b.cx, 0, b.cz); R.makeRotationY(b.ang); M.multiply(R); Tm.makeTranslation(s[0] * (b.W / 2 + .05), 2.98, s[1] * (b.L / 2 + .05)); M.multiply(Tm); R.makeRotationY(s[2]); M.multiply(R); Tm.makeScale(len, 1, 1); M.multiply(Tm);
    aw.setMatrixAt(i, M); aw.setColorAt(i, c.setHex(AWC[i % AWC.length]));
  });
  aw.castShadow = true; aw.receiveShadow = true; world.add(aw);
  // fontaine
  const FG = fountainGeometry();
  const stone = new THREE.MeshStandardMaterial({ color: 0x8d877b, roughness: .85 }); weatherize(stone);
  const water = new THREE.MeshStandardMaterial({ color: 0x03060a, roughness: .04, metalness: .1 }); attachShared(water);
  const fs = new THREE.Mesh(FG.stone, stone), fw = new THREE.Mesh(FG.water, water);
  [fs, fw].forEach(o => { o.position.set(G.FO.cx, 0, G.FO.cz); o.castShadow = o === fs; o.receiveShadow = true; world.add(o); });
  // végétation et mobilier (packs) + silhouettes simples pour les arbres lointains
  const prepCache = new Map();
  const prep = mt => {
    if (prepCache.has(mt)) return prepCache.get(mt);
    const n = mt.name || '';
    mt.envMapIntensity = .3;
    if (/Leaves|Leaf|Grass|Flowers/.test(n)) { mt.color.multiplyScalar(.78); swayTrees(mt); weatherize(mt, { wetR: .7, snow: .6 }); }
    else if (/Bark/.test(n)) weatherize(mt, { wetR: .7 });
    else weatherize(mt, { wetR: .6 });
    prepCache.set(mt, mt); return mt;
  };
  const D = placeDecor(props, nature, G, { near: CFG.near, grass: CFG.grass }, prep);
  world.add(D.group);
  const TG = treeGeometries();
  const leafM = new THREE.MeshStandardMaterial({ color: 0x1b2a1a, roughness: .85 }); swayTrees(leafM); weatherize(leafM, { wetR: .7 });
  const barkM = new THREE.MeshStandardMaterial({ color: 0x241a13, roughness: .9 }); weatherize(barkM);
  const pineM = new THREE.MeshStandardMaterial({ color: 0x101c16, roughness: .9, side: THREE.DoubleSide }); swayTrees(pineM); weatherize(pineM, { wetR: .7 });
  const dec = D.farTrees.filter(t => t[3] !== 1), pin = D.farTrees.filter(t => t[3] === 1);
  const crowns = new THREE.InstancedMesh(TG.crown, leafM, Math.max(1, dec.length)), trunks = new THREE.InstancedMesh(TG.trunk, barkM, Math.max(1, dec.length + pin.length)), pines = new THREE.InstancedMesh(TG.pine, pineM, Math.max(1, pin.length));
  crowns.count = dec.length; pines.count = pin.length; trunks.count = dec.length + pin.length;
  const S = new THREE.Matrix4();
  dec.forEach((t, i) => { M.makeRotationY(t[0] * 1.3); S.makeScale(t[2], t[2] * (.9 + (i % 5) * .05), t[2]); M.multiply(S); M.setPosition(t[0], 0, t[1]); crowns.setMatrixAt(i, M); trunks.setMatrixAt(i, M); crowns.setColorAt(i, c.setHSL(.25 + (i % 7) * .012, .3, .45 + (i % 3) * .08)); });
  pin.forEach((t, i) => { M.makeRotationY(t[1]); S.makeScale(t[2], t[2] * 1.2, t[2]); M.multiply(S); M.setPosition(t[0], 0, t[1]); pines.setMatrixAt(i, M); M.multiply(new THREE.Matrix4().makeScale(.6, .45, .6)); trunks.setMatrixAt(dec.length + i, M); });
  [crowns, trunks, pines].forEach(o => { o.castShadow = true; o.receiveShadow = true; o.computeBoundingSphere(); world.add(o); });
  // fumée des cheminées
  if (V.extras.chims.length) world.add(smokeMesh(V.extras.chims));
  // foule
  P = people;
  crowd = makeCrowd(people, G.crowd, world, G.rnd);
  blobs = contactShadows(crowd.length); world.add(blobs);
  crowd.forEach(p => {
    p.root.traverse(o => { if (o.material) { const ms = Array.isArray(o.material) ? o.material : [o.material]; ms.forEach(m => { if (!m.userData.sh) { attachShared(m); m.userData.sh = 1; } }); } });
  });
  // matériaux restants (kit) : brouillard partagé
  world.traverse(o => { if (o.material && !Array.isArray(o.material) && !o.material.isShaderMaterial && !o.material.userData.sh) { const m = o.material; if (!m.onBeforeCompile || m.onBeforeCompile.toString().indexOf('sh.uniforms') < 0) attachShared(m); m.userData.sh = 1; } });
  renderer.shadowMap.needsUpdate = true;
  try { await renderer.compileAsync(world, camera); } catch (e) { }
  const brk = {}; V.group.children.forEach(m => { const n = m.name.split(':')[0]; brk[n] = (brk[n] || 0) + Math.round((m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count) / 3 * m.count); });
  window.__stats = { tris: V.stats.tris, calls: V.stats.calls, houses: B.length, crowd: crowd.length, top: Object.entries(brk).sort((a, b) => b[1] - a[1]).slice(0, 14) };
  ready = true; readyT = -1; loadDone();
}
let readyT = -1;
function startBuild() { if (startBuild.done) return; startBuild.done = true; build().catch(e => { console.error(e); window.__buildErr = String(e && e.stack || e); if (elLoad) elLoad.classList.add('done'); cv.style.display = 'none'; }); }
// arrivée directe dans l'appli : le village 3D ne se charge qu'au retour sur l'accueil
if (glOK) { if (window.__appOpen) window.addEventListener('popsite:landing', startBuild, { once: true }); else startBuild(); }

/* ================= caméra ================= */
const C = { px: 0, py: 0, pz: 0, fx: 0, fy: 0, fz: 1, rx: 1, rz: 0 };
const o = [0, 0, 0], _v = new THREE.Vector3(), _f = new THREE.Vector3();
function proj(x, y, z) {
  const dx = x - C.px, dy = y - C.py, dz = z - C.pz, vz = dx * C.fx + dy * C.fy + dz * C.fz;
  if (vz < 2) return false;
  _v.set(x, y, z).project(camera);
  o[0] = (_v.x + 1) / 2 * W; o[1] = (1 - _v.y) / 2 * H; o[2] = vz; return true;
}
function aim(k) {
  camera.position.set(k.px, k.py, k.pz);
  camera.up.set(0, 1, 0);
  camera.lookAt(k.tx, k.ty, k.tz);
  camera.rotateZ(-k.roll);
  camera.fov = H > W ? 64 : k.fov;
  camera.aspect = W / H;
  camera.setViewOffset(W, H, -k.sx * W, -k.sy * H, W, H);
  camera.updateProjectionMatrix(); camera.updateMatrixWorld();
  camera.getWorldDirection(_f);
  C.px = k.px; C.py = k.py; C.pz = k.pz; C.fx = _f.x; C.fy = _f.y; C.fz = _f.z;
  const rl = Math.hypot(_f.z, _f.x) || 1; C.rx = -_f.z / rl; C.rz = _f.x / rl;
}
function keyFix(a, rad, hgt, sx, sy, dim) { return { px: Math.cos(a) * rad, py: hgt, pz: Math.sin(a) * rad, tx: 0, ty: 2, tz: 0, sx, sy, dim, roll: 0, fov: 46 }; }
function keys() {
  const m = W < 820;
  const k0 = { px: 15, py: 4.6, pz: 19.5, tx: -3, ty: 8, tz: -25, sx: m ? .06 : .2, sy: m ? -.3 : -.04, dim: 1, roll: 0, fov: 58 };
  const k1 = { px: T.cx + DX * 92 + PX * 30, py: 38, pz: T.cz + DZ * 92 + PZ * 30, tx: T.cx, ty: T.h * .6, tz: T.cz, sx: m ? 0 : -.1, sy: m ? -.14 : .02, dim: 1, roll: 0, fov: 50 };
  const k2 = { px: T.cx + DX * 30 + PX * 9, py: 6.5, pz: T.cz + DZ * 30 + PZ * 9, tx: T.cx, ty: T.h * .7, tz: T.cz, sx: m ? 0 : -.27, sy: m ? .3 : .16, dim: m ? .5 : .88, roll: 0, fov: 50 };
  const k3 = keyFix(2.2, 350, 280, m ? 0 : .2, 0, .34);
  const k4 = keyFix(3.6, 190, 78, m ? 0 : .17, m ? -.2 : -.06, 1);
  return [k0, k1, k2, k2, k3, k3, k4];
}
let Y = [0, 1, 2, 3, 4, 5, 6], popTop = 0, popLen = 1, RAILY = [];
const RAIL = [].slice.call(document.querySelectorAll('.rail a'));
const docTop = el => el.getBoundingClientRect().top + (window.scrollY || 0);
function measure() {
  const vh = window.innerHeight, ap = document.querySelector('.approach'), pp = document.querySelector('.pop'), fin = document.querySelector('.final');
  popTop = docTop(pp); popLen = Math.max(1, pp.offsetHeight - vh);
  const apT = docTop(ap), finT = docTop(fin);
  Y = [0, apT + ap.offsetHeight * .46, popTop + vh * .1, popTop + popLen, popTop + popLen + vh * .9, finT - vh * .8, finT - vh * .05];
  RAILY = RAIL.map(a => { const el = document.getElementById(a.getAttribute('href').slice(1)); return el ? docTop(el) : 0; });
  KX = [];
}
const MIX = { px: 0, py: 0, pz: 0, tx: 0, ty: 0, tz: 0, sx: 0, sy: 0, dim: 1, roll: 0, fov: 50 };
/* trajectoire : interpolation cubique monotone (vitesse continue, jamais de dépassement sous les toits) */
const CK = ['px', 'py', 'pz', 'tx', 'ty', 'tz', 'sx', 'sy', 'dim', 'roll', 'fov'];
function mono(xs, ys, x) {
  const n = xs.length;
  if (x <= xs[0]) return ys[0]; if (x >= xs[n - 1]) return ys[n - 1];
  let i = 0; while (i < n - 2 && x > xs[i + 1]) i++;
  const d = k => (ys[k + 1] - ys[k]) / Math.max(1e-6, xs[k + 1] - xs[k]);
  const m = k => {
    if (k <= 0 || k >= n - 1) return 0;
    const a = d(k - 1), b = d(k); if (a * b <= 0) return 0;
    const h0 = xs[k] - xs[k - 1], h1 = xs[k + 1] - xs[k], w1 = 2 * h1 + h0, w2 = h1 + 2 * h0;
    return (w1 + w2) / (w1 / a + w2 / b);
  };
  const h = xs[i + 1] - xs[i], t = (x - xs[i]) / h, t2 = t * t, t3 = t2 * t;
  return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * m(i) + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * m(i + 1);
}
let KX = [], KV = {}, kW = -1;
function buildKnots() {
  const K = keys(), a = K[0], b = K[1];
  // point de passage au-dessus du village entre la place et le garage
  const cxp = -PX * 40 + DX * 80, cyp = 82, czp = -PZ * 40 + DZ * 80;
  const mid = {}; for (const p of CK) mid[p] = (a[p] + b[p]) / 2;
  mid.px = .25 * a.px + .5 * cxp + .25 * b.px; mid.py = .25 * a.py + .5 * cyp + .25 * b.py; mid.pz = .25 * a.pz + .5 * czp + .25 * b.pz; mid.roll = -.1;
  const pts = [K[0], mid, K[1], K[2], K[3], K[4], K[5], K[6]];
  const xs = [Y[0], (Y[0] + Y[1]) / 2, Y[1], Y[2], Y[3], Y[4], Y[5], Y[6]];
  for (let i = 1; i < xs.length; i++) xs[i] = Math.max(xs[i], xs[i - 1] + 1);
  KX = xs; KV = {}; for (const p of CK) KV[p] = pts.map(o => o[p]);
}
function camAt(y) {
  if (kW !== W || !KX.length) { buildKnots(); kW = W; }
  for (const p of CK) MIX[p] = mono(KX, KV[p], y);
  return MIX;
}

/* ================= défilement : natif (jamais bloqué par le rendu 3D) ================= */
const maxScroll = () => Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
function goTo(y) { window.scrollTo({ top: clamp(y, 0, maxScroll()), behavior: reduce ? 'auto' : 'smooth' }); }
const CURSOR = fine && !reduce;
function sectionY(id) { if (id === 'top') return 0; if (id === 'pop') return popTop + popLen * .82; const el = document.getElementById(id); return el ? docTop(el) : null; }
document.addEventListener('click', e => {
  const a = e.target.closest && e.target.closest('a[href^="#"]'); if (!a) return; const id = a.getAttribute('href').slice(1), yy = sectionY(id); if (yy === null) return;
  e.preventDefault(); goTo(yy); const el = document.getElementById(id); if (el && id !== 'top') { if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1'); el.focus({ preventScroll: true }); }
});

/* ================= radar, filtres, météo ================= */
const RMAX = 235, SWEEP = 4.2, PERIOD = 7;
let radar0 = 0, lastCount = -1, filter = 'all', T0 = -1;
const WX = { rain: 1, snow: 0, tr: 1, ts: 0 }; let flashT = -99, nextFlash = 10, dryState = false;
const elCount = document.getElementById('count'), elNone = document.getElementById('hud-none'), elAlt = document.getElementById('hud-alt'), elWind = document.getElementById('hud-wind'), elDir = document.getElementById('hud-dir');
function rescan(t) { radar0 = t + .2; NONE.forEach(b => { b.on = false; }); }
let pxs = -999, pys = -999, curX = -999, curY = -999;
window.addEventListener('pointermove', e => { pxs = e.clientX; pys = e.clientY; }, { passive: true });
document.addEventListener('mouseout', e => { if (!e.relatedTarget) { pxs = pys = -999; } });
const cur = document.getElementById('cursor'); let curHot = false, curShop = false, curLive = false;
document.addEventListener('pointerover', e => { const el = e.target.closest && e.target.closest('a,button,summary,input,label'); if (!!el !== curHot) { curHot = !!el; cur.classList.toggle('hot', curHot); } });

function tag(b, strong) {
  const s = b.name.toUpperCase(), s2 = b.type.toUpperCase() + ' · AUCUN SITE';
  ctx.font = '600 10px "Martian Mono",ui-monospace,monospace'; const w1 = ctx.measureText(s).width;
  ctx.font = '400 9px "Martian Mono",ui-monospace,monospace'; const w2 = strong ? ctx.measureText(s2).width : 0;
  const w = Math.max(w1, w2) + 16, h = strong ? 34 : 20; let x = b.sx + 14; const y = b.sy - h - 14;
  if (x + w > W - 8) x = b.sx - 14 - w;
  ctx.strokeStyle = 'rgba(255,186,78,.75)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(b.sx, b.sy); ctx.lineTo(x < b.sx ? x + w : x, y + h); ctx.stroke();
  ctx.fillStyle = 'rgba(8,12,22,.88)'; ctx.fillRect(x, y, w, h); ctx.strokeRect(x + .5, y + .5, w - 1, h - 1);
  ctx.fillStyle = '#f1ece2'; ctx.font = '600 10px "Martian Mono",ui-monospace,monospace'; ctx.textBaseline = 'top'; ctx.fillText(s, x + 8, y + 5);
  if (strong) { ctx.fillStyle = '#ffb23e'; ctx.font = '400 9px "Martian Mono",ui-monospace,monospace'; ctx.fillText(s2, x + 8, y + 19); }
}
const brEl = document.querySelector('.br'), roEl = document.querySelector('.readout'); let mHud = false;
let hudOff = false, railOn = -1, lastAlt = -1, hudT = -9, lastOp = '';
const huds = document.querySelectorAll('.readout,.alt');
let sm = 0, sm1 = 0, prevSm = 0, vel = 0, lastT = 0, lastR = 0, ovDirty = true;
const perf = { ema: 1 / 60, bad: 0, good: 0 };
const blocks = [].slice.call(document.querySelectorAll('.blk')), browser = document.getElementById('browser'), urlEl = document.getElementById('url'), URLTXT = 'garage-perrin.fr';
const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];
const back = t => { const c = 1.9; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
const frustum = new THREE.Frustum(), PM = new THREE.Matrix4(), BM = new THREE.Matrix4();
const LSORT = LAMPS.map(l => ({ x: l[0], z: l[1], y: 4.6, d: 0, k: 'street' }));
const FOC = { x: 0, z: 0 };

let asleep = false;
window.addEventListener('popsite:landing', () => { if (asleep) { asleep = false; lastT = performance.now() / 1000; resize(); requestAnimationFrame(frame); } });
function frame(ms) {
  // appli ouverte : plus aucun rendu 3D (zéro chauffe), on se réveille au retour sur l'accueil
  if (window.__appOpen) { asleep = true; return; }
  const t = ms / 1000, raw = t - lastT, dt = Math.min(.05, Math.max(.001, raw)); lastT = t;
  if (T0 < 0) { T0 = t; radar0 = t + (reduce ? 0 : 2.2); }
  if (ready && readyT < 0) { readyT = t; radar0 = t + (reduce ? 0 : 1.6); }
  if (!paused) AC += Math.min(raw, .1);
  const at = AC;

  const y = window.scrollY || 0;
  // double lissage : départs et arrêts en douceur, même avec une molette crantée
  if (reduce) sm1 = sm = y; else { const kk = 1 - Math.exp(-dt * 6.5); sm1 += (y - sm1) * kk; sm += (sm1 - sm) * kk; if (Math.abs(y - sm) < .3 && Math.abs(y - sm1) < .3) sm = sm1 = y; }
  const dv = (sm - prevSm) / dt; prevSm = sm; vel += (dv - vel) * (1 - Math.exp(-dt * 4));

  const wa = .65 + Math.sin(at * .043) * .35, gust = Math.pow(Math.max(0, Math.sin(at * .29 + Math.sin(at * .11) * 2)), 8) * .55, ws = .55 + .2 * Math.sin(at * .17) + gust;
  U.uWind.value.set(Math.cos(wa) * ws, Math.sin(wa) * ws);
  const wk = 1 - Math.exp(-dt * 1.3); WX.rain += (WX.tr - WX.rain) * wk; WX.snow += (WX.ts - WX.snow) * wk;
  U.uRain.value = WX.rain; U.uSnow.value = WX.snow; U.uWet.value = Math.max(WX.rain, U.uWet.value - dt * .02 * (WX.rain < .5 ? 1 : 0));
  if (WX.snow > .3) U.uWet.value = Math.max(0, U.uWet.value - dt * .3);
  if (!reduce && !paused && window.__shot === undefined && WX.rain > .5 && t > nextFlash) { flashT = t; nextFlash = t + 16 + Math.random() * 16; }
  const fe = t - flashT; U.uFlash.value = reduce ? 0 : (fe < .6 ? (Math.exp(-fe * 18) * .9 + (fe > .16 ? Math.exp(-(fe - .16) * 12) * .55 : 0)) * WX.rain : 0);
  hemi.intensity = .5 + U.uFlash.value * 2.5; moon.intensity = .62 + U.uFlash.value * 3;
  world.fog.density = lerp(.0042 + .0009 * WX.rain + .0016 * WX.snow, .0016 + .0004 * WX.rain + .0007 * WX.snow, smooth(clamp((C.py - 15) / 220, 0, 1)));
  const dry = WX.tr < .5;
  if (dry !== dryState && crowd.length) { dryState = dry; setDry(crowd, P, dry); }

  const k = camAt(sm), par = reduce ? 0 : 1;
  if (window.__camK) Object.assign(k, window.__camK);
  const st = ready ? readyT : t;
  const it = reduce ? 1 : clamp((t - st - .1) / 3.4, 0, 1), ie = 1 - Math.pow(1 - it, 3), heroW = 1 - clamp(sm / Math.max(1, Y[1] * .5), 0, 1);
  k.py += (1 - ie) * 360 * heroW; k.px *= 1 + (1 - ie) * .45 * heroW; k.pz *= 1 + (1 - ie) * .45 * heroW;
  k.roll += clamp(vel * -.00002, -.035, .035) * par; k.fov += clamp(Math.abs(vel) * .0012, 0, 3) * par;
  aim(k);
  U.uFocus.value.set(k.tx, k.tz);
  const wsr = U.uWind.value.x * C.rx + U.uWind.value.y * C.rz;
  const op = (k.dim * (reduce ? 1 : clamp((t - st) / 1.2, 0, 1)) * (ready ? 1 : 0)).toFixed(2); if (op !== lastOp) { lastOp = op; sceneEl.style.opacity = op; }
  const off = k.dim < .7; if (off !== hudOff) { hudOff = off; for (let hi = 0; hi < huds.length; hi++) huds[hi].classList.toggle('off', off); }
  const mh = W < 820 && y > H * .35; if (mh !== mHud) { mHud = mh; if (brEl) brEl.classList.toggle('hide', mh); if (roEl) roEl.classList.toggle('hide', mh); }
  const alt = Math.round(k.py); if (alt !== lastAlt) { lastAlt = alt; elAlt.textContent = alt; }
  if (t - hudT > .4) { hudT = t; elWind.textContent = Math.round(ws * 24); const brg = (Math.atan2(-U.uWind.value.x, U.uWind.value.y) * 180 / Math.PI + 360) % 360; elDir.textContent = COMPASS[Math.round(brg / 45) % 8]; }

  const rt = t - radar0, ph = ((rt % PERIOD) + PERIOD) % PERIOD, scanR = reduce ? RMAX : clamp(rt / SWEEP, 0, 1) * RMAX;
  let count = 0;
  U.uTime.value = at; U.uScan.value = scanR;
  if (!reduce && rt >= 0 && ph < SWEEP) { U.uRadar.value = ph / SWEEP * RMAX; U.uRadarA.value = (1 - ph / SWEEP) * clamp((C.py - 10) / 40, .15, 1); } else { U.uRadar.value = -999; U.uRadarA.value = 0; }
  const forceT = sm > Y[1] * .3;
  for (const b of NONE) {
    const want = scanR >= b.r && (filter === 'all' || b.cat === filter || (b === T && forceT));
    if (want && (filter === 'all' || b.cat === filter)) count++;
    if (want && !b.on) { b.on = true; b.t0 = t; } if (!want) b.on = false;
    if (b.on) { const e = reduce ? 9 : t - b.t0; b.lit = e < .18 ? e / .18 * 1.7 : 1 + .7 * Math.exp(-(e - .18) * 5); } else b.lit += (0 - b.lit) * (1 - Math.exp(-dt * 7));
    if (b.lit < .002) b.lit = 0;
  }
  if (count !== lastCount) { lastCount = count; elCount.textContent = count; elNone.textContent = count; }

  // repères + faisceaux
  let si = 0, bi = 0;
  const bx = C.rx, bz = C.rz, BP = beams.geometry.attributes.position.array, BU = beams.geometry.attributes.aUV.array;
  const steepK = clamp((.78 + C.fy) / .3, 0, 1);
  for (const b of NONE) {
    b.sx = -9999; if (b.lit <= 0) continue;
    const pulse = reduce ? 1 : .85 + .15 * Math.sin(t * 2.2 + b.cx), L = Math.min(b.lit, 1.6);
    SPRP.set([b.cx, b.top + .6, b.cz], si * 3); SPRC.set([1.4 * L, 1 * L, .5 * L, 5.5 * pulse], si * 4); SPRH[si] = 0; si++;
    SPRP.set([b.cx, b.top + .6, b.cz], si * 3); SPRC.set([.6 * L, .36 * L, .12 * L, 17 * pulse], si * 4); SPRH[si] = 0; si++;
    const cd = Math.hypot(b.cx - C.px, b.top - C.py, b.cz - C.pz), near = clamp((cd - 30) / 70, 0, 1);
    const bh = 22 + 5 * pulse, bw = 1.2, y0 = b.top + .4, y1 = y0 + bh, a = Math.min(1, b.lit) * .85 * near * steepK;
    BP.set([b.cx - bx * bw, y0, b.cz - bz * bw, b.cx + bx * bw, y0, b.cz + bz * bw, b.cx + bx * bw, y1, b.cz + bz * bw, b.cx - bx * bw, y0, b.cz - bz * bw, b.cx + bx * bw, y1, b.cz + bz * bw, b.cx - bx * bw, y1, b.cz - bz * bw], bi * 18);
    BU.set([-1, 0, a, 1, 0, a, 1, 1, a, -1, 0, a, 1, 1, a, -1, 1, a], bi * 18); bi++;
    if (proj(b.cx, b.top + .6, b.cz)) { b.sx = o[0]; b.sy = o[1]; b.sd = o[2]; }
  }
  for (const b of SITES) { if (scanR >= b.r) { SPRP.set([b.cx, b.top + .5, b.cz], si * 3); SPRC.set([.3, .62, .8, 1.5], si * 4); SPRH[si] = 0; si++; } }
  for (let i = si; i < DUST0; i++) SPRC[i * 4 + 3] = 0;
  sprites.geometry.attributes.position.needsUpdate = true; sprites.geometry.attributes.aCol.needsUpdate = true; sprites.geometry.attributes.aPh.needsUpdate = true;
  beams.geometry.setDrawRange(0, bi * 6); beams.geometry.attributes.position.needsUpdate = true; beams.geometry.attributes.aUV.needsUpdate = true;

  // lampes les plus proches du regard -> vraies lumières + diffusion dans le brouillard
  FOC.x = lerp(C.px, k.tx, .55); FOC.z = lerp(C.pz, k.tz, .55);
  for (const l of LSORT) l.d = Math.hypot(l.x - FOC.x, l.z - FOC.z) + Math.max(0, -((l.x - C.px) * C.fx + (l.z - C.pz) * C.fz)) * 1.5;
  LSORT.sort((a, b) => a.d - b.d);
  const dmax = LSORT[NL - 1].d + 1e-3, hiK = clamp(1 - (C.py - 30) / 200, .35, 1);
  for (let i = 0; i < NL; i++) {
    const l = LSORT[i], f = (1 - smooth(clamp((l.d - dmax * .72) / (dmax * .28), 0, 1)));
    const flick = 1 - .04 * Math.sin(at * 13 + i * 7) * Math.sin(at * 7.3 + i);
    PL[i].position.set(l.x, l.y - .15, l.z); PL[i].intensity = 46 * f * flick;
    U.uLP.value[i].set(l.x, l.y, l.z, 1); U.uLC.value[i].set(1, .62, .3).multiplyScalar(f * flick * hiK * (1 + .8 * WX.rain + 1.4 * WX.snow));
  }

  // météo / particules
  const fpx = .5 * H * DPR / Math.tan(camera.fov * Math.PI / 360);
  rain.material.uniforms.uAmt.value = WX.rain; rain.material.uniforms.uPx.value = fpx; rain.material.uniforms.uVP.value.set(W * DPR, H * DPR);
  rain.visible = WX.rain > .01; splash.visible = WX.rain > .01; snow.visible = WX.snow > .01; leaves.visible = WX.snow < .9 && !MOBILE;
  [splash, snow, leaves, sprites].forEach(m => { m.material.uniforms.uPx.value = fpx; m.material.uniforms.uMaxPt.value = 64; if (m.material.uniforms.uAmt) m.material.uniforms.uAmt.value = m === snow ? WX.snow : m === leaves ? (1 - WX.snow) * .9 : WX.rain; });
  rwall.visible = U.uRadarA.value > 0 && U.uRadar.value > 3;
  if (precip) { precip.uniforms.uDPR.value = DPR; precip.uniforms.uWS.value = wsr; }

  let doRender = true;
  // cadence : 30 i/s sur mobile ou quand la scène est voilée derrière le contenu
  const cap = (CFG.fps <= 30 || k.dim < .6) ? 1 / 31 : 0;
  if (cap && t - lastR < cap) doRender = false;
  if (window.__shot !== undefined) { doRender = window.__shot > 0; if (doRender) window.__shot--; }
  let rdt = dt;
  if (doRender && ready) {
    const fd = t - lastR; lastR = t; rdt = Math.min(.1, fd);
    if (fd < .25 && t - readyT > 3) {
      perf.ema += (fd - perf.ema) * .08;
      const target = cap ? 1 / 27 : 1 / 52;
      if (perf.ema > target * 1.15) perf.bad += fd; else perf.bad = Math.max(0, perf.bad - fd * .5);
      if (perf.ema < target * .92 && !cap) perf.good += fd; else perf.good = 0;
      if (perf.bad > 1.2 && RS > .5) { RS = Math.max(.5, RS * .85); perf.bad = 0; perf.good = 0; resize(true); }
      else if (perf.good > 5 && RS < 1) { RS = Math.min(1, RS * 1.1); perf.good = 0; resize(true); }
    }
  }
  if (glOK && ready && doRender) {
    PM.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse); frustum.setFromProjectionMatrix(PM);
    stepCrowd(crowd, paused ? 0 : rdt, at, camera, frustum);
    if (blobs) { crowd.forEach((p, i) => { const r = p.root; BM.makeScale(1.05, 1, 1.05).setPosition(r.position.x, 0, r.position.z); if (!r.visible) BM.makeScale(0, 0, 0); blobs.setMatrixAt(i, BM); }); blobs.instanceMatrix.needsUpdate = true; }
    composer.render(dt);
  }

  // surcouche 2D
  const qp = clamp((sm - popTop) / popLen, 0, 1), inPop = sm > popTop - H * .3 && sm < popTop + popLen + H * .5;
  let hover = null, drew = false;
  if (ovDirty) { ctx.setTransform(ODPR, 0, 0, ODPR, 0, 0); ctx.clearRect(0, 0, W, H); ovDirty = false; }
  if (inPop && T.sx > -999 && W >= 820) {
    const br = browser.getBoundingClientRect(), ex = br.left, ey = br.top + br.height * .72, la = clamp(qp * 6, 0, 1) * clamp((1 - qp) * 8, 0, 1);
    if (la > 0) { ctx.strokeStyle = 'rgba(255,196,96,' + (.85 * la).toFixed(3) + ')'; ctx.lineWidth = 1.3; ctx.setLineDash([2, 6]); ctx.lineDashOffset = -t * 18; ctx.beginPath(); ctx.moveTo(T.sx, T.sy); ctx.quadraticCurveTo((T.sx + ex) / 2, Math.min(T.sy, ey) - 80, ex, ey); ctx.stroke(); ctx.setLineDash([]); drew = true; }
  }
  if (sm < popTop + H * .2 && ready) {
    let hd = 30;
    for (const s2 of NONE) { if (s2.lit <= 0 || s2.sx < -999) continue; const dd2 = Math.hypot(s2.sx - pxs, s2.sy - pys); if (dd2 < hd) { hd = dd2; hover = s2; } }
    const near = clamp((sm - Y[1] * .5) / (Y[1] * .3), 0, 1);
    if (near > 0) { ctx.globalAlpha = near; for (const s2 of NONE) { if (s2 !== hover && s2.lit > 0 && s2.sx > -999 && s2.sd < 190 && s2.sy > 90) { tag(s2, s2 === T); drew = true; } } ctx.globalAlpha = 1; }
    if (hover) { tag(hover, true); drew = true; }
  }
  if (drew) ovDirty = true;

  if (CURSOR && pxs > -999) { if (curX < -900) { curX = pxs; curY = pys; } const ck = 1 - Math.exp(-dt * 20); curX += (pxs - curX) * ck; curY += (pys - curY) * ck; cur.style.transform = 'translate3d(' + curX.toFixed(1) + 'px,' + curY.toFixed(1) + 'px,0)'; if (!curLive) { curLive = true; cur.classList.add('live'); } }
  else if (curLive) { curLive = false; cur.classList.remove('live'); curX = -999; }
  if (!!hover !== curShop) { curShop = !!hover; cur.classList.toggle('shop', curShop); }

  let ri = 0; for (let n = 0; n < RAILY.length; n++) { if (y + H * .45 >= RAILY[n]) ri = n; }
  if (ri !== railOn) { if (railOn >= 0) { RAIL[railOn].classList.remove('on'); RAIL[railOn].removeAttribute('aria-current'); } railOn = ri; RAIL[ri].classList.add('on'); RAIL[ri].setAttribute('aria-current', 'true'); }

  if (!reduce) {
    const seen = sm > popTop - H * 1.1 && sm < popTop + popLen + H * 1.1;
    if (seen) {
      const enter = clamp((sm - (popTop - H * .45)) / (H * .55), 0, 1);
      browser.style.transform = 'scale(' + (.86 + .14 * back(enter)).toFixed(4) + ') rotate(' + ((1 - enter) * -2.5).toFixed(3) + 'deg)';
      for (let n = 0; n < blocks.length; n++) {
        const stt = .04 + n * .11, e2 = clamp((qp - stt) / .18, 0, 1), bk = e2 <= 0 ? 0 : back(e2);
        blocks[n].style.transform = (n === blocks.length - 1 ? 'rotate(8deg) ' : '') + 'translateY(' + ((1 - bk) * 46).toFixed(2) + 'px) scale(' + (.55 + .45 * bk).toFixed(4) + ')';
        blocks[n].style.opacity = clamp(e2 * 3, 0, 1).toFixed(3);
      }
      urlEl.textContent = URLTXT.slice(0, Math.round(clamp(qp / .14, 0, 1) * URLTXT.length)) || ' ';
    }
  }
  requestAnimationFrame(frame);
}

let lastW = 0, lastH = 0;
function resize(force) {
  const nw = window.innerWidth, nh = window.innerHeight;
  // barre d'adresse mobile : petits changements de hauteur ignorés (pas de réallocation pendant le scroll)
  if (force !== true && nw === lastW && Math.abs(nh - lastH) < 160 && lastW) { measure(); return; }
  lastW = nw; lastH = nh; W = nw; H = nh;
  const dev = Math.min(window.devicePixelRatio || 1, 2), maxD = Math.sqrt(CFG.px / Math.max(1, W * H));
  DPR = clamp(Math.min(dev, maxD) * RS, .45, 2); ODPR = Math.min(window.devicePixelRatio || 1, 2);
  if (force !== true) { ov.width = Math.round(W * ODPR); ov.height = Math.round(H * ODPR); ovDirty = true; }
  if (glOK) {
    renderer.setPixelRatio(DPR); renderer.setSize(W, H, false);
    composer.setPixelRatio(DPR); composer.setSize(W, H);
    if (bloom) bloom.resolution.set(W * DPR * .5, H * DPR * .5);
    if (fxaa) fxaa.material.uniforms.resolution.value.set(1 / (W * DPR), 1 / (H * DPR));
  }
  cv.style.width = W + 'px'; cv.style.height = H + 'px';
  measure();
}
window.addEventListener('resize', () => resize());
window.addEventListener('load', measure);
if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
cv.addEventListener('webglcontextlost', e => { e.preventDefault(); glOK = false; });
resize(); sm = sm1 = prevSm = window.scrollY || 0;
window.__tier = TIER;
requestAnimationFrame(frame);

/* ================= grain, apparitions, textes décodés ================= */
(function () {
  const g = document.createElement('canvas'); g.width = g.height = 180; const gc = g.getContext('2d'), im = gc.createImageData(180, 180);
  for (let k = 0; k < im.data.length; k += 4) { const v = Math.random() * 255 | 0; im.data[k] = im.data[k + 1] = im.data[k + 2] = v; im.data[k + 3] = 255; } gc.putImageData(im, 0, 0);
  try { document.getElementById('grain').style.backgroundImage = 'url(' + g.toDataURL('image/png') + ')'; } catch (err) { }
})();
const GLY = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/#+·';
function scramble(el) {
  if (reduce) return; const txt = el.getAttribute('data-txt') || el.textContent; el.setAttribute('data-txt', txt); const s0 = performance.now(), dur = 520 + txt.length * 14;
  (function step(now) { const p = clamp((now - s0) / dur, 0, 1), nn = Math.floor(p * txt.length); let out = txt.slice(0, nn); for (let k = nn; k < txt.length; k++) { const ch = txt.charAt(k); out += ch === ' ' ? ' ' : GLY.charAt((Math.random() * GLY.length) | 0); } el.textContent = out; if (p < 1) requestAnimationFrame(step); else el.textContent = txt; })(s0);
}
const secs = [].slice.call(document.querySelectorAll('main > section'));
function enter(s) { if (s.classList.contains('in')) return; s.classList.add('in'); [].forEach.call(s.querySelectorAll('.eyebrow'), scramble); }
if ('IntersectionObserver' in window) { const io = new IntersectionObserver(es => { es.forEach(en => { if (en.isIntersecting) { enter(en.target); io.unobserve(en.target); } }); }, { rootMargin: '0px 0px -6% 0px' }); secs.forEach(s => io.observe(s)); }
else secs.forEach(enter);

/* ================= contrôles ================= */
const now = () => performance.now() / 1000;
document.getElementById('rescan').addEventListener('click', () => rescan(now()));
const chips = [].slice.call(document.querySelectorAll('#chips .chip'));
chips.forEach(c => {
  const cat = c.getAttribute('data-cat'), nb = cat === 'all' ? NONE.length : NONE.filter(b => b.cat === cat).length; c.querySelector('b').textContent = nb;
  c.addEventListener('click', () => { filter = cat; chips.forEach(x => x.setAttribute('aria-pressed', x === c ? 'true' : 'false')); });
});
const sbtn = [].slice.call(document.querySelectorAll('#styles .chip'));
sbtn.forEach(c => c.addEventListener('click', () => { browser.classList.remove('vitrine', 'nuit'); const s = c.getAttribute('data-style'); if (s) browser.classList.add(s); sbtn.forEach(x => x.setAttribute('aria-pressed', x === c ? 'true' : 'false')); }));
const pb = document.getElementById('pause'); pb.addEventListener('click', () => { paused = !paused; pb.setAttribute('aria-pressed', paused ? 'true' : 'false'); pb.textContent = paused ? 'Lecture' : 'Pause'; });
const wxb = [].slice.call(document.querySelectorAll('.wx button[data-wx]'));
wxb.forEach(bt => bt.addEventListener('click', () => { const w = bt.getAttribute('data-wx'); WX.tr = w === 'pluie' ? 1 : 0; WX.ts = w === 'neige' ? 1 : 0; wxb.forEach(x => x.setAttribute('aria-pressed', x === bt ? 'true' : 'false')); }));
const tabs = [].slice.call(document.querySelectorAll('.tab'));
function pick(tb, focus) { tabs.forEach(x => { const on = x === tb; x.setAttribute('aria-selected', on ? 'true' : 'false'); x.tabIndex = on ? 0 : -1; document.getElementById(x.getAttribute('aria-controls')).hidden = !on; }); if (focus) tb.focus(); }
tabs.forEach((tb, n) => { tb.addEventListener('click', () => pick(tb)); tb.addEventListener('keydown', e => { if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); pick(tabs[(n + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length], true); } }); });
[].slice.call(document.querySelectorAll('button.mini')).forEach(b => b.addEventListener('click', () => goTo(sectionY('pop'))));
document.getElementById('scan').addEventListener('submit', e => {
  e.preventDefault(); const v = document.getElementById('ville').value.trim();
  if (!v) { document.getElementById('scanmsg').textContent = 'Écris une ville ou un code postal pour lancer le radar.'; return; }
  document.getElementById('scanmsg').textContent = '';
  if (window.PopApp) window.PopApp.scan(v); else rescan(now());
});
const heroScan = document.getElementById('scan-hero');
if (heroScan) heroScan.addEventListener('submit', e => {
  e.preventDefault(); const v = document.getElementById('ville-hero').value.trim();
  if (window.PopApp) { if (v) window.PopApp.scan(v); else location.hash = 'radar'; }
});
document.getElementById('copy').addEventListener('click', function () {
  const btn = this, txt = document.getElementById('prompt-text').textContent;
  try { navigator.clipboard.writeText(txt).then(() => { btn.textContent = 'Copié'; }, () => { btn.textContent = 'Sélectionne le texte'; }); } catch (err) { btn.textContent = 'Sélectionne le texte'; }
});
window.__dbg = { G, U, camera, world, sky, get bloom() { return bloom; }, get precip() { return precip; }, rain, splash, renderer, crowd: () => crowd, setWX: (r, s) => { WX.tr = WX.rain = r; WX.ts = WX.snow = s; } };
