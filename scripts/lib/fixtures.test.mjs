import test from 'node:test';
import assert from 'node:assert/strict';
import { computeElo, START } from './elo.mjs';
import { toEloMatches, buildFixtures } from './fixtures.mjs';

const mk = (date, h, a, hg, ag) => ({ utcDate: date, homeId: h, awayId: a, homeGoals: hg, awayGoals: ag });

test('Elo: winner gains what loser loses, draws between equals do not move ratings', () => {
  const t = computeElo([mk('2026-01-01', 1, 2, 2, 0)]);
  assert.ok(t.get(1).elo > START && t.get(2).elo < START);
  assert.ok(Math.abs(t.get(1).elo + t.get(2).elo - 2 * START) < 1e-9);
  const home = computeElo([mk('2026-01-01', 1, 2, 1, 1)]);
  assert.ok(home.get(1).elo < START, 'home side is expected to do better than a draw because of the home bonus');
  assert.equal(home.get(1).games, 1);
});

test('Elo: bigger margins move ratings more, upsets move them more than routine wins', () => {
  const one = computeElo([mk('2026-01-01', 1, 2, 1, 0)]).get(1).elo;
  const four = computeElo([mk('2026-01-01', 1, 2, 4, 0)]).get(1).elo;
  assert.ok(four > one);
  const warmup = [mk('2025-01-01', 3, 4, 3, 0), mk('2025-02-01', 3, 4, 3, 0), mk('2025-03-01', 3, 4, 3, 0)];
  const routine = computeElo([...warmup, mk('2026-01-01', 3, 4, 1, 0)]);
  const upset = computeElo([...warmup, mk('2026-01-01', 4, 3, 1, 0)]);
  assert.ok(upset.get(4).elo - computeElo(warmup).get(4).elo > routine.get(3).elo - computeElo(warmup).get(3).elo);
});

test('Elo: order of input does not matter; unfinished matches are ignored', () => {
  const a = mk('2026-01-01', 1, 2, 2, 0), b = mk('2026-02-01', 2, 1, 1, 1);
  assert.equal(computeElo([a, b]).get(1).elo, computeElo([b, a]).get(1).elo);
  assert.equal(computeElo([{ ...a, homeGoals: null }]).size, 0);
});

test('toEloMatches keeps only finished matches with a score', () => {
  const api = [
    { status: 'FINISHED', utcDate: '2026-01-01', homeTeam: { id: 1 }, awayTeam: { id: 2 }, score: { fullTime: { home: 1, away: 0 } } },
    { status: 'SCHEDULED', utcDate: '2026-12-01', homeTeam: { id: 1 }, awayTeam: { id: 2 }, score: { fullTime: { home: null, away: null } } },
  ];
  assert.equal(toEloMatches(api).length, 1);
});

test('buildFixtures: future, drawn, well-rated clubs only', () => {
  const ratings = new Map([[1, { elo: 1700.4, games: 40 }], [2, { elo: 1650, games: 38 }], [3, { elo: 1500, games: 3 }]]);
  const now = Date.parse('2026-10-29T00:00:00Z');
  const api = [
    { id: 10, utcDate: '2026-11-04T20:00:00Z', homeTeam: { id: 1, name: 'Arsenal FC', shortName: 'Arsenal' }, awayTeam: { id: 2, name: 'Paris Saint-Germain FC', shortName: 'PSG' } },
    { id: 11, utcDate: '2026-10-01T20:00:00Z', homeTeam: { id: 1, name: 'A' }, awayTeam: { id: 2, name: 'B' } },
    { id: 12, utcDate: '2026-11-05T20:00:00Z', homeTeam: { id: 3, name: 'Thin FC' }, awayTeam: { id: 1, name: 'Arsenal FC' } },
    { id: 13, utcDate: '2026-11-06T20:00:00Z', homeTeam: { id: null }, awayTeam: { id: null } },
  ];
  const { fixtures, skipped } = buildFixtures(api, ratings, { now });
  assert.deepEqual(fixtures.map((f) => f.id), ['10']);
  assert.equal(fixtures[0].homeElo, 1700);
  assert.deepEqual(skipped, ['Thin FC']);
});
