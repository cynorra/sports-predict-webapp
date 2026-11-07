// Pure helpers for the results sync: turn SportAPI fixtures into the compact list shown on /results. No network, no I/O.

// Competitions shown on /results, in display order. Names are exactly as SportAPI reports them (league_name).
export const LEAGUES = [
  'Premier League',
  'UEFA Champions League',
  'UEFA Europa League',
  'Spanish La Liga',
  'German Bundesliga',
  'Italian Serie A',
  'French Ligue 1',
];

const FINISHED = new Set(['FT', 'AET', 'PENS']);

/** Finished matches of the wanted competitions, as small plain objects. Unfinished, postponed and score-less rows are dropped. */
export function pickResults(fixtures, leagues = LEAGUES) {
  const out = [];
  for (const f of fixtures ?? []) {
    if (!FINISHED.has(f.status) || !leagues.includes(f.league_name)) continue;
    if (!Number.isInteger(f.home_score) || !Number.isInteger(f.away_score)) continue;
    if (!f.home_team || !f.away_team || !f.date) continue;
    out.push({
      id: f.id,
      date: f.date, // calendar date in Central European time, as the API keeps its match calendar
      kickoff: f.kickoff_utc ?? null,
      league: f.league_name,
      home: f.home_short || f.home_team,
      away: f.away_short || f.away_team,
      homeScore: f.home_score,
      awayScore: f.away_score,
      status: f.status,
      ...(Number.isInteger(f.penalty_home) && Number.isInteger(f.penalty_away) && { penHome: f.penalty_home, penAway: f.penalty_away }),
    });
  }
  return out;
}

/** Newest date first; inside a date competitions follow LEAGUES order, then kickoff time. */
export function groupByDate(results, leagues = LEAGUES) {
  const rank = (l) => { const i = leagues.indexOf(l); return i < 0 ? leagues.length : i; };
  const byDate = new Map();
  for (const r of results) {
    if (!byDate.has(r.date)) byDate.set(r.date, []);
    byDate.get(r.date).push(r);
  }
  return [...byDate.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([date, matches]) => ({
      date,
      matches: matches.sort((x, y) => rank(x.league) - rank(y.league) || String(x.kickoff).localeCompare(String(y.kickoff)) || x.id - y.id),
    }));
}

/** YYYY-MM-DD strings for today and the previous days-1 days (UTC). */
export function lastDates(days, now = Date.now()) {
  return Array.from({ length: days }, (_, i) => new Date(now - i * 864e5).toISOString().slice(0, 10));
}
