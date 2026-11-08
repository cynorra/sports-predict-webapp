// Generates every post image from data, so nothing is stock art or a fake photo:
//   public/images/<slug>.svg          cover image shown at the top of the post (1200x630)
//   public/images/<slug>.png          same cover as PNG, used for og:image / twitter:image / JSON-LD
//   public/images/<slug>-<fig>.svg    explanatory figures embedded in the article body
// All numbers come from the Elo formula, the Poisson maths (same as src/lib/model.ts) or the figures quoted in the
// article itself. Illustrative examples are labelled as such inside the image.
// Run: npm run images   (output is committed; the build only verifies it via `npm run audit`).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import opentype from 'opentype.js';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import sharp from 'sharp';
import { predictMatch } from '../../src/lib/model.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = join(ROOT, 'public', 'images');
mkdirSync(OUT, { recursive: true });

const PITCH = '#0b6e4f', DARK = '#084c38', GOLD = '#f5b700', INK = '#0f172a', SLATE = '#64748b', LIGHT = '#e2e8f0', RED = '#b91c1c';
// Text is converted to outlines with the site's own display face (Barlow Condensed), so every image looks the same on any machine
// and no system font is needed by the PNG renderer.
const FONT_DIR = join(ROOT, 'node_modules', '@fontsource', 'barlow-condensed', 'files');
const loadFont = (w) => { const b = readFileSync(join(FONT_DIR, `barlow-condensed-latin-${w}-normal.woff`)); return opentype.parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)); };
const FONTS = { 600: loadFont(600), 700: loadFont(700), 800: loadFont(800) };
const fontFor = (weight) => FONTS[weight >= 800 ? 800 : weight >= 600 ? 700 : 600];
const SCALE = 1.12; // the condensed face is narrow: scale sizes so text keeps its visual weight
const textWidth = (s, size, weight = 400) => fontFor(weight).getAdvanceWidth(s, size * SCALE);

// ---------- helpers ----------
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const r1 = (n) => Math.round(n * 10) / 10;
// Each distinct glyph is written once per SVG (<defs>) and referenced with <use>, which keeps the files small.
const GLYPHS = new Map(); // "fontKey:glyphIndex" -> { id, d }
const glyphOf = (f, glyph) => {
  const key = `${Object.values(FONTS).indexOf(f)}:${glyph.index}`;
  if (!GLYPHS.has(key)) GLYPHS.set(key, { id: `g${GLYPHS.size}`, d: glyph.getPath(0, 0, f.unitsPerEm).toPathData(1) });
  return GLYPHS.get(key).id;
};
const defsFor = (body) => {
  const ids = new Set([...body.matchAll(/href="#(g\d+)"/g)].map((m) => m[1]));
  const d = [...GLYPHS.values()].filter((g) => ids.has(g.id)).map((g) => `<path id="${g.id}" d="${g.d}"/>`).join('');
  return d ? `<defs>${d}</defs>` : '';
};
function t(x, y, s, { size = 24, weight = 400, fill = INK, anchor = 'start', opacity = 1, rotate } = {}) {
  const f = fontFor(weight), sz = size * SCALE, w = f.getAdvanceWidth(s, sz);
  const x0 = anchor === 'middle' ? x - w / 2 : anchor === 'end' ? x - w : x;
  const k = sz / f.unitsPerEm;
  let uses = '';
  f.forEachGlyph(s, x0, y, sz, undefined, (glyph, gx) => {
    if (glyph.path.commands.length) uses += `<use href="#${glyphOf(f, glyph)}" x="${Math.round((gx - x0) / k)}"/>`;
  });
  const rot = rotate ? `rotate(${rotate} ${r1(x)} ${r1(y)}) ` : '';
  const op = opacity < 1 ? ` opacity="${opacity}"` : '';
  return `<g fill="${fill}"${op} transform="${rot}translate(${r1(x0)} ${r1(y)}) scale(${Math.round(k * 10000) / 10000})">${uses}</g>`;
}
// Greedy word wrap using real glyph widths (maxPx is the available width, size/weight as passed to t()).
function wrap(s, maxPx, size, _widthEm, weight = 400) {
  const lines = [];
  let cur = '';
  for (const word of s.split(' ')) {
    const next = cur ? `${cur} ${word}` : word;
    if (textWidth(next, size, weight) > maxPx && cur) { lines.push(cur); cur = word; } else cur = next;
  }
  if (cur) lines.push(cur);
  return lines;
}
const svgDoc = (w, h, title, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${esc(title)}"><title>${esc(title)}</title>${defsFor(body)}${body}</svg>\n`;

/** White card with title, subtitle and a wrapped source/explanation note at the bottom. */
function frame(w, h, { title, sub, note }, inner) {
  const noteLines = note ? wrap(note, w - 80, 20, 0.5) : [];
  const noteSvg = noteLines.map((l, i) => t(40, h - 20 - (noteLines.length - 1 - i) * 26, l, { size: 20, fill: SLATE })).join('');
  return svgDoc(w, h, title,
    `<rect x="1" y="1" width="${w - 2}" height="${h - 2}" rx="4" fill="#fff" stroke="${LIGHT}" stroke-width="2"/>` +
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
    g += gap === 400 ? t(px + 10, py - 28, label, { size: 24, weight: 700, anchor: 'end' }) : gap < 200 ? t(px - 16, py - 20, label, { size: 24, weight: 700, anchor: 'end' }) : t(px + 18, py + 40, label, { size: 24, weight: 700 });
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

// ---------- figures for the evergreen guides ----------
function figPoissonBars() {
  const w = 1200, lam = 1.4, note = 'Poisson probabilities for a team expected to score 1.4 goals: P(k) = e^(-1.4) x 1.4^k / k!. Computed, not observed data. Six or more goals is shown as 6.';
  const h = 470 + noteH(note);
  const ps = [0, 1, 2, 3, 4, 5, 6].map((k) => poisson(k, lam));
  const base = 380, scale = 800; let g = `<line x1="80" x2="1120" y1="${base}" y2="${base}" stroke="${SLATE}" stroke-width="3"/>`;
  ps.forEach((p, k) => {
    const cx = 170 + k * 150, hh = p * scale, top = k === 1;
    g += `<rect x="${cx - 48}" y="${base - hh}" width="96" height="${hh}" rx="6" fill="${top ? GOLD : PITCH}"/>`;
    g += t(cx, base - hh - 14, `${(p * 100).toFixed(1)}%`, { size: 26, weight: 700, anchor: 'middle' }) + t(cx, base + 36, k === 6 ? '6+' : `${k}`, { size: 26, anchor: 'middle', fill: SLATE });
  });
  g += t(600, base + 74, 'Goals scored by the team', { size: 22, anchor: 'middle', fill: INK });
  return frame(w, h, { title: 'Chance of each goal count at 1.4 expected goals', sub: 'One goal is the most common outcome; a blank is almost as likely as two goals', note }, g);
}

function figOffsideLine() {
  const w = 1200, note = 'Simplified diagram, attacking left to right. Attacker A is level with the second-last defender (onside). Attacker B is nearer the goal line than the ball and the second-last defender (offside position).';
  const h = 500 + noteH(note);
  const gx = 1100, line = 820;
  let g = `<rect x="60" y="130" width="1060" height="260" rx="10" fill="#eef7f2" stroke="${PITCH}" stroke-width="3"/>`;
  g += `<line x1="${gx}" x2="${gx}" y1="130" y2="390" stroke="${PITCH}" stroke-width="6"/>` + t(gx - 8, 122, 'Goal line', { size: 20, fill: SLATE, anchor: 'end' });
  g += `<line x1="${line}" x2="${line}" y1="112" y2="408" stroke="${RED}" stroke-width="3" stroke-dasharray="10 8"/>` + t(line, 436, 'Offside line: second-last defender', { size: 22, weight: 700, fill: RED, anchor: 'middle' });
  const dot = (x, y, c, label, tc = '#fff') => `<circle cx="${x}" cy="${y}" r="24" fill="${c}" stroke="${INK}" stroke-width="3"/>` + t(x, y + 8, label, { size: 22, weight: 700, fill: tc, anchor: 'middle' });
  g += dot(1050, 260, INK, 'GK') + dot(line, 200, INK, 'D') + dot(line, 330, GOLD, 'A', INK) + dot(960, 190, GOLD, 'B', INK);
  g += `<circle cx="560" cy="270" r="14" fill="#fff" stroke="${INK}" stroke-width="4"/>` + t(560, 312, 'Ball played', { size: 20, anchor: 'middle', fill: SLATE });
  g += t(line, 100, 'Level = onside', { size: 20, anchor: 'middle', fill: SLATE }) + t(960, 160, 'Ahead of the line', { size: 20, anchor: 'middle', fill: SLATE });
  return frame(w, h, { title: 'Where the offside line sits', sub: 'Compare each attacker with the ball and the second-last opponent', note }, g);
}

function figTieOrder() {
  const w = 1200, note = 'Simplified. Each competition publishes the complete list, which continues beyond these steps, and it can change between seasons. Read the current regulations.';
  const h = 520 + noteH(note);
  const cols = [
    ['Overall record first', 'Premier League and Bundesliga style', ['Points', 'Goal difference', 'Goals scored', 'Head-to-head record'], PITCH, '#fff'],
    ['Head-to-head first', 'La Liga style', ['Points', 'Head-to-head points', 'Head-to-head goal difference', 'Overall goal difference'], GOLD, INK],
  ];
  let g = '';
  cols.forEach(([name, sub, steps, c, tc], ci) => {
    const x = 40 + ci * 570;
    g += `<rect x="${x}" y="130" width="540" height="64" rx="12" fill="${c}"/>` + t(x + 270, 160, name, { size: 28, weight: 700, fill: tc, anchor: 'middle' }) + t(x + 270, 184, sub, { size: 18, fill: tc, anchor: 'middle' });
    steps.forEach((s, i) => {
      const y = 214 + i * 66;
      g += `<rect x="${x}" y="${y}" width="540" height="54" rx="10" fill="#f1f5f9" stroke="${LIGHT}" stroke-width="2"/>` + `<circle cx="${x + 34}" cy="${y + 27}" r="16" fill="${c}"/>` + t(x + 34, y + 34, `${i + 1}`, { size: 20, weight: 700, fill: tc, anchor: 'middle' }) + t(x + 66, y + 35, s, { size: 24 });
    });
  });
  return frame(w, h, { title: 'Two ways to order the tiebreakers', sub: 'Same measures, different order, sometimes a different table', note }, g);
}

function figFormBand() {
  const w = 1200, note = 'One standard error of a goal average for a team whose true rate is 1.4 goals per match: the square root of (1.4 / matches). Computed from the Poisson distribution, not observed data.';
  const h = 430 + noteH(note);
  const X = (v) => 140 + ((v - 0.5) / 2) * 960;
  let g = '';
  for (const v of [0.5, 1, 1.5, 2, 2.5]) g += `<line x1="${X(v)}" x2="${X(v)}" y1="130" y2="360" stroke="${LIGHT}" stroke-width="2"/>` + t(X(v), 392, v.toFixed(1), { size: 22, fill: SLATE, anchor: 'middle' });
  g += `<line x1="${X(1.4)}" x2="${X(1.4)}" y1="136" y2="360" stroke="${INK}" stroke-width="3" stroke-dasharray="8 8"/>` + t(X(1.4), 130, 'True rate 1.4', { size: 22, weight: 700, anchor: 'middle' });
  [[5, PITCH], [10, '#d97706'], [38, SLATE]].forEach(([n, c], i) => {
    const se = Math.sqrt(1.4 / n), y = 160 + i * 66;
    g += `<rect x="${X(1.4 - se)}" y="${y}" width="${X(1.4 + se) - X(1.4 - se)}" height="46" rx="8" fill="${c}"/>` + t(24, y + 31, `${n} matches`, { size: 22, weight: 700 }) + t(X(1.4 + se) + 14, y + 31, `${(1.4 - se).toFixed(1)} to ${(1.4 + se).toFixed(1)}`, { size: 22 });
  });
  return frame(w, h, { title: 'How far a goal average can drift by chance', sub: 'The more matches, the narrower the typical swing', note }, g);
}

function figDrawCurve() {
  const w = 1200, note = 'Two equally matched teams, each expected to score the stated number of goals, with independent Poisson goals. Computed, not observed data. Real leagues also show slightly more low-scoring draws than this simple model.';
  const h = 600 + noteH(note);
  const drawP = (l) => { let d = 0; for (let i = 0; i <= 20; i++) d += poisson(i, l) ** 2; return d; };
  const X = (l) => 150 + ((l - 0.5) / 2) * 940, Y = (p) => 470 - ((p - 0.1) / 0.4) * 300;
  let g = '';
  for (const p of [0.1, 0.2, 0.3, 0.4, 0.5]) g += `<line x1="150" x2="1090" y1="${Y(p)}" y2="${Y(p)}" stroke="${LIGHT}" stroke-width="2"/>` + t(130, Y(p) + 8, `${Math.round(p * 100)}%`, { size: 22, fill: SLATE, anchor: 'end' });
  for (const l of [0.5, 1, 1.5, 2, 2.5]) g += t(X(l), 510, l.toFixed(1), { size: 22, fill: SLATE, anchor: 'middle' });
  const pts = []; for (let l = 0.5; l <= 2.501; l += 0.05) pts.push(`${r1(X(l))},${r1(Y(drawP(l)))}`);
  g += `<polyline points="${pts.join(' ')}" fill="none" stroke="${PITCH}" stroke-width="6" stroke-linejoin="round"/>`;
  for (const l of [0.8, 1.3, 1.8]) g += `<circle cx="${X(l)}" cy="${Y(drawP(l))}" r="11" fill="${GOLD}" stroke="${INK}" stroke-width="3"/>` + t(X(l) + 16, Y(drawP(l)) - 18, `${Math.round(drawP(l) * 100)}%`, { size: 26, weight: 700 });
  g += t(620, 556, "Expected goals for each team", { size: 22, anchor: 'middle' });
  return frame(w, h, { title: 'Chance of a draw between equal teams', sub: 'More expected goals means fewer level finishes', note }, g);
}

function figLadder() {
  const w = 1200, note = 'Typical single-match knockout. Some competitions skip extra time, and two-leg ties apply the steps after the second leg. Check the regulations of the tournament.';
  const h = 380 + noteH(note);
  const boxes = [['90 minutes', 'plus stoppage time', PITCH, '#fff'], ['Extra time', '2 x 15 minutes', '#d97706', '#fff'], ['Penalty shootout', '5 kicks each, then sudden death', GOLD, INK]];
  let g = '';
  boxes.forEach(([a, b, c, tc], i) => {
    const x = 40 + i * 400;
    g += `<rect x="${x}" y="150" width="340" height="150" rx="16" fill="${c}"/>` + t(x + 170, 212, a, { size: 32, weight: 700, fill: tc, anchor: 'middle' });
    wrap(b, 300, 22).forEach((ln, k) => { g += t(x + 170, 252 + k * 28, ln, { size: 22, fill: tc, anchor: 'middle' }); });
    if (i < 2) g += `<path d="M${x + 350} 225 H${x + 390}" stroke="${INK}" stroke-width="4" marker-end="none"/><path d="M${x + 378} 211 L${x + 392} 225 L${x + 378} 239" fill="none" stroke="${INK}" stroke-width="4"/>` + t(x + 370, 190, 'level?', { size: 18, fill: SLATE, anchor: 'middle' });
  });
  return frame(w, h, { title: 'How a level knockout match is settled', sub: 'Each step happens only if the previous one ends level', note }, g);
}

function figTiers() {
  const w = 1200, note = 'Soccer Scores Today scoring: exact score 10, correct result and goal difference 5, correct result 3. Scored on the result after 90 minutes plus stoppage time.';
  const h = 480 + noteH(note);
  const rows = [['Exact score', 10, GOLD, INK], ['Right result + goal difference', 5, PITCH, '#fff'], ['Right result only', 3, '#64748b', '#fff']];
  let g = '';
  rows.forEach(([name, pts, c, tc], i) => {
    const y = 130 + i * 100, bw = pts * 80;
    g += `<rect x="40" y="${y}" width="${bw}" height="72" rx="10" fill="${c}"/>` + t(40 + bw - 20, y + 49, `${pts}`, { size: 38, weight: 700, fill: tc, anchor: 'end' });
    g += t(40 + bw + 20, y + 47, name, { size: 26, weight: 700 });
  });
  g += t(40, 436, 'Example: you pick 2-0.   2-0 = 10 points   3-1 = 5 points   1-0 = 3 points   1-1 = 0 points', { size: 22, fill: SLATE });
  return frame(w, h, { title: 'The three scoring tiers', sub: 'Points per prediction, highest tier only', note }, g);
}

// ---------- figures, second batch of guides ----------
function figWcFunnel() {
  const w = 1200, note = 'Format of the 48-team men\'s World Cup as set out in the FIFA regulations: 12 groups of four, the top two plus the eight best third-placed teams advance.';
  const h = 540 + noteH(note);
  const stages = [['Group stage', 48], ['Round of 32', 32], ['Round of 16', 16], ['Quarter-finals', 8], ['Semi-finals', 4], ['Final', 2], ['Champion', 1]];
  let g = '';
  stages.forEach(([n, v], i) => {
    const y = 124 + i * 56, bw = 40 + (v / 48) * 760;
    g += `<rect x="${40}" y="${y}" width="${bw}" height="42" rx="8" fill="${i === 6 ? GOLD : i === 0 ? DARK : PITCH}"/>` + t(56, y + 29, n, { size: 24, weight: 700, fill: i === 6 ? INK : '#fff' }) + t(40 + bw + 16, y + 30, `${v} ${v === 1 ? 'team' : 'teams'}`, { size: 24, fill: INK });
  });
  return frame(w, h, { title: 'How 48 teams become one champion', sub: 'Teams remaining at the start of each stage', note }, g);
}

function figRankCompare() {
  const w = 1200, note = 'Simplified comparison of the shared structure. The exact formulas, weights and treatment of goal margins are set by FIFA and by each independent Elo site; check their documentation.';
  const h = 500 + noteH(note);
  const rows = [['Result of the match', 'Yes', 'Yes'], ['Importance of the match', 'Yes', 'Yes'], ['Strength of the opponent', 'Yes', 'Yes'], ['Goal margin', 'Handled differently', 'Often scales the change']];
  let g = t(560, 140, 'FIFA ranking', { size: 26, weight: 700, anchor: 'middle', fill: PITCH }) + t(910, 140, 'Independent Elo ratings', { size: 26, weight: 700, anchor: 'middle', fill: '#b45309' });
  rows.forEach(([a, b, c], i) => {
    const y = 160 + i * 74;
    g += `<rect x="40" y="${y}" width="1120" height="60" rx="10" fill="${i % 2 ? '#fff' : '#f1f5f9'}" stroke="${LIGHT}" stroke-width="2"/>` + t(64, y + 39, a, { size: 24, weight: 700 }) + t(560, y + 39, b, { size: 24, anchor: 'middle' }) + t(910, y + 39, c, { size: 24, anchor: 'middle' });
  });
  return frame(w, h, { title: 'What both rating systems have in common', sub: 'Points move after every match, depending on what was expected', note }, g);
}

function figXptsBars() {
  const w = 1200, note = 'Example match: expected goals 1.6 for the hosts and 1.2 for the visitors, independent Poisson goals. xPts = 3 x P(win) + 1 x P(draw).';
  const h = 500 + noteH(note);
  const { h: ph, d: pd, a: pa } = scoreGrid(1.6, 1.2);
  const xh = 3 * ph + pd, xa = 3 * pa + pd;
  let g = '';
  [['Home side: expected points', xh, PITCH], ['Away side: expected points', xa, GOLD]].forEach(([n, v, c], i) => {
    const y = 140 + i * 90, bw = v * 260;
    g += t(40, y + 40, n, { size: 24, weight: 700 }) + `<rect x="420" y="${y}" width="${bw}" height="56" rx="8" fill="${c}"/>` + t(420 + bw + 14, y + 38, v.toFixed(2), { size: 30, weight: 700 });
  });
  g += t(40, 360, 'Points that can actually be earned in one match:', { size: 24, weight: 700 });
  [['Win', 3, PITCH, '#fff'], ['Draw', 1, SLATE, '#fff'], ['Defeat', 0, '#cbd5e1', INK]].forEach(([n, v, c, tc], i) => {
    const x = 40 + i * 200;
    g += `<rect x="${x}" y="384" width="170" height="64" rx="10" fill="${c}"/>` + t(x + 85, 424, `${n}: ${v}`, { size: 26, weight: 700, fill: tc, anchor: 'middle' });
  });
  return frame(w, h, { title: 'Expected points for one match', sub: 'An average over many identical matches, not a number anyone can score', note }, g);
}

function figCleanCurve() {
  const w = 1200, note = 'Chance that the opponent scores zero = e^(-m), where m is the opponent\'s expected goals (Poisson). Computed, not observed data.';
  const h = 560 + noteH(note);
  const X = (m) => 150 + ((m - 0.5) / 1.6) * 940, Y = (p) => 450 - ((p - 0.1) / 0.5) * 300;
  let g = '';
  for (const p of [0.1, 0.2, 0.3, 0.4, 0.5, 0.6]) g += `<line x1="150" x2="1090" y1="${Y(p)}" y2="${Y(p)}" stroke="${LIGHT}" stroke-width="2"/>` + t(130, Y(p) + 8, `${Math.round(p * 100)}%`, { size: 22, fill: SLATE, anchor: 'end' });
  for (const m of [0.5, 1, 1.5, 2]) g += t(X(m), 488, m.toFixed(1), { size: 22, fill: SLATE, anchor: 'middle' });
  const pts = []; for (let m = 0.5; m <= 2.001; m += 0.05) pts.push(`${r1(X(m))},${r1(Y(Math.exp(-m)))}`);
  g += `<polyline points="${pts.join(' ')}" fill="none" stroke="${PITCH}" stroke-width="6" stroke-linejoin="round"/>`;
  for (const m of [0.8, 1.2, 2]) g += `<circle cx="${X(m)}" cy="${Y(Math.exp(-m))}" r="11" fill="${GOLD}" stroke="${INK}" stroke-width="3"/>` + t(X(m) + 16, Y(Math.exp(-m)) - 16, `${Math.round(Math.exp(-m) * 100)}%`, { size: 26, weight: 700 });
  g += t(620, 530, "Opponent's expected goals", { size: 22, anchor: 'middle' });
  return frame(w, h, { title: 'Chance of a clean sheet', sub: 'Weaker attacks leave far more room for zero', note }, g);
}

function figFormations() {
  const w = 1200, note = 'Schematic only: players move constantly, and the same formation can be played in very different ways. The goalkeeper is shown at the bottom of each pitch.';
  const h = 540 + noteH(note);
  const shapes = [['4-4-2', [4, 4, 2]], ['4-3-3', [4, 3, 3]], ['3-5-2', [3, 5, 2]]];
  let g = '';
  shapes.forEach(([name, rows], i) => {
    const x = 40 + i * 380, px = x, pw = 340, py = 150, ph = 340;
    g += `<rect x="${px}" y="${py}" width="${pw}" height="${ph}" rx="10" fill="#eef7f2" stroke="${PITCH}" stroke-width="3"/><line x1="${px}" x2="${px + pw}" y1="${py + 40}" y2="${py + 40}" stroke="${PITCH}" stroke-opacity=".35" stroke-width="2"/>`;
    g += `<circle cx="${px + pw / 2}" cy="${py + ph - 28}" r="14" fill="${INK}"/>`;
    const ys = [py + ph - 100, py + ph - 190, py + ph - 270];
    rows.forEach((n, r) => { for (let k = 0; k < n; k++) g += `<circle cx="${px + (pw * (k + 1)) / (n + 1)}" cy="${ys[r]}" r="14" fill="${r === 2 ? GOLD : PITCH}" stroke="${INK}" stroke-width="2"/>`; });
    g += t(px + pw / 2, 138, name, { size: 30, weight: 700, anchor: 'middle' });
  });
  return frame(w, h, { title: 'Three classic formations', sub: 'Defenders, midfielders and forwards, counted from the back', note }, g);
}

function figVarFlow() {
  const w = 1200, note = 'Simplified from the IFAB video assistant referee protocol. The on-field referee always makes the final decision.';
  const h = 520 + noteH(note);
  const chips = ['Goals', 'Penalties', 'Direct red cards', 'Mistaken identity'];
  let g = '';
  chips.forEach((c, i) => { g += `<rect x="${40 + i * 280}" y="124" width="260" height="52" rx="26" fill="${GOLD}"/>` + t(170 + i * 280, 158, c, { size: 22, weight: 700, fill: INK, anchor: 'middle' }); });
  const steps = [['VAR checks', 'silently, in the background'], ['Possible clear error?', 'recommends a review'], ['Referee decides', 'by signal or on-field review']];
  steps.forEach(([a, b], i) => {
    const x = 40 + i * 400;
    g += `<rect x="${x}" y="240" width="340" height="140" rx="16" fill="${i === 2 ? PITCH : '#f1f5f9'}" stroke="${LIGHT}" stroke-width="2"/>` + t(x + 170, 300, a, { size: 28, weight: 700, fill: i === 2 ? '#fff' : INK, anchor: 'middle' }) + t(x + 170, 338, b, { size: 21, fill: i === 2 ? '#fff' : SLATE, anchor: 'middle' });
    if (i < 2) g += `<path d="M${x + 350} 310 H${x + 390}" stroke="${INK}" stroke-width="4"/><path d="M${x + 378} 296 L${x + 392} 310 L${x + 378} 324" fill="none" stroke="${INK}" stroke-width="4"/>`;
  });
  g += t(40, 218, 'Only these four situations can be reviewed', { size: 22, fill: SLATE });
  return frame(w, h, { title: 'How a video review runs', sub: 'The assistant advises; the referee decides', note }, g);
}

function figCardsLadder() {
  const w = 1200, note = 'Based on Law 12 of the Laws of the Game (IFAB). Suspensions after a card are set by each competition.';
  const h = 430 + noteH(note);
  const card = (x, c, line1, line2, tc) => `<rect x="${x}" y="150" width="340" height="190" rx="16" fill="${c}"/><rect x="${x + 130}" y="172" width="80" height="108" rx="8" fill="${c === GOLD ? '#fff' : '#fff'}" fill-opacity=".22" stroke="${tc}" stroke-width="3"/>` + t(x + 170, 312, line1, { size: 26, weight: 700, fill: tc, anchor: 'middle' }) + t(x + 170, 335, line2, { size: 18, fill: tc, anchor: 'middle' });
  let g = card(40, GOLD, 'Yellow card', 'a caution', INK) + t(410, 255, '+', { size: 48, weight: 700, anchor: 'middle' }) + card(440, GOLD, 'Second yellow', 'same match', INK) + t(810, 255, '=', { size: 48, weight: 700, anchor: 'middle' }) + card(840, RED, 'Red card', 'sent off', '#fff');
  g += t(40, 380, 'A direct red card for serious offences skips the yellow stage. The team plays on with one fewer player.', { size: 22, fill: SLATE });
  return frame(w, h, { title: 'How a sending-off happens', sub: 'Two cautions or one serious offence', note }, g);
}

function figEloConverge() {
  const w = 1200, note = 'Expected rating path for a team of true strength 1700 facing 1500-rated opponents on neutral ground, with update constant 20 and no goal-margin weighting. Illustrative calculation, not real data.';
  const h = 600 + noteH(note);
  const E = (g2) => 1 / (1 + Math.pow(10, -g2 / 400)), et = E(200);
  const X = (n) => 150 + (n / 60) * 940, Y = (r) => 480 - ((r - 1500) / 220) * 320;
  let g = '';
  for (const r of [1500, 1550, 1600, 1650, 1700]) g += `<line x1="150" x2="1090" y1="${Y(r)}" y2="${Y(r)}" stroke="${r === 1700 ? GOLD : LIGHT}" stroke-width="${r === 1700 ? 4 : 2}"${r === 1700 ? ' stroke-dasharray="10 8"' : ''}/>` + t(130, Y(r) + 8, `${r}`, { size: 22, fill: SLATE, anchor: 'end' });
  for (const n of [0, 10, 20, 30, 40, 50, 60]) g += t(X(n), 520, `${n}`, { size: 22, fill: SLATE, anchor: 'middle' });
  let r = 1500; const pts = [`${X(0)},${Y(r)}`];
  for (let n = 1; n <= 60; n++) { r += 20 * (et - E(r - 1500)); pts.push(`${r1(X(n))},${r1(Y(r))}`); }
  g += `<polyline points="${pts.join(' ')}" fill="none" stroke="${PITCH}" stroke-width="6" stroke-linejoin="round"/>` + t(1090, Y(1700) - 12, 'true strength 1700', { size: 22, weight: 700, anchor: 'end', fill: '#b45309' });
  g += t(620, 560, 'Matches played', { size: 22, anchor: 'middle' });
  return frame(w, h, { title: 'A new rating learns slowly', sub: 'Even a clearly stronger team needs many matches to be rated fairly', note }, g);
}

// ---------- records figures (numbers: FIFA, Opta Analyst, Premier League, ESPN; see the guides' Sources) ----------
function hbars(rows, { x0 = 330, rowH = 56, barH = 34, max, top = 140, hi = 0, fillFor }) {
  const sc = (1200 - 80 - x0 - 70) / max;
  let g = '';
  rows.forEach((r, i) => {
    const y = top + i * rowH, bw = r.v * sc;
    g += t(x0 - 16, y + barH - 8, r.name, { size: 24, weight: 700, anchor: 'end' });
    g += `<rect x="${x0}" y="${y}" width="${r2(bw)}" height="${barH}" rx="4" fill="${fillFor(r, i)}"/>`;
    g += t(x0 + bw + 12, y + barH - 8, String(r.v), { size: 26, weight: 700 });
    if (r.sub) g += t(x0 + 12, y + barH - 9, r.sub, { size: 17, weight: 600, fill: '#fff' });
  });
  return g;
}
const r2 = (n) => Math.round(n * 100) / 100;

function figWcScorers() {
  const note = "Goals at men's FIFA World Cup final tournaments after the 2026 edition, as listed by FIFA and the Opta Analyst. Ronaldo is the Brazilian forward; Cristiano Ronaldo has 11.";
  const rows = [
    { name: 'Kylian Mbappé', v: 22, sub: 'France' }, { name: 'Lionel Messi', v: 21, sub: 'Argentina' }, { name: 'Miroslav Klose', v: 16, sub: 'Germany' },
    { name: 'Ronaldo', v: 15, sub: 'Brazil' }, { name: 'Gerd Müller', v: 14, sub: 'West Germany' }, { name: 'Harry Kane', v: 14, sub: 'England' },
    { name: 'Just Fontaine', v: 13, sub: 'France' }, { name: 'Pelé', v: 12, sub: 'Brazil' },
  ];
  const h = 140 + rows.length * 56 + 50 + noteH(note);
  const g = hbars(rows, { max: 22, fillFor: (r, i) => (i === 0 ? GOLD : PITCH) });
  return frame(1200, h, { title: 'World Cup all-time top scorers', sub: 'Goals at World Cup final tournaments', note }, g);
}

function figPlSeasons() {
  const note = 'Most goals by one player in a Premier League season. Seasons marked 42 games were played when the league had 22 clubs; the league has had 38-game seasons since 1995-96. Source: ESPN, Premier League records.';
  const rows = [
    { name: 'Haaland 2022-23', v: 36, g: 38 }, { name: 'Shearer 1994-95', v: 34, g: 42 }, { name: 'Cole 1993-94', v: 34, g: 42 },
    { name: 'Salah 2017-18', v: 32, g: 38 }, { name: 'Suárez 2013-14', v: 31, g: 38 }, { name: 'C. Ronaldo 2007-08', v: 31, g: 38 },
    { name: 'Shearer 1995-96', v: 31, g: 38 }, { name: 'Shearer 1993-94', v: 31, g: 42 },
  ];
  const h = 140 + rows.length * 56 + 90 + noteH(note);
  let g = hbars(rows, { x0: 350, max: 36, fillFor: (r) => (r.g === 42 ? '#94a3b8' : PITCH) });
  const ly = 140 + rows.length * 56 + 20;
  g += `<rect x="350" y="${ly}" width="26" height="22" rx="4" fill="${PITCH}"/>` + t(386, ly + 18, '38-game season', { size: 22 });
  g += `<rect x="620" y="${ly}" width="26" height="22" rx="4" fill="#94a3b8"/>` + t(656, ly + 18, '42-game season', { size: 22 });
  return frame(1200, h, { title: 'Most goals in a Premier League season', sub: 'Eight highest single-season totals', note }, g);
}

function figClScorers() {
  const note = "Goals in the UEFA Champions League, qualifiers excluded, as listed by the Opta Analyst on 4 November 2026. UEFA's own table counts a few totals differently.";
  const rows = [
    { name: 'Cristiano Ronaldo', v: 140 }, { name: 'Lionel Messi', v: 129 }, { name: 'Robert Lewandowski', v: 109 }, { name: 'Karim Benzema', v: 90 },
    { name: 'Kylian Mbappé', v: 74 }, { name: 'Raúl', v: 71 }, { name: 'Erling Haaland', v: 62 }, { name: 'Harry Kane', v: 58 },
    { name: 'Thomas Müller', v: 57 }, { name: 'Ruud van Nistelrooy', v: 56 },
  ];
  const h = 140 + rows.length * 56 + 50 + noteH(note);
  const g = hbars(rows, { x0: 360, max: 140, fillFor: (r, i) => (i === 0 ? GOLD : PITCH) });
  return frame(1200, h, { title: 'Champions League all-time top scorers', sub: 'Top 10 by goals', note }, g);
}

function tiles(items, { y0 = 140, cols = 3, w = 340, h = 170, gap = 20 }) {
  let g = '';
  items.forEach((it, i) => {
    const x = 40 + (i % cols) * (w + gap), y = y0 + Math.floor(i / cols) * (h + gap);
    g += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" fill="#f1f5f9" stroke="${LIGHT}" stroke-width="2"/>`;
    g += t(x + 20, y + 76, it.n, { size: 64, weight: 800, fill: PITCH });
    g += t(x + 20, y + 114, it.label, { size: 22, weight: 700 });
    g += t(x + 20, y + 144, it.who, { size: 20, fill: SLATE });
  });
  return g;
}

function figPlRecords() {
  const note = "Records from the Premier League's own records table, which covers seasons up to 2025/26. Seconds are shown to two decimals as the league publishes them.";
  const items = [
    { n: '260', label: 'Career goals', who: 'Alan Shearer' }, { n: '213', label: 'Goals at one club', who: 'Harry Kane, Tottenham' }, { n: '36', label: 'Goals in a season', who: 'Erling Haaland, 2022/23' },
    { n: '12', label: 'Hat-tricks', who: 'Sergio Agüero' }, { n: '7.69s', label: 'Fastest goal', who: 'Shane Long, 2019' }, { n: '10', label: 'Own goals', who: 'Richard Dunne' },
  ];
  const h = 140 + 2 * 190 + 30 + noteH(note);
  return frame(1200, h, { title: 'Premier League scoring records', sub: 'Who holds six of the headline marks', note }, tiles(items, {}));
}

// ---------- cover images ----------
function cover({ kicker, title, motif }) {
  // Headline: biggest size (84 -> 52) at which the uppercase title fits the left column in at most four lines.
  const head = title.toUpperCase();
  let size = 84, lines = wrap(head, 600, size, 0, 800);
  while ((lines.length > 4 || lines.some((l) => textWidth(l, size, 800) > 600)) && size > 52) { size -= 4; lines = wrap(head, 600, size, 0, 800); }
  const lh = Math.round(size * 1.0);
  let g = `<rect width="1200" height="630" fill="#0e1512"/>`;
  g += `<g fill="none" stroke="#fff" stroke-opacity="0.06" stroke-width="3"><circle cx="1010" cy="315" r="210"/><line x1="1010" y1="0" x2="1010" y2="630"/><rect x="-40" y="195" width="170" height="240"/></g>`;
  g += `<rect x="66" y="78" width="56" height="8" fill="${GOLD}"/>` + t(66, 128, kicker.toUpperCase(), { size: 26, weight: 700, fill: GOLD });
  lines.forEach((l, i) => { g += t(66, 128 + 30 + size * 0.86 + i * lh, l, { size, weight: 800, fill: '#fff' }); });
  g += `<rect x="66" y="506" width="590" height="2" fill="#fff" fill-opacity="0.25"/>`;
  g += t(66, 560, 'SCORE', { size: 40, weight: 800, fill: '#fff' }) + t(66 + textWidth('SCORE', 40, 800) + 2, 560, 'RADAR', { size: 40, weight: 800, fill: GOLD });
  g += `<rect x="716" y="66" width="420" height="498" fill="#fff" fill-opacity="0.07" stroke="#fff" stroke-opacity="0.16" stroke-width="2"/><rect x="716" y="66" width="420" height="8" fill="${GOLD}"/>`;
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
  poisson: () => [0, 1, 2, 3, 4, 5].map((k) => { const p = poisson(k, 1.4), hh = p * 800; return `<rect x="${752 + k * 62}" y="${470 - hh}" width="50" height="${hh}" rx="6" fill="${k === 1 ? GOLD : W}" fill-opacity="${k === 1 ? 1 : 0.85}"/>` + t(777 + k * 62, 506, `${k}`, { size: 22, fill: W, anchor: 'middle' }); }).join('') + t(926, 140, 'Goals scored · avg 1.4', { size: 26, weight: 700, fill: W, anchor: 'middle' }),
  offside: () => `<rect x="740" y="130" width="372" height="330" rx="10" fill="none" stroke="${W}" stroke-opacity="0.6" stroke-width="4"/><line x1="1100" x2="1100" y1="130" y2="460" stroke="${W}" stroke-width="8"/><line x1="960" x2="960" y1="110" y2="480" stroke="${GOLD}" stroke-width="4" stroke-dasharray="10 8"/><circle cx="960" cy="360" r="20" fill="${W}"/><circle cx="1030" cy="230" r="20" fill="${GOLD}"/><circle cx="960" cy="230" r="20" fill="#0f172a"/>` + t(926, 520, 'Level is onside', { size: 26, weight: 700, fill: W, anchor: 'middle' }),
  table: () => [['1', 'Points'], ['2', 'Goal difference'], ['3', 'Goals scored'], ['4', 'Head-to-head']].map(([n, s], i) => `<rect x="750" y="${130 + i * 86}" width="352" height="68" rx="12" fill="${i === 1 ? GOLD : W}" fill-opacity="${i === 1 ? 1 : 0.85}"/>` + t(780, 174 + i * 86, n, { size: 30, weight: 700, fill: INK }) + t(826, 174 + i * 86, s, { size: 28, fill: INK })).join(''),
  band: () => [[5, 330], [10, 250], [38, 130]].map(([n, wd], i) => `<rect x="${926 - wd / 2}" y="${150 + i * 100}" width="${wd}" height="56" rx="10" fill="${i === 0 ? GOLD : W}" fill-opacity="${i === 0 ? 1 : 0.8}"/>` + t(926, 235 + i * 100, `${n} matches`, { size: 22, fill: W, anchor: 'middle' })).join('') + `<line x1="926" x2="926" y1="120" y2="470" stroke="${W}" stroke-opacity="0.6" stroke-width="3" stroke-dasharray="8 8"/>`,
  draws: () => {
    const dp = (l) => { let d = 0; for (let i = 0; i <= 20; i++) d += poisson(i, l) ** 2; return d; };
    const X = (l) => 760 + ((l - 0.5) / 2) * 340, Y = (p) => 460 - ((p - 0.15) / 0.35) * 300;
    const pts = []; for (let l = 0.5; l <= 2.501; l += 0.1) pts.push(`${r1(X(l))},${r1(Y(dp(l)))}`);
    return `<polyline points="${pts.join(' ')}" fill="none" stroke="${W}" stroke-width="8" stroke-linejoin="round"/><circle cx="${X(0.8)}" cy="${Y(dp(0.8))}" r="13" fill="${GOLD}"/><circle cx="${X(1.8)}" cy="${Y(dp(1.8))}" r="13" fill="${GOLD}"/>` + t(926, 520, 'More goals, fewer draws', { size: 26, weight: 700, fill: W, anchor: 'middle' });
  },
  ladder: () => [['90 min', W], ['Extra time', '#e2e8f0'], ['Penalties', GOLD]].map(([s, c], i) => `<rect x="752" y="${130 + i * 120}" width="348" height="92" rx="14" fill="${c}"/>` + t(926, 187 + i * 120, s, { size: 34, weight: 700, fill: INK, anchor: 'middle' })).join(''),
  tiers: () => [[10, GOLD], [5, W], [3, '#cbd5e1']].map(([p, c], i) => `<rect x="752" y="${130 + i * 120}" width="${p * 34}" height="92" rx="14" fill="${c}"/>` + t(752 + p * 34 - 18, 190 + i * 120, `${p}`, { size: 44, weight: 700, fill: INK, anchor: 'end' })).join('') + t(926, 520, 'Points per pick', { size: 26, weight: 700, fill: W, anchor: 'middle' }),
  wc: () => [48, 32, 16, 8, 4, 2, 1].map((v, i) => `<rect x="${926 - (30 + v * 6.4) / 2}" y="${112 + i * 56}" width="${30 + v * 6.4}" height="42" rx="8" fill="${i === 6 ? GOLD : W}" fill-opacity="${i === 6 ? 1 : 0.85}"/>` + t(926, 142 + i * 56, `${v}`, { size: 24, weight: 700, fill: INK, anchor: 'middle' })).join('') + t(926, 530, '48 teams to one champion', { size: 24, weight: 700, fill: W, anchor: 'middle' }),
  rank: () => [[1650, 'FIFA'], [1450, 'Elo']].map(([h, n], i) => `<rect x="${770 + i * 190}" y="${480 - h / 4}" width="150" height="${h / 4}" rx="10" fill="${i ? GOLD : W}"/>` + t(845 + i * 190, 520, n, { size: 28, weight: 700, fill: W, anchor: 'middle' })).join('') + t(926, 120, 'Two ways to rate teams', { size: 26, weight: 700, fill: W, anchor: 'middle' }),
  xpts: () => [[1.65, W], [1.11, GOLD]].map(([v, c], i) => `<rect x="760" y="${180 + i * 130}" width="${v * 190}" height="86" rx="12" fill="${c}"/>` + t(760 + v * 190 + 14, 238 + i * 130, v.toFixed(2), { size: 40, weight: 700, fill: W })).join('') + t(926, 130, 'Expected points', { size: 28, weight: 700, fill: W, anchor: 'middle' }),
  clean: () => {
    const X = (m) => 756 + ((m - 0.5) / 1.6) * 360, Y = (p) => 470 - ((p - 0.1) / 0.5) * 300;
    const pts = []; for (let m = 0.5; m <= 2.001; m += 0.1) pts.push(`${r1(X(m))},${r1(Y(Math.exp(-m)))}`);
    return `<polyline points="${pts.join(' ')}" fill="none" stroke="${W}" stroke-width="8" stroke-linejoin="round"/><circle cx="${X(1.2)}" cy="${Y(Math.exp(-1.2))}" r="14" fill="${GOLD}"/>` + t(926, 520, 'Chance opponent scores zero', { size: 24, weight: 700, fill: W, anchor: 'middle' });
  },
  formation: () => [[4, 4, 2]].map((rows) => { let g = `<rect x="756" y="110" width="340" height="400" rx="12" fill="none" stroke="${W}" stroke-opacity=".6" stroke-width="4"/>`; const ys = [440, 340, 230]; rows.forEach((n, r) => { for (let k = 0; k < n; k++) g += `<circle cx="${756 + (340 * (k + 1)) / (n + 1)}" cy="${ys[r]}" r="16" fill="${r === 2 ? GOLD : W}"/>`; }); return g + `<circle cx="926" cy="486" r="14" fill="${INK}"/>`; })[0],
  var: () => `<rect x="770" y="150" width="320" height="200" rx="16" fill="none" stroke="${W}" stroke-width="8"/><rect x="900" y="360" width="60" height="30" fill="${W}"/><rect x="850" y="390" width="160" height="14" rx="7" fill="${W}"/><polygon points="890,205 890,295 970,250" fill="${GOLD}"/>` + t(926, 520, 'The referee decides', { size: 26, weight: 700, fill: W, anchor: 'middle' }),
  cards: () => `<rect x="780" y="150" width="130" height="190" rx="14" fill="${GOLD}" transform="rotate(-8 845 245)"/><rect x="930" y="150" width="130" height="190" rx="14" fill="${RED}" transform="rotate(8 995 245)"/>` + t(926, 440, 'Caution or sending-off', { size: 26, weight: 700, fill: W, anchor: 'middle' }),
  scorers: () => [['Mbappé', 22], ['Messi', 21], ['Klose', 16], ['Ronaldo', 15], ['Müller', 14]].map(([n, v], i) =>
    t(752, 124 + i * 78, n, { size: 24, weight: 700, fill: W }) + `<rect x="752" y="${134 + i * 78}" width="${r1(v / 22 * 300)}" height="30" rx="4" fill="${i === 0 ? GOLD : W}" fill-opacity="${i === 0 ? 1 : 0.85}"/>` + t(752 + v / 22 * 300 + 12, 158 + i * 78, String(v), { size: 26, weight: 700, fill: W })).join('') + t(926, 540, 'World Cup goals, all time', { size: 24, weight: 700, fill: W, anchor: 'middle' }),
  plrecord: () => [['Haaland', 36, 1], ['Shearer', 34, 0], ['Cole', 34, 0], ['Salah', 32, 1]].map(([n, v, a], i) =>
    t(752, 130 + i * 98, n, { size: 24, weight: 700, fill: W }) + `<rect x="752" y="${142 + i * 98}" width="${r1(v / 36 * 300)}" height="38" rx="4" fill="${i === 0 ? GOLD : W}" fill-opacity="${i === 0 ? 1 : 0.85}"/>` + t(752 + v / 36 * 300 + 12, 172 + i * 98, String(v), { size: 28, weight: 700, fill: W })).join('') + t(926, 540, 'Most goals in a season', { size: 24, weight: 700, fill: W, anchor: 'middle' }),
  clscorers: () => [['Ronaldo', 140], ['Messi', 129], ['Lewandowski', 109], ['Benzema', 90], ['Mbappé', 74]].map(([n, v], i) =>
    t(752, 124 + i * 78, n, { size: 24, weight: 700, fill: W }) + `<rect x="752" y="${134 + i * 78}" width="${r1(v / 140 * 300)}" height="30" rx="4" fill="${i === 0 ? GOLD : W}" fill-opacity="${i === 0 ? 1 : 0.85}"/>` + t(752 + v / 140 * 300 + 12, 158 + i * 78, String(v), { size: 26, weight: 700, fill: W })).join('') + t(926, 540, 'Champions League goals', { size: 24, weight: 700, fill: W, anchor: 'middle' }),
  pltiles: () => [['260', 'Career goals'], ['213', 'At one club'], ['36', 'In a season'], ['7.69s', 'Fastest goal']].map(([n, l], i) => {
    const x = 752 + (i % 2) * 176, y = 120 + Math.floor(i / 2) * 190;
    return `<rect x="${x}" y="${y}" width="164" height="170" rx="4" fill="#fff" fill-opacity="${i === 0 ? 0.18 : 0.1}"/>` + t(x + 14, y + 80, n, { size: 56, weight: 800, fill: i === 0 ? GOLD : W }) + t(x + 14, y + 128, l, { size: 20, weight: 700, fill: W });
  }).join('') + t(926, 540, 'Premier League records', { size: 24, weight: 700, fill: W, anchor: 'middle' }),
  newelo: () => {
    const E = (g2) => 1 / (1 + Math.pow(10, -g2 / 400)), et = E(200);
    const X = (n) => 756 + (n / 60) * 340, Y = (r) => 470 - ((r - 1500) / 220) * 300;
    let r = 1500; const pts = [`${X(0)},${Y(r)}`];
    for (let n = 1; n <= 60; n++) { r += 20 * (et - E(r - 1500)); pts.push(`${r1(X(n))},${r1(Y(r))}`); }
    return `<line x1="756" x2="1096" y1="${Y(1700)}" y2="${Y(1700)}" stroke="${GOLD}" stroke-width="4" stroke-dasharray="10 8"/><polyline points="${pts.join(' ')}" fill="none" stroke="${W}" stroke-width="8" stroke-linejoin="round"/>` + t(926, 520, 'Learning takes matches', { size: 26, weight: 700, fill: W, anchor: 'middle' });
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
  { section: 'guides', slug: 'poisson-distribution-football-goals-explained', kicker: 'Guide · Modelling', motif: 'poisson', figs: { bars: figPoissonBars } },
  { section: 'guides', slug: 'offside-rule-in-football-explained-simply', kicker: 'Guide · Rules', motif: 'offside', figs: { line: figOffsideLine } },
  { section: 'guides', slug: 'football-league-table-tiebreakers-explained', kicker: 'Guide · Rules', motif: 'table', figs: { order: figTieOrder } },
  { section: 'guides', slug: 'small-samples-and-football-form-luck-or-skill', kicker: 'Guide · Form', motif: 'band', figs: { band: figFormBand } },
  { section: 'guides', slug: 'why-football-draws-happen-and-how-often', kicker: 'Guide · Results', motif: 'draws', figs: { curve: figDrawCurve } },
  { section: 'guides', slug: 'extra-time-and-penalty-shootouts-explained', kicker: 'Guide · Rules', motif: 'ladder', figs: { ladder: figLadder } },
  { section: 'guides', slug: 'how-points-work-in-the-prediction-game', kicker: 'Guide · The game', motif: 'tiers', figs: { tiers: figTiers } },
  { section: 'guides', slug: 'world-cup-all-time-top-scorers', kicker: 'Guide · World Cup', motif: 'scorers', figs: { list: figWcScorers } },
  { section: 'guides', slug: 'most-goals-in-a-premier-league-season', kicker: 'Guide · Records', motif: 'plrecord', figs: { seasons: figPlSeasons } },
  { section: 'guides', slug: 'champions-league-all-time-top-scorers', kicker: 'Guide · Champions League', motif: 'clscorers', figs: { list: figClScorers } },
  { section: 'guides', slug: 'premier-league-scoring-records', kicker: 'Guide · Records', motif: 'pltiles', figs: { records: figPlRecords } },
  { section: 'guides', slug: 'how-the-48-team-world-cup-format-works', kicker: 'Guide · World Cup', motif: 'wc', figs: { funnel: figWcFunnel } },
  { section: 'guides', slug: 'fifa-world-ranking-vs-elo-ratings-difference', kicker: 'Guide · Ratings', motif: 'rank', figs: { compare: figRankCompare } },
  { section: 'guides', slug: 'expected-points-xpts-football-explained', kicker: 'Guide · Expected points', motif: 'xpts', figs: { bars: figXptsBars } },
  { section: 'guides', slug: 'clean-sheets-in-football-how-often-teams-keep-one', kicker: 'Guide · Defence', motif: 'clean', figs: { curve: figCleanCurve } },
  { section: 'guides', slug: 'football-formations-explained-442-433-352', kicker: 'Guide · Tactics', motif: 'formation', figs: { pitches: figFormations } },
  { section: 'guides', slug: 'var-in-football-explained-what-it-can-review', kicker: 'Guide · Rules', motif: 'var', figs: { flow: figVarFlow } },
  { section: 'guides', slug: 'yellow-and-red-cards-in-football-rules-and-suspensions', kicker: 'Guide · Rules', motif: 'cards', figs: { ladder: figCardsLadder } },
  { section: 'guides', slug: 'elo-ratings-for-new-teams-why-few-matches-mean-doubt', kicker: 'Guide · Ratings', motif: 'newelo', figs: { curve: figEloConverge } },
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

// ---------- default social card (og-default.png) ----------
{
  let g = `<rect width="1200" height="630" fill="#0e1512"/>`;
  g += `<g fill="none" stroke="#fff" stroke-opacity="0.06" stroke-width="3"><circle cx="900" cy="315" r="230"/><line x1="900" y1="0" x2="900" y2="630"/><rect x="-40" y="195" width="170" height="240"/></g>`;
  g += `<rect x="80" y="150" width="64" height="10" fill="${GOLD}"/>`;
  g += t(80, 300, 'SCORE', { size: 150, weight: 800, fill: '#fff' }) + t(80 + textWidth('SCORE', 150, 800) + 6, 300, 'RADAR', { size: 150, weight: 800, fill: GOLD });
  g += t(80, 380, 'Football predictions, match analysis and guides', { size: 42, weight: 700, fill: '#d6dbd8' });
  g += t(80, 540, 'FREE SCORE PREDICTOR  ·  ELO + POISSON MODEL', { size: 28, weight: 700, fill: GOLD });
  const svg = svgDoc(1200, 630, 'Soccer Scores Today', g);
  await sharp(Buffer.from(svg), { density: 96 }).resize(1200, 630).png({ compressionLevel: 9 }).toFile(join(ROOT, 'public', 'og-default.png'));
  console.log('og-default.png');
}
