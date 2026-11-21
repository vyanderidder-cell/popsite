/* Devanture — carte radar en canvas : rues OpenStreetMap, balayage, commerces sans site en ambre */

const AMBER = '#ffb23e', ICE = '#7fe0ff';

function glowSprite(color, size) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d'), r = size / 2, gr = g.createRadialGradient(r, r, 0, r, r, r);
  gr.addColorStop(0, color); gr.addColorStop(.18, color); gr.addColorStop(.32, 'rgba(255,178,62,.35)'); gr.addColorStop(1, 'rgba(255,178,62,0)');
  g.fillStyle = gr; g.fillRect(0, 0, size, size); return c;
}

export function createRadar(canvas, opt = {}) {
  const ctx = canvas.getContext('2d');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const glow = glowSprite(AMBER, 64);
  let W = 1, H = 1, DPR = 1, data = null, items = [], filter = () => true;
  let kx = 1, ky = 1, scale = 1, ox = 0, oy = 0, roadsCache = null, C = null, viewT = 0;
  let sel = null, hov = null, scanT0 = -1, lastInteract = 0, running = false, raf = 0, lastDraw = 0, dirty = true;
  let ptrs = new Map(), drag = null, pinch = null, moved = 0;

  const proj = (lat, lon) => [((lon - data.center.lon) * kx) * scale + W / 2 + ox, ((data.center.lat - lat) * ky) * scale + H / 2 + oy];
  const isTarget = it => it.web === 'none' || it.web === 'social';

  function size() {
    const r = canvas.getBoundingClientRect();
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = Math.max(1, r.width); H = Math.max(1, r.height);
    canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
    dirty = true; kick();
  }
  const ro = new ResizeObserver(size); ro.observe(canvas);

  function fit() {
    if (!data) return;
    scale = Math.min(W, H) * .45 / data.radius; ox = oy = 0; dirty = true; kick();
  }

  /* rues : rendues une fois dans un calque, puis simplement déplacées/agrandies pendant qu'on manipule la carte ;
     on ne les redessine qu'une fois le geste fini (gros gain sur les grandes villes) */
  function drawRoads(now) {
    const fresh = roadsCache && C && C.W === W && C.H === H && C.DPR === DPR;
    const same = fresh && C.s === scale && C.ox === ox && C.oy === oy;
    if (fresh && !dirty && (same || now - viewT < 160)) return;
    C = { W, H, DPR, s: scale, ox, oy }; dirty = false;
    if (!roadsCache) roadsCache = document.createElement('canvas');
    roadsCache.width = canvas.width; roadsCache.height = canvas.height;
    const g = roadsCache.getContext('2d');
    g.setTransform(DPR, 0, 0, DPR, 0, 0); g.clearRect(0, 0, W, H);
    g.lineCap = 'round'; g.lineJoin = 'round';
    const z = Math.max(.8, Math.min(1.8, scale * 2.2));
    const passes = [[3, 'rgba(127,224,255,.17)', .9 * z], [2, 'rgba(127,224,255,.30)', 1.4 * z], [1, 'rgba(176,204,240,.5)', 2.3 * z]];
    for (const [cls, col, w] of passes) {
      g.strokeStyle = col; g.lineWidth = w; g.beginPath();
      for (const r of data.roads) {
        if (r.c !== cls) continue;
        let first = true;
        for (const p of r.p) { const q = proj(p[0], p[1]); if (first) { g.moveTo(q[0], q[1]); first = false; } else g.lineTo(q[0], q[1]); }
      }
      g.stroke();
    }
  }

  function frame(ms) {
    raf = 0;
    if (!running || !canvas.isConnected) { running = false; return; }
    const now = ms / 1000;
    const scanning = scanT0 >= 0 && now - scanT0 < 2.6;
    const idle = now - lastInteract > 14 && !scanning;
    // 30 i/s suffisent pour le balayage ; à l'arrêt, une image puis on dort
    if (ms - lastDraw < 32) { raf = requestAnimationFrame(frame); return; }
    lastDraw = ms;
    draw(now);
    if (!idle && !reduce) raf = requestAnimationFrame(frame); else running = false;
  }
  function kick() { lastInteract = performance.now() / 1000; if (!running) { running = true; raf = requestAnimationFrame(frame); } }

  function draw(now) {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const cx = W / 2 + ox, cy = H / 2 + oy;
    const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(W, H) * .7);
    bg.addColorStop(0, '#0d1626'); bg.addColorStop(1, '#060a13');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    if (!data) {
      ringsAndSweep(cx, cy, Math.min(W, H) * .45, now, 0);
      return;
    }
    drawRoads(performance.now());
    const k = scale / C.s;
    ctx.setTransform(DPR * k, 0, 0, DPR * k, DPR * (W / 2 + ox - (W / 2 + C.ox) * k), DPR * (H / 2 + oy - (H / 2 + C.oy) * k));
    ctx.drawImage(roadsCache, 0, 0, W, H);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    const R = data.radius * scale;
    const sp = scanT0 >= 0 ? Math.min(1, (now - scanT0) / 2.4) : 1;
    ringsAndSweep(cx, cy, R, now, sp);
    // zone hors rayon assombrie
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.arc(cx, cy, R, 0, Math.PI * 2, true); ctx.fillStyle = 'rgba(6,10,19,.55)'; ctx.fill('evenodd'); ctx.restore();
    const sweepA = sp < 1 ? -Math.PI / 2 + sp * Math.PI * 2 : 99;
    // commerces avec site : petits points froids
    ctx.fillStyle = 'rgba(147,160,186,.55)';
    for (const it of items) {
      if (isTarget(it) || !filter(it)) continue;
      if (!revealed(it, cx, cy, sweepA)) continue;
      const q = proj(it.lat, it.lon); ctx.beginPath(); ctx.arc(q[0], q[1], 2, 0, Math.PI * 2); ctx.fill();
    }
    // cibles : points ambre avec halo
    const pulse = reduce ? 1 : .8 + .2 * Math.sin(now * 2.4);
    for (const it of items) {
      if (!isTarget(it) || !filter(it)) continue;
      if (!revealed(it, cx, cy, sweepA)) continue;
      const q = proj(it.lat, it.lon), big = it.id === sel || it.id === hov, s = (big ? 46 : 30) * pulse;
      ctx.globalAlpha = it.locked ? .35 : 1;
      ctx.drawImage(glow, q[0] - s / 2, q[1] - s / 2, s, s);
      ctx.fillStyle = it.web === 'social' ? '#ffe0a8' : AMBER;
      ctx.beginPath(); ctx.arc(q[0], q[1], big ? 4.5 : 3.2, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }
    for (const id of [hov, sel]) {
      const it = id && items.find(x => x.id === id); if (!it || !filter(it)) continue;
      const q = proj(it.lat, it.lon);
      ctx.strokeStyle = AMBER; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(q[0], q[1], 11, 0, Math.PI * 2); ctx.stroke();
      label(it.locked ? 'Commerce verrouillé' : it.name, q[0], q[1]);
    }
    // centre
    ctx.fillStyle = ICE; ctx.beginPath(); ctx.arc(cx, cy, 3, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(127,224,255,.5)'; ctx.beginPath(); ctx.arc(cx, cy, 8, 0, Math.PI * 2); ctx.stroke();
  }
  function revealed(it, cx, cy, sweepA) {
    if (sweepA === 99) return true;
    const q = proj(it.lat, it.lon); let a = Math.atan2(q[1] - cy, q[0] - cx); if (a < -Math.PI / 2) a += Math.PI * 2;
    return a <= sweepA;
  }
  function ringsAndSweep(cx, cy, R, now, sp) {
    ctx.strokeStyle = 'rgba(127,224,255,.14)'; ctx.lineWidth = 1;
    for (let k = 1; k <= 4; k++) { ctx.beginPath(); ctx.arc(cx, cy, R * k / 4, 0, Math.PI * 2); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(cx - R, cy); ctx.lineTo(cx + R, cy); ctx.moveTo(cx, cy - R); ctx.lineTo(cx, cy + R); ctx.strokeStyle = 'rgba(127,224,255,.07)'; ctx.stroke();
    if (data) {
      ctx.font = '600 11px "Instrument Sans", system-ui, sans-serif'; ctx.fillStyle = 'rgba(147,160,186,.8)';
      const km = data.radius / 1000;
      ctx.fillText((km < 1 ? Math.round(data.radius) + ' m' : String(+km.toFixed(1)).replace('.', ',') + ' km'), cx + R * .71 + 6, cy - R * .71 - 6);
    }
    if (reduce) return;
    const a = sp < 1 ? -Math.PI / 2 + sp * Math.PI * 2 : now * .9;
    if (ctx.createConicGradient) {
      const g = ctx.createConicGradient(a - Math.PI * .5, cx, cy);
      g.addColorStop(0, 'rgba(127,224,255,0)'); g.addColorStop(.23, 'rgba(127,224,255,0)'); g.addColorStop(.25, sp < 1 ? 'rgba(255,178,62,.28)' : 'rgba(127,224,255,.16)'); g.addColorStop(.2501, 'rgba(127,224,255,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();
    }
    ctx.strokeStyle = sp < 1 ? 'rgba(255,178,62,.8)' : 'rgba(127,224,255,.45)'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); ctx.stroke();
  }
  function label(txt, x, y) {
    ctx.font = '650 13px "Instrument Sans", system-ui, sans-serif';
    const w = ctx.measureText(txt).width + 16, lx = Math.min(W - w - 6, Math.max(6, x + 14)), ly = Math.max(6, y - 32);
    ctx.fillStyle = 'rgba(10,16,29,.94)'; ctx.fillRect(lx, ly, w, 24);
    ctx.fillStyle = AMBER; ctx.fillRect(lx, ly, w, 2);
    ctx.fillStyle = '#f1ece2'; ctx.fillText(txt, lx + 8, ly + 16.5);
  }

  function hit(x, y) {
    if (!data) return null;
    let best = null, bd = 16 * 16;
    for (const it of items) {
      if (!filter(it)) continue;
      const q = proj(it.lat, it.lon), d = (q[0] - x) ** 2 + (q[1] - y) ** 2;
      const w = isTarget(it) ? d * .6 : d;
      if (w < bd) { bd = w; best = it; }
    }
    return best;
  }
  const local = e => { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  function zoomAt(f, x, y) {
    if (!data) return;
    const ns = Math.max(Math.min(W, H) * .2 / data.radius, Math.min(scale * f, 3));
    const k = ns / scale; ox = (ox + W / 2 - x) * k - W / 2 + x; oy = (oy + H / 2 - y) * k - H / 2 + y; scale = ns; viewT = performance.now(); kick();
  }
  canvas.addEventListener('pointerdown', e => {
    canvas.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, local(e)); moved = 0;
    if (ptrs.size === 1) drag = { x: e.clientX, y: e.clientY, ox, oy };
    if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), s: scale }; drag = null; }
  });
  canvas.addEventListener('pointermove', e => {
    const p = local(e);
    if (ptrs.has(e.pointerId)) ptrs.set(e.pointerId, p);
    if (pinch && ptrs.size === 2) {
      const [a, b] = [...ptrs.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      zoomAt(pinch.s * d / pinch.d / scale, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2); moved = 99; return;
    }
    if (drag) {
      moved = Math.max(moved, Math.hypot(e.clientX - drag.x, e.clientY - drag.y));
      if (moved > 4) { ox = drag.ox + e.clientX - drag.x; oy = drag.oy + e.clientY - drag.y; viewT = performance.now(); kick(); canvas.style.cursor = 'grabbing'; }
      return;
    }
    if (e.pointerType === 'mouse') {
      const it = hit(p[0], p[1]), id = it ? it.id : null;
      if (id !== hov) { hov = id; canvas.style.cursor = id ? 'pointer' : 'grab'; opt.onHover && opt.onHover(id); kick(); }
    }
  });
  const up = e => {
    const p = local(e); ptrs.delete(e.pointerId);
    if (ptrs.size < 2) pinch = null;
    if (drag && moved <= 4) { const it = hit(p[0], p[1]); if (it) { sel = it.id; kick(); opt.onPick && opt.onPick(it.id); } }
    drag = null; canvas.style.cursor = hov ? 'pointer' : 'grab';
  };
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('pointerleave', () => { if (hov) { hov = null; opt.onHover && opt.onHover(null); kick(); } });
  canvas.addEventListener('wheel', e => { if (!data) return; e.preventDefault(); const p = local(e); zoomAt(Math.exp(-e.deltaY * .0016), p[0], p[1]); }, { passive: false });
  canvas.style.cursor = 'grab'; canvas.style.touchAction = 'none';

  size();
  return {
    setData(d, animate) {
      data = d; items = d ? d.items : [];
      if (d) { const la = d.center.lat * Math.PI / 180; kx = 111320 * Math.cos(la); ky = 110540; }
      roadsCache = null; sel = hov = null; fit();
      scanT0 = animate && !reduce ? performance.now() / 1000 : -1; kick();
    },
    setFilter(f) { filter = f || (() => true); kick(); },
    hover(id) { hov = id; kick(); },
    select(id) {
      sel = id; const it = id && items.find(x => x.id === id);
      if (it && data) { const q = proj(it.lat, it.lon); if (q[0] < 30 || q[0] > W - 30 || q[1] < 30 || q[1] > H - 30) { ox += W / 2 - q[0]; oy += H / 2 - q[1]; viewT = performance.now(); } }
      kick();
    },
    zoom(f) { zoomAt(f, W / 2, H / 2); },
    fit, kick,
    idle() { kick(); },
    destroy() { running = false; if (raf) cancelAnimationFrame(raf); ro.disconnect(); }
  };
}
