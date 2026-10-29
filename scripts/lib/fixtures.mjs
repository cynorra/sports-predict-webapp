// Pure helpers for the fixture sync: turn football-data.org matches into rated fixtures. No network, no I/O.
// Ratings come from scripts/lib/elo.mjs, keyed by football-data team id (no name matching needed).

export const MIN_GAMES = 10; // rated matches a club needs before we publish a prediction involving it

// Finished API matches -> inputs for computeElo. Champions League games get a higher K because they are the only cross-league link.
export function toEloMatches(apiMatches, { k, label } = {}) {
  return apiMatches
    .filter((m) => m.status === 'FINISHED' && m.score?.fullTime?.home != null && m.homeTeam?.id && m.awayTeam?.id)
    .map((m) => ({ utcDate: m.utcDate, homeId: m.homeTeam.id, awayId: m.awayTeam.id, homeGoals: m.score.fullTime.home, awayGoals: m.score.fullTime.away, k, label }));
}

// Upcoming API matches + rating table -> fixtures. Skips undrawn slots, past kickoffs and clubs with too little history.
export function buildFixtures(upcoming, ratings, { competition = 'Champions League', limit = 12, now = Date.now(), minGames = MIN_GAMES } = {}) {
  const fixtures = [], skipped = new Set();
  for (const m of upcoming) {
    if (!m.utcDate || new Date(m.utcDate).getTime() <= now) continue;
    if (!m.homeTeam?.id || !m.awayTeam?.id) continue; // knockout slot not drawn yet
    const h = ratings.get(m.homeTeam.id), a = ratings.get(m.awayTeam.id);
    const thin = [[m.homeTeam, h], [m.awayTeam, a]].filter(([, r]) => !r || r.games < minGames);
    if (thin.length) { thin.forEach(([t]) => skipped.add(t.name)); continue; }
    fixtures.push({
      id: String(m.id), competition,
      home: m.homeTeam.shortName || m.homeTeam.name, away: m.awayTeam.shortName || m.awayTeam.name,
      kickoff: m.utcDate, homeElo: Math.round(h.elo), awayElo: Math.round(a.elo),
    });
  }
  fixtures.sort((x, y) => x.kickoff.localeCompare(y.kickoff));
  return { fixtures: fixtures.slice(0, limit), skipped: [...skipped] };
}
