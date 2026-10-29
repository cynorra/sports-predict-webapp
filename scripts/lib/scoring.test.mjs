import test from 'node:test';
import assert from 'node:assert/strict';
import { scorePrediction, regularScore, buildStandings } from './scoring.mjs';
import { updateMask, fromDoc } from './firestore-rest.mjs';

test('scoring rules: 10 exact, 5 result+goal difference, 3 result, 0 wrong', () => {
  assert.equal(scorePrediction({ home: 2, away: 1 }, { home: 2, away: 1 }), 10);
  assert.equal(scorePrediction({ home: 3, away: 2 }, { home: 2, away: 1 }), 5);
  assert.equal(scorePrediction({ home: 1, away: 0 }, { home: 3, away: 1 }), 3);
  assert.equal(scorePrediction({ home: 0, away: 0 }, { home: 2, away: 2 }), 5); // draw with same difference
  assert.equal(scorePrediction({ home: 1, away: 1 }, { home: 2, away: 0 }), 0);
  assert.equal(scorePrediction({ home: 0, away: 1 }, { home: 1, away: 0 }), 0);
});

test('regularScore prefers the 90-minute score over the extra-time score', () => {
  assert.deepEqual(regularScore({ score: { fullTime: { home: 3, away: 2 }, regularTime: { home: 2, away: 2 } } }), { home: 2, away: 2 });
  assert.deepEqual(regularScore({ score: { fullTime: { home: 1, away: 0 } } }), { home: 1, away: 0 });
  assert.equal(regularScore({ score: { fullTime: { home: null, away: null } } }), null);
});

test('standings: only nicknamed users are listed, sorted by points then exact scores', () => {
  const fixtures = [{ id: 'f1', homeGoals: 2, awayGoals: 1 }, { id: 'f2', homeGoals: 0, awayGoals: 0 }, { id: 'f3' }];
  const predictions = [
    { id: 'a_f1', uid: 'a', fixtureId: 'f1', home: 2, away: 1 }, // 10
    { id: 'a_f2', uid: 'a', fixtureId: 'f2', home: 1, away: 0 }, // 0
    { id: 'b_f1', uid: 'b', fixtureId: 'f1', home: 1, away: 0 }, // 5
    { id: 'b_f2', uid: 'b', fixtureId: 'f2', home: 0, away: 0 }, // 10
    { id: 'c_f1', uid: 'c', fixtureId: 'f1', home: 2, away: 1, points: 10 }, // no nickname, already stored
    { id: 'a_f3', uid: 'a', fixtureId: 'f3', home: 1, away: 1 }, // not played yet
  ];
  const users = [{ id: 'a', nickname: 'Ada' }, { id: 'b', nickname: 'Bora' }, { id: 'c' }];
  const { entries, scored, community } = buildStandings({ fixtures, predictions, users });
  assert.deepEqual(entries.map((e) => [e.nickname, e.points, e.exact]), [['Bora', 15, 1], ['Ada', 10, 1]]);
  assert.equal(scored.find((s) => s.id === 'c_f1').changed, false);
  assert.equal(scored.find((s) => s.id === 'a_f1').changed, true);
  assert.equal(scored.some((s) => s.id === 'a_f3'), false);
  assert.deepEqual(community.get('f1'), { home: 3, draw: 0, away: 0, total: 3 });
  assert.equal(community.get('f3').draw, 1);
});

test('helpers: updateMask builds merge field paths, fromDoc decodes values', () => {
  assert.equal(updateMask(['points', 'scoredAt']), '?updateMask.fieldPaths=points&updateMask.fieldPaths=scoredAt');
  const d = fromDoc({ name: 'projects/p/databases/(default)/documents/predictions/u_1', fields: { home: { integerValue: '2' }, uid: { stringValue: 'u' }, t: { timestampValue: '2026-11-04T20:00:00Z' } } });
  assert.equal(d.id, 'u_1'); assert.equal(d.home, 2); assert.equal(d.t.toISOString(), '2026-11-04T20:00:00.000Z');
});
