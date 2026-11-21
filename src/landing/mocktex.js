/* Devanture — la maquette du commerce dessinée en haute définition (texture), découpée en tranches qui s'assemblent en 3D. */
export const MW = 1600, MH = 1000;
export const SLICES = [[0, 64], [64, 168], [168, 560], [560, 662], [662, 842], [842, 1000]];
export const STYLES = {
  atelier: { bg: '#f6f1e7', ink: '#17202e', soft: '#4a5361', acc: '#d9502a', box: '#ece5d6', rule: '#cfc5b0', bar: '#e6dfd0', on: '#ffffff', head: '800 {s}px "Big Shoulders", "Arial Narrow", sans-serif', r: 18 },
  vitrine: { bg: '#fbfaf6', ink: '#12261c', soft: '#4d5f55', acc: '#1f6b47', box: '#eef1e8', rule: '#cdd6c8', bar: '#e9ece3', on: '#ffffff', head: '600 {s}px Georgia, "Times New Roman", serif', r: 4, small: 0.82 },
  nuit: { bg: '#101826', ink: '#f2eee6', soft: '#a9b4c9', acc: '#ffb547', box: '#18233a', rule: '#2b3a58', bar: '#0b111d', on: '#1a1002', head: '800 {s}px "Big Shoulders", "Arial Narrow", sans-serif', r: 26 }
};
const BODY = s => `500 ${s}px "Instrument Sans", system-ui, sans-serif`;
const BOLD = s => `650 ${s}px "Instrument Sans", system-ui, sans-serif`;

function rr(g, x, y, w, h, r) { g.beginPath(); g.roundRect ? g.roundRect(x, y, w, h, r) : g.rect(x, y, w, h); }
function pill(g, x, y, text, st, size, filled) {
  g.font = BOLD(size); const w = g.measureText(text).width + size * 1.6, h = size * 2;
  rr(g, x, y, w, h, h / 2);
  if (filled) { g.fillStyle = st.acc; g.fill(); g.fillStyle = st.on; }
  else { g.strokeStyle = st.rule; g.lineWidth = 2; g.stroke(); g.fillStyle = st.ink; }
  g.textBaseline = 'middle'; g.fillText(text, x + size * 0.8, y + h / 2 + 1);
  return w;
}

export function drawMock(cv, styleKey, shop) {
  const st = STYLES[styleKey] || STYLES.atelier, g = cv.getContext('2d');
  const S = shop || { name: 'Garage Perrin', url: 'garage-perrin.fr', line: 'Votre voiture, entre de bonnes mains.', sub: 'Entretien, pneus, freins et clim.', addr: '12 rue des Tanneurs', cta: 'Prendre RDV', call: 'Appeler le garage' };
  const H = s => st.head.replace('{s}', Math.round(s * (st.small || 1)));
  g.clearRect(0, 0, MW, MH);
  g.save(); rr(g, 0, 0, MW, MH, 30); g.clip();
  g.fillStyle = st.bg; g.fillRect(0, 0, MW, MH);
  // barre du navigateur
  g.fillStyle = st.bar; g.fillRect(0, 0, MW, 64);
  g.fillStyle = st.rule; g.fillRect(0, 63, MW, 1);
  ['#ff6b5e', '#ffbe3d', '#38c84d'].forEach((c, i) => { g.beginPath(); g.arc(36 + i * 26, 32, 8, 0, Math.PI * 2); g.fillStyle = styleKey === 'nuit' ? '#3a4a68' : c; g.fill(); });
  rr(g, 520, 16, 560, 32, 16); g.fillStyle = st.bg; g.fill();
  g.font = BODY(17); g.fillStyle = st.soft; g.textBaseline = 'middle'; g.textAlign = 'center'; g.fillText(S.url, 800, 33); g.textAlign = 'left';
  // navigation
  g.font = H(46); g.fillStyle = st.ink; g.textBaseline = 'alphabetic'; g.fillText(S.name, 64, 132);
  g.font = BODY(22); g.fillStyle = st.soft; let lx = 820;
  for (const t of ['Services', 'Horaires', 'Avis', 'Contact']) { g.fillText(t, lx, 128); lx += g.measureText(t).width + 40; }
  g.font = BOLD(21); const cw = g.measureText(S.cta).width + 34;
  pill(g, MW - 64 - cw, 92, S.cta, st, 21, true);
  // héros
  g.fillStyle = st.ink; g.textBaseline = 'alphabetic';
  const words = S.line.split(' '), maxW = 780;
  let fs = 112, lines;
  for (; fs > 60; fs -= 4) {
    g.font = H(fs); lines = []; let line = '';
    for (const w of words) { const tst = line ? line + ' ' + w : w; if (g.measureText(tst).width > maxW && line) { lines.push(line); line = w; } else line = tst; }
    lines.push(line); if (lines.length <= 2) break;
  }
  let y = 250 + fs * 0.35;
  for (const l of lines) { g.fillText(l, 64, y); y += fs * 0.92; }
  g.font = BODY(27); g.fillStyle = st.soft; g.fillText(S.sub, 64, y + 18); g.fillText(S.addr + ' · du lundi au samedi', 64, y + 56);
  // visuel : la devanture du garage, dessinée
  const px = 900, py = 196, pw = 636, ph = 344;
  g.save(); rr(g, px, py, pw, ph, st.r); g.clip();
  const gr = g.createLinearGradient(0, py, 0, py + ph); gr.addColorStop(0, st.box); gr.addColorStop(1, st.rule); g.fillStyle = gr; g.fillRect(px, py, pw, ph);
  // porte de garage à lames
  g.fillStyle = styleKey === 'nuit' ? '#22314f' : '#d8cfbd'; g.fillRect(px + 60, py + 70, pw - 120, ph - 70);
  g.strokeStyle = styleKey === 'nuit' ? '#2f4268' : '#c4b9a3'; g.lineWidth = 3;
  for (let k = py + 96; k < py + ph; k += 26) { g.beginPath(); g.moveTo(px + 60, k); g.lineTo(px + pw - 60, k); g.stroke(); }
  g.fillStyle = st.acc; g.fillRect(px + 60, py + 46, pw - 120, 24);
  g.font = BOLD(15); g.fillStyle = st.on; g.textBaseline = 'middle'; g.fillText(S.name.toUpperCase(), px + 74, py + 59);
  // voiture
  const cx = px + 150, cy = py + ph - 30;
  g.fillStyle = st.ink; g.beginPath();
  g.moveTo(cx, cy - 22); g.quadraticCurveTo(cx + 4, cy - 64, cx + 70, cy - 70); g.lineTo(cx + 140, cy - 112);
  g.quadraticCurveTo(cx + 210, cy - 128, cx + 270, cy - 110); g.lineTo(cx + 330, cy - 72); g.quadraticCurveTo(cx + 380, cy - 66, cx + 384, cy - 30); g.lineTo(cx + 384, cy - 14); g.lineTo(cx, cy - 14); g.closePath(); g.fill();
  g.fillStyle = st.box; g.beginPath(); g.moveTo(cx + 156, cy - 102); g.quadraticCurveTo(cx + 210, cy - 116, cx + 258, cy - 102); g.lineTo(cx + 300, cy - 74); g.lineTo(cx + 120, cy - 74); g.closePath(); g.fill();
  for (const wx of [cx + 82, cx + 300]) { g.beginPath(); g.arc(wx, cy - 12, 34, 0, Math.PI * 2); g.fillStyle = st.ink; g.fill(); g.beginPath(); g.arc(wx, cy - 12, 15, 0, Math.PI * 2); g.fillStyle = st.rule; g.fill(); }
  g.restore();
  // pastilles de services
  let cx2 = 64; for (const t of ['Révision', 'Pneus', 'Freins', 'Climatisation', 'Contrôle avant vente', 'Diagnostic']) cx2 += pill(g, cx2, 586, t, st, 22, false) + 14;
  // horaires / avis
  const boxes = [['Horaires', 'Lundi – vendredi  8 h – 18 h 30', 'Samedi  9 h – 12 h'], ['Avis Google', '4,7 ★', '86 avis de clients du coin'], ['Téléphone', '03 85 •• •• ••', 'Rappel sous 24 h']];
  boxes.forEach((b, i) => {
    const bx = 64 + i * 498, bw = 474; rr(g, bx, 676, bw, 148, st.r); g.fillStyle = st.box; g.fill();
    g.font = BOLD(17); g.fillStyle = st.soft; g.textBaseline = 'alphabetic'; g.fillText(b[0], bx + 26, 714);
    if (i === 1) { g.font = H(54); g.fillStyle = st.ink; g.fillText(b[1], bx + 26, 776); g.font = BODY(20); g.fillStyle = st.soft; g.fillText(b[2], bx + 26, 806); }
    else { g.font = BODY(25); g.fillStyle = st.ink; g.fillText(b[1], bx + 26, 760); g.fillText(b[2], bx + 26, 796); }
  });
  // appel à l'action
  rr(g, 64, 862, MW - 128, 104, st.r); g.fillStyle = st.ink; g.fill();
  g.font = H(44); g.fillStyle = st.bg; g.textBaseline = 'middle'; g.fillText('Une question, un devis ?', 100, 915);
  g.font = BOLD(23); const ww = g.measureText(S.call).width + 40;
  rr(g, MW - 100 - ww, 890, ww, 50, 25); g.fillStyle = st.acc; g.fill(); g.fillStyle = st.on; g.fillText(S.call, MW - 100 - ww + 20, 916);
  g.restore();
}

/* enseigne peinte au-dessus de la vitrine */
export function drawSign(cv, name) {
  const g = cv.getContext('2d'), W = cv.width, H = cv.height;
  g.clearRect(0, 0, W, H);
  g.fillStyle = '#0b1322'; rr(g, 0, 0, W, H, 14); g.fill();
  g.strokeStyle = 'rgba(255,190,110,.35)'; g.lineWidth = 4; rr(g, 8, 8, W - 16, H - 16, 10); g.stroke();
  g.fillStyle = '#ffb547'; g.font = `800 ${Math.round(H * 0.62)}px "Big Shoulders", "Arial Narrow", sans-serif`;
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(name.toUpperCase(), W / 2, H / 2 + H * 0.04);
}
