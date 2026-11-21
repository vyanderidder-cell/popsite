/* Devanture — la page autour de la 3D : mesures de défilement, compteur, étiquettes, formulaires. */
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const docTop = el => el ? el.getBoundingClientRect().top + scrollY : 0;

export function initPage() {
  const K = { spot: 900, popIn: 1800, popStart: 1900, popEnd: 3600, popOut: 3800, over: 4400, over2: 6000, final: 8000 };
  const scrim = $('#scrim');
  function measure() {
    const vh = innerHeight, ap = $('#repere'), pop = $('#pop'), pitch = $('#pitch'), faq = $('#questions'), fin = $('#essai');
    const maxS = Math.max(1, document.documentElement.scrollHeight - vh);
    K.spot = docTop(ap) + Math.max(0, ap.offsetHeight - vh) * 0.35;
    K.popIn = docTop(pop) - vh * 0.1;
    K.popStart = docTop(pop) + vh * 0.05;
    K.popEnd = docTop(pop) + Math.max(vh, pop.offsetHeight - vh) * 0.8;
    K.popOut = docTop(pop) + Math.max(0, pop.offsetHeight - vh);
    K.over = docTop(pitch) + vh * 0.2;
    K.over2 = docTop(faq);
    K.final = Math.min(maxS, docTop(fin));
  }
  addEventListener('load', measure);
  if (document.fonts) document.fonts.ready.then(measure);

  /* compteur du héros et relevé du radar */
  const cEl = $('#count'), nNone = $('#n-none'), nAll = $('#n-all');
  let shown = 0;
  function setCount(n, all, instant) {
    shown = n; if (cEl) cEl.textContent = n; if (nNone) nNone.textContent = n; if (nAll && all) nAll.textContent = all;
    if (!instant && cEl) { cEl.classList.remove('tick'); void cEl.offsetWidth; cEl.classList.add('tick'); }
  }
  setCount(0);

  /* étiquettes posées sur les commerces trouvés */
  const lab = $('#labels'), tags = [];
  function found(n, s) {
    setCount(n, window.__dvShops || 0);
    if (!lab || tags.length >= 7 || !s.b.name || innerWidth < 900) return;
    const el = document.createElement('div'); el.className = 'tag';
    el.innerHTML = `<i></i><span><b>${s.b.name}</b><small>${s.b.cat} · aucun site</small></span>`;
    lab.appendChild(el);
    tags.push({ el, wp: { x: s.b.x, y: s.b.h + s.b.d * 0.45 + 1.2, z: s.b.z }, born: performance.now() });
  }
  const out = {};
  function labels(project, y) {
    if (!tags.length) return;
    const fade = 1 - clamp((y - innerHeight * 0.25) / (innerHeight * 0.35), 0, 1);
    lab.style.opacity = fade;
    if (fade <= 0) return;
    // au plus trois étiquettes, bien espacées, jamais sous le texte du héros
    const placed = [], W = innerWidth, H = innerHeight;
    for (const t of tags) {
      project(t.vec || (t.vec = toV3(t.wp)), out);
      let ok = out.vis && performance.now() - t.born > 200 && out.x > W * 0.5 && out.x < W - 230 && out.y > 150 && out.y < H - 200 && placed.length < 3;
      if (ok) for (const p of placed) if (Math.abs(p.x - out.x) < 220 && Math.abs(p.y - out.y) < 90) { ok = false; break; }
      if (ok) placed.push({ x: out.x, y: out.y });
      t.el.style.transform = `translate3d(${out.x.toFixed(1)}px,${out.y.toFixed(1)}px,0)`;
      t.el.classList.toggle('on', ok);
    }
  }
  let toV3 = p => p;
  function setV3(ctor) { toV3 = p => new ctor(p.x, p.y, p.z); }

  /* choix du style de la maquette */
  const chips = $$('#styles button'); let styleCb = () => { };
  chips.forEach(b => b.addEventListener('click', () => setStyle(b.dataset.style)));
  function setStyle(s) { chips.forEach(x => x.setAttribute('aria-pressed', x.dataset.style === s ? 'true' : 'false')); styleCb(s); }

  /* progression de la maquette : l'adresse se tape */
  const url = $('#pop-url'), URL = 'garage-perrin.fr';
  let lastN = -1;
  function popProgress(p) {
    if (!url) return; const n = Math.round(clamp(p / 0.25, 0, 1) * URL.length);
    if (n !== lastN) { lastN = n; url.textContent = URL.slice(0, n) || ' '; }
  }

  /* voile de lisibilité : plus dense quand on lit du texte par-dessus la ville */
  function onScroll() {
    if (!scrim) return; const y = scrollY, vh = innerHeight;
    const a = clamp((y - (K.popOut - vh * 0.2)) / (vh * 0.6), 0, 1) * (1 - clamp((y - (K.final - vh * 0.9)) / (vh * 0.7), 0, 1) * 0.75);
    scrim.style.opacity = (a * 0.82).toFixed(3);
    document.body.classList.toggle('scrolled', y > 40);
  }
  addEventListener('scroll', onScroll, { passive: true }); onScroll();

  /* apparition orchestrée du héros */
  function reveal() { document.body.classList.add('ready'); measure(); onScroll(); }

  /* formulaires : lancent le vrai radar de l'appli */
  function scanFrom(input, msg) {
    const v = input.value.trim();
    if (!v) { if (msg) msg.textContent = 'Écris une ville ou un code postal pour lancer le radar.'; input.focus(); return; }
    if (msg) msg.textContent = '';
    if (window.PopApp) window.PopApp.scan(v); else location.hash = 'radar';
  }
  $$('form[data-scan]').forEach(f => f.addEventListener('submit', e => { e.preventDefault(); scanFrom(f.querySelector('input'), f.parentElement.querySelector('.scan-msg')); }));

  /* aperçu de l'outil : onglets */
  const tabs = $$('.tool .tab');
  function pick(tb, focus) { tabs.forEach(x => { const on = x === tb; x.setAttribute('aria-selected', on ? 'true' : 'false'); x.tabIndex = on ? 0 : -1; document.getElementById(x.getAttribute('aria-controls')).hidden = !on; }); if (focus) tb.focus(); }
  tabs.forEach((tb, n) => { tb.addEventListener('click', () => pick(tb)); tb.addEventListener('keydown', e => { if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); pick(tabs[(n + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length], true); } }); });

  /* copier le prompt */
  const cp = $('#copy');
  if (cp) cp.addEventListener('click', () => {
    const txt = $('#prompt-text').textContent;
    const ok = () => { cp.textContent = 'Copié'; setTimeout(() => { cp.textContent = 'Copier le prompt'; }, 1800); };
    try { navigator.clipboard.writeText(txt).then(ok, () => { cp.textContent = 'Sélectionne le texte'; }); } catch (e) { cp.textContent = 'Sélectionne le texte'; }
  });

  /* liens d'ancre : défilement doux, focus déplacé */
  document.addEventListener('click', e => {
    const a = e.target.closest && e.target.closest('a[href^="#"]'); if (!a) return;
    const id = a.getAttribute('href').slice(1); const el = id === 'top' ? document.body : document.getElementById(id);
    if (!el || el.closest('#app')) return;
    if (!document.querySelector('main').contains(el) && id !== 'top') return;
    e.preventDefault();
    const y = id === 'top' ? 0 : id === 'pop' ? K.popEnd : docTop(el);
    scrollTo({ top: y, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    if (id !== 'top') { if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1'); el.focus({ preventScroll: true }); }
  });

  return { measure, keys: () => K, setCount, found, labels, setV3, onStyle: cb => { styleCb = cb; }, setStyle, popProgress, reveal };
}
