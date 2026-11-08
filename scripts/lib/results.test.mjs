import test from 'node:test';
import assert from 'node:assert/strict';
import { pickResults, groupByDate, lastDates, LEAGUES, pickUpcoming, groupUpcoming, nextDates, easternDate, UPCOMING_LEAGUES } from './results.mjs';

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

test('pickUpcoming keeps scheduled matches of wanted competitions only', () => {
  const rows = pickUpcoming([
    fx({ id: 1, status: 'Scheduled', home_score: null, away_score: null }),
    fx({ id: 2, status: 'LIVE' }),
    fx({ id: 3, status: 'FT' }),
    fx({ id: 4, status: 'Scheduled', league_name: 'Brazilian Serie A' }),
    fx({ id: 5, status: 'Postponed' }),
    fx({ id: 6, status: 'Scheduled', kickoff_utc: null }),
    fx({ id: 1, status: 'Scheduled' }),
    fx({ id: 7, status: 'Scheduled', league_name: 'US Major League Soccer' }),
  ]);
  assert.deepEqual(rows.map((r) => r.id), [1, 7]);
  assert.equal(rows[0].home, 'Arsenal');
  assert.deepEqual(pickUpcoming(undefined), []);
});

test('easternDate lists a late kickoff on the evening it is played in the US', () => {
  assert.equal(easternDate('2026-11-10T01:00:00Z'), '2026-11-09');
  assert.equal(easternDate('2026-11-09T15:00:00Z'), '2026-11-09');
});

test('groupUpcoming sorts oldest date first and orders competitions as listed', () => {
  const rows = pickUpcoming([
    fx({ id: 1, status: 'Scheduled', league_name: 'Italian Serie A', kickoff_utc: '2026-11-10T19:45:00Z' }),
    fx({ id: 2, status: 'Scheduled', league_name: 'Premier League', kickoff_utc: '2026-11-10T20:00:00Z' }),
    fx({ id: 3, status: 'Scheduled', league_name: 'Premier League', kickoff_utc: '2026-11-09T20:00:00Z' }),
    fx({ id: 4, status: 'Scheduled', league_name: 'Premier League', kickoff_utc: '2026-11-10T15:00:00Z' }),
  ]);
  const g = groupUpcoming(rows);
  assert.deepEqual(g.map((d) => d.date), ['2026-11-09', '2026-11-10']);
  assert.deepEqual(g[1].matches.map((m) => m.id), [4, 2, 1]);
});

test('nextDates starts today and moves forward; the schedule list extends the results list', () => {
  assert.deepEqual(nextDates(3, Date.UTC(2026, 10, 8, 12)), ['2026-11-08', '2026-11-09', '2026-11-10']);
  assert.equal(LEAGUES.every((l) => UPCOMING_LEAGUES.includes(l)), true);
});
