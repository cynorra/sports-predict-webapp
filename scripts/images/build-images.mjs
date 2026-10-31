// Generates every post image from data, so nothing is stock art or a fake photo:
//   public/images/<slug>.svg          cover image shown at the top of the post (1200x630)
//   public/images/<slug>.png          same cover as PNG, used for og:image / twitter:image / JSON-LD
//   public/images/<slug>-<fig>.svg    explanatory figures embedded in the article body
// All numbers come from the Elo formula, the Poisson maths (same as src/lib/model.ts) or the figures quoted in the
// article itself. Illustrative examples are labelled as such inside the image.
// Run: npm run images   (output is committed; the build only verifies it via `npm run audit`).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import sharp from 'sharp';
import { predictMatch } from '../../src/lib/model.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = join(ROOT, 'public', 'images');
mkdirSync(OUT, { recursive: true });

const PITCH = '#0b6e4f', DARK = '#084c38', GOLD = '#f5b700', INK = '#0f172a', SLATE = '#64748b', LIGHT = '#e2e8f0', RED = '#b91c1c';
const FONT = 'font-family="Arial, Helvetica, sans-serif"';

// ---------- helpers ----------
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const r1 = (n) => Math.round(n * 10) / 10;
function t(x, y, s, { size = 24, weight = 400, fill = INK, anchor = 'start', opacity = 1, rotate } = {}) {
  const tr = rotate ? ` transform="rotate(${rotate} ${x} ${y})"` : '';
  const op = opacity < 1 ? ` opacity="${opacity}"` : '';
  return `<text x="${r1(x)}" y="${r1(y)}" ${FONT} font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}"${op}${tr}>${esc(s)}</text>`;
}
function wrap(s, maxPx, size, widthEm = 0.5) {
  const cw = size * widthEm, lines = [];
  let cur = '';
  for (const word of s.split(' ')) {
    const next = cur ? `${cur} ${word}` : word;
    if (next.length * cw > maxPx && cur) { lines.push(cur); cur = word; } else cur = next;
  }
  if (cur) lines.push(cur);
  return lines;
}
const svgDoc = (w, h, title, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${esc(title)}"><title>${esc(title)}</title>${body}</svg>\n`;

/** White card with title, subtitle and a wrapped source/explanation note at the bottom. */
function frame(w, h, { title, sub, note }, inner) {
  const noteLines = note ? wrap(note, w - 80, 20, 0.5) : [];
  const noteSvg = noteLines.map((l, i) => t(40, h - 20 - (noteLines.length - 1 - i) * 26, l, { size: 20, fill: SLATE })).join('');
  return svgDoc(w, h, title,
    `<rect x="1" y="1" width="${w - 2}" height="${h - 2}" rx="18" fill="#fff" stroke="${LIGHT}" stroke-width="2"/>` +
    t(40, 58, title, { size: 34, weight: 700 }) + (sub ? t(40, 94, sub, { size: 23, fill: SLATE }) : '') + inner + noteSvg);
}
/** Height needed so the note never collides with the figure body. */
const noteH = (note, w = 1200) => (note ? wrap(note, w - 80, 20, 0.5).length * 26 + 20 : 0);

// ---------- maths (kept identical to src/lib/model.ts) ----------
const poisson = (k, l) => { let p = Math.exp(-l); for (let i = 1; i <= k; i++) p *= l / i; return p; };
const eloExpected = (gap) => 1 / (1 + Math.pow(10, -gap / 400));
function scoreGrid(xgH, xgA, max = 12) {
  const cells = []; let h = 0, d = 0, a = 0;
  for (let i = 0; i <= max; i++) for (let j = 0; j <= max; j++) {
    const p = poisson(i, xgH) * poisson(j, xgA);
    cells.push({ i, j, p }); if (i > j) h += p; else if (i === j) d += p; else a += p;
  }
  return { cells, h, d, a };
}

// ---------- in-article figures ----------
function figEloCurve() {
  const w = 1200, note = 'Expected score counts a win as 1, a draw as 0.5 and a loss as 0, so it is not a win probability. Computed from the standard Elo formula E = 1 / (1 + 10^(-gap / 400)).';
  const h = 640 + noteH(note);
  const X = (g) => 130 + ((g + 400) / 800) * 1000, Y = (e) => 520 - e * 380;
  let g = '';
  for (const e of [0, 0.25, 0.5, 0.75, 1]) {
    g += `<line x1="130" x2="1130" y1="${Y(e)}" y2="${Y(e)}" stroke="${e === 0.5 ? SLATE : LIGHT}" stroke-width="2"${e === 0.5 ? ' stroke-dasharray="8 8"' : ''}/>` + t(110, Y(e) + 8, `${e * 100}%`, { size: 22, fill: SLATE, anchor: 'end' });
  }
  for (const x of [-400, -200, 0, 200, 400]) g += t(X(x), 556, x > 0 ? `+${x}` : `${x}`, { size: 22, fill: SLATE, anchor: 'middle' });
  const pts = []; for (let x = -400; x <= 400; x += 10) pts.push(`${r1(X(x))},${r1(Y(eloExpected(x)))}`);
  g += `<polyline points="${pts.join(' ')}" fill="none" stroke="${PITCH}" stroke-width="6" stroke-linejoin="round"/>`;
  for (const gap of [0, 100, 200, 400]) {
    const e = eloExpected(gap), px = X(gap), py = Y(e);
    g += `<line x1="${px}" x2="${px}" y1="${py}" y2="520" stroke="${GOLD}" stroke-width="2" stroke-dasharray="4 6"/><circle cx="${px}" cy="${py}" r="11" fill="${GOLD}" stroke="${INK}" stroke-width="3"/>`;
    const label = gap === 0 ? 'Equal ratings: 50%' : `+${gap} points: ${Math.round(e * 100)}%`;
    g += gap === 400 ? t(px + 10, py - 28, label, { size: 24, weight: 700, anchor: 'end' }) : t(px + 18, py + 40, label, { size: 24, weight: 700 });
  }
  g += t(630, 604, "Rating gap (team's rating minus opponent's rating)", { size: 22, fill: INK, anchor: 'middle' });
  return frame(w, h, { title: 'Elo: expected score by rating gap', sub: 'The bigger the gap, the more the stronger team is expected to score', note }, g);
}

function figEloExample() {
  const w = 1200, note = 'Home side rated 1900 against a visitor rated 1800, a 65-point home bonus and K = 30. Expected score 0.72, so the changes are 30 x (1 - 0.72), 30 x (0.5 - 0.72) and 30 x (0 - 0.72). The visitor moves by the opposite amounts.';
  const h = 590 + noteH(note);
  const E = eloExpected(1900 + 65 - 1800);
  const rows = [['Home win', 30 * (1 - E), PITCH], ['Draw', 30 * (0.5 - E), '#d97706'], ['Home loss', 30 * (0 - E), RED]];
  const base = 255, k = 9; let g = `<line x1="60" x2="1140" y1="${base}" y2="${base}" stroke="${SLATE}" stroke-width="3"/>`;
  rows.forEach(([name, v, c], i) => {
    const cx = 230 + i * 370, val = Math.round(v), hgt = Math.abs(v) * k;
    const y = v >= 0 ? base - hgt : base;
    g += `<rect x="${cx - 70}" y="${y}" width="140" height="${hgt}" rx="6" fill="${c}"/>`;
    g += t(cx, v >= 0 ? y - 14 : y + hgt + 34, `${val > 0 ? '+' : '−'}${Math.abs(val)}`, { size: 38, weight: 700, anchor: 'middle', fill: c });
    g += t(cx, 535, name, { size: 26, weight: 700, anchor: 'middle' });
  });
  g += t(60, base + 28, 'rating points', { size: 20, fill: SLATE });
  return frame(w, h, { title: "Home side's rating change after the match", sub: 'Same teams, three results: an upset moves ratings far more than a routine win', note }, g);
}

function figHomeSplit() {
  const w = 1200, note = 'Approximate long-run averages for the major European leagues. Exact figures vary by league and season; check a current sample (for example on FBref) before relying on them.';
  const h = 330 + noteH(note);
  const segs = [['Home win', 45, PITCH, '#fff'], ['Draw', 25, SLATE, '#fff'], ['Away win', 30, GOLD, INK]];
  let x = 40, g = '';
  segs.forEach(([name, pct, c, tc], i) => {
    const sw = 1120 * pct / 100;
    g += `<rect x="${x}" y="140" width="${sw}" height="100" fill="${c}"${i === 0 ? ' rx="10"' : ''}/>`;
    g += t(x + sw / 2, 188, name, { size: 28, weight: 700, fill: tc, anchor: 'middle' }) + t(x + sw / 2, 222, `${pct}%`, { size: 28, fill: tc, anchor: 'middle' });
    x += sw;
  });
  g += t(40, 288, 'Typical goals per match: home side about 1.5, visitors about 1.2', { size: 24, fill: INK });
  return frame(w, h, { title: 'How top-league matches usually end', sub: 'Share of results across major European leagues, historically', note }, g);
}

function figHomeExample() {
  const w = 1200, note = 'Independent Poisson goals, the same method as our model. Neutral pitch: 1.3 expected goals each. With the home bonus: hosts +0.3, visitors -0.1 (1.6 vs 1.2). Percentages are rounded and may not add to exactly 100.';
  const h = 470 + noteH(note);
  const rows = [['Neutral pitch: 1.3 vs 1.3 expected goals', 1.3, 1.3], ['With home bonus: 1.6 vs 1.2 expected goals', 1.6, 1.2]];
  let g = '';
  rows.forEach(([label, a, b], r) => {
    const { h: ph, d: pd, a: pa } = scoreGrid(a, b);
    const y = 150 + r * 140; let x = 40;
    g += t(40, y - 14, label, { size: 24, weight: 700 });
    [[ph, PITCH, '#fff'], [pd, SLATE, '#fff'], [pa, GOLD, INK]].forEach(([p, c, tc]) => {
      const sw = 1120 * p;
      g += `<rect x="${x}" y="${y}" width="${sw}" height="72" fill="${c}"/>` + t(x + sw / 2, y + 47, `${Math.round(p * 100)}%`, { size: 30, weight: 700, fill: tc, anchor: 'middle' });
      x += sw;
    });
  });
  const lg = [['Home win', PITCH], ['Draw', SLATE], ['Away win', GOLD]];
  lg.forEach(([n, c], i) => { g += `<rect x="${40 + i * 190}" y="405" width="26" height="26" rx="4" fill="${c}"/>` + t(76 + i * 190, 427, n, { size: 22 }); });
  return frame(w, h, { title: 'What a third of a goal changes', sub: 'Two evenly matched sides, with and without home advantage', note }, g);
}

function figClBands() {
  const w = 1200, note = 'Source: UEFA competition regulations (uefa.com). Regulations can change between seasons.';
  const h = 400 + noteH(note);
  const sq = 31; let g = '';
  const color = (i) => (i < 8 ? GOLD : i < 24 ? PITCH : '#cbd5e1');
  for (let i = 0; i < 36; i++) g += `<rect x="${40 + i * sq}" y="140" width="29" height="44" rx="4" fill="${color(i)}"/>`;
  const bands = [[0, 8, GOLD, '1st–8th', 'Round of 16', 'straight through'], [8, 24, PITCH, '9th–24th', 'Two-leg play-off', '9–16 seeded, 17–24 unseeded'], [24, 36, '#94a3b8', '25th–36th', 'Eliminated', 'no drop to another competition']];
  for (const [a, b, c, pos, what, extra] of bands) {
    const x1 = 40 + a * sq, x2 = 40 + b * sq - 2;
    g += `<path d="M${x1} 204 V214 H${x2} V204" fill="none" stroke="${c}" stroke-width="4"/>`;
    g += t(x1, 262, pos, { size: 28, weight: 700 }) + t(x1, 298, what, { size: 24 }) + t(x1, 330, extra, { size: 20, fill: SLATE });
  }
  return frame(w, h, { title: 'What each league-phase finish is worth', sub: '36 clubs in one table after eight matchdays', note }, g);
}

function figClPots() {
  const w = 1200, note = 'Clubs from the same national association cannot meet in the league phase. The draw decides which two clubs from each pot you face.';
  const h = 560 + noteH(note);
  const mid = 330;
  let g = `<circle cx="190" cy="${mid}" r="96" fill="${GOLD}" stroke="${INK}" stroke-width="4"/>` + t(190, mid - 2, 'One club', { size: 28, weight: 700, anchor: 'middle' }) + t(190, mid + 30, '8 matches', { size: 24, anchor: 'middle' });
  for (let i = 0; i < 4; i++) {
    const y = 125 + i * 92;
    g += `<line x1="286" y1="${mid}" x2="540" y2="${y + 34}" stroke="${SLATE}" stroke-width="2.5"/>`;
    g += `<rect x="540" y="${y}" width="620" height="68" rx="12" fill="#f1f5f9" stroke="${LIGHT}" stroke-width="2"/>`;
    g += t(566, y + 43, `Pot ${i + 1}`, { size: 28, weight: 700 }) + t(676, y + 43, '9 clubs', { size: 24, fill: SLATE }) + t(1136, y + 43, '1 at home + 1 away', { size: 26, weight: 700, fill: PITCH, anchor: 'end' });
  }
  g += t(1160, 125 + 4 * 92 + 30, '4 pots x 2 opponents = 8 matches: 4 at home, 4 away', { size: 24, weight: 700, anchor: 'end' });
  return frame(w, h, { title: 'How the eight opponents are drawn', sub: 'Pots are based on UEFA club coefficients', note }, g);
}

/** Half pitch, goal at the top; 12 px per metre. */
function figXgPitch() {
  const w = 1200, note = 'Illustrative values taken from the examples in this article, not real match data. The penalty value (about 0.76) is the figure most data providers use.';
  const h = 830 + noteH(note) - 20;
  const s = 12, ox = 40, oy = 130, cx = ox + 34 * s;
  let g = `<rect x="${ox}" y="${oy}" width="${68 * s}" height="${52.5 * s}" fill="#eef7f2" stroke="${PITCH}" stroke-width="4"/>`;
  g += `<rect x="${cx - 3.66 * s}" y="${oy - 14}" width="${7.32 * s}" height="14" fill="#fff" stroke="${PITCH}" stroke-width="4"/>`;
  g += `<rect x="${cx - 20.16 * s}" y="${oy}" width="${40.32 * s}" height="${16.5 * s}" fill="none" stroke="${PITCH}" stroke-width="4"/>`;
  g += `<rect x="${cx - 9.16 * s}" y="${oy}" width="${18.32 * s}" height="${5.5 * s}" fill="none" stroke="${PITCH}" stroke-width="4"/>`;
  const sy = oy + 11 * s, rr = 9.15 * s, dx = Math.sqrt(rr * rr - (16.5 * s - 11 * s) ** 2);
  g += `<path d="M${cx - dx} ${oy + 16.5 * s} A${rr} ${rr} 0 0 0 ${cx + dx} ${oy + 16.5 * s}" fill="none" stroke="${PITCH}" stroke-width="4"/><circle cx="${cx}" cy="${sy}" r="4" fill="${PITCH}"/>`;
  const shots = [['A', cx - 68, oy + 102, 0.33], ['B', cx + 72, oy + 420, 0.02], ['C', cx, sy, 0.76]];
  for (const [, x, y] of shots) g += `<line x1="${x}" y1="${y}" x2="${cx}" y2="${oy}" stroke="${INK}" stroke-width="2" stroke-dasharray="6 8" opacity="0.5"/>`;
  for (const [l, x, y, v] of shots) g += `<circle cx="${x}" cy="${y}" r="${14 + v * 30}" fill="${PITCH}" fill-opacity="0.92" stroke="${GOLD}" stroke-width="4"/>` + t(x, y + 8, l, { size: 22, weight: 700, fill: '#fff', anchor: 'middle' });
  const info = [['A', 'Striker alone, about ten metres out', '0.33'], ['B', 'Speculative shot from about 35 metres through a crowd', '0.02'], ['C', 'Penalty kick', '0.76']];
  info.forEach(([l, d, v], i) => {
    const y = 175 + i * 175;
    g += `<circle cx="${ox + 68 * s + 50}" cy="${y}" r="22" fill="${PITCH}" stroke="${GOLD}" stroke-width="4"/>` + t(ox + 68 * s + 50, y + 8, l, { size: 22, weight: 700, fill: '#fff', anchor: 'middle' });
    wrap(d, 215, 21).forEach((ln, k) => { g += t(ox + 68 * s + 86, y - 6 + k * 26, ln, { size: 21 }); });
    g += t(ox + 68 * s + 86, y + 18 + (wrap(d, 215, 21).length - 1) * 26 + 14, `about ${v} xG`, { size: 26, weight: 700, fill: PITCH });
  });
  return frame(w, h, { title: 'xG: how likely is each shot to score?', sub: 'Each shot gets a value between 0 and 1 from distance, angle and situation', note }, g);
}

function figXgMatch() {
  const w = 1200, note = 'Worked example from this article: a 1-0 result. Winners 8 shots worth 0.9 xG in total; losers 15 shots worth 2.1 xG in total.';
  const h = 400 + noteH(note);
  const rows = [['Winning side', '8 shots, scored 1', 0.9, GOLD, INK], ['Losing side', '15 shots, scored 0', 2.1, PITCH, '#fff']];
  let g = '';
  rows.forEach(([n, s2, xg, c, tc], i) => {
    const y = 140 + i * 110, bw = xg * 400;
    g += t(40, y + 32, n, { size: 26, weight: 700 }) + t(40, y + 62, s2, { size: 22, fill: SLATE });
    g += `<rect x="300" y="${y}" width="${bw}" height="76" rx="8" fill="${c}"/>` + t(300 + bw - 18, y + 50, `${xg} xG`, { size: 32, weight: 700, fill: tc, anchor: 'end' });
  });
  return frame(w, h, { title: 'Same match, two stories', sub: 'Chances created (xG) against the final result', note }, g);
}

function heatFigure({ xgH, xgA, homeName, awayName, title, sub, note }) {
  const w = 1200, cell = 100, max = 5, x0 = 230, y0 = 200;
  const h = y0 + (max + 1) * cell + 40 + noteH(note);
  const { cells, h: ph, d: pd, a: pa } = scoreGrid(xgH, xgA);
  const top = [...cells].sort((a, b) => b.p - a.p);
  let g = t(x0 + ((max + 1) * cell) / 2, 150, `${awayName} goals`, { size: 24, weight: 700, anchor: 'middle' });
  g += t(80, y0 + ((max + 1) * cell) / 2, `${homeName} goals`, { size: 24, weight: 700, anchor: 'middle', rotate: -90 });
  for (let k = 0; k <= max; k++) { g += t(x0 + k * cell + cell / 2, 190, `${k}`, { size: 24, fill: SLATE, anchor: 'middle' }) + t(x0 - 24, y0 + k * cell + cell / 2 + 8, `${k}`, { size: 24, fill: SLATE, anchor: 'end' }); }
  for (const c of cells) {
    if (c.i > max || c.j > max) continue;
    const o = 0.06 + 0.94 * (c.p / top[0].p), best = c === top[0];
    g += `<rect x="${x0 + c.j * cell}" y="${y0 + c.i * cell}" width="${cell - 4}" height="${cell - 4}" rx="8" fill="${PITCH}" fill-opacity="${r1(o * 100) / 100}"${best ? ` stroke="${GOLD}" stroke-width="6"` : ''}/>`;
    g += t(x0 + c.j * cell + (cell - 4) / 2, y0 + c.i * cell + 58, `${(c.p * 100).toFixed(1)}%`, { size: 24, weight: best ? 700 : 400, fill: o > 0.5 ? '#fff' : INK, anchor: 'middle' });
  }
  const px = x0 + (max + 1) * cell + 50;
  g += t(px, y0 + 20, 'Most likely scorelines', { size: 24, weight: 700 });
  top.slice(0, 4).forEach((c, i) => { g += t(px, y0 + 62 + i * 40, `${i + 1}.  ${c.i}-${c.j}   ${(c.p * 100).toFixed(1)}%`, { size: 26 }); });
  g += `<line x1="${px}" x2="${px + 270}" y1="${y0 + 240}" y2="${y0 + 240}" stroke="${LIGHT}" stroke-width="2"/>`;
  g += t(px, y0 + 284, 'Result chances', { size: 24, weight: 700 });
  [[`${homeName} win`, ph], ['Draw', pd], [`${awayName} win`, pa]].forEach(([n, p], i) => { g += t(px, y0 + 326 + i * 38, `${n}  ${Math.round(p * 100)}%`, { size: 26 }); });
  return frame(w, h, { title, sub, note }, g);
}

// ---------- cover images ----------
function cover({ kicker, title, motif }) {
  const lines = wrap(title, 590, 54, 0.57);
  let g = `<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${DARK}"/><stop offset="1" stop-color="${PITCH}"/></linearGradient></defs>`;
  g += `<rect width="1200" height="630" fill="url(#bg)"/>`;
  g += `<g fill="none" stroke="#fff" stroke-opacity="0.07" stroke-width="4"><circle cx="1010" cy="315" r="210"/><line x1="1010" y1="0" x2="1010" y2="630"/><rect x="-40" y="195" width="170" height="240"/></g>`;
  g += `<rect x="66" y="92" width="${kicker.length * 14 + 36}" height="40" rx="20" fill="${GOLD}"/>` + t(84, 120, kicker.toUpperCase(), { size: 20, weight: 700, fill: INK });
  lines.forEach((l, i) => { g += t(66, 215 + i * 66, l, { size: 54, weight: 700, fill: '#fff' }); });
  g += `<text x="66" y="566" ${FONT} font-size="34" font-weight="700" fill="#fff">Skor<tspan fill="${GOLD}">Radar</tspan></text>`;
  g += `<rect x="716" y="66" width="420" height="498" rx="28" fill="#fff" fill-opacity="0.09"/>`;
  g += motif;
  return svgDoc(1200, 630, title, g);
}
const W = '#fff';
const motifs = {
  elo: () => {
    const X = (g) => 750 + ((g + 400) / 800) * 350, Y = (e) => 470 - e * 300;
    const pts = []; for (let x = -400; x <= 400; x += 20) pts.push(`${r1(X(x))},${r1(Y(eloExpected(x)))}`);
    return `<line x1="750" x2="1100" y1="${Y(0.5)}" y2="${Y(0.5)}" stroke="${W}" stroke-opacity="0.35" stroke-width="3" stroke-dasharray="8 8"/><polyline points="${pts.join(' ')}" fill="none" stroke="${W}" stroke-width="8" stroke-linejoin="round"/><circle cx="${X(0)}" cy="${Y(0.5)}" r="14" fill="${GOLD}"/><circle cx="${X(200)}" cy="${Y(eloExpected(200))}" r="14" fill="${GOLD}"/>` + t(926, 520, '+200 points = 76%', { size: 26, weight: 700, fill: W, anchor: 'middle' });
  },
  home: () => [['H', 45, GOLD], ['D', 25, '#cbd5e1'], ['A', 30, W]].map(([l, p, c], i) => `<rect x="${762 + i * 118}" y="${470 - p * 7.4}" width="92" height="${p * 7.4}" rx="8" fill="${c}"/>` + t(808 + i * 118, 470 - p * 7.4 - 14, `${p}%`, { size: 30, weight: 700, fill: W, anchor: 'middle' }) + t(808 + i * 118, 512, ['Home', 'Draw', 'Away'][i], { size: 24, fill: W, anchor: 'middle' })).join(''),
  cl: () => {
    let g = '';
    for (let i = 0; i < 36; i++) g += `<rect x="${754 + (i % 6) * 60}" y="${108 + Math.floor(i / 6) * 60}" width="52" height="52" rx="8" fill="${i < 8 ? GOLD : '#fff'}" fill-opacity="${i < 8 ? 1 : i < 24 ? 0.85 : 0.22}"/>`;
    return g + t(926, 528, '36 clubs · one table', { size: 26, weight: 700, fill: W, anchor: 'middle' });
  },
  xg: () => {
    const s = 8.5, cx = 926, oy = 110;
    let g = `<g fill="none" stroke="${W}" stroke-opacity="0.8" stroke-width="4"><rect x="${cx - 20.16 * s}" y="${oy}" width="${40.32 * s}" height="${16.5 * s}"/><rect x="${cx - 9.16 * s}" y="${oy}" width="${18.32 * s}" height="${5.5 * s}"/><rect x="${cx - 3.66 * s}" y="${oy - 10}" width="${7.32 * s}" height="10"/>`;
    const dx = Math.sqrt((9.15 * s) ** 2 - (5.5 * s) ** 2);
    g += `<path d="M${cx - dx} ${oy + 16.5 * s} A${9.15 * s} ${9.15 * s} 0 0 0 ${cx + dx} ${oy + 16.5 * s}"/></g>`;
    for (const [x, y, v] of [[cx - 48, oy + 72, 0.33], [cx + 40, oy + 300, 0.02], [cx, oy + 11 * s, 0.76]]) g += `<line x1="${x}" y1="${y}" x2="${cx}" y2="${oy}" stroke="${W}" stroke-opacity="0.4" stroke-width="2" stroke-dasharray="6 8"/><circle cx="${x}" cy="${y}" r="${9 + v * 28}" fill="${GOLD}"/>`;
    return g + t(926, 520, 'xG: chance a shot scores', { size: 26, weight: 700, fill: W, anchor: 'middle' });
  },
  predict: () => {
    const { cells } = scoreGrid(1.9, 0.8), top = Math.max(...cells.map((c) => c.p));
    let g = '';
    for (const c of cells) if (c.i < 5 && c.j < 5) g += `<rect x="${758 + c.j * 70}" y="${108 + c.i * 70}" width="64" height="64" rx="8" fill="${c.p === top ? GOLD : W}" fill-opacity="${c.p === top ? 1 : r1((0.1 + 0.8 * c.p / top) * 100) / 100}"/>`;
    return g + t(926, 520, 'Every scoreline has a chance', { size: 26, weight: 700, fill: W, anchor: 'middle' });
  },
  analysis: (d) => {
    const bars = [[d.pHome, GOLD, `${d.home} win`], [d.pDraw, '#cbd5e1', 'Draw'], [d.pAway, W, `${d.away} win`]];
    let x = 756, g = t(926, 252, `${d.ph} – ${d.pa}`, { size: 120, weight: 700, fill: W, anchor: 'middle' }) + t(926, 312, 'Model scoreline', { size: 26, fill: GOLD, weight: 700, anchor: 'middle' });
    bars.forEach(([p, c], i) => { const bw = 340 * p; g += `<rect x="${x}" y="360" width="${bw}" height="30" fill="${c}"${i === 0 ? ' rx="6"' : ''}/>`; x += bw; });
    bars.forEach(([p, c, n], i) => { g += `<rect x="760" y="${420 + i * 40}" width="20" height="20" rx="4" fill="${c}"/>` + t(792, 438 + i * 40, `${n}  ${Math.round(p * 100)}%`, { size: 24, fill: W }); });
    return g;
  },
};

// ---------- post registry ----------
const frontmatter = (section, slug) => readFileSync(join(ROOT, 'src', 'content', section, `${slug}.md`), 'utf8').replace(/\r\n/g, '\n');
const field = (fm, k) => (new RegExp(`^${k}:\\s*"?(.*?)"?\\s*$`, 'm').exec(fm) || [])[1] ?? '';

const barca = predictMatch({ elo: 1821 }, { elo: 1654 });
const POSTS = [
  { section: 'guides', slug: 'elo-ratings-in-football-explained', kicker: 'Guide · Ratings', motif: 'elo', figs: { curve: figEloCurve, example: figEloExample } },
  { section: 'guides', slug: 'home-advantage-in-football-how-big-is-it', kicker: 'Guide · Home advantage', motif: 'home', figs: { split: figHomeSplit, example: figHomeExample } },
  { section: 'guides', slug: 'how-the-new-champions-league-format-works', kicker: 'Guide · Champions League', motif: 'cl', figs: { bands: figClBands, pots: figClPots } },
  { section: 'guides', slug: 'what-is-xg-expected-goals-explained', kicker: 'Guide · Expected goals', motif: 'xg', figs: { pitch: figXgPitch, match: figXgMatch } },
  {
    section: 'guides', slug: 'how-to-predict-football-scores', kicker: 'Guide · Predictions', motif: 'predict',
    figs: { scorelines: () => heatFigure({ xgH: 1.9, xgA: 0.8, homeName: 'Team A', awayName: 'Team B', title: 'Chance of every scoreline', sub: 'Team A expected to score 1.9 goals, Team B 0.8 (Poisson model)', note: 'Each square is the probability of that exact score. The gold outline marks the single most likely result, which still happens only about one match in eight.' }) },
  },
  {
    section: 'analysis', slug: 'barcelona-vs-aston-villa-prediction', kicker: 'Match analysis · Champions League', motif: 'analysis',
    motifData: (fm) => ({ home: field(fm, 'homeTeam'), away: field(fm, 'awayTeam'), ph: barca.mostLikely.home, pa: barca.mostLikely.away, pHome: barca.pHome, pDraw: barca.pDraw, pAway: barca.pAway }),
    figs: { scorelines: () => heatFigure({ xgH: barca.xgHome, xgA: barca.xgAway, homeName: 'Barcelona', awayName: 'Aston Villa', title: 'Model chance of every scoreline', sub: `Expected goals: Barcelona ${barca.xgHome.toFixed(1)}, Aston Villa ${barca.xgAway.toFixed(1)}`, note: 'From club Elo ratings 1821 and 1654 with the model’s 65-point home bonus, converted to expected goals and an independent Poisson distribution. See the methodology page.' }) },
  },
];

for (const p of POSTS) {
  const fm = frontmatter(p.section, p.slug);
  const title = field(fm, 'title');
  const data = p.motifData ? p.motifData(fm) : undefined;
  const svg = cover({ kicker: p.kicker, title, motif: motifs[p.motif](data) });
  writeFileSync(join(OUT, `${p.slug}.svg`), svg);
  await sharp(Buffer.from(svg), { density: 96 }).resize(1200, 630).png({ compressionLevel: 9, palette: true, quality: 90 }).toFile(join(OUT, `${p.slug}.png`));
  for (const [name, fn] of Object.entries(p.figs)) {
    const out = fn();
    writeFileSync(join(OUT, `${p.slug}-${name}.svg`), out);
    const m = /viewBox="0 0 (\d+) (\d+)"/.exec(out);
    console.log(`${p.slug}-${name}.svg  ${m[1]}x${m[2]}`);
  }
  console.log(`${p.slug}.svg/.png`);
}
