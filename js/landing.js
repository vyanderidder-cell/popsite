/* Devanture — accueil : une vraie ville la nuit (vidéo + photos), pluie, radar et faisceaux par-dessus.
   Plus de 3D : léger, fluide, ne chauffe pas. */
import { MEDIA, PINS } from './media.js';

const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const fine = window.matchMedia('(pointer: fine)').matches;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const sceneEl = document.getElementById('scene'), ov = document.getElementById('over'), ctx = ov.getContext('2d');
let W = 1, H = 1, DPR = 1, paused = false, asleep = false;

/* ---------- calques de la scène ---------- */
const LAYERS = ['hero', 'street', 'aerial', 'shop', 'blue'];
const lay = {};
for (const k of LAYERS) {
  const d = document.createElement('div'); d.className = 'lay'; d.dataset.k = k;
  if (k === 'hero' && MEDIA.heroVideo) {
    const v = document.createElement('video');
    v.muted = true; v.loop = true; v.playsInline = true; v.setAttribute('playsinline', ''); v.setAttribute('muted', '');
    v.preload = window.innerWidth < 900 ? 'metadata' : 'auto'; v.poster = MEDIA.heroPoster || MEDIA.blue; v.src = MEDIA.heroVideo;
    d.appendChild(v); lay[k] = { el: d, media: v, video: true };
  } else {
    const im = new Image(); im.decoding = 'async'; im.alt = ''; im.src = MEDIA[k === 'hero' ? 'blue' : k];
    d.appendChild(im); lay[k] = { el: d, media: im };
  }
  sceneEl.insertBefore(d, ov);
}
const heroV = lay.hero.video ? lay.hero.media : null;
let ready = false, prog = 0;
const lv = document.getElementById('loadv'), lp = document.getElementById('loadp');
const setP = p => { prog = Math.max(prog, Math.min(1, p)); if (lv) lv.style.setProperty('--p', prog); if (lp) lp.textContent = Math.round(prog * 100) + ' %'; };
const tick = setInterval(() => setP(prog + (1 - prog) * .12), 160);
const done = () => {
  if (ready) return; ready = true; clearInterval(tick); setP(1); sceneEl.style.opacity = 1;
  const l = document.getElementById('loadv'); if (l) { l.classList.add('done'); setTimeout(() => l.remove(), 800); }
};
if (heroV) { heroV.addEventListener('loadeddata', done, { once: true }); if (!reduce) heroV.play().catch(() => { }); }
lay.street.media.addEventListener('load', () => setTimeout(done, 600), { once: true });
setTimeout(done, 3500);

/* ---------- mesures et défilement ---------- */
const docTop = el => el.getBoundingClientRect().top + (window.scrollY || 0);
let STOPS = [], popTop = 0, popLen = 1, RAILY = [];
const RAIL = [].slice.call(document.querySelectorAll('.rail a'));
function measure() {
  const q = s => document.querySelector(s), pp = q('.pop');
  popTop = docTop(pp); popLen = Math.max(1, pp.offsetHeight - H);
  STOPS = [
    ['hero', 0],
    ['street', docTop(q('.approach')) - H * .55],
    ['aerial', docTop(q('#outil')) - H * .6],
    ['shop', docTop(q('#pitch')) - H * .6],
    ['blue', docTop(q('#tarif')) - H * .6]
  ];
  RAILY = RAIL.map(a => { const el = document.getElementById(a.getAttribute('href').slice(1)); return el ? docTop(el) : 0; });
}
function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, W < 820 ? 1.5 : 2);
  W = window.innerWidth; H = window.innerHeight;
  ov.width = Math.round(W * DPR); ov.height = Math.round(H * DPR);
  measure(); initRain();
}
const maxScroll = () => Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
function goTo(y) { window.scrollTo({ top: clamp(y, 0, maxScroll()), behavior: reduce ? 'auto' : 'smooth' }); }
function sectionY(id) { if (id === 'top') return 0; if (id === 'pop') return popTop + popLen * .82; const el = document.getElementById(id); return el ? docTop(el) : null; }
document.addEventListener('click', e => {
  const a = e.target.closest && e.target.closest('a[href^="#"]'); if (!a) return;
  const id = a.getAttribute('href').slice(1), yy = sectionY(id); if (yy === null) return;
  e.preventDefault(); goTo(yy);
  const el = document.getElementById(id); if (el && id !== 'top') { if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1'); el.focus({ preventScroll: true }); }
});

/* ---------- pluie / neige ---------- */
let WX = 'pluie', drops = [];
function initRain() {
  const n = reduce ? 0 : Math.round(W * H / (W < 820 ? 5200 : 3200));
  drops = Array.from({ length: n }, () => ({ x: Math.random() * W, y: Math.random() * H, z: .35 + Math.random() * .65, s: Math.random() }));
}
function drawWeather(dt) {
  if (WX === 'clair') return;
  if (WX === 'pluie') {
    ctx.strokeStyle = 'rgba(200,215,235,.32)'; ctx.lineWidth = 1; ctx.beginPath();
    for (const d of drops) {
      const v = 1300 * d.z, len = 16 * d.z + 6;
      d.y += v * dt; d.x -= v * dt * .12;
      if (d.y > H + 20) { d.y = -20 - Math.random() * 60; d.x = Math.random() * (W + 80); }
      if (d.x < -20) d.x = W + 20;
      ctx.moveTo(d.x, d.y); ctx.lineTo(d.x + len * .12, d.y - len);
    }
    ctx.stroke();
  } else {
    ctx.fillStyle = 'rgba(240,244,250,.8)'; ctx.beginPath();
    for (const d of drops) {
      d.y += 60 * d.z * dt; d.x += Math.sin((d.y + d.s * 400) * .012) * 18 * dt - 6 * dt;
      if (d.y > H + 6) { d.y = -6; d.x = Math.random() * W; }
      const r = 1 + d.z * 1.6; ctx.moveTo(d.x + r, d.y); ctx.arc(d.x, d.y, r, 0, Math.PI * 2);
    }
    ctx.fill();
  }
}

/* ---------- radar de la vue aérienne et repères ---------- */
let filter = 'all', radar0 = performance.now() / 1000;
const NONE_COUNT = { all: 23, resto: 4, beaute: 4, auto: 3, artisan: 5, commerce: 7 };
function coverMap(media) {
  const iw = media.videoWidth || media.naturalWidth || 1920, ih = media.videoHeight || media.naturalHeight || 1080;
  const s = Math.max(W / iw, H / ih);
  return { s, ox: (W - iw * s) / 2, oy: (H - ih * s) / 2, iw, ih };
}
function tag(x, y, name, sub, strong) {
  ctx.font = '600 10px "Martian Mono",ui-monospace,monospace'; const w1 = ctx.measureText(name).width;
  ctx.font = '400 9px "Martian Mono",ui-monospace,monospace'; const w2 = strong ? ctx.measureText(sub).width : 0;
  const w = Math.max(w1, w2) + 16, h = strong ? 34 : 20; let tx = x + 14; const ty = y - h - 14;
  if (tx + w > W - 8) tx = x - 14 - w;
  ctx.strokeStyle = 'rgba(255,186,78,.75)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(tx < x ? tx + w : tx, ty + h); ctx.stroke();
  ctx.fillStyle = 'rgba(8,12,22,.88)'; ctx.fillRect(tx, ty, w, h); ctx.strokeRect(tx + .5, ty + .5, w - 1, h - 1);
  ctx.textBaseline = 'top'; ctx.fillStyle = '#f1ece2'; ctx.font = '600 10px "Martian Mono",ui-monospace,monospace'; ctx.fillText(name, tx + 8, ty + 5);
  if (strong) { ctx.fillStyle = '#ffb23e'; ctx.font = '400 9px "Martian Mono",ui-monospace,monospace'; ctx.fillText(sub, tx + 8, ty + 19); }
}
function drawPins(key, alpha, t, layerScale, layerY) {
  const list = PINS[key]; if (!list || alpha < .02) return;
  const L = lay[key], m = coverMap(L.media);
  const cx = W / 2, cy = H / 2;
  const sweepA = ((t - radar0) / 3.2) * Math.PI * 2 - Math.PI / 2;
  ctx.save(); ctx.globalAlpha = alpha;
  // anneau de balayage centré sur le premier repère « centre »
  const c = list.center;
  if (c) {
    let x = m.ox + c[0] * m.iw * m.s, y = m.oy + c[1] * m.ih * m.s;
    x = cx + (x - cx) * layerScale; y = cy + (y - cy) * layerScale + layerY;
    const R = Math.min(W, H) * .42;
    ctx.strokeStyle = 'rgba(127,224,255,.16)'; ctx.lineWidth = 1;
    for (let k = 1; k <= 3; k++) { ctx.beginPath(); ctx.arc(x, y, R * k / 3, 0, Math.PI * 2); ctx.stroke(); }
    if (!reduce && ctx.createConicGradient) {
      const g = ctx.createConicGradient(sweepA - Math.PI * .5, x, y);
      g.addColorStop(0, 'rgba(127,224,255,0)'); g.addColorStop(.22, 'rgba(127,224,255,0)'); g.addColorStop(.25, 'rgba(255,178,62,.22)'); g.addColorStop(.2501, 'rgba(127,224,255,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI * 2); ctx.fill();
    }
  }
  const age = t - radar0;
  list.shops.forEach((p, i) => {
    if (filter !== 'all' && p.cat !== filter) return;
    if (age < .25 + i * .12) return;
    let x = m.ox + p.x * m.iw * m.s, y = m.oy + p.y * m.ih * m.s;
    x = cx + (x - cx) * layerScale; y = cy + (y - cy) * layerScale + layerY;
    if (x < -20 || x > W + 20 || y < -20 || y > H + 20) return;
    const pulse = reduce ? 1 : .75 + .25 * Math.sin(t * 2.6 + i);
    // faisceau vertical
    const bh = 70 + (i % 3) * 22, gr = ctx.createLinearGradient(x, y - bh, x, y);
    gr.addColorStop(0, 'rgba(255,178,62,0)'); gr.addColorStop(1, 'rgba(255,178,62,' + (.45 * pulse).toFixed(3) + ')');
    ctx.fillStyle = gr; ctx.fillRect(x - 1.5, y - bh, 3, bh);
    const hg = ctx.createRadialGradient(x, y, 0, x, y, 18);
    hg.addColorStop(0, 'rgba(255,190,90,' + (.9 * pulse).toFixed(3) + ')'); hg.addColorStop(1, 'rgba(255,178,62,0)');
    ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(x, y, 18, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffb23e'; ctx.beginPath(); ctx.arc(x, y, 3.2, 0, Math.PI * 2); ctx.fill();
    if (p.label && W > 700) tag(x, y - bh * .6, p.label, p.sub || 'AUCUN SITE', !!p.sub);
  });
  ctx.restore();
}

/* ---------- maquette qui se construit au défilement ---------- */
const blocks = [].slice.call(document.querySelectorAll('.blk')), browser = document.getElementById('browser'), urlEl = document.getElementById('url'), URLTXT = 'garage-perrin.fr';
const back = t => { const c = 1.9; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };

/* ---------- compteur du hero ---------- */
const elCount = document.getElementById('count'), elNone = document.getElementById('hud-none');
let shownCount = -1;
function countAt(t) { const tgt = NONE_COUNT[filter] || 0, p = clamp((t - radar0) / 2.4, 0, 1); return Math.round(tgt * (1 - Math.pow(1 - p, 3))); }

/* ---------- curseur ---------- */
const cur = document.getElementById('cursor'); let pxs = -999, pys = -999, curX = -999, curY = -999, curLive = false;
if (fine && !reduce) {
  window.addEventListener('pointermove', e => { pxs = e.clientX; pys = e.clientY; }, { passive: true });
  document.addEventListener('mouseout', e => { if (!e.relatedTarget) pxs = pys = -999; });
  document.addEventListener('pointerover', e => { const el = e.target.closest && e.target.closest('a,button,summary,input,label'); cur.classList.toggle('hot', !!el); });
}

/* ---------- boucle ---------- */
let sm = window.scrollY || 0, lastT = performance.now() / 1000, railOn = -1, mHud = null;
const brEl = document.querySelector('.br'), roEl = document.querySelector('.readout');
function frame(ms) {
  if (window.__appOpen) { asleep = true; if (heroV) heroV.pause(); return; }
  const t = ms / 1000, dt = Math.min(.05, Math.max(.001, t - lastT)); lastT = t;
  const y = window.scrollY || 0; sm += (y - sm) * (1 - Math.exp(-dt * 10));
  // calques : fondu entre les plans, léger travelling avant pendant qu'on reste dessus
  let cur_i = 0; for (let i = 0; i < STOPS.length; i++) if (sm >= STOPS[i][1]) cur_i = i;
  const fade = H * .55, f = cur_i === 0 ? 1 : clamp((sm - STOPS[cur_i][1]) / fade, 0, 1);
  const prev = cur_i > 0 ? STOPS[cur_i - 1][0] : null, curK = STOPS[cur_i][0];
  const nextY = cur_i + 1 < STOPS.length ? STOPS[cur_i + 1][1] : STOPS[cur_i][1] + H * 3;
  const scales = {}, ys = {};
  for (const k of LAYERS) {
    const L = lay[k], on = k === curK ? 1 : k === prev ? 1 : 0;
    const z = k === curK ? 2 : k === prev ? 1 : 0;
    const op = k === curK ? (prev ? f : 1) : k === prev ? 1 : 0;
    const i = STOPS.findIndex(s => s[0] === k), y0 = i >= 0 ? STOPS[i][1] : 0, y1 = i + 1 < STOPS.length ? STOPS[i + 1][1] + fade : y0 + H * 3;
    const lp = clamp((sm - y0) / Math.max(1, y1 - y0), 0, 1);
    const sc = 1.06 + (reduce ? 0 : .09 * lp), ty = reduce ? 0 : -lp * H * .03;
    scales[k] = sc; ys[k] = ty;
    L.el.style.opacity = on ? op.toFixed(3) : '0';
    L.el.style.zIndex = z;
    L.el.style.transform = `translate3d(0,${ty.toFixed(1)}px,0) scale(${sc.toFixed(4)})`;
  }
  if (heroV) { const want = (curK === 'hero' || prev === 'hero') && !paused && !reduce; if (want && heroV.paused) heroV.play().catch(() => { }); else if (!want && !heroV.paused) heroV.pause(); }

  ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.clearRect(0, 0, W, H);
  if (!paused) drawWeather(dt); else drawWeather(0);
  const aerialA = curK === 'aerial' ? (prev ? f : 1) : prev === 'aerial' ? 1 - f : 0;
  drawPins('aerial', aerialA, t, scales.aerial, ys.aerial);
  const streetA = curK === 'street' ? (prev ? f : 1) : prev === 'street' ? 1 - f : 0;
  drawPins('street', streetA, t, scales.street, ys.street);

  const c = countAt(t); if (c !== shownCount) { shownCount = c; elCount.textContent = c; if (elNone) elNone.textContent = c; }

  if (fine && !reduce && pxs > -999) { if (curX < -900) { curX = pxs; curY = pys; } const k = 1 - Math.exp(-dt * 20); curX += (pxs - curX) * k; curY += (pys - curY) * k; cur.style.transform = `translate3d(${curX.toFixed(1)}px,${curY.toFixed(1)}px,0)`; if (!curLive) { curLive = true; cur.classList.add('live'); } }
  else if (curLive) { curLive = false; cur.classList.remove('live'); curX = -999; }

  const mh = y > H * .35; if (mh !== mHud) { mHud = mh; if (brEl) brEl.classList.toggle('hide', mh); if (roEl) roEl.classList.toggle('hide', mh); }
  let ri = 0; for (let n = 0; n < RAILY.length; n++) if (y + H * .45 >= RAILY[n]) ri = n;
  if (ri !== railOn && RAIL[ri]) { if (railOn >= 0) { RAIL[railOn].classList.remove('on'); RAIL[railOn].removeAttribute('aria-current'); } railOn = ri; RAIL[ri].classList.add('on'); RAIL[ri].setAttribute('aria-current', 'true'); }

  if (!reduce && sm > popTop - H * 1.1 && sm < popTop + popLen + H * 1.1) {
    const qp = clamp((sm - popTop) / popLen, 0, 1), en = clamp((sm - (popTop - H * .45)) / (H * .55), 0, 1);
    browser.style.transform = `scale(${(.86 + .14 * back(en)).toFixed(4)}) rotate(${((1 - en) * -2.5).toFixed(3)}deg)`;
    for (let n = 0; n < blocks.length; n++) {
      const st = .04 + n * .11, e2 = clamp((qp - st) / .18, 0, 1), bk = e2 <= 0 ? 0 : back(e2);
      blocks[n].style.transform = (n === blocks.length - 1 ? 'rotate(8deg) ' : '') + `translateY(${((1 - bk) * 46).toFixed(2)}px) scale(${(.55 + .45 * bk).toFixed(4)})`;
      blocks[n].style.opacity = clamp(e2 * 3, 0, 1).toFixed(3);
    }
    urlEl.textContent = URLTXT.slice(0, Math.round(clamp(qp / .14, 0, 1) * URLTXT.length)) || ' ';
  }
  requestAnimationFrame(frame);
}
window.addEventListener('popsite:landing', () => { if (asleep) { asleep = false; lastT = performance.now() / 1000; resize(); requestAnimationFrame(frame); } });
window.addEventListener('resize', resize);
window.addEventListener('load', measure);
resize(); requestAnimationFrame(frame);
if (reduce) blocks.forEach(b => { b.style.opacity = 1; b.style.transform = 'none'; });

/* ---------- grain, apparitions, textes décodés ---------- */
(function () {
  const g = document.createElement('canvas'); g.width = g.height = 180; const gc = g.getContext('2d'), im = gc.createImageData(180, 180);
  for (let k = 0; k < im.data.length; k += 4) { const v = Math.random() * 255 | 0; im.data[k] = im.data[k + 1] = im.data[k + 2] = v; im.data[k + 3] = 255; } gc.putImageData(im, 0, 0);
  try { document.getElementById('grain').style.backgroundImage = 'url(' + g.toDataURL('image/png') + ')'; } catch (e) { }
})();
const GLY = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/#+·';
function scramble(el) {
  if (reduce) return; const txt = el.getAttribute('data-txt') || el.textContent; el.setAttribute('data-txt', txt); const s0 = performance.now(), dur = 520 + txt.length * 14;
  (function step(now) { const p = clamp((now - s0) / dur, 0, 1), nn = Math.floor(p * txt.length); let out = txt.slice(0, nn); for (let k = nn; k < txt.length; k++) { const ch = txt.charAt(k); out += ch === ' ' ? ' ' : GLY.charAt((Math.random() * GLY.length) | 0); } el.textContent = out; if (p < 1) requestAnimationFrame(step); else el.textContent = txt; })(s0);
}
const secs = [].slice.call(document.querySelectorAll('main > section'));
function enter(s) { if (s.classList.contains('in')) return; s.classList.add('in'); [].forEach.call(s.querySelectorAll('.eyebrow'), scramble); }
if ('IntersectionObserver' in window) { const io = new IntersectionObserver(es => es.forEach(en => { if (en.isIntersecting) { enter(en.target); io.unobserve(en.target); } }), { rootMargin: '0px 0px -6% 0px' }); secs.forEach(s => io.observe(s)); }
else secs.forEach(enter);

/* ---------- contrôles ---------- */
document.getElementById('rescan').addEventListener('click', () => { radar0 = performance.now() / 1000; });
const chips = [].slice.call(document.querySelectorAll('#chips .chip'));
chips.forEach(c => c.addEventListener('click', () => { filter = c.getAttribute('data-cat'); radar0 = performance.now() / 1000 - 1.6; chips.forEach(x => x.setAttribute('aria-pressed', x === c ? 'true' : 'false')); }));
const sbtn = [].slice.call(document.querySelectorAll('#styles .chip'));
sbtn.forEach(c => c.addEventListener('click', () => { browser.classList.remove('vitrine', 'nuit'); const s = c.getAttribute('data-style'); if (s) browser.classList.add(s); sbtn.forEach(x => x.setAttribute('aria-pressed', x === c ? 'true' : 'false')); }));
const pb = document.getElementById('pause');
pb.addEventListener('click', () => { paused = !paused; pb.setAttribute('aria-pressed', paused ? 'true' : 'false'); pb.textContent = paused ? 'Lecture' : 'Pause'; if (heroV) { if (paused) heroV.pause(); } });
const wxb = [].slice.call(document.querySelectorAll('.wx button[data-wx]'));
wxb.forEach(bt => bt.addEventListener('click', () => { WX = bt.getAttribute('data-wx'); wxb.forEach(x => x.setAttribute('aria-pressed', x === bt ? 'true' : 'false')); }));
const tabs = [].slice.call(document.querySelectorAll('.tab'));
function pick(tb, focus) { tabs.forEach(x => { const on = x === tb; x.setAttribute('aria-selected', on ? 'true' : 'false'); x.tabIndex = on ? 0 : -1; document.getElementById(x.getAttribute('aria-controls')).hidden = !on; }); if (focus) tb.focus(); }
tabs.forEach((tb, n) => { tb.addEventListener('click', () => pick(tb)); tb.addEventListener('keydown', e => { if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); pick(tabs[(n + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length], true); } }); });
[].slice.call(document.querySelectorAll('button.mini')).forEach(b => b.addEventListener('click', () => goTo(sectionY('pop'))));
document.getElementById('scan').addEventListener('submit', e => {
  e.preventDefault(); const v = document.getElementById('ville').value.trim();
  if (!v) { document.getElementById('scanmsg').textContent = 'Écris une ville ou un code postal pour lancer le radar.'; return; }
  document.getElementById('scanmsg').textContent = '';
  if (window.PopApp) window.PopApp.scan(v);
});
const heroScan = document.getElementById('scan-hero');
if (heroScan) heroScan.addEventListener('submit', e => { e.preventDefault(); const v = document.getElementById('ville-hero').value.trim(); if (window.PopApp) { if (v) window.PopApp.scan(v); else location.hash = 'radar'; } });
document.getElementById('copy').addEventListener('click', function () {
  const btn = this, txt = document.getElementById('prompt-text').textContent;
  try { navigator.clipboard.writeText(txt).then(() => { btn.textContent = 'Copié'; }, () => { btn.textContent = 'Sélectionne le texte'; }); } catch (e) { btn.textContent = 'Sélectionne le texte'; }
});
