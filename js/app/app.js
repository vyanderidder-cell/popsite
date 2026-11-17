/* PopSite — l'appli : routeur, état local, toutes les pages */
import { GROUPS, GROUP_LABEL, kindInfo } from './data.js';
import { geocode, scan as runScan, NET, phoneOf, emailOf, socialOf, safeUrl } from './osm.js';
import { buildMockup, parseHours, STYLES, esc as E, slug, DAYS_FR } from './mockup.js';
import { prospect, buildPrompt } from './texts.js';
import { createRadar } from './radar.js';
import { shareUrl, siteBase, qrSvg } from './share.js';

const ROOT = document.getElementById('app');
const ROUTES = ['radar', 'suivi', 'tarifs', 'aide', 'connexion', 'inscription', 'compte', 'mentions', 'exemples', 'gestion'];
const isAppRoute = h => ROUTES.includes(h) || /^fiche-[a-z]\d+$/.test(h);
const route = () => { try { return decodeURIComponent(location.hash.slice(1)); } catch (e) { return ''; } };
window.__appOpen = isAppRoute(route());

/* ---------------- état (sur cet appareil) ---------------- */
const KEY = 'popsite:v1', RKEY = 'popsite:roads';
const DEF = { v: 1, user: null, auth: false, plan: 'free', trialUntil: 0, trialUsed: false, usage: { m: '', scans: 0, maq: 0 }, scan: null, leads: {}, prefs: { radius: 2000, price: { creation: 350, mensuel: 15 }, channel: 'boutique', tool: 'claude' } };
let S = load(), ROADS = null;
function load() {
  try {
    const j = JSON.parse(localStorage.getItem(KEY));
    if (j && j.v === 1) return { ...DEF, ...j, usage: { ...DEF.usage, ...(j.usage || {}) }, prefs: { ...DEF.prefs, ...(j.prefs || {}), price: { ...DEF.prefs.price, ...((j.prefs || {}).price || {}) } }, leads: j.leads || {} };
  } catch (e) { }
  return JSON.parse(JSON.stringify(DEF));
}
let saveT = 0;
function save(now) {
  clearTimeout(saveT);
  const go = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { } };
  if (now) go(); else saveT = setTimeout(go, 300);
}
function saveRoads(r) { ROADS = r; try { localStorage.setItem(RKEY, JSON.stringify(r.map(x => ({ c: x.c, p: x.p.map(p => [+p[0].toFixed(5), +p[1].toFixed(5)]) })))); } catch (e) { try { localStorage.removeItem(RKEY); } catch (e2) { } } }
function loadRoads() { if (ROADS) return ROADS; try { ROADS = JSON.parse(localStorage.getItem(RKEY)) || []; } catch (e) { ROADS = []; } return ROADS; }

const LIM = { free: { scans: 1, maq: 1, list: 3 }, pro: { scans: 60, maq: 100, list: Infinity } };
const isPro = () => S.plan === 'pro' || S.trialUntil > Date.now();
const lim = () => LIM[isPro() ? 'pro' : 'free'];
const logged = () => !!(S.user && S.auth);
function usage() { const m = new Date().toISOString().slice(0, 7); if (S.usage.m !== m) S.usage = { m, scans: 0, maq: 0 }; return S.usage; }

const STATUS = [['a_montrer', 'À montrer'], ['montree', 'Montrée'], ['a_relancer', 'À relancer'], ['vendue', 'Vendue'], ['refus', 'Pas intéressé']];
const ST_LABEL = Object.fromEntries([...STATUS, ['a_un_site', 'A déjà un site']]);

/* ---------------- utilitaires ---------------- */
const $ = (s, el = ROOT) => el.querySelector(s);
const $$ = (s, el = ROOT) => [...el.querySelectorAll(s)];
const dist = d => d < 1000 ? Math.round(d / 10) * 10 + ' m' : String(+(d / 1000).toFixed(1)).replace('.', ',') + ' km';
const eur = n => (Math.round(+n || 0)).toLocaleString('fr-FR') + ' €';
const pot = n => `<span class="ap-pot" title="Potentiel ${n}/3" aria-label="Potentiel ${n} sur 3">${[1, 2, 3].map(i => `<i class="${i <= n ? 'on' : ''}"></i>`).join('')}</span>`;
const webBadge = w => w === 'social' ? '<span class="ap-badge social">Réseaux seulement</span>' : w === 'none' ? '<span class="ap-badge none">Aucun site</span>' : w === 'brand' ? '<span class="ap-badge site">Enseigne</span>' : '<span class="ap-badge site">A un site</span>';
const ago = t => { const s = (Date.now() - t) / 1000; return s < 60 ? 'à l\'instant' : s < 3600 ? 'il y a ' + Math.round(s / 60) + ' min' : s < 86400 ? 'il y a ' + Math.round(s / 3600) + ' h' : 'il y a ' + Math.round(s / 86400) + ' j'; };
const isTarget = it => it.web === 'none' || it.web === 'social';

const ONLINE = !window.claude && /^https?:$/.test(location.protocol) && !/^(localhost|127\.)/.test(location.hostname);
function sendLead(d) { if (!ONLINE) return; try { fetch('/api/inscription', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d), keepalive: true }).catch(() => { }); } catch (e) { } }
if (ONLINE) { const va = document.createElement('script'); va.defer = true; va.src = '/_vercel/insights/script.js'; document.head.appendChild(va); }
const today = () => new Date().toISOString().slice(0, 10);
const plusDays = n => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
const frDate = d => d ? new Date(d + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' }) : '';
const dues = () => Object.values(S.leads).filter(l => ['montree', 'a_relancer'].includes(l.status) && l.next && l.next <= today());
let toastT = 0;
function toast(msg) { const t = $('.ap-toast'); if (!t) return; t.textContent = msg; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 2400); }
async function copy(text, okMsg) {
  try { await navigator.clipboard.writeText(text); toast(okMsg || 'Copié'); return true; }
  catch (e) {
    const ta = document.createElement('textarea'); ta.value = text; ta.style.cssText = 'position:fixed;opacity:0;top:0'; document.body.appendChild(ta); ta.select();
    let ok = false; try { ok = document.execCommand('copy'); } catch (e2) { }
    ta.remove(); toast(ok ? (okMsg || 'Copié') : 'Copie refusée : sélectionne le texte à la main'); return ok;
  }
}
let DL = null;
if (window.claude && window.claude.use) window.claude.use('downloads').then(d => { DL = d; if (d) document.querySelectorAll('[data-dl]').forEach(b => { b.hidden = false; }); }).catch(() => { });
const canDownload = () => !window.claude || !!DL;
async function download(name, text, type) {
  if (DL) { try { await DL.save({ filename: name, data: text }); return true; } catch (e) { toast('Téléchargement annulé'); return false; } }
  try {
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: type || (/\.csv$/.test(name) ? 'text/csv;charset=utf-8' : 'text/html;charset=utf-8') })); a.download = name;
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500); return true;
  } catch (e) { toast('Téléchargement impossible ici : utilise « Copier le HTML »'); return false; }
}
function modal(html, bind) {
  const m = document.createElement('div'); m.className = 'ap-modal'; m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true');
  m.innerHTML = `<div>${html}</div>`; ROOT.appendChild(m);
  const close = () => { m.remove(); document.removeEventListener('keydown', esc); };
  const esc = e => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', esc);
  m.addEventListener('click', e => { if (e.target === m || e.target.closest('[data-close]')) close(); });
  const f = m.querySelector('button,a,input'); if (f) f.focus();
  bind && bind(m, close);
  return close;
}
function needAccount(why) {
  modal(`<p class="eyebrow">Compte gratuit</p><h2>${E(why)}</h2><p>Ton compte garde tes commerces, tes maquettes et ton suivi. Ça prend vingt secondes.</p>
  <div class="ap-row"><a class="btn" href="#inscription" data-close>Créer mon compte</a><a class="btn ghost" href="#connexion" data-close>J'ai déjà un compte</a></div>`);
  try { sessionStorage.setItem('popsite:ret', route()); } catch (e) { }
}
function paywall(kind) {
  const txt = { scans: ['Ton scan gratuit est utilisé.', 'Avec Pro, tu lances 60 scans par mois, sur toutes les villes que tu veux.'], maq: ['Ta maquette gratuite est faite.', 'Avec Pro, tu fais popper 100 maquettes par mois, dans les 3 styles.'], list: ['Ce commerce est réservé à Pro.', 'La version gratuite montre les 3 meilleurs commerces de chaque scan. Pro les débloque tous.'] }[kind];
  modal(`<p class="eyebrow">PopSite Pro · 14,99 € par mois</p><h2>${txt[0]}</h2><p>${txt[1]}</p>
  <div class="ap-row">${S.trialUsed ? '' : '<button class="btn" type="button" data-trial>Essayer Pro 7 jours</button>'}<a class="btn ${S.trialUsed ? '' : 'ghost'}" href="#tarifs" data-close>Voir les tarifs</a></div>`,
    (m, close) => { const b = m.querySelector('[data-trial]'); if (b) b.onclick = () => { close(); startTrial(); }; });
}
function startTrial() {
  if (!logged()) { needAccount('Crée ton compte pour lancer l\'essai.'); return; }
  if (S.trialUsed) { toast('Ton essai a déjà été utilisé'); return; }
  S.trialUsed = true; S.trialUntil = Date.now() + 7 * 864e5; save(true); paintTop(); toast('Pro activé pour 7 jours'); render(route());
}
function payModal() {
  modal(`<p class="eyebrow">Passer Pro</p><h2>Le paiement en ligne arrive très vite.</h2><p>On branche le paiement sécurisé dans les prochains jours. Laisse ton e-mail : tu seras prévenu en premier${S.trialUsed ? '' : ', et en attendant tu peux tester Pro gratuitement pendant 7 jours'}.</p>
  <form class="ap-row" id="pm-f" novalidate><input class="ap-input" style="flex:1 1 200px" type="email" name="email" placeholder="ton@email.fr" value="${E((S.user && S.user.email) || '')}" aria-label="Ton e-mail"><button class="btn" type="submit">Préviens-moi</button></form>
  <p class="au-err" id="pm-err" role="alert"></p>
  <div class="ap-row">${S.trialUsed ? '<a class="btn ghost" href="#compte" data-close>Aller à mon compte</a>' : '<button class="btn ghost" type="button" data-trial>Essayer Pro 7 jours</button>'}<button class="ap-link" type="button" data-close>Fermer</button></div>`,
    (m, close) => {
      const b = m.querySelector('[data-trial]'); if (b) b.onclick = () => { close(); startTrial(); };
      m.querySelector('#pm-f').addEventListener('submit', e => { e.preventDefault(); const em = String(new FormData(e.target).get('email') || '').trim().toLowerCase(); if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) { m.querySelector('#pm-err').textContent = 'Cette adresse n\'a pas l\'air valide.'; return; } sendLead({ email: em, prenom: (S.user && S.user.prenom) || '', source: 'pro' }); S.proWait = em; save(true); close(); toast('C\'est noté, tu seras prévenu'); });
    });
}

/* ---------------- coquille ---------------- */
ROOT.innerHTML = `
<header class="ap-top">
  <button class="mark" type="button" data-act="home" aria-label="Retour à l'accueil PopSite"><i aria-hidden="true"></i>PopSite</button>
  <nav class="ap-nav" aria-label="Appli"><a href="#radar" data-r="radar">Radar</a><a href="#suivi" data-r="suivi">Mes commerces</a><a href="#aide" data-r="aide">Aide</a><a href="#tarifs" data-r="tarifs">Tarifs</a></nav>
  <a class="ap-plan" id="ap-plan" href="#tarifs">Gratuit</a>
  <span id="ap-me"></span>
</header>
<main id="ap-view"></main>
<footer class="ap-foot"><span>PopSite</span><a href="#exemples">Exemples</a><a href="#aide">Aide</a><a href="#tarifs">Tarifs</a><a href="#mentions">Mentions légales</a><span>Données © contributeurs OpenStreetMap</span></footer>
<nav class="ap-tabbar" aria-label="Appli"><a href="#radar" data-r="radar"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4.5"/><path d="M12 12l6-6"/></svg>Radar</a><a href="#suivi" data-r="suivi"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9h16l-1.5-4h-13z"/><path d="M5 9v10h14V9"/><path d="M10 19v-5h4v5"/></svg>Commerces</a><a href="#aide" data-r="aide"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M9.6 9.3a2.5 2.5 0 1 1 3.4 2.3c-.6.3-1 .8-1 1.5v.4"/><path d="M12 16.6v.1"/></svg>Aide</a><a href="#compte" data-r="compte"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8.5" r="3.5"/><path d="M5 20c1-3.6 3.7-5.3 7-5.3s6 1.7 7 5.3"/></svg>Compte</a></nav>
<div class="ap-toast" role="status" aria-live="polite"></div>`;
const VIEW = $('#ap-view');
function paintTop() {
  const p = $('#ap-plan'), pro = isPro();
  p.textContent = pro ? (S.plan === 'pro' ? 'Pro' : 'Essai Pro') : 'Gratuit'; p.classList.toggle('pro', pro); p.href = pro ? '#compte' : '#tarifs';
  const nd = logged() ? dues().length : 0;
  $$('[data-r="suivi"]').forEach(a => { let b = a.querySelector('.ap-dot'); if (nd) { if (!b) { b = document.createElement('b'); b.className = 'ap-dot'; a.appendChild(b); } b.textContent = nd; b.title = nd + ' relance(s) aujourd\'hui'; } else if (b) b.remove(); });
  $('#ap-me').innerHTML = logged() ? `<a class="ap-me" href="#compte" aria-label="Mon compte">${E((S.user.prenom || '?').charAt(0).toUpperCase())}</a>` : '<a class="btn ghost small" href="#connexion">Connexion</a>';
}
ROOT.addEventListener('click', e => {
  const h = e.target.closest('[data-act="home"]');
  if (h) { e.preventDefault(); location.hash = 'top'; }
});

/* ---------------- routeur ---------------- */
let cleanup = null, cur = '';
function render(r) {
  if (cleanup) { cleanup(); cleanup = null; }
  const base = r.startsWith('fiche-') ? 'fiche' : r;
  $$('[data-r]').forEach(a => { const on = a.dataset.r === base || (base === 'fiche' && a.dataset.r === 'radar') || (base === 'connexion' && a.dataset.r === 'compte'); if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  const changed = r !== cur;
  if (changed) ROOT.scrollTop = 0;
  cur = r; paintTop();
  if (base === 'radar') vRadar();
  else if (base === 'fiche') vFiche(r.slice(6));
  else if (base === 'suivi') vSuivi();
  else if (base === 'tarifs') vTarifs();
  else if (base === 'aide') vAide();
  else if (base === 'connexion' || base === 'inscription') vAuth(base);
  else if (base === 'compte') vCompte();
  else if (base === 'mentions') vMentions();
  else if (base === 'exemples') vExemples();
  else if (base === 'gestion') vGestion();
  if (changed && !pendingQ) { const h = VIEW.querySelector('h1'); if (h) { h.tabIndex = -1; try { h.focus({ preventScroll: true }); } catch (e) { } } }
  document.title = ({ radar: 'Radar', fiche: 'Fiche commerce', suivi: 'Mes commerces', tarifs: 'Tarifs', aide: 'Aide', connexion: 'Connexion', inscription: 'Inscription', compte: 'Mon compte', mentions: 'Mentions légales', exemples: 'Exemples de maquettes', gestion: 'Gestion' }[base] || 'PopSite') + ' · PopSite';
}
function openApp(r) {
  if (!ROOT.classList.contains('on')) { ROOT.classList.add('on'); document.body.classList.add('app-open'); window.__appOpen = true; }
  render(r);
}
function closeApp(r) {
  if (!ROOT.classList.contains('on')) return;
  if (cleanup) { cleanup(); cleanup = null; }
  cur = ''; ROOT.classList.remove('on'); document.body.classList.remove('app-open'); window.__appOpen = false;
  document.title = 'PopSite · Le radar à commerces sans site';
  window.dispatchEvent(new Event('popsite:landing'));
  if (r === 'top' || !r) window.scrollTo(0, 0);
  else { const el = document.getElementById(r); if (el) requestAnimationFrame(() => el.scrollIntoView()); }
}
function onRoute() { const r = route(); if (isAppRoute(r)) openApp(r); else closeApp(r); }
window.addEventListener('hashchange', onRoute);
const go = r => { if (route() === r) render(r); else location.hash = r; };

/* ================= RADAR ================= */
let pendingQ = null;
const RS = { place: null, sugg: [], si: -1, busy: false, step: 0, err: '', group: 'all', showSite: false, sort: 'pot' };
function scanLabel() { return S.scan ? S.scan.label : ''; }
function applyLocks() {
  if (!S.scan) return;
  const L = lim().list; let n = 0;
  for (const it of S.scan.items) { if (isTarget(it)) { it.locked = n >= L; n++; } else it.locked = false; }
}
function vRadar() {
  if (![500, 1000, 2000, 3000, 5000].includes(S.prefs.radius)) S.prefs.radius = 2000;
  const R = S.prefs.radius;
  VIEW.innerHTML = `<div class="rd">
  <aside class="rd-side">
    <div class="rd-search">
      <p class="eyebrow">Radar</p>
      <h1 class="ap-h1">Où on cherche ?</h1>
      ${NET.blocked ? '<p class="ap-beta"><b>Aperçu :</b> ici, la page ne peut pas joindre OpenStreetMap, alors tu vois le village de démo. Une fois PopSite en ligne, le radar scanne ta vraie ville.</p>' : ''}
      <form id="rd-form" novalidate>
        <div class="rd-where">
          <label class="ap-field" for="rd-q">Ville ou code postal</label>
          <input id="rd-q" class="ap-input" style="margin-top:7px" autocomplete="off" spellcheck="false" role="combobox" aria-expanded="false" aria-controls="rd-sugg" aria-autocomplete="list" placeholder="Ex. 71460 ou Cluny" value="${E(pendingQ != null ? pendingQ : scanLabel())}">
          <ul id="rd-sugg" class="rd-sugg" role="listbox" aria-label="Villes" hidden></ul>
        </div>
        <div class="ap-field" style="margin-top:14px">Rayon
          <div class="ap-seg" id="rd-r" role="group" aria-label="Rayon">${[500, 1000, 2000, 3000, 5000].map(v => `<button type="button" data-v="${v}" aria-pressed="${v === R}">${dist(v)}</button>`).join('')}</div>
        </div>
        <div class="rd-go" style="margin-top:16px"><button class="btn" type="submit" id="rd-go">Lancer le radar</button></div>
        <p class="rd-quota" id="rd-quota" style="margin-top:12px"></p>
        <p class="au-err" id="rd-err" role="alert"></p>
      </form>
    </div>
    <div class="rd-res" id="rd-res"></div>
  </aside>
  <div class="rd-map">
    <canvas id="rd-cv" aria-label="Carte radar : chaque point ambre est un commerce sans site"></canvas>
    <div class="rd-hud"><span id="rd-place">${E(scanLabel() || 'Radar en attente')}</span><span class="amb" id="rd-hudn"></span></div>
    <div class="rd-zoom"><button type="button" data-z="1.5" aria-label="Zoomer">+</button><button type="button" data-z="0.66" aria-label="Dézoomer">−</button><button type="button" data-z="fit" aria-label="Recentrer">◎</button></div>
    <div class="rd-legend"><span><i style="background:var(--amber)"></i>Sans site</span><span><i style="background:#93a0ba"></i>Avec site</span></div>
    <div class="rd-attr">© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a></div>
  </div></div>`;
  const radar = createRadar($('#rd-cv'), {
    onPick: id => { const it = S.scan && S.scan.items.find(x => x.id === id); if (!it) return; if (it.locked) paywall('list'); else go('fiche-' + id); },
    onHover: id => { $$('.rd-item').forEach(li => li.classList.toggle('hl', li.dataset.id === id)); }
  });
  cleanup = () => radar.destroy();
  const q = $('#rd-q'), sug = $('#rd-sugg');
  if (S.scan) { applyLocks(); radar.setData({ center: S.scan.center, radius: S.scan.radius, items: S.scan.items, roads: loadRoads() }, false); RS.place = { label: S.scan.label, lat: S.scan.center.lat, lon: S.scan.center.lon, demo: S.scan.demo }; }
  radar.setFilter(filterFn());
  paintQuota(); paintRes(radar);

  $('#rd-r').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; S.prefs.radius = +b.dataset.v; save(); $$('#rd-r button').forEach(x => x.setAttribute('aria-pressed', x === b)); });
  $('.rd-zoom').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; if (b.dataset.z === 'fit') radar.fit(); else radar.zoom(+b.dataset.z); });
  let gt = 0, gq = 0;
  const showSugg = () => {
    sug.innerHTML = RS.sugg.map((p, i) => `<li role="option" id="sg${i}" aria-selected="${i === RS.si}" data-i="${i}"><span>${E(p.label)}</span><small>${E(p.sub || '')}</small></li>`).join('');
    sug.hidden = !RS.sugg.length; q.setAttribute('aria-expanded', RS.sugg.length ? 'true' : 'false');
    if (RS.si >= 0) q.setAttribute('aria-activedescendant', 'sg' + RS.si); else q.removeAttribute('aria-activedescendant');
  };
  q.addEventListener('input', () => {
    RS.place = null; clearTimeout(gt); const v = q.value.trim();
    if (v.length < 2) { RS.sugg = []; showSugg(); return; }
    gt = setTimeout(async () => { const my = ++gq; try { const r = await geocode(v, true); if (my === gq) { RS.sugg = r; RS.si = -1; showSugg(); } } catch (e) { } }, 260);
  });
  q.addEventListener('keydown', e => {
    if (!RS.sugg.length || sug.hidden) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); RS.si = (RS.si + (e.key === 'ArrowDown' ? 1 : RS.sugg.length - 1) + (RS.si < 0 && e.key === 'ArrowUp' ? 1 : 0)) % RS.sugg.length; showSugg(); }
    else if (e.key === 'Enter' && RS.si >= 0) { e.preventDefault(); pick(RS.si); }
    else if (e.key === 'Escape') { RS.sugg = []; showSugg(); }
  });
  const pick = i => { RS.place = RS.sugg[i]; q.value = RS.place.label; RS.sugg = []; showSugg(); };
  sug.addEventListener('mousedown', e => { const li = e.target.closest('li'); if (li) { e.preventDefault(); pick(+li.dataset.i); } });
  q.addEventListener('blur', () => setTimeout(() => { RS.sugg = []; showSugg(); }, 120));
  $('#rd-form').addEventListener('submit', async e => { e.preventDefault(); await doScan(radar); });

  $('#rd-res').addEventListener('click', e => {
    const c = e.target.closest('[data-g]'); if (c) { RS.group = c.dataset.g; radar.setFilter(filterFn()); paintRes(radar); return; }
    const lk = e.target.closest('[data-lock]'); if (lk) { paywall('list'); return; }
  });
  $('#rd-res').addEventListener('change', e => {
    if (e.target.id === 'rd-site') { RS.showSite = e.target.checked; radar.setFilter(filterFn()); paintRes(radar); }
    if (e.target.id === 'rd-sort') { RS.sort = e.target.value; paintRes(radar); }
  });
  $('#rd-res').addEventListener('mouseover', e => { const li = e.target.closest('.rd-item'); radar.hover(li ? li.dataset.id : null); });
  if (pendingQ) { const v = pendingQ; pendingQ = null; q.value = v; if (v) doScan(radar); }
}
function filterFn() { return it => (RS.group === 'all' || kindInfo(it.kind).g === RS.group) && (RS.showSite || isTarget(it)); }
function paintQuota() {
  const el = $('#rd-quota'); if (!el) return;
  const u = usage(), l = lim(), left = Math.max(0, l.scans - u.scans);
  el.innerHTML = NET.blocked ? 'Village de démo · les scans de démo ne sont pas décomptés' : isPro() ? `Pro · <b>${left}</b> scans restants ce mois-ci` : `Gratuit · <b>${left}</b> scan restant ce mois-ci · <a class="ap-link" href="#tarifs">Pro</a>`;
}
async function doScan(radar) {
  const q = $('#rd-q'), err = $('#rd-err'), v = q.value.trim(); err.textContent = '';
  if (!v) { err.textContent = 'Écris une ville ou un code postal.'; q.focus(); return; }
  if (RS.busy) return;
  RS.busy = true; RS.step = 0; RS.err = ''; paintRes(radar); $('#rd-go').disabled = true;
  try {
    let place = RS.place && RS.place.label === v ? RS.place : null;
    if (!place) { const r = await geocode(v, false); place = r[0]; }
    if (!place) throw new Error('nf');
    if (!place.demo && !NET.blocked) {
      const u = usage(); if (u.scans >= lim().scans) { RS.busy = false; paintRes(radar); $('#rd-go').disabled = false; paywall('scans'); return; }
    }
    RS.step = 1; paintRes(radar);
    const res = await runScan(place, S.prefs.radius, ph => { RS.step = ph === 'pois' ? 1 : 3; paintRes(radar); });
    RS.step = 4;
    S.scan = { label: res.demo ? res.label : place.label, sub: place.sub || '', center: res.center, radius: res.radius, items: res.items, demo: res.demo, at: res.at };
    S.scan.items.forEach(it => { if (!it.city) it.city = res.demo ? 'Saint-Pop' : place.label; const L = S.leads[it.id]; if (L && L.status === 'a_un_site') it.web = 'site'; });
    if (!res.demo && res.items.some(isTarget)) usage().scans++;
    saveRoads(res.roads); save(true);
    RS.place = { ...place, label: S.scan.label }; q.value = S.scan.label; RS.group = 'all';
    applyLocks();
    radar.setData({ center: res.center, radius: res.radius, items: S.scan.items, roads: res.roads }, true);
    radar.setFilter(filterFn());
    const pl = $('#rd-place'); if (pl) pl.textContent = S.scan.label;
    if (window.innerWidth < 860) setTimeout(() => { const h = $('#rd-res'); if (h) ROOT.scrollTo({ top: h.offsetTop - 70, behavior: 'smooth' }); }, 2600);
  } catch (e) {
    RS.err = e.message === 'nf' ? 'Ville introuvable. Essaie avec le code postal.' : e.status === 429 || e.status === 504 || e.name === 'AbortError' ? 'OpenStreetMap est saturé en ce moment. Réessaie dans une minute, ou réduis le rayon.' : 'Le scan n\'a pas abouti. Vérifie ta connexion et réessaie.';
  }
  RS.busy = false; const b = $('#rd-go'); if (b) b.disabled = false;
  paintQuota(); paintRes(radar);
  if (NET.blocked && !$('.rd-search .ap-beta')) { const f = $('#rd-form'); if (f) f.insertAdjacentHTML('beforebegin', '<p class="ap-beta"><b>Aperçu :</b> ici, la page ne peut pas joindre OpenStreetMap, alors tu vois le village de démo. Une fois PopSite en ligne, le radar scanne ta vraie ville.</p>'); }
}
function paintRes(radar) {
  const box = $('#rd-res'); if (!box) return;
  const hud = $('#rd-hudn');
  if (RS.busy) {
    const steps = ['Localisation de la ville', 'Interrogation d\'OpenStreetMap', 'Tri des commerces sans site', 'Tracé des rues'];
    box.innerHTML = `<ol class="rd-steps">${steps.map((s, i) => `<li class="${i < RS.step ? 'done' : i === RS.step ? 'cur' : ''}">${s}</li>`).join('')}</ol>`;
    if (radar) radar.kick();
    return;
  }
  const errHtml = RS.err ? `<div class="rd-intro"><p style="color:#ff8f7a" role="alert">${E(RS.err)}</p></div>` : '';
  if (RS.err && !S.scan) { box.innerHTML = errHtml; return; }
  if (!S.scan) {
    box.innerHTML = `<div class="rd-intro"><p>Tape ta ville, choisis un rayon, et le radar te sort les commerces <b style="color:var(--amber)">sans site</b> autour.</p>
    <ol><li>Les points ambre sont tes cibles.</li><li>Clique un commerce pour faire popper sa maquette.</li><li>Passe le voir avec la maquette sur ton téléphone.</li></ol>
    <p class="fine">Données OpenStreetMap, gratuites et libres.</p></div>`;
    if (hud) hud.innerHTML = '';
    return;
  }
  const sc = S.scan, targets = sc.items.filter(isTarget), f = filterFn();
  const counts = {}; targets.forEach(it => { const g = kindInfo(it.kind).g; counts[g] = (counts[g] || 0) + 1; });
  let list = sc.items.filter(f);
  if (RS.sort === 'dist') list.sort((a, b) => a.dist - b.dist);
  else if (RS.sort === 'nom') list.sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  else list.sort((a, b) => (isTarget(b) - isTarget(a)) || (b.score - a.score) || (a.dist - b.dist));
  const locked = targets.filter(it => it.locked).length;
  if (hud) hud.innerHTML = `<b>${targets.length}</b> sans site · ${sc.items.length} analysés`;
  box.innerHTML = errHtml + `<div class="rd-head">
    <div class="rd-count"><span class="n">${targets.length}</span><span class="t">${targets.length > 1 ? 'commerces' : 'commerce'} sans site<small>sur ${sc.items.length} analysé${sc.items.length > 1 ? 's' : ''} · ${dist(sc.radius)} autour de ${E(sc.label)}</small></span></div>
    <div class="rd-filters" role="group" aria-label="Filtrer par activité"><button class="chip" type="button" data-g="all" aria-pressed="${RS.group === 'all'}">Tous <b>${targets.length}</b></button>${GROUPS.filter(g => counts[g.id]).map(g => `<button class="chip" type="button" data-g="${g.id}" aria-pressed="${RS.group === g.id}">${g.label} <b>${counts[g.id]}</b></button>`).join('')}</div>
    <div class="rd-tools"><label><input type="checkbox" id="rd-site" ${RS.showSite ? 'checked' : ''}> Voir aussi ceux qui ont un site</label>
    <select id="rd-sort" aria-label="Trier"><option value="pot" ${RS.sort === 'pot' ? 'selected' : ''}>Potentiel</option><option value="dist" ${RS.sort === 'dist' ? 'selected' : ''}>Distance</option><option value="nom" ${RS.sort === 'nom' ? 'selected' : ''}>Nom</option></select></div>
  </div>
  ${!sc.items.length ? `<div class="rd-intro"><p>OpenStreetMap ne connaît aucun commerce dans ce rayon. Élargis-le, ou essaie la ville voisine.</p><p class="fine">Ce scan ne t'a pas été décompté.</p></div>` : !targets.length ? `<div class="rd-intro"><p>Tous les commerces trouvés ici déclarent déjà un site. Élargis le rayon ou change de ville.</p><p class="fine">Ce scan ne t'a pas été décompté.</p></div>` : ''}
  ${!targets.length && !RS.showSite ? '' : list.length ? `<ul class="rd-list">${list.map((it, i) => {
    const L = S.leads[it.id], st = L && L.status && L.status !== 'nouveau' ? `<span class="ap-badge ${L.status === 'vendue' ? 'sold' : 'st'}">${ST_LABEL[L.status]}</span>` : webBadge(it.web);
    return `<li class="rd-item${isTarget(it) ? '' : ' site'}${it.locked ? ' locked' : ''}" data-id="${it.id}"><a href="#fiche-${it.id}" ${it.locked ? 'tabindex="-1" aria-hidden="true"' : ''}><span class="ix">${String(i + 1).padStart(2, '0')}</span><strong>${E(it.locked ? it.name.replace(/\S/g, '•') : it.name)}</strong><span class="rt">${st}${isTarget(it) ? pot(it.score) : ''}</span><small>${E(kindInfo(it.kind).label)} · ${dist(it.dist)}</small></a></li>`;
  }).join('')}</ul>` : '<div class="rd-intro"><p>Aucun commerce dans ce filtre.</p></div>'}
  ${locked ? `<div class="rd-lock"><p>Version gratuite : <b>3 commerces visibles</b> sur ${targets.length}. ${locked > 1 ? 'Les ' + locked + ' autres se débloquent' : 'Le dernier se débloque'} avec Pro.</p><div class="ap-row"><button class="btn small" type="button" data-lock>Débloquer</button><a class="ap-link" href="#tarifs">Voir les tarifs</a></div></div>` : ''}`;
}

/* ================= FICHE ================= */
function getLead(id) {
  if (S.leads[id]) return S.leads[id];
  const it = S.scan && S.scan.items.find(x => x.id === id);
  if (!it) return null;
  return { ...it, status: 'nouveau', note: '', f: null, created: Date.now(), updated: Date.now(), place: S.scan.label };
}
function keepLead(L) { L.updated = Date.now(); S.leads[L.id] = L; save(); }
function introFor(L, info) {
  const by = { resto: 'On vous accueille dans une ambiance simple et chaleureuse. Réservez votre table ou passez nous voir.', commerce: 'Des produits choisis avec soin et des conseils de proximité. Passez nous voir en boutique.', beaute: 'Un accueil attentionné et des prestations sur rendez-vous. Réservez votre moment.', artisan: 'Un artisan de proximité pour vos projets, du devis à la finition. Parlons de votre projet.', auto: 'Un service sérieux et des conseils clairs pour votre véhicule. Prenez rendez-vous.', hebergement: 'Un séjour au calme, au cœur de la région. Réservez directement auprès de nous.', sante: 'Horaires, accès et informations pratiques du cabinet.', services: 'Un interlocuteur de proximité qui prend le temps de vous écouter. Prenons rendez-vous.' }[info.g];
  return `${L.name}, ${info.label.toLowerCase()}${L.city ? ' à ' + L.city : ''}. ${by}`;
}
function defaultsFor(L) {
  const info = kindInfo(L.kind), t = L.tags || {};
  return { style: 'atelier', tagline: info.hook, intro: introFor(L, info), services: info.svc.slice(0, 5), cta: info.cta, hours: parseHours(t.opening_hours) || Array(7).fill(''), rating: '', reviews: '', by: true,
    phone: phoneOf(t), email: emailOf(t), social: socialOf(t), addr: L.addr || '', city: L.city || '' };
}
function model(L) {
  const f = L.f, info = kindInfo(L.kind);
  return { name: L.name, kindLabel: info.label, group: info.g, city: f.city, addr: f.addr, phone: f.phone, email: f.email, social: safeUrl(f.social), hours: f.hours, tagline: f.tagline, intro: f.intro, services: f.services, rating: f.rating, reviews: f.reviews, cta: f.cta, style: f.style, lat: L.lat, lon: L.lon, by: f.by ? ((S.user && S.user.prenom) || 'PopSite') : '' };
}
let FTAB = 'mq';
function vFiche(id) {
  const L = getLead(id);
  if (!L) { VIEW.innerHTML = `<div class="ap-wrap pg"><a class="ap-back" href="#radar">← Radar</a><div class="ap-empty"><h1 class="ap-h2">Ce commerce n'est plus dans ton radar.</h1><p>Relance un scan sur sa ville pour le retrouver.</p><a class="btn small" href="#radar">Ouvrir le radar</a></div></div>`; return; }
  if (L.locked && !isPro()) { VIEW.innerHTML = `<div class="ap-wrap pg"><a class="ap-back" href="#radar">← Radar</a><div class="ap-empty"><h1 class="ap-h2">Ce commerce est réservé à Pro.</h1><p>La version gratuite montre les 3 meilleurs commerces de chaque scan.</p><button class="btn small" type="button" data-pw>Débloquer</button></div></div>`; $('[data-pw]').onclick = () => paywall('list'); return; }
  const info = kindInfo(L.kind), t = L.tags || {};
  const phone = (L.f && L.f.phone) || phoneOf(t), email = (L.f && L.f.email) || emailOf(t), social = socialOf(t);
  const osm = /^[nwr]\d+$/.test(L.id) ? `https://www.openstreetmap.org/${{ n: 'node', w: 'way', r: 'relation' }[L.id[0]]}/${L.id.slice(1)}` : '';
  const gq = 'https://www.google.com/search?q=' + encodeURIComponent(L.name + ' ' + (L.city || ''));
  const back = S.leads[L.id] && S.leads[L.id].status !== 'nouveau' && !(S.scan && S.scan.items.some(x => x.id === L.id)) ? ['#suivi', 'Mes commerces'] : ['#radar', 'Radar'];
  VIEW.innerHTML = `<div class="ap-wrap fc">
  <a class="ap-back" href="${back[0]}">← ${back[1]}</a>
  <div class="fc-head"><div><p class="eyebrow">${E(info.label)}${L.dist != null ? ' · ' + dist(L.dist) : ''}${L.city ? ' · ' + E(L.city) : ''}</p><h1 class="ap-h1" style="margin-top:12px">${E(L.name)}</h1>
    <div class="ap-row" style="margin-top:14px">${webBadge(L.web)}${isTarget(L) ? pot(L.score || 1) : ''}</div></div>
    <div class="fc-status"><span class="ap-k">Où tu en es</span><div class="ap-seg" id="fc-st" role="group" aria-label="Statut">${STATUS.map(([k, l]) => `<button type="button" data-s="${k}" aria-pressed="${L.status === k}">${l}</button>`).join('')}</div></div>
  </div>
  <div class="fc-grid">
    <aside class="ap-box top-a fc-card">
      <dl><dt>Activité</dt><dd>${E(info.label)}</dd><dt>Adresse</dt><dd>${E([L.addr, L.city].filter(Boolean).join(', ') || '—')}</dd><dt>Téléphone</dt><dd>${phone ? `<a href="tel:${E(phone.replace(/[^\d+]/g, ''))}">${E(phone)}</a>` : '—'}</dd>
      <dt>E-mail</dt><dd>${email ? E(email) : '—'}</dd><dt>Horaires</dt><dd>${t.opening_hours ? 'Connus' : '—'}</dd>${social ? `<dt>Réseaux</dt><dd><a href="${E(social)}">Page trouvée</a></dd>` : ''}<dt>Site web</dt><dd class="${isTarget(L) ? 'none' : ''}">${isTarget(L) ? 'Aucun' : 'Oui'}</dd></dl>
      ${info.reg ? '<p class="fc-reg">Profession réglementée : son site doit rester informatif, sans publicité ni promotion.</p>' : ''}
      <div class="ap-row"><a class="btn ghost small" href="${gq}" target="_blank" rel="noopener">Vérifier sur Google</a>${osm ? `<a class="ap-link" href="${osm}" target="_blank" rel="noopener">Fiche OSM</a>` : ''}</div>
      ${isTarget(L) ? '<button class="ap-link" type="button" id="fc-has" style="align-self:flex-start">Il a déjà un site ? Retire-le</button>' : ''}
      <label class="ap-field" id="fc-next-w" ${['montree', 'a_relancer'].includes(L.status) ? '' : 'hidden'}>Relance prévue le<input class="ap-input" type="date" id="fc-next" value="${E(L.next || '')}"></label>
      <label class="ap-field">Tes notes<textarea class="ap-area" id="fc-note" placeholder="Prénom du gérant, meilleur moment pour passer, réaction…">${E(L.note || '')}</textarea></label>
    </aside>
    <div class="fc-main">
      <div class="tabs" role="tablist" aria-label="Étapes"><button class="tab" role="tab" id="t-mq" aria-controls="fc-panel" type="button"><b>01</b>Maquette</button><button class="tab" role="tab" id="t-pr" aria-controls="fc-panel" type="button"><b>02</b>Prospection</button><button class="tab" role="tab" id="t-pt" aria-controls="fc-panel" type="button"><b>03</b>Prompt IA</button><button class="tab" role="tab" id="t-dv" aria-controls="fc-panel" type="button"><b>04</b>Devis</button></div>
      <div class="fc-panel" id="fc-panel" role="tabpanel"></div>
    </div>
  </div></div>`;
  const tabs = { mq: $('#t-mq'), pr: $('#t-pr'), pt: $('#t-pt'), dv: $('#t-dv') };
  const show = k => { FTAB = k; Object.entries(tabs).forEach(([n, b]) => { b.setAttribute('aria-selected', n === k); b.tabIndex = n === k ? 0 : -1; }); $('#fc-panel').setAttribute('aria-labelledby', 't-' + k); if (pvCleanup) { pvCleanup(); pvCleanup = null; } (k === 'mq' ? pMaquette : k === 'pr' ? pProspect : k === 'pt' ? pPrompt : pDevis)(L); };
  Object.entries(tabs).forEach(([k, b]) => b.addEventListener('click', () => show(k)));
  $('.fc-main .tabs').addEventListener('keydown', e => { if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return; const ks = ['mq', 'pr', 'pt', 'dv'], i = ks.indexOf(FTAB); const n = ks[(i + (e.key === 'ArrowRight' ? 1 : 3)) % 4]; show(n); tabs[n].focus(); });
  $('#fc-st').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (!logged()) { needAccount('Crée ton compte pour suivre ce commerce.'); return; }
    L.status = b.dataset.s; if (L.status === 'vendue') { if (!L.sale) L.sale = { ...S.prefs.price, at: Date.now() }; } else delete L.sale;
    if (['montree', 'a_relancer'].includes(L.status) && !L.next) L.next = plusDays(L.status === 'montree' ? 5 : 2);
    keepLead(L); $$('#fc-st button').forEach(x => x.setAttribute('aria-pressed', x === b));
    const nw = $('#fc-next-w'); if (nw) { nw.hidden = !['montree', 'a_relancer'].includes(L.status); $('#fc-next').value = L.next || ''; }
    paintTop(); toast('Statut : ' + ST_LABEL[L.status] + (L.next && !nw.hidden ? ' · relance le ' + frDate(L.next) : ''));
  });
  $('#fc-next').addEventListener('change', e => { L.next = e.target.value; keepLead(L); paintTop(); });
  $('#fc-note').addEventListener('input', e => { if (!logged()) return; L.note = e.target.value; if (L.status === 'nouveau') L.status = 'a_montrer'; keepLead(L); });
  $('#fc-note').addEventListener('focus', () => { if (!logged()) needAccount('Crée ton compte pour garder tes notes.'); }, { once: true });
  const has = $('#fc-has'); if (has) has.addEventListener('click', () => {
    L.status = 'a_un_site'; L.web = 'site'; S.leads[L.id] = L; L.updated = Date.now();
    const it = S.scan && S.scan.items.find(x => x.id === L.id); if (it) it.web = 'site';
    applyLocks(); save(true); toast('Retiré de tes cibles'); go('radar');
  });
  show(FTAB);
  cleanup = () => { if (pvCleanup) { pvCleanup(); pvCleanup = null; } };
}
let pvCleanup = null;
function pMaquette(L) {
  const P = $('#fc-panel'), u = usage();
  if (!L.f) {
    const left = Math.max(0, lim().maq - u.maq);
    P.innerHTML = `<div class="mq-lock" style="border-color:var(--line);background:none"><p class="eyebrow">Étape 1</p><h2 class="ap-h2">Fais popper son site.</h2>
    <p class="ap-sub">PopSite reprend le nom, l'adresse, le téléphone et les horaires trouvés sur OpenStreetMap, choisit les textes selon l'activité et monte une maquette complète. Tu ajustes tout ensuite.</p>
    <div class="ap-row"><button class="btn" type="button" id="mq-go">Faire popper la maquette</button><span class="rd-quota">${isPro() ? `<b>${left}</b> maquettes restantes ce mois-ci` : `Gratuit · <b>${left}</b> maquette restante`}</span></div></div>`;
    $('#mq-go').onclick = () => {
      if (!logged()) { needAccount('Crée ton compte pour faire popper ta maquette.'); return; }
      if (usage().maq >= lim().maq) { paywall('maq'); return; }
      L.f = defaultsFor(L); L.mockAt = Date.now(); if (L.status === 'nouveau') L.status = 'a_montrer';
      usage().maq++; keepLead(L); save(true);
      $$('#fc-st button').forEach(x => x.setAttribute('aria-pressed', x.dataset.s === L.status));
      pMaquette(L); toast('Maquette prête');
    };
    return;
  }
  const f = L.f, sl = slug(L.name);
  P.innerHTML = `<div class="mq">
  <div class="mq-ed">
    <div class="ap-field">Style<div class="ap-seg" id="mq-style" role="group" aria-label="Style">${Object.entries(STYLES).map(([k, s]) => `<button type="button" data-v="${k}" aria-pressed="${f.style === k}">${s.label}</button>`).join('')}</div></div>
    <label class="ap-field">Accroche<input class="ap-input" data-f="tagline" value="${E(f.tagline)}"></label>
    <label class="ap-field">Présentation<textarea class="ap-area" data-f="intro">${E(f.intro)}</textarea></label>
    <label class="ap-field">Prestations, une par ligne<textarea class="ap-area" data-f="services">${E(f.services.join('\n'))}</textarea></label>
    <label class="ap-field">Bouton principal<input class="ap-input" data-f="cta" value="${E(f.cta)}"></label>
    <details><summary>Coordonnées</summary><div>
      <label class="ap-field">Adresse<input class="ap-input" data-f="addr" value="${E(f.addr)}"></label>
      <label class="ap-field">Ville<input class="ap-input" data-f="city" value="${E(f.city)}"></label>
      <label class="ap-field">Téléphone<input class="ap-input" data-f="phone" value="${E(f.phone)}" inputmode="tel"></label>
      <label class="ap-field">E-mail<input class="ap-input" data-f="email" value="${E(f.email)}" inputmode="email"></label>
    </div></details>
    <details><summary>Horaires</summary><div class="mq-hours">${DAYS_FR.map((d, i) => `<span>${d.slice(0, 3)}</span><input class="ap-input" data-h="${i}" value="${E(f.hours[i] || '')}" placeholder="Fermé">`).join('')}</div></details>
    <details><summary>Note Google</summary><div>
      <div class="ap-row"><label class="ap-field" style="flex:1">Note sur 5<input class="ap-input" data-f="rating" value="${E(f.rating)}" inputmode="decimal" placeholder="4,7"></label><label class="ap-field" style="flex:1">Nombre d'avis<input class="ap-input" data-f="reviews" value="${E(f.reviews)}" inputmode="numeric" placeholder="86"></label></div>
      <p class="fine">Recopie ce que Google affiche. N'invente jamais une note.</p></div></details>
    <label class="switch">Bandeau « maquette proposée par ${E((S.user && S.user.prenom) || 'toi')} »<input type="checkbox" data-f="by" ${f.by ? 'checked' : ''}></label>
  </div>
  <div class="mq-pv">
    <div class="ap-row" style="justify-content:space-between"><div class="ap-seg" id="mq-dev" role="group" aria-label="Appareil"><button type="button" data-v="d" aria-pressed="true">Ordinateur</button><button type="button" data-v="m" aria-pressed="false">Téléphone</button></div><span class="fine">Aperçu en direct</span></div>
    <div class="mq-frame"><div class="bar"><span class="dots" aria-hidden="true"><i></i><i></i><i></i></span><span class="url">${E(sl)}.fr</span></div><div class="mq-vp" id="mq-vp"><iframe title="Maquette du site de ${E(L.name)}" sandbox="allow-same-origin"></iframe></div></div>
    <div class="mq-act"><button class="btn" type="button" id="mq-show">Mode boutique</button><button class="btn ghost" type="button" id="mq-dl" data-dl ${canDownload() ? '' : 'hidden'}>Télécharger le HTML</button><button class="btn ghost" type="button" id="mq-share">Lien à envoyer</button><button class="btn ghost" type="button" id="mq-copy">Copier le HTML</button></div>
    <p class="fine">Le mode boutique ouvre la maquette en plein écran : c'est elle que tu montres sur ton téléphone.</p>
  </div></div>`;
  const ifr = $('#mq-vp iframe'), vp = $('#mq-vp');
  let dev = 'd', ut = 0;
  const html = () => buildMockup(model(L));
  const paint = () => { ifr.srcdoc = html(); };
  const fitFrame = () => {
    const w = vp.clientWidth;
    if (dev === 'd') { const s = w / 1280, h = Math.round(w * .66); vp.style.height = h + 'px'; vp.classList.remove('mob'); ifr.style.cssText = `width:1280px;height:${Math.round(h / s)}px;transform:scale(${s});left:0`; }
    else { const h = Math.min(640, Math.round(w * 1.25)), s = Math.min(1, h / 800); vp.style.height = h + 'px'; vp.classList.add('mob'); ifr.style.cssText = `width:390px;height:${Math.round(h / s)}px;transform:scale(${s});left:${Math.round((w - 390 * s) / 2)}px`; }
  };
  const ro = new ResizeObserver(fitFrame); ro.observe(vp); fitFrame(); paint();
  pvCleanup = () => ro.disconnect();
  const touch = () => { keepLead(L); clearTimeout(ut); ut = setTimeout(paint, 220); };
  P.querySelector('.mq-ed').addEventListener('input', e => {
    const el = e.target;
    if (el.dataset.h != null) { f.hours[+el.dataset.h] = el.value; touch(); return; }
    const k = el.dataset.f; if (!k) return;
    if (k === 'services') f.services = el.value.split('\n').map(s => s.trim()).filter(Boolean);
    else if (k === 'by') f.by = el.checked; else f[k] = el.value;
    touch();
  });
  $('#mq-style').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; f.style = b.dataset.v; $$('#mq-style button').forEach(x => x.setAttribute('aria-pressed', x === b)); keepLead(L); paint(); });
  $('#mq-dev').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; dev = b.dataset.v; $$('#mq-dev button').forEach(x => x.setAttribute('aria-pressed', x === b)); fitFrame(); });
  $('#mq-show').onclick = () => showMode(html(), L.name);
  const dl = $('#mq-dl'); if (dl) dl.onclick = async () => { if (await download(sl + '-maquette.html', html())) toast('Maquette téléchargée'); };
  $('#mq-copy').onclick = () => copy(html(), 'HTML de la maquette copié');
  $('#mq-share').onclick = () => shareModal(L);
}
function showMode(html, name) {
  const s = document.createElement('div'); s.className = 'show'; s.setAttribute('role', 'dialog'); s.setAttribute('aria-label', 'Maquette de ' + name + ' en plein écran');
  s.innerHTML = `<button type="button">Fermer</button><iframe title="Maquette de ${E(name)}" sandbox="allow-same-origin"></iframe>`;
  s.querySelector('iframe').srcdoc = html; document.body.appendChild(s);
  const close = () => { s.remove(); document.removeEventListener('keydown', k); try { if (document.fullscreenElement) document.exitFullscreen(); } catch (e) { } };
  const k = e => { if (e.key === 'Escape') close(); };
  s.querySelector('button').onclick = close; document.addEventListener('keydown', k); s.querySelector('button').focus();
  try { const p = s.requestFullscreen && s.requestFullscreen(); if (p && p.catch) p.catch(() => { }); } catch (e) { }
}
function ctxFor(L) {
  const f = L.f || defaultsFor(L);
  return { lead: { name: L.name, kind: L.kind, city: f.city || L.city, addr: f.addr || L.addr, phone: f.phone, email: f.email, social: f.social, lat: L.lat, lon: L.lon }, f, info: kindInfo(L.kind), me: { prenom: S.user && S.user.prenom, tel: S.user && S.user.tel, email: S.user && S.user.email }, price: S.prefs.price };
}
function pProspect(L) {
  const P = $('#fc-panel'), ch = S.prefs.channel, c = ctxFor(L), out = prospect(ch, c);
  const chans = [['boutique', 'En boutique'], ['mail', 'Mail'], ['relance', 'Relance'], ['telephone', 'Téléphone']];
  const mailto = c.lead.email && out.body ? `mailto:${encodeURIComponent(c.lead.email)}?subject=${encodeURIComponent(out.subject)}&body=${encodeURIComponent(out.body)}` : '';
  P.innerHTML = `<div class="pr">
  <div class="ap-row" style="justify-content:space-between"><div class="ap-seg" id="pr-ch" role="group" aria-label="Canal">${chans.map(([k, l]) => `<button type="button" data-v="${k}" aria-pressed="${ch === k}">${l}${k === 'boutique' ? ' ★' : ''}</button>`).join('')}</div>
  <div class="pr-price"><label class="ap-field">Création (€)<input class="ap-input" id="pr-c" inputmode="numeric" value="${E(S.prefs.price.creation)}"></label><label class="ap-field">Par mois (€)<input class="ap-input" id="pr-m" inputmode="numeric" value="${E(S.prefs.price.mensuel)}"></label></div></div>
  ${!c.me.prenom ? '<p class="pr-note">Ajoute ton prénom et ton téléphone dans <a class="ap-link" href="#compte">ton compte</a> : ils apparaîtront dans les textes.</p>' : ''}
  ${ch === 'mail' || ch === 'relance' ? `
    <p class="pr-note">Un mail seul obtient rarement une réponse. Il marche mieux comme prise de contact avant de passer, ou comme relance après ta visite.</p>
    <div class="pr-mail"><label class="ap-field">Objet<input class="ap-input" id="pr-subj" value="${E(out.subject)}"></label>
    <div class="ap-row">${out.alt.map(a => `<button class="chip" type="button" data-alt="${E(a)}">${E(a)}</button>`).join('')}</div>
    <label class="ap-field">Message<textarea class="ap-area" id="pr-body" style="min-height:340px">${E(out.body)}</textarea></label>
    <div class="ap-row"><button class="btn" type="button" id="pr-copy">Copier le message</button><button class="btn ghost" type="button" id="pr-copys">Copier l'objet</button>${mailto ? `<a class="btn ghost" id="pr-mailto" href="${mailto}">Ouvrir ma messagerie</a>` : ''}</div>
    ${c.lead.email ? `<p class="fine">Adresse du commerce : ${E(c.lead.email)}</p>` : '<p class="fine">Pas d\'e-mail connu pour ce commerce : passe plutôt le voir.</p>'}</div>` : `
    <ol class="say">${out.steps.map(([k, v]) => `<li><span><em>${E(k)}</em>${E(v)}</span></li>`).join('')}</ol>
    ${out.objections ? `<div><p class="eyebrow" style="margin-bottom:6px">S'il te dit…</p><div class="faq">${out.objections.map(([q, a]) => `<details><summary>${E(q)}</summary><p>${E(a)}</p></details>`).join('')}</div></div>` : ''}
    <div class="ap-row">${L.f ? '<button class="btn" type="button" id="pr-show">Ouvrir la maquette en mode boutique</button>' : '<button class="btn" type="button" id="pr-mq">Faire d\'abord la maquette</button>'}<button class="btn ghost" type="button" id="pr-copyall">Copier le script</button></div>`}
  </div>`;
  $('#pr-ch').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; S.prefs.channel = b.dataset.v; save(); pProspect(L); });
  const pr = (id, k) => $(id).addEventListener('change', e => { S.prefs.price[k] = Math.max(0, parseInt(e.target.value, 10) || 0); save(); pProspect(L); });
  pr('#pr-c', 'creation'); pr('#pr-m', 'mensuel');
  if (out.body) {
    $('#pr-copy').onclick = () => copy($('#pr-body').value, 'Message copié');
    $('#pr-copys').onclick = () => copy($('#pr-subj').value, 'Objet copié');
    $$('[data-alt]').forEach(b => b.onclick = () => { $('#pr-subj').value = b.dataset.alt; });
    const upd = () => { const a = $('#pr-mailto'); if (a) a.href = `mailto:${encodeURIComponent(c.lead.email)}?subject=${encodeURIComponent($('#pr-subj').value)}&body=${encodeURIComponent($('#pr-body').value)}`; };
    $('#pr-subj').addEventListener('input', upd); $('#pr-body').addEventListener('input', upd);
  } else {
    const s = $('#pr-show'); if (s) s.onclick = () => showMode(buildMockup(model(L)), L.name);
    const m = $('#pr-mq'); if (m) m.onclick = () => $('#t-mq').click();
    $('#pr-copyall').onclick = () => copy(out.steps.map(([k, v]) => k.toUpperCase() + '\n' + v).join('\n\n') + (out.objections ? '\n\nOBJECTIONS\n' + out.objections.map(([q, a]) => q + '\n' + a).join('\n\n') : ''), 'Script copié');
  }
}
function pPrompt(L) {
  const P = $('#fc-panel'), tool = S.prefs.tool;
  if (!L.f) { P.innerHTML = `<div class="ap-empty"><h2 class="ap-h2">D'abord la maquette.</h2><p>Le prompt reprend la maquette validée par le gérant : fais-la popper, montre-la, puis reviens ici.</p><button class="btn small" type="button" id="pt-mq">Aller à la maquette</button></div>`; $('#pt-mq').onclick = () => $('#t-mq').click(); return; }
  const c = ctxFor(L), txt = buildPrompt(tool, c), name = { claude: 'Claude Code', codex: 'Codex', lovable: 'Lovable' }[tool];
  P.innerHTML = `<div class="pr">
  <div class="ap-seg" id="pt-tool" role="group" aria-label="Outil">${[['claude', 'Claude Code'], ['codex', 'Codex'], ['lovable', 'Lovable']].map(([k, l]) => `<button type="button" data-v="${k}" aria-pressed="${tool === k}">${l}</button>`).join('')}</div>
  <div class="pt-steps"><div><b>01</b>Télécharge ou copie la maquette validée.<button class="ap-link" type="button" id="pt-dl" data-dl style="align-self:flex-start" ${canDownload() ? '' : 'hidden'}>Télécharger la maquette</button><button class="ap-link" type="button" id="pt-cp" style="align-self:flex-start">Copier le HTML</button></div>
  <div><b>02</b>${tool === 'lovable' ? 'Crée un nouveau projet sur Lovable.' : 'Ouvre ' + name + ' dans un dossier vide, avec le fichier de la maquette dedans.'}</div>
  <div><b>03</b>Colle ce prompt${tool === 'lovable' ? ' et joins la maquette' : ''}. Relis le résultat avec le gérant avant de mettre en ligne.</div></div>
  <div class="prompt"><header><span>Prompt pour ${name}</span><button class="btn ghost small" type="button" id="pt-copy">Copier</button></header><pre>${E(txt)}</pre></div></div>`;
  $('#pt-tool').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; S.prefs.tool = b.dataset.v; save(); pPrompt(L); });
  $('#pt-copy').onclick = () => copy(txt, 'Prompt copié');
  const dl = $('#pt-dl'); if (dl) dl.onclick = async () => { if (await download(slug(L.name) + '-maquette.html', buildMockup(model(L)))) toast('Maquette téléchargée'); };
  const cp = $('#pt-cp'); if (cp) cp.onclick = () => copy(buildMockup(model(L)), 'HTML copié');
}

/* ================= SUIVI ================= */
function vSuivi() {
  const leads = Object.values(S.leads).filter(l => l.status && l.status !== 'nouveau');
  const by = k => leads.filter(l => l.status === k).sort((a, b) => b.updated - a.updated);
  const sold = by('vendue'), shown = leads.filter(l => ['montree', 'a_relancer', 'vendue'].includes(l.status));
  const card = l => { const P = STYLES[(l.f && l.f.style) || 'atelier']; return `<a class="sv-card" href="#fiche-${l.id}"><span class="sw" style="background:${l.f ? P.acc : 'var(--line)'}"></span><strong>${E(l.name)}</strong><small>${E(kindInfo(l.kind).label)}${l.city ? ' · ' + E(l.city) : ''}</small><small>${l.f ? 'Maquette ' + P.label.toLowerCase() : 'Pas de maquette'} · ${ago(l.updated)}</small></a>`; };
  const du = dues(), anyMaq = Object.values(S.leads).some(l => l.f);
  const steps = [['Scanne ta ville', !!S.scan], ['Fais popper une maquette', anyMaq], ['Montre-la à un commerçant', shown.length > 0], ['Vends ton premier site', sold.length > 0]];
  const done = steps.filter(s => s[1]).length;
  VIEW.innerHTML = `<div class="ap-wrap sv">
  <div class="ap-row" style="justify-content:space-between;align-items:flex-end"><div><p class="eyebrow">Mes commerces</p><h1 class="ap-h1" style="margin-top:12px">Où tu en es.</h1></div>
  ${logged() && leads.length ? `<div class="ap-row"><button class="btn ghost small" type="button" id="sv-csv">Copier en CSV</button><button class="btn ghost small" type="button" id="sv-dl" data-dl ${canDownload() ? '' : 'hidden'}>Télécharger</button></div>` : ''}</div>
  ${logged() && done < 4 ? `<div class="ap-box top-i ck"><div class="ap-row" style="justify-content:space-between"><span class="ap-k">Ton premier site vendu · ${done} / 4</span><div class="meter" style="flex:1;max-width:240px"><i style="width:${done * 25}%"></i></div></div><ol>${steps.map(([t, ok]) => `<li class="${ok ? 'ok' : ''}">${t}</li>`).join('')}</ol></div>` : ''}
  ${logged() && du.length ? `<div class="ap-box top-a due"><span class="ap-k">À relancer aujourd'hui · ${du.length}</span><div class="ap-row">${du.map(l => `<a class="chip" href="#fiche-${l.id}">${E(l.name)}${l.next < today() ? ' · en retard' : ''}</a>`).join('')}</div></div>` : ''}
  ${!logged() ? `<div class="ap-empty"><h2 class="ap-h2">Connecte-toi pour suivre tes commerces.</h2><p>Ton suivi garde chaque commerce, sa maquette, tes notes et où tu en es.</p><div class="ap-row"><a class="btn small" href="#inscription">Créer mon compte</a><a class="btn ghost small" href="#connexion">Connexion</a></div></div>` :
    !leads.length ? `<div class="ap-empty"><h2 class="ap-h2">Rien à suivre pour l'instant.</h2><p>Lance le radar, ouvre un commerce sans site et fais popper sa maquette : il arrive ici.</p><a class="btn small" href="#radar">Ouvrir le radar</a></div>` : `
  <div class="sv-stats">
    <div class="ap-box sv-stat"><span class="ap-k">Suivis</span><b>${leads.length}</b></div>
    <div class="ap-box sv-stat"><span class="ap-k">Maquettes montrées</span><b>${shown.length}</b></div>
    <div class="ap-box sv-stat amb"><span class="ap-k">Sites vendus</span><b>${sold.length}</b></div>
    <div class="ap-box sv-stat amb"><span class="ap-k">Signé</span><b>${eur(sold.reduce((a, l) => a + +(l.sale || S.prefs.price).creation, 0))}</b><span class="fine">+ ${eur(sold.reduce((a, l) => a + +(l.sale || S.prefs.price).mensuel, 0))} par mois</span></div>
  </div>
  <div class="sv-cols">${[['a_montrer', 'À montrer'], ['montree', 'Montrée'], ['a_relancer', 'À relancer'], ['vendue', 'Vendue']].map(([k, l]) => { const xs = by(k); return `<div class="sv-col${k === 'vendue' ? ' sold' : ''}"><h2>${l}<span>${xs.length}</span></h2>${xs.map(card).join('') || '<p class="fine" style="padding:10px 2px">Vide</p>'}</div>`; }).join('')}</div>
  ${by('refus').length || by('a_un_site').length ? `<details class="faq"><summary>Écartés (${by('refus').length + by('a_un_site').length})</summary><div class="sv-other" style="padding-bottom:18px">${[...by('refus'), ...by('a_un_site')].map(l => `<a class="chip" href="#fiche-${l.id}">${E(l.name)} · ${ST_LABEL[l.status]}</a>`).join('')}</div></details>` : ''}`}
  </div>`;
  const csv = () => 'Nom;Activité;Ville;Adresse;Téléphone;E-mail;Statut;Relance;Notes;Création;Mensuel;Mis à jour\n' + leads.map(l => { const f = l.f || {}, p = l.sale || S.prefs.price; return [l.name, kindInfo(l.kind).label, f.city || l.city, f.addr || l.addr, f.phone || phoneOf(l.tags || {}), f.email || emailOf(l.tags || {}), ST_LABEL[l.status], l.next || '', l.note || '', p.creation, p.mensuel, new Date(l.updated).toLocaleDateString('fr-FR')].map(v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"').join(';'); }).join('\n');
  const c = $('#sv-csv'); if (c) c.onclick = () => copy(csv(), 'Suivi copié (colle-le dans un tableur)');
  const d = $('#sv-dl'); if (d) d.onclick = async () => { if (await download('popsite-suivi.csv', '\ufeff' + csv())) toast('Suivi téléchargé'); };
}
/* ================= TARIFS ================= */
function vTarifs() {
  const pro = isPro();
  VIEW.innerHTML = `<div class="ap-wrap pg">
  <div style="display:flex;flex-direction:column;gap:14px"><p class="eyebrow">Tarifs</p><h1 class="ap-h1">Un site vendu rembourse l'année.</h1><p class="ap-sub">Commence gratuitement, sans carte bancaire. Passe en Pro le jour où tu démarches pour de vrai : un seul site vendu ${eur(S.prefs.price.creation)}, c'est ${Math.max(1, Math.floor(S.prefs.price.creation / 14.99))} mois de Pro payés.</p></div>
  <div class="plans">
    <article class="plan"><h3>Gratuit</h3><p class="price">0 €</p><ul><li>1 scan de zone par mois</li><li>Les 3 meilleurs commerces visibles</li><li>1 maquette par mois</li><li>Scripts de prospection</li></ul>${logged() ? '<a class="btn ghost" href="#radar">Ouvrir le radar</a>' : '<a class="btn ghost" href="#inscription">Commencer</a>'}</article>
    <article class="plan pro"><h3>Pro</h3><p class="price">14,99 € <small>par mois</small></p><ul><li>Tous les commerces de chaque scan</li><li>60 scans et 100 maquettes par mois</li><li>3 styles de maquette</li><li>Mode boutique à montrer sur ton téléphone</li><li>Prompt de construction pour ton IA</li><li>Suivi : à montrer, montrée, vendue</li></ul>
    ${pro ? `<span class="btn" aria-disabled="true">${S.plan === 'pro' ? 'Tu es Pro' : 'Essai en cours'}</span>` : '<button class="btn" type="button" id="tf-pro">Passer Pro</button>'}</article>
  </div>
  <table class="pg-cmp"><thead><tr><th>Ce qui change</th><th>Gratuit</th><th>Pro</th></tr></thead><tbody>
    <tr><td>Scans par mois</td><td>1</td><td class="y">60</td></tr><tr><td>Commerces visibles par scan</td><td>3</td><td class="y">Tous</td></tr>
    <tr><td>Maquettes par mois</td><td>1</td><td class="y">100</td></tr><tr><td>Styles de maquette</td><td>3</td><td class="y">3</td></tr>
    <tr><td>Scripts boutique, mail, relance, téléphone</td><td>Oui</td><td class="y">Oui</td></tr><tr><td>Prompt Claude Code, Codex, Lovable</td><td>Oui</td><td class="y">Oui</td></tr>
    <tr><td>Rayon jusqu'à 5 km</td><td>Oui</td><td class="y">Oui</td></tr></tbody></table>
  <div style="display:flex;flex-direction:column;gap:20px"><h2 class="ap-h2">Questions sur l'abonnement</h2>
  <div class="faq">
    <details open><summary>Je peux arrêter quand je veux ?</summary><p>Oui. Pro est sans engagement : tu arrêtes en un clic et tu repasses en gratuit à la fin du mois payé.</p></details>
    <details><summary>PopSite prend une commission sur mes ventes ?</summary><p>Non. Tu fixes ton prix, tu encaisses toi-même, PopSite ne touche rien sur tes sites vendus.</p></details>
    <details><summary>Les scans non utilisés sont reportés ?</summary><p>Non, les compteurs repartent à zéro le 1er de chaque mois.</p></details>
    <details><summary>Comment je paie ?</summary><p>Par carte, avec un paiement sécurisé. Il arrive très bientôt ; en attendant, l'essai Pro de 7 jours te laisse tout tester.</p></details>
  </div></div></div>`;
  const b = $('#tf-pro'); if (b) b.onclick = payModal;
}

/* ================= AIDE ================= */
function vAide() {
  const secs = [['h-radar', 'Le radar'], ['h-ordre', 'Le bon ordre'], ['h-regles', 'Démarcher dans les règles'], ['h-prix', 'Fixer ton prix'], ['h-ligne', 'Mettre un site en ligne'], ['h-faq', 'Questions']];
  VIEW.innerHTML = `<div class="ap-wrap pg">
  <div style="display:flex;flex-direction:column;gap:14px"><p class="eyebrow">Aide</p><h1 class="ap-h1">Du radar au site vendu.</h1></div>
  <div class="hp"><nav class="hp-toc" aria-label="Sommaire">${secs.map(([i, l]) => `<button type="button" data-to="${i}">${l}</button>`).join('')}</nav>
  <div class="hp-body">
    <section id="h-radar"><h2 class="ap-h2">Le radar</h2>
      <p>Le radar interroge <strong>OpenStreetMap</strong>, la carte libre et collaborative. Il garde les commerces qui n'y déclarent aucun site, et écarte les enseignes nationales qui en ont forcément un.</p>
      <p>La carte n'est pas toujours à jour : un commerce peut avoir un site que personne n'a renseigné. Avant de te déplacer, clique <strong>Vérifier sur Google</strong> sur sa fiche. S'il a un site, retire-le en un clic.</p>
      <p>Le <strong>potentiel</strong> (les trois points) estime l'intérêt d'un commerce : coordonnées connues, horaires, présence sur les réseaux sans site, activité où un site rapporte (restaurant, artisan, hébergement, beauté).</p></section>
    <section id="h-ordre"><h2 class="ap-h2">Le bon ordre</h2>
      <ol class="hp-flow"><li>Scanne ta zone</li><li>Vérifie sur Google</li><li>Fais popper la maquette</li><li>Passe en boutique</li><li>Relance à J+5</li><li>Colle le prompt dans ton IA</li><li>Mets en ligne</li></ol>
      <p>Le passage en boutique marche bien mieux qu'un mail : le gérant voit son propre site sur ton téléphone, en vrai. Garde le mail pour prévenir ou pour relancer.</p></section>
    <section id="h-regles"><h2 class="ap-h2">Démarcher dans les règles</h2>
      <ul><li>Entre professionnels, la CNIL autorise la prospection par e-mail sans accord préalable si le message concerne l'activité de la personne. Présente-toi clairement et offre toujours un moyen simple de ne plus être contacté : les mails de PopSite finissent par « répondez stop ».</li>
      <li>Au téléphone, appelle le numéro du commerce, pendant ses horaires, et n'insiste pas après un non.</li>
      <li>Pour encaisser, il te faut un statut. La micro-entreprise est le plus simple à créer, sur le site officiel autoentrepreneur.urssaf.fr.</li>
      <li>N'invente jamais d'avis, de note ou de chiffre dans une maquette.</li></ul></section>
    <section id="h-prix"><h2 class="ap-h2">Fixer ton prix</h2>
      <p>C'est toi qui décides. Pour un site vitrine d'une page, on voit souvent quelques centaines d'euros pour la création, puis 10 à 30 € par mois pour l'hébergement, le nom de domaine et les petites mises à jour. Règle tes prix par défaut dans ton compte : ils apparaissent dans tes scripts.</p></section>
    <section id="h-ligne"><h2 class="ap-h2">Mettre un site en ligne</h2>
      <ol><li>Colle le prompt de la fiche dans Claude Code, Codex ou Lovable, avec la maquette.</li><li>Héberge le dossier obtenu sur Netlify ou Vercel : un glisser-déposer suffit, l'offre gratuite couvre un site vitrine.</li><li>Achète le nom de domaine au nom du commerçant (comptez une dizaine d'euros par an pour un .fr) et branche-le.</li><li>Ajoute le site sur la fiche Google du commerce : c'est là que les clients le trouveront.</li></ol></section>
    <section id="h-faq"><h2 class="ap-h2">Questions</h2>
      <div class="faq">
        <details><summary>Pourquoi le radar ne trouve rien dans mon village ?</summary><p>OpenStreetMap est moins rempli à la campagne. Élargis le rayon à 3 ou 5 km, ou essaie la ville voisine.</p></details>
        <details><summary>Le scan dit que le serveur est saturé.</summary><p>Les serveurs publics d'OpenStreetMap sont partagés par tout le monde. Patiente une minute, ou réduis le rayon.</p></details>
        <details><summary>Où sont gardées mes données ?</summary><p>Pour l'instant, sur ton appareil uniquement. Les comptes en ligne, qui synchronisent ton téléphone et ton ordinateur, arrivent bientôt.</p></details>
        <details><summary>Le commerce n'a pas d'e-mail.</summary><p>C'est le cas le plus courant, et c'est tant mieux : passe le voir avec la maquette en mode boutique.</p></details>
      </div></section>
  </div></div></div>`;
  $('.hp-toc').addEventListener('click', e => { const b = e.target.closest('[data-to]'); if (b) document.getElementById(b.dataset.to).scrollIntoView({ behavior: 'smooth' }); });
}

/* ================= CONNEXION / INSCRIPTION ================= */
function vAuth(kind) {
  if (logged()) { go('compte'); return; }
  const up = kind === 'inscription';
  const dots = [[22, 30], [64, 22], [70, 61], [35, 72], [52, 44], [18, 55]].map(([x, y]) => `<i style="left:${x}%;top:${y}%"></i>`).join('');
  VIEW.innerHTML = `<div class="au">
  <div class="au-art"><div class="scope" aria-hidden="true">${dots}</div><p class="eyebrow" style="position:relative">${up ? 'Compte gratuit' : 'Bon retour'}</p><h2 class="ap-h1">${up ? 'Ton radar t\'attend.' : 'On reprend où tu en étais.'}</h2><p>${up ? '1 scan, 1 maquette, les scripts de prospection. Sans carte bancaire.' : 'Tes commerces, tes maquettes et ton suivi.'}</p></div>
  <div class="au-form"><form id="au-f" novalidate>
    <h1 class="ap-h2">${up ? 'Créer mon compte' : 'Connexion'}</h1>
    <p class="ap-beta"><b>Bêta :</b> ton compte reste sur cet appareil pour l'instant. La synchronisation en ligne arrive bientôt.</p>
    ${up ? '<label class="ap-field">Prénom<input class="ap-input" name="prenom" autocomplete="given-name" required></label>' : ''}
    <label class="ap-field">E-mail<input class="ap-input" name="email" type="email" autocomplete="email" required></label>
    ${up ? `<label class="ap-field">Ta ville (facultatif)<input class="ap-input" name="ville" autocomplete="address-level2"></label>
    <label class="au-check"><input type="checkbox" name="cgu"><span>J'accepte les <a class="ap-link" href="#mentions" style="font-size:inherit;text-transform:none;letter-spacing:0">conditions d'utilisation</a>.</span></label>` : ''}
    <input type="text" name="site" tabindex="-1" autocomplete="off" aria-hidden="true" style="position:absolute;left:-9999px;width:1px;height:1px">
    <p class="au-err" id="au-err" role="alert"></p>
    <button class="btn" type="submit">${up ? 'Créer mon compte' : 'Me connecter'}</button>
    <p class="fine" style="text-align:center">${up ? 'Déjà un compte ? <a class="ap-link" href="#connexion">Connexion</a>' : 'Pas encore de compte ? <a class="ap-link" href="#inscription">Inscription</a>'}</p>
  </form></div></div>`;
  $('#au-f').addEventListener('submit', e => {
    e.preventDefault(); const fd = new FormData(e.target), err = $('#au-err');
    const email = String(fd.get('email') || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { err.textContent = 'Cette adresse e-mail n\'a pas l\'air valide.'; return; }
    if (up) {
      const prenom = String(fd.get('prenom') || '').trim();
      if (!prenom) { err.textContent = 'Ton prénom, pour signer tes messages.'; return; }
      if (!fd.get('cgu')) { err.textContent = 'Coche la case pour accepter les conditions.'; return; }
      S.user = { prenom, email, ville: String(fd.get('ville') || '').trim(), tel: '', since: Date.now() }; S.auth = true;
      if (!fd.get('site')) sendLead({ prenom, email, ville: S.user.ville, source: 'inscription' });
    } else {
      if (!S.user || S.user.email !== email) { err.innerHTML = 'Aucun compte avec cet e-mail sur cet appareil. <a class="ap-link" href="#inscription">Créer un compte</a>'; return; }
      S.auth = true;
    }
    save(true); paintTop(); toast(up ? 'Bienvenue ' + S.user.prenom : 'Content de te revoir');
    let ret = ''; try { ret = sessionStorage.getItem('popsite:ret') || ''; sessionStorage.removeItem('popsite:ret'); } catch (e2) { }
    go(isAppRoute(ret) && !/connexion|inscription/.test(ret) ? ret : 'radar');
  });
}

/* ================= COMPTE ================= */
function vCompte() {
  if (!logged()) { try { sessionStorage.setItem('popsite:ret', 'compte'); } catch (e) { } go('connexion'); return; }
  const u = usage(), l = lim(), U = S.user, pro = isPro();
  const meter = (a, b) => `<div class="meter"><i style="width:${Math.min(100, a / b * 100)}%"></i></div>`;
  VIEW.innerHTML = `<div class="ap-wrap pg">
  <div style="display:flex;flex-direction:column;gap:12px"><p class="eyebrow">Mon compte</p><h1 class="ap-h1">Salut ${E(U.prenom)}.</h1></div>
  <div class="ac">
    <div class="ap-box top-a"><h2 class="ap-h2">Abonnement</h2>
      <p class="ap-row"><span class="ap-badge ${pro ? 'sold' : ''}">${S.plan === 'pro' ? 'Pro' : pro ? 'Essai Pro' : 'Gratuit'}</span>${S.trialUntil > Date.now() && S.plan !== 'pro' ? `<span class="fine">jusqu'au ${new Date(S.trialUntil).toLocaleDateString('fr-FR')}</span>` : ''}</p>
      <div class="ap-k">Scans ce mois-ci · ${u.scans} / ${l.scans}</div>${meter(u.scans, l.scans)}
      <div class="ap-k">Maquettes ce mois-ci · ${u.maq} / ${l.maq}</div>${meter(u.maq, l.maq)}
      ${pro ? '' : `<div class="ap-row"><button class="btn small" type="button" id="ac-pro">Passer Pro</button>${S.trialUsed ? '' : '<button class="btn ghost small" type="button" id="ac-trial">Essai 7 jours</button>'}</div>`}
    </div>
    <form class="ap-box" id="ac-f"><h2 class="ap-h2">Profil</h2>
      <label class="ap-field">Prénom<input class="ap-input" name="prenom" value="${E(U.prenom)}"></label>
      <label class="ap-field">E-mail<input class="ap-input" name="email" type="email" value="${E(U.email)}"></label>
      <label class="ap-field">Téléphone (pour tes messages)<input class="ap-input" name="tel" inputmode="tel" value="${E(U.tel || '')}"></label>
      <label class="ap-field">Ville<input class="ap-input" name="ville" value="${E(U.ville || '')}"></label>
      <button class="btn small" type="submit" style="align-self:flex-start">Enregistrer</button></form>
    <form class="ap-box" id="ac-p"><h2 class="ap-h2">Tes prix de vente</h2><p class="ap-sub" style="font-size:15px">Utilisés dans tes scripts et ton chiffre signé.</p>
      <div class="ap-row"><label class="ap-field" style="flex:1">Création (€)<input class="ap-input" name="creation" inputmode="numeric" value="${E(S.prefs.price.creation)}"></label><label class="ap-field" style="flex:1">Par mois (€)<input class="ap-input" name="mensuel" inputmode="numeric" value="${E(S.prefs.price.mensuel)}"></label></div>
      <button class="btn small" type="submit" style="align-self:flex-start">Enregistrer</button></form>
    <div class="ap-box"><h2 class="ap-h2">Mode test</h2><p class="ap-sub" style="font-size:15px">Le paiement n'est pas encore branché. Active Pro sur cet appareil pour tout essayer.</p>
      <label class="switch">PopSite Pro en mode test<input type="checkbox" id="ac-test" ${S.plan === 'pro' ? 'checked' : ''}></label></div>
    <div class="ap-box full"><h2 class="ap-h2">Tes données</h2><p class="ap-sub" style="font-size:15px">Tout est gardé dans ce navigateur. Exporte-les avant de changer d'appareil.</p>
      <div class="ap-row"><button class="btn ghost small" type="button" id="ac-exp">Copier mes données</button><button class="btn ghost small" type="button" id="ac-out">Me déconnecter</button><button class="ap-link" type="button" id="ac-del" style="color:#ff8f7a">Tout effacer</button></div></div>
  </div></div>`;
  const b1 = $('#ac-pro'); if (b1) b1.onclick = payModal;
  const b2 = $('#ac-trial'); if (b2) b2.onclick = startTrial;
  $('#ac-f').addEventListener('submit', e => { e.preventDefault(); const fd = new FormData(e.target); Object.assign(S.user, { prenom: String(fd.get('prenom')).trim() || S.user.prenom, email: String(fd.get('email')).trim().toLowerCase() || S.user.email, tel: String(fd.get('tel')).trim(), ville: String(fd.get('ville')).trim() }); save(true); paintTop(); toast('Profil enregistré'); });
  $('#ac-p').addEventListener('submit', e => { e.preventDefault(); const fd = new FormData(e.target); S.prefs.price = { creation: Math.max(0, parseInt(fd.get('creation'), 10) || 0), mensuel: Math.max(0, parseInt(fd.get('mensuel'), 10) || 0) }; save(true); toast('Prix enregistrés'); });
  $('#ac-test').addEventListener('change', e => { S.plan = e.target.checked ? 'pro' : 'free'; applyLocks(); save(true); paintTop(); toast(e.target.checked ? 'Pro activé en mode test' : 'Retour au gratuit'); vCompte(); });
  $('#ac-exp').onclick = () => copy(JSON.stringify(S, null, 2), 'Données copiées');
  $('#ac-out').onclick = () => { S.auth = false; save(true); paintTop(); toast('Déconnecté'); go('radar'); };
  $('#ac-del').onclick = () => modal(`<h2>Tout effacer ?</h2><p>Ton compte, tes scans, tes maquettes et ton suivi seront supprimés de cet appareil.</p><div class="ap-row"><button class="btn" type="button" id="del-ok" style="background:#ff8f7a;border-color:#ff8f7a">Tout effacer</button><button class="btn ghost" type="button" data-close>Annuler</button></div>`,
    (m, close) => { m.querySelector('#del-ok').onclick = () => { try { localStorage.removeItem(KEY); localStorage.removeItem(RKEY); } catch (e) { } S = JSON.parse(JSON.stringify(DEF)); ROADS = null; close(); paintTop(); toast('Tout est effacé'); go('radar'); }; });
}

/* ================= MENTIONS ================= */
function vMentions() {
  VIEW.innerHTML = `<div class="ap-wrap pg"><div style="display:flex;flex-direction:column;gap:12px"><p class="eyebrow">Légal</p><h1 class="ap-h1">Mentions légales et confidentialité.</h1></div>
  <div class="lg">
    <section><h2 class="ap-h2">Éditeur</h2><p>PopSite est édité par <span class="ph">[Nom et prénom ou raison sociale]</span>, <span class="ph">[statut, SIRET]</span>, <span class="ph">[adresse]</span>. Contact : <span class="ph">[adresse e-mail]</span>. Directeur de la publication : <span class="ph">[nom]</span>.</p></section>
    <section><h2 class="ap-h2">Hébergement</h2><p>Le site est hébergé par <span class="ph">[nom de l'hébergeur, adresse, téléphone]</span>.</p></section>
    <section><h2 class="ap-h2">Données des commerces</h2><p>Les commerces affichés viennent d'OpenStreetMap, © les contributeurs d'OpenStreetMap, sous licence ODbL. Le géocodage des villes utilise le service de la Géoplateforme de l'IGN, et Nominatim en secours.</p></section>
    <section><h2 class="ap-h2">Tes données</h2><ul><li>Pendant la bêta, ton compte, tes scans, tes maquettes et tes notes sont enregistrés uniquement dans ton navigateur. Aucun serveur PopSite ne les reçoit.</li><li>Quand tu lances un scan, le nom de la ville et ses coordonnées sont envoyés aux services OpenStreetMap et IGN pour obtenir les résultats.</li><li>PopSite n'utilise ni cookie publicitaire ni outil de suivi.</li><li>Tu peux tout exporter ou tout effacer depuis ton compte, à tout moment.</li></ul></section>
    <section><h2 class="ap-h2">Conditions d'utilisation</h2><ul><li>PopSite t'aide à repérer des commerces et à préparer des maquettes. Tu restes responsable de ta prospection et du respect des règles qui s'y appliquent.</li><li>Les maquettes sont des propositions : ne publie jamais un site sans l'accord du commerçant, et n'y mets aucun avis ni chiffre inventé.</li><li>L'abonnement Pro est sans engagement.</li></ul></section>
  </div></div>`;
}


/* ================= LIEN À ENVOYER ================= */
function shareModal(L) {
  const f = L.f, me = (S.user && S.user.prenom) || '';
  modal(`<p class="eyebrow">Lien de la maquette</p><h2>À envoyer à ${E(L.name)}</h2>
  <p>Le gérant ouvre sa maquette sur son téléphone, quand il veut. Rien n'est publié : toute la maquette tient dans le lien.</p>
  <div class="sh-qr" id="sh-qr"><span class="fine">QR code en préparation…</span></div>
  <input class="ap-input" id="sh-url" readonly value="Préparation du lien…" aria-label="Lien de la maquette">
  <div class="ap-row"><button class="btn" type="button" id="sh-copy" disabled>Copier le lien</button><a class="btn ghost" id="sh-sms" href="#" hidden>Envoyer par SMS</a><button class="btn ghost" type="button" id="sh-msg" disabled>Copier le message</button></div>
  <p class="fine">En boutique : fais-lui scanner le QR code, la maquette s'ouvre sur son téléphone.</p>`, async m => {
    let url = '';
    try { url = await shareUrl(model(L)); } catch (e) { m.querySelector('#sh-url').value = 'Impossible de créer le lien sur ce navigateur.'; return; }
    const msg = `Bonjour, comme promis, voici la maquette du site de ${L.name} : ${url}${me ? '\n' + me : ''}`;
    m.querySelector('#sh-url').value = url;
    const c = m.querySelector('#sh-copy'), cm = m.querySelector('#sh-msg'); c.disabled = cm.disabled = false;
    c.onclick = () => copy(url, 'Lien copié'); cm.onclick = () => copy(msg, 'Message copié');
    const tel = (f.phone || '').replace(/[^\d+]/g, ''), mob = /^(\+33|0)[67]/.test(tel);
    if (!window.claude) { const a = m.querySelector('#sh-sms'); a.hidden = false; a.href = `sms:${mob ? tel : ''}?&body=${encodeURIComponent(msg)}`; }
    qrSvg(url).then(svg => { const q = m.querySelector('#sh-qr'); if (q) q.innerHTML = svg; }).catch(() => { const q = m.querySelector('#sh-qr'); if (q) q.innerHTML = '<span class="fine">QR code indisponible sans connexion</span>'; });
  });
}

/* ================= DEVIS ================= */
function pDevis(L) {
  const P = $('#fc-panel');
  if (!logged()) { P.innerHTML = `<div class="ap-empty"><h2 class="ap-h2">Le devis, après le oui.</h2><p>Crée ton compte pour préparer un devis propre en deux minutes.</p><a class="btn small" href="#inscription">Créer mon compte</a></div>`; return; }
  const B = S.prefs.biz || (S.prefs.biz = { nom: S.user.prenom || '', siret: '', adresse: '', franchise: true, conditions: 'Paiement à réception de facture.' });
  if (!L.devis) {
    S.prefs.devisSeq = (S.prefs.devisSeq || 0) + 1;
    L.devis = { num: 'DEV-' + new Date().getFullYear() + '-' + String(S.prefs.devisSeq).padStart(3, '0'), date: today(), valid: 30,
      lines: [{ t: 'Création du site vitrine : une page adaptée au téléphone, textes, horaires, contact et référencement local', p: S.prefs.price.creation, m: false },
        { t: 'Hébergement, nom de domaine et petites mises à jour', p: S.prefs.price.mensuel, m: true }] };
    keepLead(L); save(true);
  }
  const D = L.devis;
  const html = () => devisHtml(L, D, B);
  P.innerHTML = `<div class="mq">
  <form class="mq-ed" id="dv-f" novalidate>
    <p class="pr-note">Un devis clair rassure et fait signer. Ces infos sont gardées pour tes prochains devis.</p>
    <label class="ap-field">Ton nom ou ton entreprise<input class="ap-input" data-b="nom" value="${E(B.nom)}"></label>
    <label class="ap-field">SIRET<input class="ap-input" data-b="siret" value="${E(B.siret)}" placeholder="Obligatoire pour facturer"></label>
    <label class="ap-field">Ton adresse<input class="ap-input" data-b="adresse" value="${E(B.adresse)}"></label>
    ${D.lines.map((l, i) => `<div class="ap-field">Ligne ${i + 1}${l.m ? ' (par mois)' : ''}<textarea class="ap-area" style="min-height:70px" data-l="${i}" data-k="t">${E(l.t)}</textarea><input class="ap-input" data-l="${i}" data-k="p" inputmode="numeric" value="${E(l.p)}" aria-label="Prix ligne ${i + 1} en euros"></div>`).join('')}
    <label class="ap-field">Conditions de paiement<input class="ap-input" data-b="conditions" value="${E(B.conditions)}"></label>
    <label class="switch">Micro-entreprise : TVA non applicable<input type="checkbox" data-b="franchise" ${B.franchise ? 'checked' : ''}></label>
  </form>
  <div class="mq-pv">
    <div class="ap-row" style="justify-content:space-between"><span class="ap-k">${E(D.num)} · valable ${D.valid} jours</span><span class="fine">Aperçu</span></div>
    <div class="mq-frame"><div class="mq-vp" id="dv-vp" style="height:560px;background:#e9e5dc"><iframe title="Devis" sandbox="allow-same-origin allow-modals" style="width:794px;height:1123px;transform-origin:0 0"></iframe></div></div>
    <div class="mq-act">${window.claude ? '' : '<button class="btn" type="button" id="dv-print">Imprimer ou PDF</button>'}<button class="btn ghost" type="button" id="dv-dl" data-dl ${canDownload() ? '' : 'hidden'}>Télécharger</button><button class="btn ghost" type="button" id="dv-copy">Copier le HTML</button></div>
    <p class="fine">${window.claude ? 'Sur le site en ligne, un bouton imprime le devis ou l\'enregistre en PDF.' : 'Dans la fenêtre d\'impression, choisis « Enregistrer en PDF » pour l\'envoyer par mail.'}</p>
  </div></div>`;
  const vp = $('#dv-vp'), ifr = vp.querySelector('iframe');
  const fit = () => { const s = Math.min(1, vp.clientWidth / 794); ifr.style.transform = `scale(${s})`; vp.style.height = Math.round(1123 * s) + 'px'; };
  const ro = new ResizeObserver(fit); ro.observe(vp); fit(); pvCleanup = () => ro.disconnect();
  let t = 0; const paint = () => { ifr.srcdoc = html(); }; paint();
  $('#dv-f').addEventListener('input', e => {
    const el = e.target;
    if (el.dataset.b) B[el.dataset.b] = el.type === 'checkbox' ? el.checked : el.value;
    if (el.dataset.l != null) { const l = D.lines[+el.dataset.l]; l[el.dataset.k] = el.dataset.k === 'p' ? Math.max(0, parseInt(el.value, 10) || 0) : el.value; }
    keepLead(L); save(); clearTimeout(t); t = setTimeout(paint, 200);
  });
  const pr = $('#dv-print'); if (pr) pr.onclick = () => { try { ifr.contentWindow.focus(); ifr.contentWindow.print(); } catch (e) { toast('Impression impossible ici : utilise « Télécharger »'); } };
  $('#dv-dl').onclick = async () => { if (await download(D.num + '-' + slug(L.name) + '.html', html())) toast('Devis téléchargé'); };
  $('#dv-copy').onclick = () => copy(html(), 'Devis copié');
}
function devisHtml(L, D, B) {
  const f = L.f || {}, once = D.lines.filter(l => !l.m), month = D.lines.filter(l => l.m);
  const tot = xs => xs.reduce((a, l) => a + (+l.p || 0), 0);
  const end = new Date(new Date(D.date + 'T12:00:00').getTime() + D.valid * 864e5).toLocaleDateString('fr-FR');
  const row = l => `<tr><td>${E(l.t)}</td><td class="r">${eur(l.p)}${l.m ? ' / mois' : ''}</td></tr>`;
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><title>${E(D.num)} · ${E(L.name)}</title><style>
  @page{size:A4;margin:16mm}*{box-sizing:border-box}body{margin:0;padding:48px 56px;font:14px/1.5 "Helvetica Neue",Arial,sans-serif;color:#17202e;background:#fff}
  .top{display:flex;justify-content:space-between;gap:30px;margin-bottom:46px}h1{font-size:30px;margin:0 0 6px;letter-spacing:-.5px}.muted{color:#5b6472}.box{border:1px solid #d9d3c6;border-radius:8px;padding:14px 16px;min-width:230px}
  .k{font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:#8a8f99;margin-bottom:4px}table{width:100%;border-collapse:collapse;margin:26px 0}th{font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:#8a8f99;text-align:left;border-bottom:2px solid #17202e;padding:8px 0}
  td{padding:14px 0;border-bottom:1px solid #e4dfd4;vertical-align:top}.r{text-align:right;white-space:nowrap;padding-left:20px}.tot td{border:0;font-weight:700;font-size:16px;padding-top:10px}
  .sign{display:flex;justify-content:space-between;gap:30px;margin-top:40px}.sign div{flex:1;border:1px dashed #b9b2a3;border-radius:8px;height:110px;padding:12px 14px}.foot{margin-top:40px;font-size:12px;color:#5b6472}
  </style></head><body>
  <div class="top"><div><h1>Devis</h1><div class="muted">N° ${E(D.num)} · le ${new Date(D.date + 'T12:00:00').toLocaleDateString('fr-FR')}</div><div class="muted">Valable jusqu'au ${end}</div></div>
  <div class="box"><div class="k">Prestataire</div><strong>${E(B.nom || '[Ton nom]')}</strong><br>${E(B.adresse || '[Ton adresse]')}<br>SIRET : ${E(B.siret || '[À compléter]')}${S.user && S.user.email ? '<br>' + E(S.user.email) : ''}${S.user && S.user.tel ? '<br>' + E(S.user.tel) : ''}</div></div>
  <div class="box" style="max-width:340px"><div class="k">Client</div><strong>${E(L.name)}</strong><br>${E([f.addr || L.addr, f.city || L.city].filter(Boolean).join(', ') || '[Adresse du client]')}</div>
  <table><thead><tr><th>Désignation</th><th class="r">Prix</th></tr></thead><tbody>${D.lines.map(row).join('')}
  <tr class="tot"><td>Total à la commande</td><td class="r">${eur(tot(once))}</td></tr>${month.length ? `<tr class="tot"><td>Puis, chaque mois</td><td class="r">${eur(tot(month))}</td></tr>` : ''}</tbody></table>
  <p>${E(B.conditions || '')}${B.franchise ? '<br>TVA non applicable, article 293 B du CGI.' : '<br>Prix indiqués hors taxes.'}</p>
  <div class="sign"><div><div class="k">Le prestataire</div></div><div><div class="k">Le client · « Bon pour accord », date et signature</div></div></div>
  <p class="foot">L'abonnement mensuel est sans engagement et peut être arrêté à tout moment avec un mois de préavis.</p>
  </body></html>`;
}

/* ================= EXEMPLES ================= */
const EXEMPLES = [
  ['Garage Perrin', 'car_repair', 'atelier', '12 rue des Tanneurs', 'Mo-Fr 08:00-12:00,14:00-18:30; Sa 09:00-12:00', '4,7', '86'],
  ['La Table d\'Odile', 'restaurant', 'vitrine', '3 place de l\'Église', 'Tu-Sa 12:00-14:00,19:00-21:30; Su 12:00-14:00', '4,6', '142'],
  ['Coiffure Mylène', 'hairdresser', 'nuit', '15 Grande Rue', 'Tu-Fr 09:00-12:00,14:00-19:00; Sa 08:30-16:00', '', ''],
  ['Le Fournil d\'Élise', 'bakery', 'atelier', '8 rue du Moulin', 'Tu-Sa 06:30-13:00,15:30-19:30; Su 07:00-12:30', '4,8', '57'],
  ['Menuiserie Roche', 'carpenter', 'vitrine', 'Route de Cluny', 'Mo-Fr 08:00-12:00,13:30-17:30', '', ''],
  ['Fleurs & Saisons', 'florist', 'nuit', '2 place du Marché', 'Tu-Sa 09:00-12:30,14:30-19:00; Su 09:00-12:30', '4,9', '31']
];
function exModel(e) {
  const info = kindInfo(e[1]), L = { name: e[0], kind: e[1], city: 'Saint-Pop', addr: e[3], tags: { opening_hours: e[4] } };
  return { name: e[0], kindLabel: info.label, group: info.g, city: 'Saint-Pop', addr: e[3], phone: '03 53 73 10 ' + String(20 + e[0].length).slice(0, 2), email: '', social: '', hours: parseHours(e[4]), tagline: info.hook, intro: introFor(L, info), services: info.svc.slice(0, 5), rating: e[5], reviews: e[6], cta: info.cta, style: e[2], lat: 46.5641, lon: 4.672, by: '' };
}
function vExemples() {
  VIEW.innerHTML = `<div class="ap-wrap pg">
  <div style="display:flex;flex-direction:column;gap:14px"><p class="eyebrow">Exemples</p><h1 class="ap-h1">Des maquettes qui font dire oui.</h1><p class="ap-sub">Six commerces fictifs, trois styles. Chaque maquette sort en un clic à partir des infos du commerce, et tu ajustes tout.</p></div>
  <div class="ex-grid">${EXEMPLES.map((e, i) => `<article class="ex-card"><div class="ex-vp"><iframe title="Maquette ${E(e[0])}" sandbox="allow-same-origin" loading="lazy" tabindex="-1"></iframe></div><div class="ex-cap"><div><strong>${E(e[0])}</strong><small>${E(kindInfo(e[1]).label)} · style ${STYLES[e[2]].label}</small></div><button class="btn ghost small" type="button" data-ex="${i}">Voir en grand</button></div></article>`).join('')}</div>
  <div class="ap-row"><a class="btn" href="#radar">Fais popper la tienne</a><span class="fine">Gratuit, sans carte bancaire</span></div></div>`;
  const cards = $$('.ex-card');
  cards.forEach((c, i) => { c.querySelector('iframe').srcdoc = buildMockup(exModel(EXEMPLES[i])); });
  const fit = () => cards.forEach(c => { const vp = c.querySelector('.ex-vp'), s = vp.clientWidth / 1280; c.querySelector('iframe').style.transform = `scale(${s})`; });
  const ro = new ResizeObserver(fit); cards.forEach(c => ro.observe(c.querySelector('.ex-vp'))); fit();
  cleanup = () => ro.disconnect();
  $('.ex-grid').addEventListener('click', e => { const b = e.target.closest('[data-ex]'); if (b) showMode(buildMockup(exModel(EXEMPLES[+b.dataset.ex])), EXEMPLES[+b.dataset.ex][0]); });
}

/* ================= GESTION (toi seul, avec ta clé) ================= */
function vGestion() {
  let key = ''; try { key = sessionStorage.getItem('popsite:admin') || ''; } catch (e) { }
  VIEW.innerHTML = `<div class="ap-wrap pg"><div style="display:flex;flex-direction:column;gap:12px"><p class="eyebrow">Gestion</p><h1 class="ap-h1">Tes inscrits.</h1></div>
  ${!ONLINE ? '<div class="ap-empty"><p>Cette page fonctionne sur le site en ligne : elle affiche les inscriptions et les demandes « Préviens-moi » reçues par le serveur.</p></div>' : `
  <form class="ap-row" id="gs-f"><input class="ap-input" style="flex:1 1 260px;max-width:420px" type="password" name="key" placeholder="Ta clé de gestion" value="${E(key)}" aria-label="Clé de gestion"><button class="btn" type="submit">Afficher</button></form>
  <div id="gs-out"></div>`}</div>`;
  if (!ONLINE) return;
  const load = async k => {
    const out = $('#gs-out'); out.innerHTML = '<p class="fine">Chargement…</p>';
    try {
      const r = await fetch('/api/inscrits', { headers: { 'x-admin-key': k } });
      if (r.status === 401) { out.innerHTML = '<p class="au-err">Clé incorrecte.</p>'; return; }
      const j = await r.json(); if (!j.ok) throw 0;
      try { sessionStorage.setItem('popsite:admin', k); } catch (e) { }
      const rows = j.rows, by = s => rows.filter(x => x.source === s).length;
      const csv = 'date;source;prenom;email;ville\n' + rows.map(x => [x.at, x.source, x.prenom, x.email, x.ville].map(v => '"' + String(v || '').replace(/"/g, '""') + '"').join(';')).join('\n');
      out.innerHTML = `<div class="sv-stats"><div class="ap-box sv-stat"><span class="ap-k">Total</span><b>${rows.length}</b></div><div class="ap-box sv-stat"><span class="ap-k">Inscriptions</span><b>${by('inscription')}</b></div><div class="ap-box sv-stat amb"><span class="ap-k">Veulent Pro</span><b>${by('pro')}</b></div><div class="ap-box sv-stat"><span class="ap-k">7 derniers jours</span><b>${rows.filter(x => Date.now() - new Date(x.at) < 7 * 864e5).length}</b></div></div>
      <div class="ap-row" style="margin:18px 0"><button class="btn ghost small" type="button" id="gs-csv">Copier en CSV</button></div>
      <div class="ap-box" style="overflow-x:auto"><table class="pg-cmp" style="max-width:none"><thead><tr><th>Date</th><th>Source</th><th>Prénom</th><th>E-mail</th><th>Ville</th></tr></thead><tbody>${rows.map(x => `<tr><td>${E(new Date(x.at).toLocaleString('fr-FR'))}</td><td>${E(x.source)}</td><td>${E(x.prenom)}</td><td>${E(x.email)}</td><td>${E(x.ville)}</td></tr>`).join('') || '<tr><td colspan="5">Personne pour l\'instant.</td></tr>'}</tbody></table></div>`;
      $('#gs-csv').onclick = () => copy(csv, 'Liste copiée');
    } catch (e) { out.innerHTML = '<p class="au-err">Le serveur n\'a pas répondu. Réessaie dans un instant.</p>'; }
  };
  $('#gs-f').addEventListener('submit', e => { e.preventDefault(); load(String(new FormData(e.target).get('key') || '')); });
  if (key) load(key);
}

/* ---------------- API pour l'accueil ---------------- */
window.PopApp = {
  isAppRoute,
  scan(q) { pendingQ = q; if (route() === 'radar') render('radar'); else location.hash = 'radar'; }
};
if (window.__appOpen) openApp(route());
