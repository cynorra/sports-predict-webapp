// Code-level editorial gates, adapted from yukle-next/scripts/lib/article-quality.js to a football prediction site.
// Principle (universal-adsense-site-standard.md, top rule): nothing untrue may be published. A prompt or a habit is not
// enforcement, so these checks run on every post in `npm run audit` and block the build.
//
// SkorRadar DOES have a real prediction model (Elo + Poisson, see /methodology), so "our model" is allowed.
// It has NO scouts, analysts, insiders, clients, surveys or match attendance, so claims of those are fiction.
// Pure functions only (no I/O) so they can be unit-tested.

export const stripTags = (s) => String(s || '').replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ').replace(/\s+/g, ' ').trim();
// Markdown -> plain text (links keep their label, tables/headings keep their words)
export const mdToText = (s) => String(s || '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/[*_`>#]/g, ' ').replace(/\|/g, ' ').replace(/\s+/g, ' ').trim();
const sentences = (t) => t.split(/(?<=[.!?])(?<!\bvs\.)(?<!\be\.g\.)(?<!\bi\.e\.)(?<!\betc\.)\s+/);

// 1. First-party claims about data, people or work the site does not have
const FIRST_PARTY = [
  /\bour\s+(?:own\s+|internal\s+|proprietary\s+|exclusive\s+)*(?:data(?:set|base)?|analysts?|scouts?|researchers?|experts?|expert team|insiders?|sources|survey|findings|testing|tests|benchmarks?|clients?|customers?|members?|readers?\s+survey)\b/i,
  /\bwe(?:['’]ve| have)?\s+(?:tested|surveyed|interviewed|spoke|talked|scouted|watched|attended|visited|tracked|monitored|studied|observed|seen|saw|audited|collected|recorded|spent)\b/i,
  /\b(?:exclusive|insider|inside) (?:information|sources?|tip|knowledge)\b/i,
  /\b(?:a|one|another) (?:reader|member|user|subscriber)s? of ours\b/i,
  /\b(?:hands-on|first-hand|firsthand) (?:test|testing|experience|analysis)\b/i,
];
export function findFirstPartyClaim(...texts) {
  for (const t of texts.filter(Boolean)) {
    const plain = mdToText(t);
    for (const re of FIRST_PARTY) { const m = plain.match(re); if (m) return plain.slice(Math.max(0, m.index - 25), m.index + m[0].length + 45).trim(); }
  }
  return null;
}

// 2. Invented first-person experience ("As a former scout, I've seen...")
const FP_I = /(?<![A-Za-z])I(?:['’](?:ve|m|d|ll))?(?=\s+[a-z]|['’](?:ve|m|d|ll)b)/;
const FP_CRED_START = /\b(?:As|Being) (?:a|an) (?:former |veteran |seasoned |longtime |long-time |retired )?(?:coach|player|scout|analyst|journalist|tipster|pundit|referee|professional|manager)\b(?:,| turned| for| with)/;
const FP_CRED = /\b(?:veterans? like me|former (?:player|coach|scout|referee)|my (?:own )?(?:\d+\+? )?(?:years|experience|career|time in)|in the dressing room)\b/i;
const FP_READER_QUESTION = /\b(?:how|what|can|should|do|does|is|are|when|why|where|which|will|could|would|am)\b[^!]*\?\s*$/i;
export function findFirstPersonExperience(...texts) {
  for (const t of texts.filter(Boolean)) {
    for (const s of sentences(mdToText(t))) {
      if (FP_READER_QUESTION.test(s)) continue;
      if (FP_CRED.test(s) || FP_CRED_START.test(s) || /^My\s/.test(s.trim()) || (FP_I.test(s) && !/["“”]/.test(s))) return s.slice(0, 160);
    }
  }
  return null;
}
const INDIRECT = /\b(?:decades (?:covering|watching|in) football|years (?:in|around) the (?:game|dressing room|press box)|as someone who(?:['’]s| has|['’]ve| have)? ?(?:spent|worked|played|coached|covered)|hard-won (?:lessons|experience)|(?:we|our team) (?:predict|foresee|guarantee))\b/i;
export function findIndirectExperience(...texts) {
  for (const t of texts.filter(Boolean)) { const p = mdToText(t); const m = p.match(INDIRECT); if (m) return p.slice(Math.max(0, m.index - 30), m.index + m[0].length + 40).trim(); }
  return null;
}

// 3. Hype, guarantees and tipster language (also a gambling-policy risk for AdSense)
const HYPE_META = /\b(guarantee[sd]?|sure[- ](?:win|bet|tip|thing)s?|banker|fixed match(?:es)?|can['’]?t (?:lose|fail)|risk-free|easy money|free money|winning system|insider|secrets?|shocking|foolproof|100%)\b/i;
const HYPE_BODY = /\b(guaranteed\s+(?:\d|win|profit|results?|success|to\b)|guarantees?\s+(?:a\s+|an\s+)?(?:win|profit|results?|success)|sure[- ](?:win|bet|tip)s?|banker\b|fixed matches?|what if I told you|foolproof|can['’]?t lose)/i;
export function findHypeClaim(post) {
  for (const [label, v] of [['title', post.title], ['meta_description', post.meta_description], ['excerpt', post.excerpt]]) {
    const m = mdToText(v).match(HYPE_META); if (m) return `${label}: "${m[0]}"`;
  }
  const m = mdToText(post.content).match(HYPE_BODY);
  return m ? `body: "${m[0]}"` : null;
}

// 4. Betting-advice / sensitive topics. SkorRadar is a prediction GAME and information site, not a tipster or bookmaker affiliate.
const YMYL = [
  /\b(?:betting (?:tips?|strategy|system|advice)|best bets?|value bets?|tipsters?|accumulator tips?|free bets?|promo codes?|sign-?up (?:bonus|offer)s?|bookmaker (?:bonus|offer|review)s?|bet365|1xbet|betway|unibet|william hill|ladbrokes|betfair|bwin)\b/i,
  /\b(?:diagnos(?:is|ed)|prognosis|rehabilitation protocol|treatment plan)\b/i,
];
export function findYmylTopic(...texts) {
  for (const t of texts.filter(Boolean)) { const p = mdToText(t); for (const re of YMYL) { const m = p.match(re); if (m) return p.slice(Math.max(0, m.index - 20), m.index + m[0].length + 30).trim(); } }
  return null;
}

// 5. Invented case studies ("Last season a mid-table club lost 6 of 8 after...") presented as fact
const ILLUSTRATIVE = /\b(?:imagine|suppose|consider|picture|say|hypothetical(?:ly)?|for example|for instance|illustrative|scenario|let['’]s say|assume|worked example)\b/i;
const ANECDOTE = [
  /\blast (?:season|month|year|week),? (?:a|one|an)\b[^.]{0,90}\b(?:club|team|side|manager|coach|striker|goalkeeper|player)\b/i,
  /\b(?:a|one) (?:mid-table|top-flight|lower-league|relegation-threatened|promoted|well-known|unnamed)[a-z -]{0,25}(?:club|team|side)\b[^.]{0,70}\b(?:lost|won|conceded|scored|drew|saved|collapsed|reported)\b/i,
];
export function findFabricatedAnecdote(content) {
  const ss = sentences(mdToText(content));
  for (let i = 0; i < ss.length; i++) for (const re of ANECDOTE) if (re.test(ss[i]) && !ILLUSTRATIVE.test([ss[i - 1] || '', ss[i]].join(' '))) return ss[i].slice(0, 160);
  return null;
}

// 6. False precision: decimal percentages / odd currency / fractional hours presented as discovered facts.
// Markdown tables are exempt: they hold computed results (e.g. Poisson worked examples) that the surrounding text labels as such.
export function countFalsePrecision(content) {
  const noTables = String(content || '').split('\n').filter((l) => !l.trim().startsWith('|')).join('\n');
  const text = mdToText(noTables);
  const all = (re) => [...text.matchAll(re)];
  const inRange = (i, len) => /[-–—]\s*[$€£]?\s*$|\d\s+to\s+[$€£]?\s*$/i.test(text.slice(Math.max(0, i - 8), i)) || /^\s*(?:%|days?|hours?|minutes?)?\s*[-–—]\s*[$€£]?\d/i.test(text.slice(i + len, i + len + 14));
  const decimalPct = all(/\b\d{1,3}\.\d{1,2}\s?%/g).filter((x) => { const v = parseFloat(x[0]); return v >= 1 && v < 90 && !/\.50?\s?%$/.test(x[0]) && !inRange(x.index, x[0].length); }).length;
  const oddMoney = all(/[$€£]\s?\d{1,3}(?:,\d{3})*(?:\.\d+)?(?![\d,])/g).filter((x) => { const n = parseFloat(x[0].replace(/[^\d.]/g, '')); return n >= 100 && n % 50 !== 0 && !inRange(x.index, x[0].length); }).length;
  const fractional = all(/\b\d+\.\d+\s?(?:days?|hours?|hrs?|weeks?|minutes?)\b/gi).filter((x) => !inRange(x.index, x[0].length)).length;
  return { decimalPct, oddMoney, fractional, total: decimalPct + oddMoney + fractional };
}
export const MAX_FALSE_PRECISION = 3;

// 7. Numbers in title / meta description / excerpt (where an unsourced number does the most damage)
export function findInventedNumberInMeta(excerpt, metaDescription, title) {
  const re = /\d+(?:\.\d+)?\s?%|[$€£]\s?\d|\b\d+(?:\.\d+)?\s?(?:x|times)\b/i;
  for (const [label, v] of [['excerpt', excerpt], ['meta_description', metaDescription], ['title', title]]) { const m = String(v || '').match(re); if (m) return `${label}: "${m[0]}"`; }
  return null;
}

// 8. Years: never in a title; no habitual "in 2026" framing in the body (evergreen prose, real dated facts only)
export function titleHasYear(...titles) { for (const t of titles) { const m = String(t || '').match(/\b(20[12]\d)\b/); if (m) return m[1]; } return null; }
const framingYears = (now) => [now.getUTCFullYear() - 1, now.getUTCFullYear()].join('|');
export function countYearFraming(content, now = new Date()) {
  const re = new RegExp('\\b(?:in|for|during|throughout|of)\\s+(?:' + framingYears(now) + ')\\b(?![\\s\\S]{0,20}(?:report|survey|study|edition|update|rule|regulation|standard|amendment|season))', 'gi');
  return (mdToText(content).match(re) || []).length;
}
export const MAX_YEAR_FRAMING = 2;

export function validateArticle(post, now = new Date()) {
  const issues = [];
  const add = (cond, msg) => { if (cond) issues.push(msg); };
  const fpc = findFirstPartyClaim(post.title, post.excerpt, post.meta_description, post.content);
  add(fpc, `FIRST-PARTY CLAIM ("${fpc}") - SkorRadar has a model, not scouts, analysts, insiders, surveys or hands-on testing. Attribute facts to public sources or say "the model".`);
  const fpe = findFirstPersonExperience(post.title, post.excerpt, post.meta_description, post.content);
  add(fpe, `INVENTED FIRST-PERSON EXPERIENCE ("${fpe}") - no "I", "my", "as a former scout". Write in the third person.`);
  const ind = findIndirectExperience(post.title, post.excerpt, post.meta_description, post.content);
  add(ind, `INDIRECT EXPERIENCE CLAIM ("${ind}") - same fabricated authority without the word "I".`);
  const hype = findHypeClaim(post);
  add(hype, `HYPE / GUARANTEE LANGUAGE (${hype}) - no guarantees, sure tips or fixed-match talk. Say "can", "may", "the model estimates".`);
  const ymyl = findYmylTopic(post.title, post.excerpt, post.meta_description, post.content);
  add(ymyl, `BETTING-ADVICE / SENSITIVE TOPIC ("${ymyl}") - SkorRadar is a prediction game, not a tipster or bookmaker affiliate. Medical claims about players need a named public source.`);
  const yf = countYearFraming(post.content, now);
  add(yf > MAX_YEAR_FRAMING, `YEAR FRAMING (${yf} phrases like "in ${now.getUTCFullYear()}") - write evergreen prose; keep a year only for a real dated fact.`);
  const an = findFabricatedAnecdote(post.content);
  add(an, `INVENTED CASE STUDY ("${an}") - label hypotheticals ("Imagine a club...") or cite a real named source.`);
  const fp = countFalsePrecision(post.content);
  add(fp.total > MAX_FALSE_PRECISION, `FALSE PRECISION (${fp.decimalPct} decimal %, ${fp.oddMoney} odd money, ${fp.fractional} fractional units) - use ranges unless a named public source gives the exact figure.`);
  const mn = findInventedNumberInMeta(post.excerpt, post.meta_description, post.title);
  add(mn, `NUMBER IN SEARCH/SHARE TEXT (${mn}) - no percentages, currency or "Nx" claims in title, description or short answer.`);
  const yr = titleHasYear(post.title);
  add(yr, `YEAR IN TITLE ("${yr}") - titles must be evergreen.`);
  return issues;
}
