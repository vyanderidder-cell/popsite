/* Devanture — chargement des bâtiments modélisés dans Blender (assets/models/*.glb, Draco).
   Chaque modèle est découpé par matériau (Mur, Toit, Encadrement, Volet, Porte, Fenetre, Vitrine, Enseigne).
   On repère aussi chaque carreau (pour allumer les fenêtres une par une), la vitrine et l'enseigne. */
import * as THREE from 'three';
import { GLTFLoader } from '../vendor/three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from '../vendor/three/addons/loaders/DRACOLoader.js';

export const HOUSES = ['maison-a', 'maison-b', 'maison-c', 'maison-d', 'maison-e'];
export const SHOPS = ['boutique-a', 'boutique-b'];
export const CHURCH = 'eglise';
const ALL = [...HOUSES, ...SHOPS, CHURCH];

/* morceaux d'un maillage : sommets confondus réunis, puis composantes connexes des triangles */
function components(g) {
  const pos = g.attributes.position, n = pos.count, idx = g.index ? g.index.array : null;
  const key = new Map(), id = new Int32Array(n);
  for (let i = 0; i < n; i++) {
    const k = Math.round(pos.getX(i) * 1e3) + ',' + Math.round(pos.getY(i) * 1e3) + ',' + Math.round(pos.getZ(i) * 1e3);
    let v = key.get(k); if (v === undefined) { v = key.size; key.set(k, v); } id[i] = v;
  }
  const par = new Int32Array(key.size).map((_, i) => i);
  const find = a => { while (par[a] !== a) a = par[a] = par[par[a]]; return a; };
  const tri = idx ? idx.length : n;
  for (let t = 0; t < tri; t += 3) {
    const a = find(id[idx ? idx[t] : t]);
    for (let j = 1; j < 3; j++) { const b = find(id[idx ? idx[t + j] : t + j]); if (a !== b) par[b] = a; }
  }
  const roots = new Map(), comp = new Int32Array(n), boxes = [];
  const v = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    const r = find(id[i]);
    let c = roots.get(r); if (c === undefined) { c = roots.size; roots.set(r, c); boxes.push(new THREE.Box3()); }
    comp[i] = c; boxes[c].expandByPoint(v.fromBufferAttribute(pos, i));
  }
  return { comp, boxes };
}

/* un nombre au hasard par carreau, pour que chaque fenêtre s'allume indépendamment */
function tagPanes(g) {
  const { comp, boxes } = components(g), a = new Float32Array(comp.length);
  for (let i = 0; i < comp.length; i++) { const c = comp[i]; a[i] = ((Math.sin(c * 12.9898 + 4.1) * 43758.5453) % 1 + 1) % 1; }
  g.setAttribute('aWin', new THREE.BufferAttribute(a, 1));
  return boxes;
}

const biggest = boxes => {
  let best = null, area = -1;
  for (const b of boxes) { const s = b.getSize(new THREE.Vector3()), ar = s.x * s.y; if (ar > area) { area = ar; best = b; } }
  return best;
};

export async function loadModels(base = '/assets/models/', onProgress) {
  const draco = new DRACOLoader().setDecoderPath('/js/draco/');
  const loader = new GLTFLoader().setDRACOLoader(draco);
  let done = 0;
  const out = {};
  await Promise.all(ALL.map(async name => {
    const gltf = await loader.loadAsync(base + name + '.glb');
    const parts = [], box = new THREE.Box3();
    let wall = null, vitrine = null, sign = null;
    gltf.scene.updateMatrixWorld(true);
    gltf.scene.traverse(o => {
      if (!o.isMesh) return;
      const g = o.geometry.clone().applyMatrix4(o.matrixWorld);
      g.deleteAttribute('uv');
      const mat = o.material.name.split('.')[0];
      g.computeBoundingBox(); box.union(g.boundingBox);
      if (mat === 'Mur') wall = g.boundingBox.clone();
      if (mat === 'Fenetre' || mat === 'Vitrine') {
        const boxes = tagPanes(g);
        if (mat === 'Vitrine') vitrine = biggest(boxes);
      }
      if (mat === 'Enseigne') sign = g.boundingBox.clone();
      parts.push({ mat, geometry: g, color: o.material.color.clone(), roughness: o.material.roughness });
    });
    // dimensions des murs (sans débords de toit) : c'est l'emprise du bâtiment
    const ws = wall.getSize(new THREE.Vector3());
    out[name] = { name, parts, box, w: ws.x, d: ws.z, top: box.max.y, tall: box.max.y > 10, vitrine, sign };
    onProgress && onProgress(++done / ALL.length);
  }));
  draco.dispose();
  return out;
}
