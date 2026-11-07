import test from 'node:test';
import assert from 'node:assert/strict';
import { pickResults, groupByDate, lastDates, LEAGUES } from './results.mjs';

const fx = (o) => ({ id: 1, date: '2026-11-07', kickoff_utc: '2026-11-07T15:00:00Z', league_name: 'Premier League', home_team: 'Arsenal FC', home_short: 'Arsenal', away_team: 'Leeds United', away_short: 'Leeds', home_score: 2, away_score: 1, status: 'FT', ...o });

test('pickResults keeps finished matches of wanted competitions only', () => {
  const rows = pickResults([
    fx({ id: 1 }),
    fx({ id: 2, status: 'LIVE' }),
    fx({ id: 3, status: 'Scheduled', home_score: null, away_score: null }),
    fx({ id: 4, league_name: 'Brazilian Serie A' }),
    fx({ id: 5, status: 'Postponed' }),
    fx({ id: 6, home_score: null }),
  ]);
  assert.deepEqual(rows.map((r) => r.id), [1]);
  assert.equal(rows[0].home, 'Arsenal');
  assert.equal(rows[0].homeScore, 2);
});

test('pickResults keeps extra time and penalty shoot-outs, with penalty scores when present', () => {
  const rows = pickResults([fx({ id: 7, status: 'PENS', home_score: 1, away_score: 1, penalty_home: 4, penalty_away: 3 }), fx({ id: 8, status: 'AET' })]);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].penHome, 4);
  assert.equal('penHome' in rows[1], false);
});

test('pickResults tolerates missing input', () => {
  assert.deepEqual(pickResults(undefined), []);
  assert.deepEqual(pickResults([{}]), []);
});

test('groupByDate sorts newest date first and orders competitions as listed', () => {
  const rows = pickResults([
    fx({ id: 1, date: '2026-11-06', league_name: 'French Ligue 1' }),
    fx({ id: 2, date: '2026-11-07', league_name: 'Italian Serie A' }),
    fx({ id: 3, date: '2026-11-07', league_name: 'Premier League', kickoff_utc: '2026-11-07T17:30:00Z' }),
    fx({ id: 4, date: '2026-11-07', league_name: 'Premier League', kickoff_utc: '2026-11-07T12:30:00Z' }),
  ]);
  const g = groupByDate(rows);
  assert.deepEqual(g.map((d) => d.date), ['2026-11-07', '2026-11-06']);
  assert.deepEqual(g[0].matches.map((m) => m.id), [4, 3, 2]);
  assert.ok(LEAGUES.indexOf('Premier League') < LEAGUES.indexOf('Italian Serie A'));
});

test('lastDates returns today first and counts back', () => {
  assert.deepEqual(lastDates(3, Date.UTC(2026, 10, 7, 12)), ['2026-11-07', '2026-11-06', '2026-11-05']);
});
