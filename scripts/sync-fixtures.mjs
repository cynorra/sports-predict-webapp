// Writes src/data/fixtures.json from real data only. Run: FOOTBALL_DATA_TOKEN=xxxx npm run fixtures
//   1. downloads finished matches of the top leagues + Champions League for the last seasons (football-data.org, free tier: 10 requests/minute)
//   2. computes club Elo ratings from those results (scripts/lib/elo.mjs)
//   3. downloads upcoming fixtures of the target competition and rates them
// Raw API responses are cached in scripts/.cache so re-runs only fetch what is missing or stale (< 12h for the current season).
// If anything fails, or no fixture can be rated, the existing fixtures.json is left untouched (never fabricate data).
import { writeFileSync, mkdirSync, existsSync, readFileSync, statSync } from 'node:fs';
import { computeElo } from './lib/elo.mjs';
import { toEloMatches, buildFixtures } from './lib/fixtures.mjs';

const token = process.env.FOOTBALL_DATA_TOKEN;
const target = process.env.COMPETITION_CODE || 'CL';
if (!token) { console.error('FOOTBALL_DATA_TOKEN is not set - leaving fixtures untouched.'); process.exit(1); }

const year = new Date().getUTCFullYear();
const SEASONS = [year - 2, year - 1, year]; // football-data "season" = year the season starts (2025 = 2025-26)
const LEAGUES = ['PL', 'PD', 'BL1', 'SA', 'FL1', 'PPL', 'DED']; // free-tier domestic leagues
const CACHE = 'scripts/.cache';
mkdirSync(CACHE, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let lastCall = 0;

async function api(path, cacheKey, maxAgeH) {
  const file = `${CACHE}/${cacheKey}.json`;
  if (existsSync(file) && (maxAgeH == null || Date.now() - statSync(file).mtimeMs < maxAgeH * 36e5)) return JSON.parse(readFileSync(file, 'utf8'));
  const wait = 6500 - (Date.now() - lastCall); // stay under 10 requests/minute
  if (wait > 0) await sleep(wait);
  lastCall = Date.now();
  const res = await fetch(`https://api.football-data.org/v4/${path}`, { headers: { 'X-Auth-Token': token } });
  if (res.status === 429) throw new Error('rate limited (429) - wait a minute and re-run; cached data is kept');
  if (!res.ok) throw new Error(`${path} -> HTTP ${res.status}`);
  const json = await res.json();
  writeFileSync(file, JSON.stringify(json));
  return json;
}

const eloInput = [];
for (const season of SEASONS) {
  const current = season === year;
  for (const code of [...LEAGUES, 'CL']) {
    try {
      const j = await api(`competitions/${code}/matches?status=FINISHED&season=${season}`, `${code}-${season}`, current ? 12 : null);
      eloInput.push(...toEloMatches(j.matches, { k: code === 'CL' ? 30 : 20 }));
      console.log(`${code} ${season}: ${j.matches.length} finished matches`);
    } catch (e) { console.warn(`skip ${code} ${season}: ${e.message}`); }
  }
}
if (eloInput.length < 500) { console.error(`only ${eloInput.length} matches loaded - not enough to rate teams. Leaving fixtures untouched.`); process.exit(1); }

const ratings = computeElo(eloInput);
const upcoming = await api(`competitions/${target}/matches?status=SCHEDULED,TIMED`, `${target}-upcoming`, 1);
const { fixtures, skipped } = buildFixtures(upcoming.matches, ratings, { competition: upcoming.competition?.name ?? 'Champions League' });
if (skipped.length) console.warn('Not enough rated matches for:', skipped.join(', '));
if (!fixtures.length) { console.error('No usable upcoming fixtures - leaving file untouched.'); process.exit(1); }

// Write only when the fixtures themselves changed, so a scheduled run with no news creates no commit and no deploy.
let previous = null;
try { previous = JSON.parse(readFileSync('src/data/fixtures.json', 'utf8')).fixtures; } catch {}
if (previous && JSON.stringify(previous) === JSON.stringify(fixtures)) { console.log('fixtures unchanged - nothing written'); process.exit(0); }

mkdirSync('src/data', { recursive: true });
writeFileSync('src/data/fixtures.json', JSON.stringify({ generatedAt: new Date().toISOString(), sources: ['football-data.org (results and fixtures)'], ratingMatches: eloInput.length, fixtures }, null, 2));
console.log(`wrote ${fixtures.length} fixtures rated from ${eloInput.length} results`);
