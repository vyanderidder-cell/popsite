/* Devanture — accueil en 3D temps réel.
   Un village de verre la nuit. Le radar balaie, les commerces sans site s'allument,
   la caméra plonge sur une devanture et le site du commerce en sort, tranche par tranche. */
import * as THREE from 'three';
import { RoomEnvironment } from '../vendor/three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from '../vendor/three/addons/geometries/RoundedBoxGeometry.js';
import { EffectComposer } from '../vendor/three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from '../vendor/three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from '../vendor/three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from '../vendor/three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from '../vendor/three/addons/postprocessing/ShaderPass.js';
import { buildWorld, groundTexture, glassMaterials, riseUniforms, withRise, radarMaterial, beaconMaterial, poolMaterial, snow, rng, AMBER } from './world.js';
import { drawMock, drawSign, MW, MH, SLICES } from './mocktex.js';
import { initPage } from './page.js';

const Q = new URLSearchParams(location.search);
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const fine = matchMedia('(pointer: fine)').matches;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = t => t * t * (3 - 2 * t);
const outBack = t => { const c = 1.7; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
const outCubic = t => 1 - Math.pow(1 - t, 3);

const page = initPage();
const canvas = document.getElementById('gl');
const loader = { el: document.getElementById('loader'), pct: document.getElementById('pct'), v: 0 };
function progress(v) { loader.v = Math.max(loader.v, v); if (loader.pct) loader.pct.textContent = Math.round(loader.v * 100); document.documentElement.style.setProperty('--load', loader.v); }

function noGL() { document.body.classList.add('no-gl'); document.body.classList.remove('is-loading'); page.reveal(); page.setCount(22, 31, true); }

let gl2 = null;
try { gl2 = canvas.getContext('webgl2', { antialias: false, powerPreference: 'high-performance', stencil: false }); } catch (e) { }
if (!gl2) noGL(); else start().catch(e => { console.error(e); noGL(); });

async function start() {
  progress(0.05);
  page.setV3(THREE.Vector3);
  const small = Math.min(innerWidth, innerHeight) < 700;
  const lite = Q.get('q') === 'lite';
  let DPR = Math.min(devicePixelRatio || 1, small ? 1.5 : 1.75);
  if (Q.get('dpr')) DPR = +Q.get('dpr');
  const DPR0 = DPR;

  const renderer = new THREE.WebGLRenderer({ canvas, context: gl2, antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(DPR);
  renderer.setSize(innerWidth, innerHeight, false);
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  // polices prêtes avant de dessiner les textures
  try { await Promise.race([Promise.all([document.fonts.load('800 80px "Big Shoulders"'), document.fonts.load('500 20px "Instrument Sans"'), document.fonts.load('650 20px "Instrument Sans"')]), new Promise(r => setTimeout(r, 2500))]); } catch (e) { }
  progress(0.2);

  const scene = new THREE.Scene();
  const NIGHT = new THREE.Color(0x070d1a);
  scene.background = NIGHT;
  scene.fog = new THREE.FogExp2(0x0a1426, Q.get('fog') ? +Q.get('fog') : 0.0042);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.55;

  // ciel
  const sky = new THREE.Mesh(new THREE.SphereGeometry(420, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'varying vec3 vP; void main(){ float h = normalize(vP).y; vec3 top = vec3(0.012,0.022,0.05); vec3 hor = vec3(0.05,0.085,0.16); gl_FragColor = vec4(mix(hor, top, smoothstep(-0.05, 0.45, h)), 1.0); }'
  }));
  scene.add(sky);

  scene.add(new THREE.HemisphereLight(0x6a86c0, 0x04060c, 0.6));
  const moon = new THREE.DirectionalLight(0xbfd0ff, 1.55); moon.position.set(-62, 60, 50); scene.add(moon, moon.target);
  const shadows = !small && !lite && !Q.has('noshadow');
  if (shadows) {
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
    moon.castShadow = true; moon.shadow.mapSize.set(2048, 2048);
    const sc = moon.shadow.camera; sc.left = -78; sc.right = 78; sc.top = 78; sc.bottom = -78; sc.near = 10; sc.far = 260;
    moon.shadow.bias = -0.0004; moon.shadow.normalBias = 0.04; moon.shadow.radius = 3;
  }
  const warm = new THREE.PointLight(0xffa24a, 0, 16, 1.8); scene.add(warm);

  const W = buildWorld(7, { lite: lite || small });
  progress(0.4);
  window.__dvShops = W.shops.length;
  if (Q.has('nohud')) document.documentElement.classList.add('nohud');
  const U = riseUniforms();
  const glass = glassMaterials(lite);
  withRise(glass.wall, U, 'wall', new THREE.Color(0.34, 0.6, 1.0).multiplyScalar(0.8)); withRise(glass.roof, U, 'roof', new THREE.Color(0.34, 0.6, 1.0).multiplyScalar(0.6));
  const mWalls = new THREE.Mesh(W.geo.walls, glass.wall), mRoofs = new THREE.Mesh(W.geo.roofs, glass.roof);
  const mCores = new THREE.Mesh(W.geo.cores, withRise(new THREE.MeshStandardMaterial({ color: 0x172a4f, roughness: 0.6, metalness: 0.08 }), U, 'cores'));
  const mWins = new THREE.Mesh(W.geo.wins, withRise(new THREE.MeshBasicMaterial({ vertexColors: true }), U, 'wins'));
  const mLamps = new THREE.Mesh(W.geo.lamps, withRise(new THREE.MeshBasicMaterial({ vertexColors: true }), U, 'lamps'));
  const mPoles = new THREE.Mesh(W.geo.poles, withRise(new THREE.MeshStandardMaterial({ color: 0x22324f, roughness: 0.5, metalness: 0.5 }), U, 'poles'));
  scene.add(mCores, mWins, mLamps, mPoles, mWalls, mRoofs);
  mCores.castShadow = mCores.receiveShadow = true; mPoles.castShadow = true;
  const riseDepth = key => withRise(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking }), U, 'depth-' + key);
  mCores.customDepthMaterial = riseDepth('cores'); mPoles.customDepthMaterial = riseDepth('poles');
  if (W.geo.trees) {
    const tm = withRise(new THREE.MeshStandardMaterial({ color: 0x1d3a5c, roughness: 0.42, metalness: 0.15, flatShading: true }), U, 'trees');
    const mTrees = new THREE.Mesh(W.geo.trees, tm); mTrees.castShadow = true; mTrees.customDepthMaterial = riseDepth('trees'); scene.add(mTrees);
    scene.add(new THREE.Mesh(W.geo.trunks, withRise(new THREE.MeshStandardMaterial({ color: 0x0e1a2c, roughness: 0.9 }), U, 'trunks')));
  }
  // sol
  const gt = groundTexture(W, small ? 1024 : 2048);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(gt.ext * 2, gt.ext * 2), new THREE.MeshStandardMaterial({ map: gt.tex, roughness: 0.82, metalness: 0.1 }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
  const far = new THREE.Mesh(new THREE.CircleGeometry(420, 48), new THREE.MeshStandardMaterial({ color: 0x0a1324, roughness: 1 }));
  far.rotation.x = -Math.PI / 2; far.position.y = -0.02; scene.add(far);

  // radar
  const radarM = radarMaterial();
  const radar = new THREE.Mesh(new THREE.CircleGeometry(46, 160), radarM);
  radar.rotation.x = -Math.PI / 2; radar.position.y = 0.06; radar.renderOrder = 2; scene.add(radar);

  // commerces sans site : intérieur, halo, colonne
  const T = W.targetSlots, NT = T.length;
  const vitrineMat = new THREE.ShaderMaterial({
    vertexShader: `varying vec2 vUv; varying vec3 vC; void main(){ vUv = uv; vC = instanceColor; gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position,1.0); }`,
    fragmentShader: `varying vec2 vUv; varying vec3 vC; void main(){
      float g = 0.62 + 0.55 * smoothstep(0.0, 1.0, vUv.y);
      float bars = 1.0 - 0.75 * step(0.955, fract(vUv.x * 4.0 + 0.0225));
      float sill = 1.0 - 0.8 * step(vUv.y, 0.07);
      float shelf = 1.0 - 0.35 * smoothstep(0.012, 0.0, abs(vUv.y - 0.42));
      gl_FragColor = vec4(vC * g * bars * sill * shelf, 1.0); }`
  });
  const inner = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), vitrineMat, Math.max(1, NT));
  const M4 = new THREE.Matrix4(), Qt = new THREE.Quaternion(), UP = new THREE.Vector3(0, 1, 0);
  const SC = new THREE.Matrix4();
  T.forEach((s, i) => { M4.copy(s.m).multiply(SC.makeScale(s.w, s.h, s.d)); inner.setMatrixAt(i, M4); inner.setColorAt(i, new THREE.Color(0, 0, 0)); });
  scene.add(inner);
  const lvl = new Float32Array(NT), lvlPool = new Float32Array(NT), phase = new Float32Array(NT);
  const beacons = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.045, 0.045, 1, 6, 1, true).translate(0, 0.5, 0), beaconMaterial(), NT);
  const pools = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), poolMaterial(), NT);
  beacons.geometry.setAttribute('aLevel', new THREE.InstancedBufferAttribute(lvl, 1));
  pools.geometry.setAttribute('aLevel', new THREE.InstancedBufferAttribute(lvlPool, 1));
  pools.geometry.setAttribute('aPhase', new THREE.InstancedBufferAttribute(phase, 1));
  T.forEach((s, i) => {
    const b = s.b, fx = Math.sin(b.rot), fz = Math.cos(b.rot), ox = b.x + fx * (b.d / 2 + 1.6), oz = b.z + fz * (b.d / 2 + 1.6);
    M4.compose(new THREE.Vector3(b.x, b.h + b.d * 0.42, b.z), Qt.identity(), new THREE.Vector3(1, b.hero ? 7 : 4.2 + (i % 3) * 0.8, 1)); beacons.setMatrixAt(i, M4);
    M4.compose(new THREE.Vector3(ox, 0.08, oz), Qt.identity(), new THREE.Vector3(b.hero ? 9 : 7, 1, b.hero ? 9 : 7)); pools.setMatrixAt(i, M4);
    phase[i] = (i * 0.37) % 1; s.ang = Math.atan2(b.z, b.x); s.found = -1;
  });
  const pins = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.34, 0), new THREE.MeshBasicMaterial({ color: 0xffffff }), Math.max(1, NT));
  T.forEach((s, i) => { const b = s.b; s.pinY = b.h + b.d * 0.42 + (b.hero ? 7 : 4.2 + (i % 3) * 0.8); pins.setColorAt(i, new THREE.Color(0, 0, 0)); });
  pins.frustumCulled = false; scene.add(pins);
  beacons.frustumCulled = pools.frustumCulled = false; beacons.renderOrder = 3; pools.renderOrder = 2;
  scene.add(beacons, pools);

  // le commerce vedette
  const H = W.hero, nH = new THREE.Vector3(Math.sin(H.rot), 0, Math.cos(H.rot)), tH = new THREE.Vector3(Math.cos(H.rot), 0, -Math.sin(H.rot));
  const face = new THREE.Vector3(H.x, 0, H.z).addScaledVector(nH, H.d / 2);
  const signCv = document.createElement('canvas'); signCv.width = 1024; signCv.height = 168; drawSign(signCv, H.name);
  const signTex = new THREE.CanvasTexture(signCv); signTex.colorSpace = THREE.SRGBColorSpace; signTex.anisotropy = 8;
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(H.w * 0.86, H.w * 0.86 * 168 / 1024), new THREE.MeshBasicMaterial({ map: signTex, transparent: true, color: new THREE.Color(2.2, 2.2, 2.2) }));
  sign.position.copy(face).addScaledVector(nH, 0.2).add(new THREE.Vector3(0, 2.95, 0)); sign.rotation.y = H.rot; sign.visible = false; scene.add(sign);
  warm.position.copy(face).addScaledVector(nH, 2.5).add(new THREE.Vector3(0, 2.2, 0));

  // la maquette qui sort de la vitrine
  const mockCv = document.createElement('canvas'); mockCv.width = MW; mockCv.height = MH;
  drawMock(mockCv, 'atelier');
  const mockTex = new THREE.CanvasTexture(mockCv); mockTex.colorSpace = THREE.SRGBColorSpace; mockTex.anisotropy = 8; mockTex.generateMipmaps = true;
  const BW = 6.6, BH = BW * MH / MW;
  const mock = new THREE.Group(); scene.add(mock);
  const slab = new THREE.Mesh(new RoundedBoxGeometry(BW + 0.44, BH + 0.44, 0.16, 3, 0.08), new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.18, transmission: 1, thickness: 0.5, ior: 1.45, specularIntensity: 0.8, envMapIntensity: 1.6 }));
  slab.position.z = -0.14; mock.add(slab);
  const slices = SLICES.map(([y0, y1], i) => {
    const h = (y1 - y0) / MH * BH, g = new THREE.PlaneGeometry(BW, h);
    const uv = g.attributes.uv; for (let k = 0; k < uv.count; k++) uv.setY(k, uv.getY(k) > 0.5 ? 1 - y0 / MH : 1 - y1 / MH);
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: mockTex, transparent: true, color: new THREE.Color(1.06, 1.06, 1.06), side: THREE.DoubleSide }));
    m.userData.home = new THREE.Vector3(0, BH / 2 - (y0 + y1) / 2 / MH * BH, 0);
    m.userData.spin = new THREE.Euler((Math.random() - 0.5) * 1.6, (Math.random() - 0.5) * 2.4, (Math.random() - 0.5) * 1.2);
    m.renderOrder = 5; mock.add(m); return m;
  });
  const mockHome = face.clone().addScaledVector(nH, 4.8).add(new THREE.Vector3(0, 6.6, 0));
  const door = face.clone().addScaledVector(nH, 0.4).add(new THREE.Vector3(0, 1.3, 0));
  const camPop = face.clone().addScaledVector(nH, 19.5).addScaledVector(tH, -1.6).add(new THREE.Vector3(0, 8.6, 0));
  mock.position.copy(mockHome); mock.lookAt(camPop); const mockQ = mock.quaternion.clone();
  mock.visible = false;

  const flakes = snow(small ? 500 : 1100, rng(11)); scene.add(flakes);

  /* ---------- caméra et rendu ---------- */
  const camera = new THREE.PerspectiveCamera(30, innerWidth / innerHeight, 0.5, 900);
  const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: small ? 2 : 4 });
  const composer = new EffectComposer(renderer, rt);
  composer.addPass(new RenderPass(scene, camera));
  // garde-fou HDR : un reflet extrême (Inf/NaN) ne doit jamais noircir l'écran via le bloom
  const safe = new ShaderPass({
    uniforms: { tDiffuse: { value: null } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform sampler2D tDiffuse; varying vec2 vUv;
      float ok(float v){ return (v < 40.0) ? max(v, 0.0) : ((v >= 40.0) ? 40.0 : 0.0); }
      void main(){ vec4 c = texture2D(tDiffuse, vUv); gl_FragColor = vec4(ok(c.r), ok(c.g), ok(c.b), 1.0); }`
  });
  composer.addPass(safe);
  const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.75, 0.5, 1.0);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  const finish = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uVig: { value: 0.55 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform sampler2D tDiffuse; uniform float uTime, uVig; varying vec2 vUv;
      float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
      void main(){ vec4 c = texture2D(tDiffuse, vUv); vec2 q = vUv - 0.5; float v = 1.0 - dot(q, q) * uVig * 1.6;
        float n = (h(vUv * 1024.0 + fract(uTime) * 71.0) - 0.5) * 0.028; gl_FragColor = vec4(c.rgb * v + n, 1.0); }`
  });
  composer.addPass(finish);

  let VW = 1, VH = 1, portrait = false;
  function resize() {
    VW = innerWidth; VH = innerHeight; portrait = VH > VW * 1.05;
    renderer.setPixelRatio(DPR); renderer.setSize(VW, VH, false);
    composer.setPixelRatio(DPR); composer.setSize(VW, VH);
    camera.aspect = VW / VH; camera.fov = portrait ? 44 : VW < 1100 ? 34 : 30; camera.updateProjectionMatrix();
    flakes.material.uniforms.uPx.value = DPR * (portrait ? 1.2 : 1);
    page.measure();
  }
  resize();
  addEventListener('resize', resize);

  /* ---------- plans de caméra liés au défilement ---------- */
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  function shots() {
    const p = portrait;
    return {
      intro: { pos: V(130, 160, 190), tgt: V(0, 0, 0), off: p ? [0, -0.1] : [0.16, 0] },
      hero: { pos: p ? V(58, 84, 98) : V(66, 52, 94), tgt: p ? V(-3, 0, -5) : V(-4, 0, -4), off: p ? [0, -0.13] : [0.17, 0.02] },
      spot: { pos: face.clone().addScaledVector(nH, p ? 19 : 14).addScaledVector(tH, p ? 3 : 7.5).add(V(0, p ? 8 : 5.6, 0)), tgt: face.clone().add(V(0, p ? 3.4 : 2.9, 0)), off: p ? [0, -0.16] : [-0.17, 0] },
      pop: { pos: p ? face.clone().addScaledVector(nH, 24).addScaledVector(tH, -1.2).add(V(0, 9.2, 0)) : camPop.clone(), tgt: mockHome.clone(), off: p ? [0, 0.17] : [0.19, 0] },
      over: { pos: V(96, 70, 52), tgt: V(0, 2, -2), off: [p ? 0 : 0.22, 0] },
      over2: { pos: V(-24, 78, 104), tgt: V(0, 1, 0), off: [p ? 0 : 0.22, 0] },
      final: { pos: p ? V(10, 170, 130) : V(8, 128, 104), tgt: V(0, 0, -6), off: p ? [0, -0.14] : [0.12, 0.04] }
    };
  }
  let SH = shots();
  addEventListener('resize', () => { SH = shots(); });
  function keys() {
    const k = page.keys(); // positions de défilement mesurées dans la page
    return [[0, 'hero'], [k.spot, 'spot'], [k.popIn, 'pop'], [k.popOut, 'pop'], [k.over, 'over'], [k.over2, 'over2'], [k.final, 'final']];
  }
  const cur = { pos: SH.intro.pos.clone(), tgt: SH.intro.tgt.clone(), off: SH.intro.off.slice() };
  const want = { pos: new THREE.Vector3(), tgt: new THREE.Vector3(), off: [0, 0] };
  function shotAt(y) {
    const K = keys();
    let i = 0; while (i < K.length - 1 && y > K[i + 1][0]) i++;
    if (i >= K.length - 1) { const s = SH[K[K.length - 1][1]]; want.pos.copy(s.pos); want.tgt.copy(s.tgt); want.off = s.off.slice(); return; }
    const [y0, a] = K[i], [y1, b] = K[i + 1], t = ease(clamp((y - y0) / Math.max(1, y1 - y0), 0, 1));
    const A = SH[a], B = SH[b];
    want.pos.lerpVectors(A.pos, B.pos, t); want.tgt.lerpVectors(A.tgt, B.tgt, t);
    // arc : on s'élève un peu entre deux plans éloignés
    const lift = Math.sin(t * Math.PI) * Math.min(14, A.pos.distanceTo(B.pos) * 0.18); want.pos.y += lift;
    want.off = [lerp(A.off[0], B.off[0], t), lerp(A.off[1], B.off[1], t)];
  }

  /* ---------- départ ---------- */
  progress(0.6);
  try { await renderer.compileAsync(scene, camera); } catch (e) { }
  progress(0.85);

  let intro0 = -1, introDone = reduce || Q.has('still'), sweep = -Math.PI * 0.75, sweepStart = sweep, nFound = 0;
  if (introDone) { U.uIntro.value = 10; T.forEach((s, i) => { s.found = 0; }); nFound = NT; page.setCount(NT, W.shops.length, true); }
  let px = 0, py = 0, pxs = 0, pys = 0;
  if (fine && !reduce) addEventListener('pointermove', e => { px = e.clientX / VW - 0.5; py = e.clientY / VH - 0.5; }, { passive: true });

  let style = 'atelier';
  page.onStyle(s => { style = s; drawMock(mockCv, s); mockTex.needsUpdate = true; });

  // qualité adaptative
  let frames = 0, acc = 0, lastT = performance.now(), lastSeen = performance.now(), slowStreak = 0, running = true;
  const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3(), tmpC = new THREE.Color();
  const snap = Q.has('still');

  function frame(now) {
    if (!running) return;
    const dt = Math.min(0.05, Math.max(0.001, (now - lastT) / 1000)); lastT = now;
    const t = now / 1000;
    if (intro0 < 0) intro0 = t;
    const it = t - intro0;
    if (!introDone) { U.uIntro.value = it * 1.25; if (it > 4.2) introDone = true; }

    // défilement
    const y = scrollY;
    shotAt(y);
    const k = 1 - Math.exp(-dt * (introDone ? 3.2 : 1.6));
    cur.pos.lerp(want.pos, k); cur.tgt.lerp(want.tgt, k);
    cur.off[0] = lerp(cur.off[0], want.off[0], k); cur.off[1] = lerp(cur.off[1], want.off[1], k);
    if (snap) { cur.pos.copy(want.pos); cur.tgt.copy(want.tgt); cur.off = want.off.slice(); }
    pxs = lerp(pxs, px, 1 - Math.exp(-dt * 3)); pys = lerp(pys, py, 1 - Math.exp(-dt * 3));
    camera.position.copy(cur.pos);
    if (!reduce) { camera.position.x += pxs * 2.4 + Math.sin(t * 0.17) * 0.6; camera.position.y += -pys * 1.6 + Math.sin(t * 0.23) * 0.3; }
    if (Q.get('cam')) { const c = Q.get('cam').split(',').map(Number); camera.position.set(c[0], c[1], c[2]); cur.tgt.set(c[3], c[4], c[5]); cur.off = [0, 0]; }
    camera.lookAt(cur.tgt);
    camera.setViewOffset(VW, VH, -cur.off[0] * VW, -cur.off[1] * VH, VW, VH);

    // radar et découvertes
    const kp = page.keys();
    const relight = clamp((y - (kp.final - VH * 1.2)) / VH, 0, 1);
    const radarOn = clamp((it - 1.2) / 1.0, 0, 1) * lerp(1 - clamp((y - kp.spot * 0.6) / (kp.spot * 0.5 + 1), 0, 0.85), 1, relight);
    radarM.uniforms.uAlpha.value = reduce ? 0.6 : radarOn;
    if (!reduce && it > 1.4) sweep += dt * (nFound < NT ? 1.25 : 0.85);
    radarM.uniforms.uSweep.value = sweep;
    for (let i = 0; i < NT; i++) {
      const s = T[i];
      if (s.found < 0 && it > 1.4) { let d = s.ang - sweepStart; d = ((d % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2); if (sweep - sweepStart >= d) { s.found = t; nFound++; page.found(nFound, s); } }
      const age = s.found < 0 ? -1 : (s.found === 0 ? 9 : t - s.found);
      const on = age < 0 ? 0 : outCubic(clamp(age / 0.8, 0, 1));
      const flash = age < 0 ? 0 : Math.exp(-age * 2.4) * 2.2;
      const focus = s.b.hero ? 1 : lerp(1 - clamp((y - kp.spot * 0.5) / (kp.spot + 1), 0, 0.55), 1, relight);
      lvl[i] = on * (0.75 + flash * 0.5) * focus * (s.b.hero ? 1.25 : 1);
      lvlPool[i] = on * (0.9 + flash) * focus;
      const rise = clamp((U.uIntro.value - s.delay) / 1.15, 0, 1);
      tmpC.setRGB(0.045, 0.07, 0.12).multiplyScalar(rise).lerp(tmpC.clone().copy(AMBER).multiplyScalar(1.55 + flash * 1.4), on);
      inner.setColorAt(i, tmpC);
      const ps = on * (s.b.hero ? 1.25 : 1) * focus;
      M4.compose(tmp.set(s.b.x, s.pinY + Math.sin(t * 1.6 + i) * 0.25, s.b.z), Qt.setFromAxisAngle(UP, t * 0.9 + i), tmp2.setScalar(Math.max(0.001, ps * (1 + flash * 0.4))));
      pins.setMatrixAt(i, M4); pins.setColorAt(i, tmpC.copy(AMBER).multiplyScalar(2.2 + flash * 2));
    }
    inner.instanceColor.needsUpdate = true; pins.instanceMatrix.needsUpdate = true; pins.instanceColor.needsUpdate = true;
    beacons.geometry.attributes.aLevel.needsUpdate = true; pools.geometry.attributes.aLevel.needsUpdate = true;
    beacons.material.uniforms.uTime.value = t; pools.material.uniforms.uTime.value = t;
    flakes.material.uniforms.uTime.value = reduce ? 0 : t;
    flakes.material.uniforms.uAlpha.value = clamp(it / 2, 0, 1);

    // devanture vedette + maquette
    const sp = clamp((y - kp.spot * 0.35) / (kp.spot * 0.65 + 1), 0, 1);
    sign.visible = sp > 0.01 || y > kp.spot * 0.3;
    sign.material.color.setScalar(0.4 + 1.8 * sp);
    warm.intensity = 2.2 * sp;
    const pp = clamp((y - kp.popStart) / Math.max(1, kp.popEnd - kp.popStart), 0, 1);
    const showMock = y > kp.popStart - VH * 0.6;
    mock.visible = showMock;
    if (showMock) {
      const fl = reduce ? 0 : Math.sin(t * 0.8) * 0.08;
      mock.position.copy(mockHome).y += fl;
      mock.quaternion.copy(mockQ);
      slab.scale.setScalar(Math.max(0.001, outBack(clamp(pp / 0.12, 0, 1))));
      slices.forEach((m, i) => {
        const st = 0.06 + i * 0.1, e = clamp((pp - st) / 0.22, 0, 1), b = outBack(e), lin = outCubic(e);
        tmp.copy(door); mock.worldToLocal(tmp);
        m.position.lerpVectors(tmp, m.userData.home, lin);
        m.position.z += (1 - lin) * (i - 2.5) * 1.2 + Math.sin(lin * Math.PI) * 0.9;
        const sc = Math.max(0.001, 0.08 + 0.92 * b); m.scale.set(sc, sc, sc);
        m.rotation.set(m.userData.spin.x * (1 - lin), m.userData.spin.y * (1 - lin), m.userData.spin.z * (1 - lin));
        m.visible = e > 0;
      });
      page.popProgress(pp);
    }

    // labels ancrés dans la scène
    page.labels((wp, out) => { tmp.copy(wp).project(camera); out.x = (tmp.x * 0.5 + 0.5) * VW; out.y = (-tmp.y * 0.5 + 0.5) * VH; out.vis = tmp.z < 1; return out; }, y);

    finish.uniforms.uTime.value = t;
    composer.render(dt);

    // mesure des perfs (on dégrade si ça rame)
    if (!document.hidden && now - lastSeen < 400) { frames++; acc += dt; }
    lastSeen = now;
    if (frames === 50) {
      const avg = acc / frames;
      if (avg > 1 / 34 && DPR > 0.8) { slowStreak++; DPR = Math.max(0.75, DPR - 0.35); resize(); }
      else if (avg > 1 / 34 && bloom.enabled) { bloom.enabled = false; }
      else if (avg < 1 / 55 && !bloom.enabled) { bloom.enabled = true; }
      else if (avg < 1 / 55 && DPR < DPR0 - 0.01) { DPR = Math.min(DPR0, DPR + 0.25); resize(); }
      frames = 0; acc = 0;
    }
    if (loader.v < 1) done();
    if (window.__appOpen || document.hidden) { running = false; return; }
    requestAnimationFrame(frame);
  }
  function wake() {
    if (running || window.__appOpen || document.hidden) return;
    // retour depuis l'appli : la ville est déjà scannée, pas besoin de rejouer l'intro
    if (intro0 >= 0 && performance.now() / 1000 - intro0 > 6) { introDone = true; U.uIntro.value = 10; T.forEach(s => { if (s.found < 0) s.found = 0; }); nFound = NT; page.setCount(NT, W.shops.length, true); }
    running = true; lastT = performance.now(); requestAnimationFrame(frame);
  }
  addEventListener('popsite:landing', wake);
  document.addEventListener('visibilitychange', wake);
  function done() { progress(1); setTimeout(() => { document.body.classList.remove('is-loading'); page.reveal(); }, 250); }
  requestAnimationFrame(frame);
  window.__dvKeys = page.keys;
  window.__dv = { scene, camera, renderer, W, bloom, composer, setStyle: s => page.setStyle(s), setDPR: v => { DPR = v; resize(); } };
}
