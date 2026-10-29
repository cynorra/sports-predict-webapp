// Computes club Elo ratings from real match results (no third-party rating source). Pure function, unit-tested.
// Method (documented on /methodology): every club starts at 1500; after each match the rating moves by
//   K * G * (actual - expected)
// where expected uses a 65-point home bonus, actual is 1 / 0.5 / 0, and G scales with the goal margin
// (1 for a one-goal margin or draw, 1.5 for two goals, (11 + margin) / 8 for three or more - the World Football Elo convention).
// Cross-league strength comes only from matches between clubs of different leagues (the Champions League), so
// ratings of clubs with few such matches are less reliable: callers should check `games`.

export const HOME_BONUS = 65;
export const START = 1500;

const expected = (diff) => 1 / (1 + Math.pow(10, -diff / 400));
const margin = (m) => (m <= 1 ? 1 : m === 2 ? 1.5 : (11 + m) / 8);

// matches: [{ utcDate, homeId, awayId, homeGoals, awayGoals, k? }] in any order. Returns Map(id -> { elo, games }).
export function computeElo(matches, { k = 20 } = {}) {
  const sorted = [...matches].sort((a, b) => a.utcDate.localeCompare(b.utcDate));
  const table = new Map();
  const get = (id) => { if (!table.has(id)) table.set(id, { elo: START, games: 0 }); return table.get(id); };
  for (const m of sorted) {
    if (m.homeGoals == null || m.awayGoals == null) continue;
    const h = get(m.homeId), a = get(m.awayId);
    const e = expected(h.elo + HOME_BONUS - a.elo);
    const actual = m.homeGoals > m.awayGoals ? 1 : m.homeGoals === m.awayGoals ? 0.5 : 0;
    const delta = (m.k ?? k) * margin(Math.abs(m.homeGoals - m.awayGoals)) * (actual - e);
    h.elo += delta; a.elo -= delta; h.games++; a.games++;
  }
  return table;
}
