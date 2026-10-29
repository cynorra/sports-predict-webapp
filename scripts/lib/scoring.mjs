// Pure scoring and leaderboard logic. The ONLY place points are computed - it runs in the scoring workflow with the
// service account, never in the browser, so the leaderboard cannot be tampered with from the client.
//
// Scoring (shown on /leaderboard): exact score 10, correct result AND goal difference 5, correct result 3, otherwise 0.
// The result used is the score after 90 minutes plus stoppage time (football-data "regularTime" when a match went to extra time).

export function scorePrediction(pred, actual) {
  if (pred.home === actual.home && pred.away === actual.away) return 10;
  const outcome = (x) => Math.sign(x.home - x.away);
  if (outcome(pred) !== outcome(actual)) return 0;
  return pred.home - pred.away === actual.home - actual.away ? 5 : 3;
}

// 90-minute score from a football-data.org match object
export function regularScore(match) {
  const s = match.score?.regularTime ?? match.score?.fullTime;
  return s && s.home != null && s.away != null ? { home: s.home, away: s.away } : null;
}

// fixtures: [{ id, homeGoals?, awayGoals?, ... }]   predictions: [{ id, uid, fixtureId, home, away, points? }]
// users: [{ id, nickname? }]
// Returns leaderboard rows (only users who chose a nickname), per-prediction points to store, and community pick counts.
export function buildStandings({ fixtures, predictions, users }) {
  const result = new Map(fixtures.filter((f) => Number.isInteger(f.homeGoals) && Number.isInteger(f.awayGoals)).map((f) => [f.id, { home: f.homeGoals, away: f.awayGoals }]));
  const nick = new Map(users.filter((u) => typeof u.nickname === 'string' && u.nickname.trim().length >= 2).map((u) => [u.id, u.nickname.trim().slice(0, 24)]));

  const totals = new Map();
  const scored = [];
  const community = new Map();

  for (const p of predictions) {
    if (!Number.isInteger(p.home) || !Number.isInteger(p.away)) continue;
    const c = community.get(p.fixtureId) ?? { home: 0, draw: 0, away: 0, total: 0 };
    c[p.home > p.away ? 'home' : p.home === p.away ? 'draw' : 'away']++; c.total++;
    community.set(p.fixtureId, c);

    const actual = result.get(p.fixtureId);
    if (!actual) continue;
    const points = scorePrediction(p, actual);
    scored.push({ id: p.id, points, changed: p.points !== points });
    const t = totals.get(p.uid) ?? { points: 0, played: 0, exact: 0, outcome: 0 };
    t.points += points; t.played++; if (points === 10) t.exact++; if (points > 0) t.outcome++;
    totals.set(p.uid, t);
  }

  const entries = [...totals]
    .filter(([uid]) => nick.has(uid))
    .map(([uid, t]) => ({ uid, nickname: nick.get(uid), ...t }))
    .sort((a, b) => b.points - a.points || b.exact - a.exact || a.nickname.localeCompare(b.nickname));
  return { entries, scored, community };
}
