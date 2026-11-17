/* Devanture — générateur de maquette : un site vitrine complet, autonome (un seul fichier HTML) */

export const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const DAYS_FR = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
const DK = ['mo', 'tu', 'we', 'th', 'fr', 'sa', 'su'];

/* opening_hours (cas courants) -> 7 lignes lisibles, ou null si format non reconnu */
export function parseHours(s) {
  if (!s) return null;
  s = String(s).trim();
  if (s === '24/7') return DAYS_FR.map(() => '24 h/24');
  const out = Array(7).fill(null);
  const fmt = (h, m) => (+h) + 'h' + (m === '00' ? '' : m);
  const expand = spec => {
    const r = [];
    for (const part of spec.split(',')) {
      const [a, b] = part.trim().toLowerCase().split('-').map(x => DK.indexOf(x.trim()));
      if (a < 0 || (b !== undefined && b < 0)) throw 0;
      if (b === undefined) r.push(a); else for (let i = a; ; i = (i + 1) % 7) { r.push(i); if (i === b) break; }
    }
    return r;
  };
  try {
    for (let rule of s.split(';')) {
      rule = rule.trim(); if (!rule) continue;
      if (/^(PH|SH)\b/i.test(rule)) continue;
      let days = [0, 1, 2, 3, 4, 5, 6], val = rule;
      const m = rule.match(/^((?:Mo|Tu|We|Th|Fr|Sa|Su)(?:\s*[-,]\s*(?:Mo|Tu|We|Th|Fr|Sa|Su))*)(?:\s*,\s*PH)?\s+(.+)$/i);
      if (m) { days = expand(m[1].replace(/\s/g, '')); val = m[2].trim(); }
      else if (!/^\d/.test(rule)) return null;
      if (/^(off|closed)$/i.test(val)) { days.forEach(i => { out[i] = 'Fermé'; }); continue; }
      const sl = val.split(',').map(x => {
        const t = x.trim().match(/^(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})\+?$/);
        if (!t) throw 0;
        return fmt(t[1], t[2]) + ' – ' + fmt(t[3], t[4]);
      });
      days.forEach(i => { out[i] = sl.join(' · '); });
    }
  } catch (e) { return null; }
  if (out.every(v => v === null)) return null;
  return out.map(v => v || 'Fermé');
}

const SECTION = {
  resto: ['La carte', 'À la carte, et à emporter.'], commerce: ['Nos produits', 'Ce que vous trouverez chez nous.'], beaute: ['Prestations', 'Nos prestations.'],
  artisan: ['Savoir-faire', 'Ce que l\'on fait pour vous.'], auto: ['Services', 'Nos services.'], hebergement: ['Le séjour', 'Votre séjour chez nous.'],
  sante: ['Le cabinet', 'Le cabinet en pratique.'], services: ['Services', 'Ce que l\'on fait pour vous.']
};

export const STYLES = {
  atelier: { label: 'Atelier', bg: '#f6f1e7', ink: '#17202e', soft: '#4a5361', acc: '#e2562b', box: '#ece5d6', rule: '#cfc5b0', on: '#ffffff', r: 14, head: '"Bricolage Grotesque", system-ui, sans-serif', body: '"Bricolage Grotesque", system-ui, sans-serif', fonts: 'family=Bricolage+Grotesque:opsz,wght@12..96,400..800' },
  vitrine: { label: 'Vitrine', bg: '#fbfaf6', ink: '#12261c', soft: '#4d5f55', acc: '#1f6b47', box: '#eef1e8', rule: '#cdd6c8', on: '#ffffff', r: 3, head: '"Fraunces", Georgia, serif', body: '"Instrument Sans", system-ui, sans-serif', fonts: 'family=Fraunces:opsz,wght@9..144,500..800&family=Instrument+Sans:wght@400..700' },
  nuit: { label: 'Nuit', bg: '#101826', ink: '#f1ece2', soft: '#a9b4c9', acc: '#ffb23e', box: '#18233a', rule: '#2b3a58', on: '#1a1002', r: 18, head: '"Bricolage Grotesque", system-ui, sans-serif', body: '"Instrument Sans", system-ui, sans-serif', fonts: 'family=Bricolage+Grotesque:opsz,wght@12..96,400..800&family=Instrument+Sans:wght@400..700' }
};

/* devanture vectorielle : enseigne au nom du commerce, store rayé, vitrines */
export function storefront(m, P) {
  const name = esc(m.name.length > 26 ? m.name.slice(0, 25) + '…' : m.name);
  const fs = Math.max(20, Math.min(40, 560 / Math.max(8, m.name.length)));
  const stripes = Array.from({ length: 12 }, (_, i) => `<rect x="${40 + i * 40}" y="150" width="20" height="46" fill="${P.acc}"/>`).join('');
  const scallop = Array.from({ length: 12 }, (_, i) => `<path d="M${40 + i * 40} 196 a20 14 0 0 0 40 0z" fill="${i % 2 ? P.bg : P.acc}" stroke="${P.acc}" stroke-width="2"/>`).join('');
  const night = P.bg === '#101826';
  const glass = night ? '#ffcf7a' : '#bcd3dc', glassOp = night ? .85 : .55;
  return `<svg viewBox="0 0 560 440" role="img" aria-label="Illustration de la devanture de ${name}" xmlns="http://www.w3.org/2000/svg">
<rect width="560" height="440" fill="${P.box}"/>
<rect x="20" y="40" width="520" height="400" fill="${night ? '#1d2940' : '#fffdf8'}" stroke="${P.rule}" stroke-width="2"/>
<rect x="20" y="40" width="520" height="22" fill="${P.rule}" opacity=".55"/>
<rect x="40" y="78" width="480" height="66" rx="4" fill="${P.ink}"/>
<text x="280" y="${111 + fs * .34}" text-anchor="middle" font-family='${P.head.replace(/"/g, '')}' font-weight="800" font-size="${fs}" fill="${P.bg}" letter-spacing="-.5">${name}</text>
<rect x="40" y="150" width="480" height="46" fill="${P.bg}"/>${stripes}${scallop}
<rect x="52" y="226" width="170" height="190" fill="${glass}" opacity="${glassOp}" stroke="${P.ink}" stroke-width="5"/>
<rect x="338" y="226" width="170" height="190" fill="${glass}" opacity="${glassOp}" stroke="${P.ink}" stroke-width="5"/>
<path d="M60 250 l60 -16 M60 290 l110 -34" stroke="#fff" stroke-width="6" opacity=".35"/>
<rect x="240" y="226" width="80" height="214" fill="${P.ink}"/>
<rect x="250" y="238" width="60" height="96" fill="${glass}" opacity="${glassOp}"/>
<circle cx="304" cy="360" r="4" fill="${P.acc}"/>
<rect x="66" y="372" width="142" height="30" rx="3" fill="${P.bg}" opacity=".9"/>
<text x="137" y="392" text-anchor="middle" font-family="monospace" font-size="12" fill="${P.ink}" letter-spacing="1">${esc((m.kindLabel || '').toUpperCase().slice(0, 18))}</text>
</svg>`;
}

function mapSvg(P) {
  return `<svg viewBox="0 0 400 220" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><rect width="400" height="220" fill="${P.box}"/>
<path d="M-10 160 C90 140 160 180 240 120 S360 60 410 70" stroke="${P.rule}" stroke-width="14" fill="none"/>
<path d="M120 -10 C130 60 110 120 150 230" stroke="${P.rule}" stroke-width="9" fill="none"/>
<path d="M260 -10 L300 230 M-10 60 L410 90" stroke="${P.rule}" stroke-width="5" fill="none" opacity=".8"/>
<circle cx="200" cy="112" r="28" fill="${P.acc}" opacity=".18"/><path d="M200 76c-14 0-24 10-24 23 0 18 24 39 24 39s24-21 24-39c0-13-10-23-24-23z" fill="${P.acc}"/><circle cx="200" cy="99" r="8" fill="${P.bg}"/></svg>`;
}

/* m : { name, kindLabel, city, addr, phone, email, social, hours[7]|null, tagline, intro, services[], rating, reviews, cta, style, lat, lon, by } */
export function buildMockup(m) {
  const P = STYLES[m.style] || STYLES.atelier;
  const tel = (m.phone || '').replace(/[^\d+]/g, '');
  const ctaHref = tel ? 'tel:' + tel : '#contact';
  const where = [m.addr, m.city].filter(Boolean).join(', ');
  const svc = (m.services || []).filter(Boolean);
  const rating = parseFloat(String(m.rating || '').replace(',', '.'));
  const hasRating = rating > 0 && rating <= 5;
  const map = m.lat ? `https://www.openstreetmap.org/?mlat=${m.lat.toFixed(5)}&mlon=${m.lon.toFixed(5)}#map=18/${m.lat.toFixed(5)}/${m.lon.toFixed(5)}` : '#';
  const stars = n => '★★★★★'.slice(0, Math.round(n)) + '☆☆☆☆☆'.slice(0, 5 - Math.round(n));
  const hours = m.hours && m.hours.some(Boolean) ? m.hours : null;
  const social = /^https?:\/\//i.test(String(m.social || '').trim()) ? String(m.social).trim() : '';
  const T = SECTION[m.group] || SECTION.services;
  const title = `${m.name} — ${m.kindLabel}${m.city ? ' à ' + m.city : ''}`;
  return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(m.name + ', ' + (m.kindLabel || '').toLowerCase() + (m.city ? ' à ' + m.city : '') + '. ' + (svc.slice(0, 3).join(', ')) + '.')}">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?${P.fonts}&display=swap" rel="stylesheet">
<style>
:root{--bg:${P.bg};--ink:${P.ink};--soft:${P.soft};--acc:${P.acc};--box:${P.box};--rule:${P.rule};--on:${P.on};--r:${P.r}px;--head:${P.head};--body:${P.body}}
*{box-sizing:border-box}html{scroll-behavior:smooth}
body{margin:0;background:var(--bg);color:var(--ink);font-family:var(--body);font-size:17px;line-height:1.55;-webkit-font-smoothing:antialiased}
a{color:inherit}h1,h2,h3,p{margin:0}
h1,h2,h3{font-family:var(--head);font-weight:800;letter-spacing:-.03em;line-height:1.02;text-wrap:balance}
.wrap{max-width:1120px;margin:0 auto;padding:0 clamp(18px,4vw,40px)}
.proto{background:var(--ink);color:var(--bg);font:600 11px/1 ui-monospace,Menlo,monospace;letter-spacing:.12em;text-transform:uppercase;text-align:center;padding:9px 12px}
.nav{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:18px 0}
.logo{font-family:var(--head);font-weight:800;font-size:22px;letter-spacing:-.03em;text-decoration:none}
.nav nav{display:flex;gap:26px;font-size:15px;color:var(--soft)}.nav nav a{text-decoration:none}.nav nav a:hover{color:var(--ink)}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:48px;padding:0 22px;border-radius:999px;background:var(--acc);color:var(--on);font-weight:700;text-decoration:none;border:2px solid var(--acc);white-space:nowrap}
.btn.ghost{background:transparent;color:var(--ink);border-color:var(--rule)}
.btn.sm{min-height:40px;padding:0 16px;font-size:15px}
.hero{display:grid;grid-template-columns:1.1fr 1fr;gap:clamp(24px,5vw,64px);align-items:center;padding:clamp(28px,6vw,72px) 0 clamp(40px,7vw,88px)}
.kicker{font:600 12px/1.2 ui-monospace,Menlo,monospace;letter-spacing:.14em;text-transform:uppercase;color:var(--acc);margin-bottom:18px}
.hero h1{font-size:clamp(40px,6vw,76px)}
.lead{color:var(--soft);font-size:clamp(17px,1.6vw,20px);margin:20px 0 28px;max-width:40ch}
.actions{display:flex;flex-wrap:wrap;gap:10px}
.facts{list-style:none;padding:0;margin:28px 0 0;display:flex;flex-wrap:wrap;gap:8px 22px;color:var(--soft);font-size:15px}
.facts li::before{content:"";display:inline-block;width:7px;height:7px;border-radius:50%;background:var(--acc);margin-right:9px;vertical-align:2px}
.visual{margin:0;border-radius:var(--r);overflow:hidden;border:1px solid var(--rule);position:relative}
.visual svg{display:block;width:100%;height:auto}
.visual figcaption{position:absolute;right:12px;top:12px;font:600 10px/1 ui-monospace,Menlo,monospace;letter-spacing:.1em;text-transform:uppercase;background:var(--bg);color:var(--soft);padding:7px 9px;border-radius:999px;border:1px solid var(--rule)}
section{padding:clamp(48px,8vw,96px) 0;border-top:1px solid var(--rule)}
.head{display:flex;justify-content:space-between;align-items:end;gap:20px;margin-bottom:34px}
.head h2{font-size:clamp(32px,4.4vw,52px)}
.head p{color:var(--soft);max-width:36ch}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:14px}
.card{background:var(--box);border-radius:var(--r);padding:22px;display:flex;flex-direction:column;gap:30px;min-height:150px;justify-content:space-between}
.card b{font:600 11px/1 ui-monospace,Menlo,monospace;color:var(--acc);letter-spacing:.1em}
.card h3{font-size:23px}
.avis{display:grid;grid-template-columns:auto 1fr;gap:clamp(20px,5vw,60px);align-items:center}
.score{font-family:var(--head);font-weight:800;font-size:clamp(72px,11vw,140px);letter-spacing:-.05em;line-height:.85}
.stars{color:var(--acc);font-size:26px;letter-spacing:4px}
.two{display:grid;grid-template-columns:1fr 1fr;gap:clamp(28px,6vw,80px)}
table{width:100%;border-collapse:collapse;font-size:16px}
td{padding:12px 0;border-bottom:1px solid var(--rule)}td:last-child{text-align:right;color:var(--soft)}
tr.closed td:last-child{opacity:.6}
address{font-style:normal;font-size:20px;line-height:1.4;margin:6px 0 18px}
.lines{display:flex;flex-direction:column;gap:8px;margin-bottom:20px}
.lines a{font-weight:600;text-decoration:none;border-bottom:1px solid var(--rule);align-self:flex-start}
.map{display:block;border-radius:var(--r);overflow:hidden;border:1px solid var(--rule)}.map svg{display:block;width:100%;height:auto}
.band{background:var(--ink);color:var(--bg);border-radius:var(--r);padding:clamp(28px,5vw,56px);display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:20px}
.band h2{font-size:clamp(30px,4vw,48px);max-width:16ch}
.band .btn{background:var(--acc);border-color:var(--acc)}
footer{padding:34px 0 46px;color:var(--soft);font-size:14px;display:flex;flex-wrap:wrap;justify-content:space-between;gap:10px 24px;border-top:1px solid var(--rule)}
footer a{text-decoration:none}
@media (max-width:780px){
  .nav nav{display:none}.hero,.two,.avis{grid-template-columns:1fr}.head{flex-direction:column;align-items:start}
  .hero{padding-top:12px}.nav .btn{min-height:40px;padding:0 14px;font-size:14px}
}
</style></head>
<body>
${m.by ? `<div class="proto">Maquette proposée par ${esc(m.by)} · aperçu non publié</div>` : ''}
<div class="wrap">
<header class="nav"><a class="logo" href="#">${esc(m.name)}</a>
<nav aria-label="Menu"><a href="#prestations">${svc.length ? T[0] : 'Accueil'}</a>${hours ? '<a href="#horaires">Horaires</a>' : ''}<a href="#contact">Contact</a></nav>
<a class="btn sm" href="${ctaHref}">${esc(m.cta)}</a></header>
<div class="hero">
<div><p class="kicker">${esc(m.kindLabel)}${m.city ? ' · ' + esc(m.city) : ''}</p>
<h1>${esc(m.tagline)}</h1>
<p class="lead">${esc(m.intro)}</p>
<div class="actions"><a class="btn" href="${ctaHref}">${esc(m.cta)}</a><a class="btn ghost" href="#contact">Nous trouver</a></div>
<ul class="facts">${where ? `<li>${esc(where)}</li>` : ''}${m.phone ? `<li>${esc(m.phone)}</li>` : ''}${hasRating ? `<li>${String(rating).replace('.', ',')} ★ sur Google</li>` : ''}</ul></div>
<figure class="visual">${storefront(m, P)}<figcaption>Votre photo ici</figcaption></figure>
</div>
</div>
${svc.length ? `<section id="prestations"><div class="wrap"><div class="head"><h2>${T[1]}</h2><p>${esc(m.name)}${m.city ? ', à ' + esc(m.city) : ''}. Passez nous voir ou appelez-nous.</p></div>
<div class="grid">${svc.map((s, i) => `<article class="card"><b>${String(i + 1).padStart(2, '0')}</b><h3>${esc(s)}</h3></article>`).join('')}</div></div></section>` : ''}
${hasRating ? `<section><div class="wrap avis"><p class="score">${String(rating).replace('.', ',')}</p><div><p class="stars" aria-label="${rating} sur 5">${stars(rating)}</p><h2 style="font-size:clamp(26px,3.4vw,40px);margin-top:10px">${m.reviews ? esc(m.reviews) + ' avis Google' : 'Note Google'}, merci à vous.</h2></div></div></section>` : ''}
<section id="contact"><div class="wrap two">
${hours ? `<div id="horaires"><div class="head"><h2>Horaires</h2></div><table>${DAYS_FR.map((d, i) => `<tr${/ferm/i.test(hours[i] || '') ? ' class="closed"' : ''}><td>${d}</td><td>${esc(hours[i] || 'Fermé')}</td></tr>`).join('')}</table></div>` : ''}
<div><div class="head"><h2>Nous trouver</h2></div>
${where ? `<address>${esc(m.name)}<br>${esc(where)}</address>` : ''}
<div class="lines">${m.phone ? `<a href="tel:${tel}">${esc(m.phone)}</a>` : ''}${m.email ? `<a href="mailto:${esc(m.email)}">${esc(m.email)}</a>` : ''}${social ? `<a href="${esc(social)}">Suivez-nous sur les réseaux</a>` : ''}</div>
<a class="map" href="${map}" aria-label="Voir l'itinéraire">${mapSvg(P)}</a></div>
</div></section>
<div class="wrap" style="padding-bottom:clamp(40px,7vw,80px)"><div class="band"><h2>${m.phone ? 'Une question ? Appelez-nous.' : 'Passez nous voir.'}</h2><a class="btn" href="${ctaHref}">${esc(m.phone || m.cta)}</a></div></div>
<div class="wrap"><footer><span>© ${new Date().getFullYear()} ${esc(m.name)}${where ? ' · ' + esc(where) : ''}</span><span><a href="#">Mentions légales</a></span></footer></div>
</body></html>`;
}

export function slug(s) {
  return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'commerce';
}
