// Automatic match previews: picks the next Champions League fixture without a post, asks Gemini to write the prose around
// OUR model's numbers, rejects anything that states a fact that is not in the supplied data, and writes
// src/content/analysis/<slug>.md. Cover and figure images come from `npm run images`; `npm run audit` is the final gate.
//
//   GEMINI_API_KEY=... node scripts/auto-analysis.mjs            write one preview (exit 0 and no file if nothing is due)
//   node scripts/auto-analysis.mjs --dry                         show the chosen fixture and facts, no model call
//   node scripts/auto-analysis.mjs --now 2026-11-22T10:00:00Z    pretend it is that moment (testing)
//
// Needs only Node built-ins (type-stripped import of src/lib/model.ts), so the CI step that holds the API key installs nothing.
import { readFileSync, writeFileSync, readdirSync, existsSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { predictMatch } from '../src/lib/model.ts';
import { pickFixture, buildFacts, previewSlug, checkProse, renderPost } from './lib/auto-analysis.mjs';

const ROOT = decodeURIComponent(new URL('..', import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1');
const DIR = join(ROOT, 'src', 'content', 'analysis');
const arg = (k) => { const i = process.argv.indexOf(k); return i > -1 ? process.argv[i + 1] : undefined; };
const DRY = process.argv.includes('--dry');
const now = arg('--now') ? new Date(arg('--now')) : new Date();
const MODELS = [...new Set([process.env.GEMINI_MODEL, 'gemini-3.5-flash', 'gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-3.6-flash', 'gemini-3.5-flash-lite'].filter(Boolean))];

const existing = readdirSync(DIR).filter((f) => f.endsWith('.md')).map((f) => f.replace(/\.md$/, ''));
const fixtures = JSON.parse(readFileSync(join(ROOT, 'src', 'data', 'fixtures.json'), 'utf8')).fixtures;
const fx = pickFixture(fixtures, { now, existingSlugs: new Set(existing) });
if (!fx) { console.log('No Champions League fixture in the next 4 days without a preview. Nothing to do.'); process.exit(0); }
const slug = previewSlug(fx.home, fx.away);
const facts = buildFacts({ ...fx, ratingMatches: JSON.parse(readFileSync(join(ROOT, 'src', 'data', 'fixtures.json'), 'utf8')).ratingMatches }, predictMatch);
console.log(`Fixture: ${fx.home} vs ${fx.away} (${facts.kickoff}) -> ${slug}`);
if (DRY) { const { model, ...rest } = facts; console.log(JSON.stringify(rest, null, 2)); process.exit(0); }
if (!process.env.GEMINI_API_KEY) { console.error('GEMINI_API_KEY is not set.'); process.exit(1); }

// Internal links the writer may use (all exist; checked below).
const LINKS = [
  ['/methodology', 'how the model works'], ['/predict', 'the free prediction board'],
  ['/guides/elo-ratings-in-soccer-explained', 'Elo ratings explained'], ['/guides/home-advantage-in-soccer-how-big-is-it', 'home advantage'],
  ['/guides/poisson-distribution-soccer-goals-explained', 'Poisson goal distribution'], ['/guides/what-is-xg-expected-goals-explained', 'expected goals (xG)'],
  ['/guides/how-the-new-champions-league-format-works', 'the Champions League format'], ['/guides/why-soccer-draws-happen-and-how-often', 'why draws happen'],
  ['/guides/how-to-predict-soccer-scores', 'how to predict soccer scores'], ['/guides/small-samples-and-soccer-form-luck-or-skill', 'small samples and form'],
];
const linkable = LINKS.filter(([u]) => u.startsWith('/guides/') ? existsSync(join(ROOT, 'src', 'content', 'guides', `${u.slice(8)}.md`)) : true);
const usedSkeletons = existing.map((s) => (readFileSync(join(DIR, `${s}.md`), 'utf8').match(/^## .+$/gm) || []).join('|').toLowerCase());

const system = `You write one match preview for "Soccer Games Today", a free football score-prediction game. The numbers come from the site's own Elo + Poisson model (not from analysts, scouts or insiders).
HARD RULES
- Use ONLY the facts in the FACTS block. State no other number, no other proper name. Do NOT mention players, coaches, stadiums, form, injuries, suspensions, head-to-head history, tactics, standings or trophies: you have no data on them. If the reader should check those, tell them to look at UEFA's official pages.
- Third person only. No "I", "we tested/analysed/found", no "our analysts/data/sources". Say "the model" for the numbers.
- No betting language: no odds, tips, "value", "lock", "sure", "guaranteed", bookmakers. It is a free prediction game; the results are estimates, not promises.
- No percentages, digits or currency in "description". Description 125-155 characters, must contain the phrase "${facts.home} vs ${facts.away} prediction".
- Use the numbers as written in FACTS (Elo ratings, percentages, expected goals with one decimal).
- No claims about "human bias", "thousands of matches", trends or what usually happens: describe only this match's numbers. Write like a clear sports-desk explainer, short sentences, no filler such as "mathematical system" or "algorithmic outputs"; "the model" is enough.
- Vary sentence openings. Write plain, direct English, no hype adjectives.
OUTPUT: one JSON object, nothing else:
{"description": string,
 "intro": string (2 short paragraphs, markdown, 70-110 words, no heading; mention the competition and kickoff time),
 "sections": [ {"h2": string, "body": string} x4 ],   // 4 sections, each 90-150 words of markdown; h2 are specific, original, 4-9 words; section 1 compares the Elo ratings, section 2 turns them into expected goals and the scoreline, section 3 says what the model cannot see, section 4 explains how home advantage enters
 "closing": {"h2": string, "body": string},           // 60-100 words, invites the reader to enter their own scoreline on /predict
 "faq": [ {"q": string ending in "?", "a": string 45-300 chars} x3 or 4 ]}
LINKS: use at least 3 of these as markdown links in section bodies, with natural anchor text: ${linkable.map(([u, t]) => `[${t}](${u})`).join(' ; ')}. The closing must link [free prediction board](/predict).
Bold at most 2 phrases. Use at most one list.`;

const factText = `FACTS
Match: ${facts.home} (home) vs ${facts.away} (away), ${facts.competition}
Kickoff: ${facts.kickoff}
Elo ratings: ${facts.home} ${facts.homeElo}, ${facts.away} ${facts.awayElo}; gap ${facts.diff} points, ${facts.diffWithHome} after the model's fixed home bonus of ${facts.homeBonus} points
Ratings are computed by the site from ${facts.ratingMatches ?? 'many'} real results (football-data.org).
Expected goals: ${facts.home} ${facts.xgHome}, ${facts.away} ${facts.xgAway}
Win/draw/win: ${facts.home} ${facts.pHome}%, draw ${facts.pDraw}%, ${facts.away} ${facts.pAway}%
Most likely scorelines (home-away): ${facts.top.map((t) => `${t.score} at ${t.pct}%`).join(', ')}
Higher-rated side: ${facts.favourite}`;

const KEYS = (process.env.GEMINI_API_KEY || '').split(/[,\s;]+/).filter(Boolean); // the secret may hold several keys (quota rotation)
async function gemini(prompt) {
  let last;
  for (const model of MODELS) for (const key of KEYS) {
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({ systemInstruction: { parts: [{ text: system }] }, contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { temperature: 0.8, maxOutputTokens: 8192, responseMimeType: 'application/json' } }),
        signal: AbortSignal.timeout(180_000),
      });
      if (!r.ok) { last = `${model}: HTTP ${r.status} ${(await r.text()).replace(/\s+/g, ' ').slice(0, 120)}`; console.warn(`  ${last}`); continue; }
      const j = await r.json();
      const c = j.candidates?.[0];
      if (!c || c.finishReason === 'MAX_TOKENS') { last = `${model}: ${c?.finishReason ?? 'no candidate'}`; console.warn(`  ${last}`); continue; }
      console.log(`  written by ${model}`);
      return JSON.parse(c.content.parts.map((p) => p.text).join(''));
    } catch (e) { last = `${model}: ${e.message}`; console.warn(`  ${last}`); }
  }
  throw new Error(`all models failed (${last})`);
}

function shapeIssues(d) {
  const e = [];
  if (!d || typeof d !== 'object') return ['not an object'];
  if (typeof d.description !== 'string' || d.description.length < 120 || d.description.length > 158) e.push(`description is ${d.description?.length} chars (want 120-158)`);
  else if (!d.description.toLowerCase().includes(`${facts.home} vs ${facts.away} prediction`.toLowerCase())) e.push('description lacks the phrase "<home> vs <away> prediction"');
  if (typeof d.intro !== 'string' || d.intro.length < 200) e.push('intro too short');
  if (!Array.isArray(d.sections) || d.sections.length !== 4 || d.sections.some((s) => !s?.h2 || !s?.body || s.body.length < 250)) e.push('need exactly 4 sections with h2 and a body of 250+ chars');
  if (!d.closing?.h2 || !d.closing?.body) e.push('closing missing');
  if (!Array.isArray(d.faq) || d.faq.length < 3 || d.faq.length > 4 || d.faq.some((f) => !f.q?.endsWith('?') || (f.a ?? '').length < 45 || f.a.length > 300)) e.push('need 3-4 faq items, question ending "?", answer 45-300 chars');
  return e;
}

let feedback = '';
for (let attempt = 1; attempt <= 4; attempt++) {
  console.log(`Attempt ${attempt}`);
  let draft;
  try { draft = await gemini(`${factText}\n${feedback}`); } catch (e) { console.warn(`  ${e.message}`); feedback = ''; continue; }
  let issues = shapeIssues(draft);
  if (!issues.length) {
    const text = [draft.intro, ...draft.sections.map((s) => `${s.h2.toLowerCase()}\n${s.body}`), draft.closing.body, ...draft.faq.map((f) => `${f.q} ${f.a}`)].join('\n');
    issues = checkProse(text, facts);
    const links = (draft.sections.map((s) => s.body).join('\n').match(/\]\(\/[^)]+\)/g) || []).length;
    if (links < 3) issues.push(`only ${links} internal links in the sections (want 3+)`);
    if (!draft.closing.body.includes('](/predict)')) issues.push('closing must link [free prediction board](/predict)');
    for (const m of (text + draft.closing.body).matchAll(/\]\((\/[^)#\s]+)\)/g)) if (!linkable.some(([u]) => u === m[1]) && m[1] !== '/analysis') issues.push(`unknown internal link ${m[1]}`);
    const sk = ['## ' + draft.sections[0].h2, '## ' + draft.sections[1].h2, '## ' + draft.sections[2].h2, '## ' + draft.sections[3].h2, '## ' + draft.closing.h2, '## sources'].join('|').toLowerCase();
    if (usedSkeletons.some((u) => u === sk)) issues.push('H2 sequence duplicates an existing preview: write different headings');
  }
  if (!issues.length) {
    const file = join(DIR, `${slug}.md`);
    writeFileSync(file, renderPost(fx, facts, draft, { slug, now }));
    // Images first (the audit checks the files), then the whole content audit. A failing audit removes the draft again.
    // The key is stripped from the children's environment: they load npm packages, the writer step must not leak it to them.
    const childEnv = { ...process.env }; delete childEnv.GEMINI_API_KEY;
    const images = spawnSync(process.execPath, [join(ROOT, 'scripts', 'images', 'build-images.mjs')], { cwd: ROOT, stdio: 'inherit', env: childEnv });
    const audit = images.status === 0 ? spawnSync(process.execPath, [join(ROOT, 'scripts', 'audit-content.mjs')], { cwd: ROOT, encoding: 'utf8', env: childEnv }) : { status: 1, stdout: '', stderr: 'image build failed' };
    if (audit.status === 0) { console.log(`PUBLISHED-READY ${slug}`); process.exit(0); }
    const out = `${audit.stdout}\n${audit.stderr}`.split('\n').filter((l) => l.startsWith('FAIL') || l.startsWith('image build')).slice(0, 8);
    unlinkSync(file);
    for (const f of readdirSync(join(ROOT, 'public', 'images')).filter((x) => x.startsWith(slug))) unlinkSync(join(ROOT, 'public', 'images', f));
    issues = out.length ? out : ['audit failed'];
    if (images.status !== 0) { console.error('Image build failed, aborting.'); process.exit(1); }
  }
  console.warn(`  rejected: ${issues.join(' | ')}`);
  feedback = `\nYour previous draft was rejected for: ${issues.join('; ')}. Write it again and fix exactly these problems.`;
}
console.error(`No preview for ${slug} passed the gates after 4 attempts; nothing was written.`);
process.exit(1);
