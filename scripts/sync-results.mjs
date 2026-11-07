// Writes src/data/results.json: finished matches of the main European competitions for the last few days (SportAPI, sportapi.ai).
// Run: SPORTAPI_KEY=... node scripts/sync-results.mjs      (locally: node --env-file=.env scripts/sync-results.mjs)
//   - one request per day returns every competition, so a run costs RESULT_DAYS requests (default 5); the free plan allows 2,000/day and 14,000/month
//   - the key is read from the environment only and is never printed; it must never reach the browser
//   - if the key is missing, a request fails or the API answers 429, the existing file is left untouched (no partial or invented data)
//   - the file is rewritten only when the matches changed, so a scheduled run with no news creates no commit
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { pickResults, lastDates } from './lib/results.mjs';

const key = process.env.SPORTAPI_KEY;
if (!key) { console.log('SPORTAPI_KEY is not set - leaving results untouched.'); process.exit(0); }

const DAYS = Math.min(Math.max(Number(process.env.RESULT_DAYS) || 5, 1), 10);
const FILE = 'src/data/results.json';
const all = [];

for (const date of lastDates(DAYS)) {
  let res;
  try {
    res = await fetch(`https://sportapi.ai/api/fixtures/date/${date}`, { headers: { 'X-Api-Key': key }, signal: AbortSignal.timeout(20000) });
  } catch (e) { console.error(`${date}: request failed (${e.name}) - leaving results untouched.`); process.exit(1); }
  if (res.status === 429) { console.error(`${date}: rate limit reached (429) - leaving results untouched.`); process.exit(1); }
  if (!res.ok) { console.error(`${date}: HTTP ${res.status} - leaving results untouched.`); process.exit(1); }
  const json = await res.json();
  if (!json?.success || !Array.isArray(json.data)) { console.error(`${date}: unexpected response shape - leaving results untouched.`); process.exit(1); }
  all.push(...pickResults(json.data));
  console.log(`${date}: ${json.data.length} fixtures, kept ${pickResults(json.data).length}`);
}

// A fixture can appear under two dates around midnight: keep one row per id.
const matches = [...new Map(all.map((m) => [m.id, m])).values()].sort((a, b) => b.date.localeCompare(a.date) || a.id - b.id);
if (!matches.length) { console.error('No finished matches in the window - leaving results untouched.'); process.exit(1); }

let previous = null;
try { previous = JSON.parse(readFileSync(FILE, 'utf8')).matches; } catch {}
if (previous && JSON.stringify(previous) === JSON.stringify(matches)) { console.log('results unchanged - nothing written'); process.exit(0); }

mkdirSync('src/data', { recursive: true });
writeFileSync(FILE, JSON.stringify({ generatedAt: new Date().toISOString(), source: 'SportAPI (sportapi.ai)', days: DAYS, matches }, null, 2));
console.log(`wrote ${matches.length} results`);
