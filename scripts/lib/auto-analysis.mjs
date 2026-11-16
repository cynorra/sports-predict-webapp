// Pure helpers for the automatic match-preview pipeline (scripts/auto-analysis.mjs). No I/O, so they can be unit-tested.
//
// Truthfulness model: every number and every team name in an auto preview comes from our own Elo/Poisson model and
// fixtures.json (football-data.org). The language model only writes prose AROUND those facts. checkProse() rejects any
// draft that contains a number or a proper name that is not in the supplied facts, so invented form, injuries, players,
// coaches or history cannot get through.

export const slugify = (s) => String(s).normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
export const previewSlug = (home, away) => `${slugify(home)}-vs-${slugify(away)}-prediction`;

/** Next fixture worth a preview: kicks off in (now+3h, now+windowDays], has no post yet, strongest clubs first. */
export function pickFixture(fixtures, { now = new Date(), existingSlugs = new Set(), windowDays = 4 } = {}) {
  const lo = now.getTime() + 3 * 36e5, hi = now.getTime() + windowDays * 864e5;
  return fixtures
    .filter((f) => /UEFA Champions League/.test(f.competition)) // the Sources section links the UEFA site; add other competitions with their own official source
    .filter((f) => f.home && f.away && Number.isFinite(f.homeElo) && Number.isFinite(f.awayElo))
    .filter((f) => { const k = Date.parse(f.kickoff); return k > lo && k <= hi; })
    .filter((f) => !existingSlugs.has(previewSlug(f.home, f.away)))
    .sort((a, b) => (b.homeElo + b.awayElo) - (a.homeElo + a.awayElo) || Date.parse(a.kickoff) - Date.parse(b.kickoff))[0] ?? null;
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** Kickoff in US Eastern wall-clock text ("Tuesday 24 November 2026, 3:00 pm Eastern"). */
export function kickoffText(iso) {
  const d = new Date(iso);
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', weekday: 'long' }).formatToParts(d).map((x) => [x.type, x.value]));
  const h12 = +p.hour % 12 || 12;
  return { text: `${p.weekday} ${p.day} ${MONTHS[+p.month - 1]} ${p.year}, ${h12}:${p.minute} ${+p.hour >= 12 ? 'pm' : 'am'} Eastern`, day: +p.day, year: +p.year };
}

export const pct = (p) => Math.round(p * 100);

/** Everything the writer may state, derived from the model. `predict` is predictMatch from src/lib/model.ts. */
export function buildFacts(fx, predict) {
  const m = predict({ elo: fx.homeElo }, { elo: fx.awayElo });
  const diff = Math.round(fx.homeElo - fx.awayElo);
  const rows = [];
  const pmf = (k, l) => { let p = Math.exp(-l); for (let i = 1; i <= k; i++) p *= l / i; return p; };
  for (let h = 0; h <= 5; h++) for (let a = 0; a <= 5; a++) rows.push({ h, a, p: pmf(h, m.xgHome) * pmf(a, m.xgAway) });
  const top = rows.sort((x, y) => y.p - x.p).slice(0, 3).map((r) => ({ score: `${r.h}-${r.a}`, pct: pct(r.p) }));
  const k = kickoffText(fx.kickoff);
  const fav = m.pHome >= m.pAway ? fx.home : fx.away;
  return {
    home: fx.home, away: fx.away, competition: fx.competition, kickoff: k.text, kickoffDay: k.day, kickoffYear: k.year,
    homeElo: Math.round(fx.homeElo), awayElo: Math.round(fx.awayElo), diff, diffWithHome: diff + 65, homeBonus: 65,
    xgHome: +m.xgHome.toFixed(1), xgAway: +m.xgAway.toFixed(1),
    pHome: pct(m.pHome), pDraw: pct(m.pDraw), pAway: pct(m.pAway),
    best: { home: m.mostLikely.home, away: m.mostLikely.away, pct: pct(m.mostLikely.p) }, top,
    favourite: fav, ratingMatches: fx.ratingMatches ?? null, model: m,
  };
}

// Numbers/words that are fine in any preview (rule and format constants, section vocabulary).
const FREE_NUMBERS = new Set(['65', '36', '8', '24', '100', '400', '10', '11', '12', '90', '1', '2', '3', '4', '5', '6', '7', '9', '0']);
const FREE_WORDS = new Set(['Elo', 'Poisson', 'Soccer', 'Games', 'Today', 'UEFA', 'League', 'Champions', 'Maher', 'Eastern', 'The', 'February', 'Europe', 'European', 'English', 'Spanish', 'German', 'Italian', 'French', 'Dutch', 'Premier', 'La', 'Liga', 'Bundesliga', 'Serie', 'Ligue', 'FIFA', 'US', 'EST', 'EDT', 'Football', 'Wikipedia']);
for (const w of [...DAYS, ...MONTHS]) FREE_WORDS.add(w);

function proseOnly(md) {
  return String(md)
    .replace(/<figure>[\s\S]*?<\/figure>/g, ' ')
    .replace(/\]\([^)]*\)/g, ']')        // link targets
    .replace(/^## Sources[\s\S]*$/m, ' ');
}

/** Returns reasons the draft prose states something that is not in the facts (empty = ok). */
export function checkProse(text, facts) {
  const reasons = [];
  const allowedNums = new Set(FREE_NUMBERS);
  for (const v of [facts.homeElo, facts.awayElo, facts.diff, facts.diffWithHome, facts.xgHome, facts.xgAway, facts.pHome, facts.pDraw, facts.pAway, facts.best.pct, facts.kickoffDay, facts.kickoffYear, facts.ratingMatches, ...facts.top.map((t) => t.pct)]) if (v != null) allowedNums.add(String(Math.abs(v)));
  const body = proseOnly(text);
  const bad = new Set();
  for (const m of body.matchAll(/\d[\d,]*(?:\.\d+)?/g)) {
    const n = m[0].replace(/,/g, '');
    if (!allowedNums.has(n) && !allowedNums.has(String(+n))) bad.add(m[0]);
  }
  if (bad.size) reasons.push(`numbers not in the supplied facts: ${[...bad].slice(0, 6).join(', ')} - use only the numbers given`);

  const allowedWords = new Set(FREE_WORDS);
  for (const s of [facts.home, facts.away, facts.competition]) for (const w of s.split(/[^A-Za-zÀ-ɏ']+/)) if (w) allowedWords.add(w);
  const names = new Set();
  const lowerWords = new Set((body.match(/[a-z][a-z'’-]+/g) || []));   // a capitalised word that also appears in lower case is an ordinary word (Title Case label, list item), not a name
  for (const line of body.split('\n')) {
    if (/^\s*#/.test(line)) continue;                               // headings are Title Case
    const cleaned = line.replace(/^\s*(?:[-*]|\d+\.)\s+/, '').replace(/\*\*[^*]*\*\*/g, ' ');
    for (const m of cleaned.matchAll(/[A-Z][A-Za-zÀ-ɏ'’-]*/g)) {
      const before = cleaned.slice(0, m.index).replace(/[\s*_\[("“]+$/, '');
      if (before === '' || /[.!?:]$/.test(before)) continue;       // first word of a sentence: capital is just grammar
      const w = m[0].replace(/['’]s$/, '');
      if (w.length < 2 || lowerWords.has(w.toLowerCase()) || w === 'I' || w === 'A' || allowedWords.has(w) || allowedWords.has(m[0])) continue;
      names.add(w);
    }
  }
  if (names.size) reasons.push(`proper names that are not in the facts: ${[...names].slice(0, 8).join(', ')} - do not mention players, coaches, venues, form, injuries or history`);
  return reasons;
}

export const SOURCES = () => [
  '- [Soccer Games Today methodology](/methodology), Soccer Games Today. How the club ratings, expected goals and Poisson probabilities in this preview are computed.',
  '- [football-data.org API documentation](https://www.football-data.org/documentation/quickstart), football-data.org. The match results behind the ratings and the fixture list used here.',
  '- [Maher (1982), "Modelling association football scores"](https://doi.org/10.1111/j.1467-9574.1982.tb00782.x), Statistica Neerlandica. The independent Poisson model of football scores.',
  `- [UEFA Champions League, official site](https://www.uefa.com/uefachampionsleague/), UEFA. Official fixtures, standings and team news to check before kickoff.`,
].join('\n');

const yamlStr = (s) => `"${String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;

/** Assemble the markdown file. `draft` is the parsed writer JSON. */
export function renderPost(fx, facts, draft, { slug, now }) {
  const { model: m } = facts;
  const title = (() => {
    const base = `${facts.home} vs ${facts.away} Prediction`;
    for (const t of [`${base} and Match Preview`, `${base} and Match Analysis`, base, `${base}: Model Preview`]) if (t.length >= 30 && t.length <= 60) return t;
    return base;
  })();
  const scoreWords = `${facts.best.home}-${facts.best.away}`;
  const lean = facts.pHome >= facts.pAway && facts.pHome >= facts.pDraw ? `a win for ${facts.home}` : facts.pAway >= facts.pDraw ? `a win for ${facts.away}` : 'a draw';
  const answer = `The Soccer Games Today model rates ${lean} as the most likely result of ${facts.home} vs ${facts.away}, with ${scoreWords} the single most probable scoreline. It is built from Elo ratings only and is an estimate, not a promise.`;
  const kw = [`${facts.home} vs ${facts.away} prediction`.toLowerCase(), `${facts.home} vs ${facts.away} score prediction`.toLowerCase(), `${facts.competition} match preview`.toLowerCase()];
  const alt = `Soccer Games Today cover showing the model scoreline ${facts.home} ${facts.best.home}-${facts.best.away} ${facts.away} with win chances of ${facts.pHome}%, ${facts.pDraw}% and ${facts.pAway}%`;
  const figAlt = `Grid of exact-score probabilities for ${facts.home} against ${facts.away}: ${scoreWords} at ${facts.best.pct}% is the most likely result`;
  const figure = `<figure>\n<img src="/images/${slug}-scorelines.svg" alt="${figAlt}" width="1200" height="912" loading="lazy" decoding="async">\n<figcaption>The model’s chance of every exact score, with the most likely result outlined in gold.</figcaption>\n</figure>`;
  const fm = [
    '---',
    `title: ${yamlStr(title)}`,
    `description: ${yamlStr(draft.description)}`,
    `answer: ${yamlStr(answer)}`,
    `publishedAt: ${now.toISOString()}`,
    'sport: football',
    'image:',
    `  src: "/images/${slug}.svg"`,
    `  alt: ${yamlStr(alt)}`,
    `homeTeam: ${yamlStr(fx.home)}`,
    `awayTeam: ${yamlStr(fx.away)}`,
    `homeElo: ${facts.homeElo}`,
    `awayElo: ${facts.awayElo}`,
    ...(fx.homeCrest ? [`homeCrest: ${yamlStr(fx.homeCrest)}`] : []),
    ...(fx.awayCrest ? [`awayCrest: ${yamlStr(fx.awayCrest)}`] : []),
    `competition: ${yamlStr(fx.competition)}`,
    `kickoff: ${new Date(fx.kickoff).toISOString()}`,
    'prediction:',
    `  home: ${m.mostLikely.home}`,
    `  away: ${m.mostLikely.away}`,
    `  pHome: ${(facts.pHome / 100).toFixed(2)}`,
    `  pDraw: ${(facts.pDraw / 100).toFixed(2)}`,
    `  pAway: ${(facts.pAway / 100).toFixed(2)}`,
    `keywords: [${kw.map(yamlStr).join(', ')}]`,
    'faq:',
    ...draft.faq.flatMap((f) => [`  - q: ${yamlStr(f.q)}`, `    a: ${yamlStr(f.a)}`]),
    '---',
    '',
  ].join('\n');
  const secs = draft.sections.map((s) => `## ${s.h2}\n\n${s.body.trim()}`);
  secs.splice(Math.min(2, secs.length), 0, figure);          // figure after the expected-goals section
  const body = [draft.intro.trim(), ...secs, `## ${draft.closing.h2}\n\n${draft.closing.body.trim()}`, `## Sources\n\n${SOURCES()}`].join('\n\n');
  return `${fm}\n${body}\n`;
}
