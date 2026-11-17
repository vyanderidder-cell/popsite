/* Données du village : lots, maisons (en modules de 2 m), commerces, lampadaires, arbres, foule. */
export function generate(dens) {
  const mobile = dens < .4;
  let seed = 20261115;
  const rnd = () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  /* ------- îlots : maisons mitoyennes alignées sur rue, cour au milieu ------- */
  const PLASTER = [0xe9dcc3, 0xe3cfa6, 0xd9b98f, 0xeee6d8, 0xd8c7b6, 0xe6c9b8, 0xcfc6b4, 0xe8d3a0, 0xd6b9a0, 0xe2d6bf];
  const SQ = 24;                                  // grande place : |x|,|z| < 24
  const SQ2 = { x0: 64, x1: 96, z0: 24, z1: 56 }; // petite place devant le garage
  const BLOCKS = [];
  let B = [];
  function partition(len, opts) {
    const res = [];
    const go = (rest) => { if (rest === 0) return true; const o = opts.slice().sort(() => rnd() - .5); for (const v of o) { if (v <= rest) { res.push(v); if (go(rest - v)) return true; res.pop(); } } return false; };
    go(len); return res;
  }
  for (let a = -5; a <= 5; a++) for (let c = -5; c <= 5; c++) {
    const bx = 40 * a, bz = 40 * c, br = Math.hypot(bx, bz);
    if (a === 0 && c === 0) continue;
    if (a === 2 && c === 1) continue;
    if (br > 200) continue;
    const edge = br > 135 ? (br - 135) / 70 : 0;
    const isT = a === 1 && c === 1;
    const D = isT ? 6 : (rnd() < .62 ? 8 : 6);
    const x0 = bx - 16, x1 = bx + 16, z0 = bz - 16, z1 = bz + 16;
    const opts = D === 8 ? [8, 10, 12] : [6, 8, 10];
    const blk = { bx, bz, D, x0, x1, z0, z1, sides: [] };
    BLOCKS.push(blk);
    // 4 côtés : [direction de la façade (normale), début, fin, axe le long de la rue]
    const sides = [
      { n: [0, -1], along: 'x', from: x0, to: x1, fixed: z0 + D / 2 },
      { n: [0, 1], along: 'x', from: x0, to: x1, fixed: z1 - D / 2 },
      { n: [-1, 0], along: 'z', from: z0 + D, to: z1 - D, fixed: x0 + D / 2 },
      { n: [1, 0], along: 'z', from: z0 + D, to: z1 - D, fixed: x1 - D / 2 }
    ];
    sides.forEach((sd, si) => {
      let parts = isT && si === 3 ? [10, 10] : partition(sd.to - sd.from, opts);
      let pos = sd.from; const row = [];
      for (const L of parts) {
        const mid = pos + L / 2; pos += L;
        const cx = sd.along === 'x' ? mid : sd.fixed, cz = sd.along === 'x' ? sd.fixed : mid;
        // parvis de l'église : pas de maisons devant le clocher
        if (a === 0 && c === -1 && si === 1 && Math.abs(cx) < 9) { row.push(null); continue; }
        if (a === 0 && c === -1 && si !== 0 && Math.abs(cx) < 7) { row.push(null); continue; }
        if (edge > 0 && rnd() < edge * .75) { row.push(null); continue; }
        const r = Math.hypot(cx, cz);
        let F = 2 + (rnd() < .55 ? 1 : 0) + (r < 100 && rnd() < .3 ? 1 : 0);
        if (edge > 0) F = Math.max(1, F - 1 - (rnd() < edge ? 1 : 0));
        const prev = row.length ? row[row.length - 1] : null;
        if (prev && prev.F === F) F = F >= 3 ? F - 1 : F + 1;
        const b = { cx, cz, W: D, L, F, ang: Math.atan2(-sd.n[1], sd.n[0]), front: 1, r, shop: 0, idx: -1, seed: rnd(), lit: 0, on: false, t0: 0, name: '', type: '', cat: '', top: 0, side: si, blk };
        row.push(b); B.push(b);
      }
      sd.row = row;
    });
    // voisins le long d'une même rue + extrémités : étages masqués sur les pignons (k=0 : z-, k=2 : z+ en local)
    sides.forEach((sd, si) => {
      const row = sd.row;
      row.forEach((b, i) => {
        if (!b) return;
        // le z local va dans le sens +x (côté nord), -x (sud), -z (ouest), +z (est)
        const prev = row[i - 1], next = row[i + 1];
        const zNeg = (si === 0 || si === 3) ? prev : next, zPos = (si === 0 || si === 3) ? next : prev;
        const endF = (nb, atStart) => {
          if (nb) return nb.F;
          if (nb === null) return 0;                       // trou dans la rangée
          if (si >= 2) { const corner = atStart ? sides[0].row : sides[1].row; const cb = atStart ? corner[0] : corner[corner.length - 1]; return cb ? cb.F : 0; }
          return 0;                                         // bout de rangée nord/sud : donne sur la rue
        };
        const isStart = (k) => (si === 0 || si === 3) ? k === 'neg' : k === 'pos';
        b.nF = [endF(zNeg, i === 0 ? true : false), 0, endF(zPos, false), 0];
        if (si >= 2) {
          // rangées est/ouest : le premier élément touche le coin nord, le dernier le coin sud
          const first = i === 0, last = i === row.length - 1;
          const nf = sides[0].row, sf = sides[1].row;
          const north = si === 2 ? nf[0] : nf[nf.length - 1], south = si === 2 ? sf[0] : sf[sf.length - 1];
          // ouest (si=2) : z local -> monde -z ; z- local = sud ; est (si=3) : z local -> monde +z ; z- local = nord
          const atNorth = first ? (north ? north.F : 0) : null, atSouth = last ? (south ? south.F : 0) : null;
          if (si === 3) { if (atNorth !== null) b.nF[0] = atNorth; if (atSouth !== null) b.nF[2] = atSouth; }
          else { if (atNorth !== null) b.nF[2] = atNorth; if (atSouth !== null) b.nF[0] = atSouth; }
        }
      });
    });
  }
  const NAMES = ['Garage Perrin|Mécanique auto|auto', 'Chez Lucette|Bar-tabac|resto', 'Coiffure Mylène|Salon de coiffure|beaute', 'Boucherie Vasseur|Boucherie|commerce', 'Le Fournil d\'Élise|Boulangerie|commerce', 'Fleurs & Saisons|Fleuriste|commerce', 'Cordonnerie Bastien|Cordonnier|artisan', 'Pizza Nino|Pizzeria|resto', 'L\'Atelier du Cycle|Réparation vélos|artisan', 'Plomberie Girard|Plombier|artisan', 'Au Fil d\'Agathe|Mercerie|commerce', 'Le Petit Zinc|Bistrot|resto', 'Toilettage Câlin|Toilettage|beaute', 'Menuiserie Roche|Menuisier|artisan', 'Épicerie Colette|Épicerie|commerce', 'Barbier Malo|Barbier|beaute', 'Carrosserie Duval|Carrosserie|auto', 'La Table d\'Odile|Restaurant|resto', 'Pressing du Centre|Pressing|commerce', 'Électricité Brun|Électricien|artisan', 'Institut Maëlle|Institut de beauté|beaute', 'Fromagerie Lacombe|Fromagerie|commerce', 'Taxi Fabre|Taxi|auto'];
  // le garage : façade est de l'îlot (40,40), côté petite place
  const T = B.filter(b => b.blk.bx === 40 && b.blk.bz === 40 && b.side === 3).sort((p, q) => q.cz - p.cz)[0];
  T.F = 2;
  // commerces : rez-de-chaussée près du centre (rues autour de la place en priorité)
  const cand = B.filter(b => b !== T && b.r < 128).map(b => ({ b, k: b.r * (.6 + rnd() * .8) })).sort((p, q) => p.k - q.k).slice(0, 60).map(o => o.b);
  cand.push(T);
  cand.forEach(b => { b.shop = 1; b.idx = 50; if (b.F < 2) b.F = 2; });
  const NONE = cand.filter(b => b !== T).sort(() => rnd() - .5).slice(0, 22);
  NONE.unshift(T);
  NONE.forEach((b, k) => { const p = NAMES[k].split('|'); b.shop = 2; b.idx = k; b.name = p[0]; b.type = p[1]; b.cat = p[2]; });
  const SITES = B.filter(b => b.shop === 1);
  const DX = 1, DZ = 0, PX = 0, PZ = 1;
  B.forEach(b => {
    b.hw = b.W / 2; b.hd = b.L / 2; b.h = b.F * 3; b.top = b.h + (b.W === 6 ? 4.8 : 5.9);
    const st = rnd();
    b.style = b.shop ? (st < .45 ? 'stone' : st < .75 ? 'timber' : 'plaster') : st < .45 ? 'plaster' : st < .78 ? 'timber' : 'stone';
    b.round = rnd() < .5;
    b.tint = PLASTER[Math.floor(rnd() * PLASTER.length)];
    b.shut = rnd();
    b.chim = rnd() < .7;
    b.annex = false;
  });

  /* lampadaires */
  const LAMPS = [];
  for (let i = 0; i < 10; i++) { const c = 40 * i - 180; for (let k = -200; k <= 180; k += 20) { const q = k + 10; if (Math.hypot(c, q) < 188 && !(Math.abs(c) < 26 && Math.abs(q) < 26)) { LAMPS.push([c + 3.3, q]); LAMPS.push([q, c + 3.3]); } } }
  for (let i = 0; i < 8; i++) { const la = i / 8 * 6.2832 + .39; LAMPS.push([2 + Math.cos(la) * 14, 2 + Math.sin(la) * 14]); }

  const CH = { cx: 0, cz: -36, W: 8, L: 12, F: 3 }, TW = { cx: 0, cz: -27.5, W: 4, F: 7 }, FO = { cx: 2, cz: 2 };
  const TREES = [];
  // place : arbres en bordure (pas devant la caméra d'accueil)
  [[-19, 19], [-19, 6], [-19, -8], [19, -8], [19, -19], [-8, 19], [8, -19], [-19, -19]].forEach(p => TREES.push([p[0], p[1], .85 + rnd() * .25, 0]));
  // champs et bois autour de la ville
  for (let i = 0; i < 260; i++) { const a2 = rnd() * 6.2832, r2 = 215 + Math.pow(rnd(), 1.6) * 520; TREES.push([Math.cos(a2) * r2 + (rnd() - .5) * 20, Math.sin(a2) * r2 + (rnd() - .5) * 20, .9 + rnd() * 1.1, 1]); }
  // jardins au cœur des îlots
  BLOCKS.forEach(k2 => {
    const n = 1 + Math.floor(rnd() * 3), m = k2.D + 2.5;
    for (let i = 0; i < n; i++) { const x = k2.x0 + m + rnd() * (32 - 2 * m), z = k2.z0 + m + rnd() * (32 - 2 * m); TREES.push([x, z, .6 + rnd() * .35, 2]); }
  });
  /* foule */
  const k = dens, crowd = [];
  const xr = Math.round((T.cx - 20) / 40) * 40 + 20, zr = Math.round((T.cz - 20) / 40) * 40 + 20;
  const sex = () => rnd() < .5 ? 'm' : 'f';
  const walker = (o) => { const v = 1.1 + rnd() * .4, formal = rnd() < .3; o.v = v; o.ts = v / (formal ? 1.15 : 1.3); o.umb = rnd() < .88; o.clip = o.umb ? (formal ? 'WalkFormalUmb' : 'WalkUmb') : (formal ? 'Walk_Formal_Loop' : 'Walk_Loop'); o.clipDry = formal ? 'Walk_Formal_Loop' : 'Walk_Loop'; o.sex = sex(); o.s0 = rnd() * 400; return o; };
  const lane = (axis, road, center, len) => { const dir = rnd() < .5 ? 1 : -1, off = dir * (1.5 + rnd() * .9); return axis === 0 ? walker({ kind: 'line', x: road + off, z: center, dx: 0, dz: dir, len }) : walker({ kind: 'line', x: center, z: road + off, dx: dir, dz: 0, len }); };
  for (let i = 0; i < Math.round(11 * k); i++) crowd.push(walker({ kind: 'circle', x: FO.cx, z: FO.cz, r: 4.6 + rnd() * 4.4, dir: rnd() < .5 ? 1 : -1 }));
  for (let i = 0; i < Math.round(16 * k); i++) { const ax = rnd() < .5 ? 0 : 1, rd = [20, -20][Math.floor(rnd() * 2)]; crowd.push(lane(ax, rd, (rnd() - .5) * 20, 150 + rnd() * 60)); }
  for (let i = 0; i < Math.round(13 * k); i++) { const ax = rnd() < .5 ? 0 : 1; crowd.push(lane(ax, ax === 0 ? xr : zr, ax === 0 ? T.cz : T.cx, 120 + rnd() * 60)); }
  for (let i = 0; i < Math.round(14 * k); i++) { const ax = rnd() < .5 ? 0 : 1, rd = 40 * (Math.floor(rnd() * 8) - 4) + 20; crowd.push(lane(ax, rd, (rnd() - .5) * 80, 200 + rnd() * 100)); }
  // petits groupes à l'arrêt : devant le garage et sur la place
  const groups = [[T.cx + 12, T.cz + 3], [T.cx + 11.5, T.cz - 4], [-8, 12], [12, -10]];
  groups.slice(0, mobile ? 2 : 4).forEach((g, gi) => {
    const n = 2 + (rnd() < .4 ? 1 : 0);
    for (let j = 0; j < n; j++) {
      const a = j / n * 6.2832 + rnd(), x = g[0] + Math.cos(a) * .85, z = g[1] + Math.sin(a) * .85;
      const u = rnd() < .8;
      crowd.push({ kind: 'idle', x, z, ry: Math.atan2(g[0] - x, g[1] - z), sex: sex(), umb: u, clip: u ? (j === 0 ? 'TalkUmb' : 'IdleUmb') : (j === 0 ? 'Idle_Talking_Loop' : 'Idle_Loop'), clipDry: j === 0 ? 'Idle_Talking_Loop' : 'Idle_Loop', ts: .9 + rnd() * .2 });
    }
  });
  return { rnd, B, NONE, T, SITES, LAMPS, DX, DZ, PX, PZ, CH, TW, FO, TREES, crowd, xr, zr, BLOCKS, SQ, SQ2 };
}
