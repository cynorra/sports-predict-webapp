// Writes src/data/upcoming.json: scheduled matches for today and the next days (SportAPI, sportapi.ai), shown on /soccer-games-today.
// Run: SPORTAPI_KEY=... node scripts/sync-upcoming.mjs      (locally: node --env-file=.env scripts/sync-upcoming.mjs)
//   - one request per day returns every competition, so a run costs UPCOMING_DAYS requests (default 4); the free plan allows 2,000/day and 14,000/month
//   - the key is read from the environment only and is never printed; it must never reach the browser
//   - if the key is missing, a request fails or the API answers 429, the existing file is left untouched (no partial or invented data)
//   - the file is rewritten only when the schedule changed, so a run with no news creates no commit
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { pickUpcoming, nextDates } from './lib/results.mjs';

const key = process.env.SPORTAPI_KEY;
if (!key) { console.log('SPORTAPI_KEY is not set - leaving the schedule untouched.'); process.exit(0); }

const DAYS = Math.min(Math.max(Number(process.env.UPCOMING_DAYS) || 4, 1), 7);
const FILE = 'src/data/upcoming.json';
const all = [];

for (const date of nextDates(DAYS)) {
  let res;
  try {
    res = await fetch(`https://sportapi.ai/api/fixtures/date/${date}`, { headers: { 'X-Api-Key': key }, signal: AbortSignal.timeout(20000) });
  } catch (e) { console.error(`${date}: request failed (${e.name}) - leaving the schedule untouched.`); process.exit(1); }
  if (res.status === 429) { console.error(`${date}: rate limit reached (429) - leaving the schedule untouched.`); process.exit(1); }
  if (!res.ok) { console.error(`${date}: HTTP ${res.status} - leaving the schedule untouched.`); process.exit(1); }
  const json = await res.json();
  if (!json?.success || !Array.isArray(json.data)) { console.error(`${date}: unexpected response shape - leaving the schedule untouched.`); process.exit(1); }
  const kept = pickUpcoming(json.data);
  all.push(...kept);
  console.log(`${date}: ${json.data.length} fixtures, kept ${kept.length}`);
}

// A fixture can appear under two dates around midnight: keep one row per id.
const matches = [...new Map(all.map((m) => [m.id, m])).values()].sort((a, b) => a.kickoff.localeCompare(b.kickoff) || a.id - b.id);
// Nothing scheduled (e.g. an international break): not an error. Past games must not stay listed, so an empty schedule is written.

let previous = null;
try { previous = JSON.parse(readFileSync(FILE, 'utf8')).matches; } catch {}
if (previous && JSON.stringify(previous) === JSON.stringify(matches)) { console.log('schedule unchanged - nothing written'); process.exit(0); }
if (!matches.length) console.log('No scheduled matches from the wanted competitions in the window - writing an empty schedule.');

mkdirSync('src/data', { recursive: true });
writeFileSync(FILE, JSON.stringify({ generatedAt: new Date().toISOString(), source: 'SportAPI (sportapi.ai)', days: DAYS, matches }, null, 2));
console.log(`wrote ${matches.length} upcoming matches`);
