// Content quality gate: run `npm run audit` before every deploy. Exit code 1 = at least one post fails.
// Checks SEO lengths, AEO/GEO structure, keyword placement, thin content, leftover template text and cross-post similarity.
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { validateArticle } from './lib/article-quality.mjs';

const ROOT = new URL('../src/content/', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const RULES = {
  guides: { minWords: 800, minH2: 4, minFaq: 3 },
  analysis: { minWords: 500, minH2: 5, minFaq: 3 },
  news: { minWords: 400, minH2: 3, minFaq: 2 },
};
const LIMITS = { title: [30, 60], description: [120, 158], answer: [120, 300], faqAnswer: [40, 320] };
const BANNED = [/editor'?s note/i, /lorem ipsum/i, /\bTODO\b/, /\bTBD\b/, /draft template/i, /\[team ?[ab]\]/i, /\{\{.*?\}\}/, /insert .* here/i, /as an ai/i];
const SIM_MAX = 0.12; // max 5-word-shingle Jaccard overlap between two posts

function parse(raw) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/.exec(raw.replace(/\r\n/g, '\n'));
  if (!m) return null;
  const fm = m[1];
  const str = (k) => (new RegExp(`^${k}:\\s*"?(.*?)"?\\s*$`, 'm').exec(fm) || [])[1] ?? '';
  const kw = (/^keywords:\s*\[(.*)\]/m.exec(fm) || [])[1] ?? '';
  const keywords = [...kw.matchAll(/"([^"]+)"/g)].map((x) => x[1]);
  const faq = [...fm.matchAll(/- q: "(.*)"\r?\n\s+a: "(.*)"/g)].map((x) => ({ q: x[1], a: x[2] }));
  return { fm, body: m[2], title: str('title'), description: str('description'), answer: str('answer'), keywords, faq, draft: /^draft:\s*true/m.test(fm) };
}
const words = (t) => t.replace(/[#>*|`_\-]/g, ' ').split(/\s+/).filter(Boolean);
const shingles = (t, n = 5) => {
  const w = words(t).map((x) => x.toLowerCase().replace(/[^a-z0-9']/g, '')).filter(Boolean);
  const s = new Set();
  for (let i = 0; i + n <= w.length; i++) s.add(w.slice(i, i + n).join(' '));
  return s;
};
const jaccard = (a, b) => {
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter || 1);
};

let errors = 0;
const warn = [];
const posts = [];
for (const section of Object.keys(RULES)) {
  const dir = join(ROOT, section);
  if (!existsSync(dir)) continue;
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.md'))) {
    const p = parse(readFileSync(join(dir, f), 'utf8'));
    const id = `${section}/${f}`;
    if (!p) { console.error(`FAIL ${id}: no frontmatter`); errors++; continue; }
    if (p.draft) continue;
    posts.push({ id, section, ...p });
  }
}

const fail = (id, msg) => { console.error(`FAIL ${id}: ${msg}`); errors++; };
for (const p of posts) {
  const r = RULES[p.section];
  const range = (k, v) => v.length < LIMITS[k][0] || v.length > LIMITS[k][1] ? fail(p.id, `${k} is ${v.length} chars (want ${LIMITS[k][0]}-${LIMITS[k][1]})`) : 0;
  range('title', p.title); range('description', p.description); range('answer', p.answer);
  const wc = words(p.body).length;
  if (wc < r.minWords) fail(p.id, `${wc} words (min ${r.minWords})`);
  const h2 = (p.body.match(/^## /gm) || []).length;
  if (h2 < r.minH2) fail(p.id, `${h2} H2 headings (min ${r.minH2})`);
  if (p.faq.length < r.minFaq) fail(p.id, `${p.faq.length} FAQ items (min ${r.minFaq})`);
  p.faq.forEach((q) => { if (q.a.length < LIMITS.faqAnswer[0] || q.a.length > LIMITS.faqAnswer[1]) fail(p.id, `FAQ answer "${q.q}" is ${q.a.length} chars`); if (!q.q.endsWith('?')) fail(p.id, `FAQ question must end with "?": ${q.q}`); });
  // Truthfulness gates (ported from yukle-next): fabricated claims, hype, betting advice, false precision, years in titles
  validateArticle({ title: p.title, excerpt: p.answer, meta_description: p.description, content: p.body }).forEach((msg) => fail(p.id, msg));
  BANNED.forEach((re) => { if (re.test(p.fm + p.body)) fail(p.id, `leftover template text matches ${re}`); });
  if (p.keywords.length < 3) fail(p.id, 'need at least 3 keywords (first = primary)');
  const primary = (p.keywords[0] || '').toLowerCase();
  if (primary) {
    const first150 = words(p.body).slice(0, 150).join(' ').toLowerCase();
    if (!p.title.toLowerCase().includes(primary)) warn.push(`${p.id}: primary keyword "${primary}" not in title`);
    if (!p.description.toLowerCase().includes(primary)) warn.push(`${p.id}: primary keyword not in description`);
    if (!p.answer.toLowerCase().includes(primary.split(' ').slice(0, 2).join(' '))) warn.push(`${p.id}: primary keyword not in short answer`);
    if (!first150.includes(primary.split(' ')[0])) warn.push(`${p.id}: primary keyword missing from first 150 words`);
    const density = (p.body.toLowerCase().split(primary).length - 1) / wc;
    if (density > 0.02) fail(p.id, `keyword stuffing: "${primary}" density ${(density * 100).toFixed(1)}% (max 2%)`);
  }
  const links = (p.body.match(/\]\(\/[^)]+\)/g) || []).length;
  if (links < 2) warn.push(`${p.id}: only ${links} internal links (want 2+)`);
  if (!/\]\(https?:\/\//.test(p.body)) warn.push(`${p.id}: no external source link (cite UEFA/league/data provider)`);
  const lens = p.body.split(/\n\n/).filter((x) => !/^(#|\||- |\d+\. )/.test(x)).map((x) => words(x).length);
  if (Math.max(...lens) > 120) warn.push(`${p.id}: a paragraph exceeds 120 words (hurts readability and AI extraction)`);
}

// Skeleton variety (standard 1.2): at most 3 posts in a section may share the exact same H2 sequence,
// and identical FAQ counts / description openings across many posts look programmatic.
const h2Seq = (p) => (p.body.match(/^## .+$/gm) || []).map((x) => x.toLowerCase()).join('|');
for (const section of Object.keys(RULES)) {
  const sp = posts.filter((p) => p.section === section);
  const groups = new Map();
  sp.forEach((p) => groups.set(h2Seq(p), [...(groups.get(h2Seq(p)) || []), p.id]));
  for (const ids of groups.values()) if (ids.length > 3) ids.forEach((id) => fail(id, `${ids.length} posts in "${section}" share the exact same H2 skeleton (max 3) - vary the structure`));
  if (sp.length >= 5) {
    const counts = new Set(sp.map((p) => p.faq.length));
    if (counts.size === 1) warn.push(`${section}: every post has ${sp[0].faq.length} FAQ items - vary between 3 and 8 by real need`);
    const opens = new Map();
    sp.forEach((p) => { const k = p.description.toLowerCase().split(' ').slice(0, 3).join(' '); opens.set(k, (opens.get(k) || 0) + 1); });
    for (const [k, n] of opens) if (n > 3) warn.push(`${section}: ${n} descriptions start with "${k}" - avoid a formula`);
  }
}

// Freshness (standard 1.5): list posts whose review date (updatedAt, else publishedAt, + 60 days) has passed. Report only, never edits dates.
if (process.argv.includes('--freshness')) {
  const now = Date.now();
  for (const p of posts) {
    const base = new Date(/^updatedAt:\s*(\S+)/m.exec(p.fm)?.[1] ?? /^publishedAt:\s*(\S+)/m.exec(p.fm)?.[1]);
    const due = base.getTime() + 60 * 864e5;
    if (due < now) console.log(`REVIEW DUE ${p.id} (last touched ${base.toISOString().slice(0, 10)})`);
  }
}

// Orphan pages (standard 3.8): once there are 3+ posts, every post must be linked from the body of at least one other post.
if (posts.length >= 3) {
  for (const p of posts) {
    const url = `/${p.section}/${p.id.split('/')[1].replace(/\.md$/, '')}`;
    const inbound = posts.filter((o) => o !== p && o.body.includes(`](${url})`)).length;
    if (inbound === 0) fail(p.id, `orphan: no other post links to ${url} - add a natural contextual link from a related post`);
  }
}

const dup = (key) => {
  const seen = new Map();
  for (const p of posts) { const k = p[key].toLowerCase(); if (seen.has(k)) fail(p.id, `duplicate ${key} with ${seen.get(k)}`); else seen.set(k, p.id); }
};
dup('title'); dup('description'); dup('answer');

for (let i = 0; i < posts.length; i++) {
  const a = shingles(posts[i].body);
  for (let j = i + 1; j < posts.length; j++) {
    const sim = jaccard(a, shingles(posts[j].body));
    if (sim > SIM_MAX) fail(posts[i].id, `${(sim * 100).toFixed(0)}% text overlap with ${posts[j].id} (max ${SIM_MAX * 100}%) - rewrite, don't reuse templates`);
  }
}

warn.forEach((w) => console.warn(`WARN ${w}`));
console.log(`\n${posts.length} posts checked, ${errors} failures, ${warn.length} warnings`);
process.exit(errors ? 1 : 0);
