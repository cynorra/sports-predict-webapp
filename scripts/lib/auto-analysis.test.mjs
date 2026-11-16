import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickFixture, previewSlug, buildFacts, checkProse } from './auto-analysis.mjs';

const predict = (h, a) => { const s = 1 / (1 + Math.pow(10, -(h.elo + 65 - a.elo) / 400)); const xgHome = 2.7 * s, xgAway = 2.7 * (1 - s); return { xgHome, xgAway, pHome: 0.7, pDraw: 0.2, pAway: 0.1, mostLikely: { home: 2, away: 0, p: 0.15 } }; };
const fx = (home, away, kickoff, he = 1700, ae = 1600) => ({ id: home, competition: 'UEFA Champions League', home, away, kickoff, homeElo: he, awayElo: ae });
const now = new Date('2026-11-20T10:00:00Z');

test('slug is stable and ascii', () => assert.equal(previewSlug('Atlético', 'Man City'), 'atletico-vs-man-city-prediction'));
test('picks the strongest upcoming fixture inside the window, skips covered and far-away ones', () => {
  const list = [fx('A', 'B', '2026-11-21T20:00:00Z', 1500, 1500), fx('C', 'D', '2026-11-22T20:00:00Z', 1800, 1800), fx('E', 'F', '2026-11-30T20:00:00Z', 2000, 2000), fx('G', 'H', '2026-11-20T11:00:00Z', 2000, 2000)];
  assert.equal(pickFixture(list, { now })?.home, 'C');
  assert.equal(pickFixture(list, { now, existingSlugs: new Set([previewSlug('C', 'D')]) })?.home, 'A');
  assert.equal(pickFixture([], { now }), null);
});
test('only Champions League fixtures are previewed', () => assert.equal(pickFixture([{ ...fx('A', 'B', '2026-11-21T20:00:00Z'), competition: 'Premier League' }], { now }), null));
test('facts carry rounded model numbers and the US Eastern kickoff', () => {
  const f = buildFacts(fx('Arsenal', 'Dortmund', '2026-11-24T20:00:00Z', 1862, 1709), predict);
  assert.equal(f.diff, 153); assert.equal(f.diffWithHome, 218); assert.match(f.kickoff, /Tuesday 24 November 2026, 3:00 pm Eastern/);
});
test('prose gate accepts supplied numbers and rejects invented ones and names', () => {
  const f = buildFacts(fx('Arsenal', 'Dortmund', '2026-11-24T20:00:00Z', 1862, 1709), predict);
  const ok = 'Arsenal come in with an Elo rating of 1862 and Dortmund with 1709, a gap of 153 points. The model gives Arsenal a 70% chance.';
  assert.deepEqual(checkProse(ok, f).filter((r) => r.startsWith('numbers')), []);
  assert.match(checkProse('Arsenal have won 77 of their last 83 games.', f).join(), /numbers not in/);
  assert.match(checkProse('The match is decided when Bukayo Saka returns.', f).join(), /proper names/);
  assert.deepEqual(checkProse('Arsenal host Dortmund. The model rates Arsenal higher, and Dortmund lower.', f), []);
});
