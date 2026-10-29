// Scores finished matches and rebuilds the leaderboard. Runs in GitHub Actions (score-predictions.yml) with a service account.
// Env: FOOTBALL_DATA_TOKEN, FIREBASE_SERVICE_ACCOUNT (full JSON). COMPETITION_CODE optional (default CL).
// Steps: results from football-data.org -> store them on fixtures/{id} -> compute points -> write leaderboard/{uid},
// predictions/{id}.points and fixtures/{id}.community*. Idempotent: it recomputes from raw data and writes only what changed.
// Logs counts only - never user data, tokens or credentials.
import { getAccessToken, listDocs, upsertDoc } from './lib/firestore-rest.mjs';
import { buildStandings, regularScore } from './lib/scoring.mjs';

const fdToken = process.env.FOOTBALL_DATA_TOKEN;
const saRaw = process.env.FIREBASE_SERVICE_ACCOUNT;
if (!fdToken || !saRaw) { console.log('FOOTBALL_DATA_TOKEN or FIREBASE_SERVICE_ACCOUNT not set - nothing to do.'); process.exit(0); }
let sa;
try { sa = JSON.parse(saRaw); } catch { console.error('FIREBASE_SERVICE_ACCOUNT is not valid JSON.'); process.exit(1); }
const projectId = process.env.FIREBASE_PROJECT_ID || sa.project_id;
const code = process.env.COMPETITION_CODE || 'CL';

const token = await getAccessToken(sa);
const [fixtures, predictions, users] = await Promise.all([listDocs(token, projectId, 'fixtures'), listDocs(token, projectId, 'predictions'), listDocs(token, projectId, 'users')]);

// 1. Store final scores on fixtures that have kicked off and are not yet resolved.
const now = Date.now();
const open = fixtures.filter((f) => !Number.isInteger(f.homeGoals) && f.kickoff && f.kickoff.getTime() < now);
let resolved = 0;
if (open.length) {
  const res = await fetch(`https://api.football-data.org/v4/competitions/${code}/matches?status=FINISHED`, { headers: { 'X-Auth-Token': fdToken } });
  if (!res.ok) { console.error(`football-data.org responded HTTP ${res.status}`); process.exit(1); }
  const finished = new Map((await res.json()).matches.map((m) => [String(m.id), regularScore(m)]));
  for (const f of open) {
    const s = finished.get(f.id);
    if (!s) continue;
    await upsertDoc(token, projectId, `fixtures/${f.id}`, { homeGoals: s.home, awayGoals: s.away, resultAt: new Date() }, { merge: true });
    f.homeGoals = s.home; f.awayGoals = s.away; resolved++;
  }
}

// 2. Points, leaderboard, community counts.
const { entries, scored, community } = buildStandings({ fixtures, predictions, users });
let pointWrites = 0;
for (const s of scored.filter((x) => x.changed)) { await upsertDoc(token, projectId, `predictions/${s.id}`, { points: s.points, scoredAt: new Date() }, { merge: true }); pointWrites++; }

for (const e of entries) {
  await upsertDoc(token, projectId, `leaderboard/${e.uid}`, { nickname: e.nickname, points: e.points, played: e.played, exact: e.exact, outcome: e.outcome, updatedAt: new Date() });
}
for (const [fid, c] of community) {
  const f = fixtures.find((x) => x.id === fid);
  if (!f) continue;
  if (f.communityTotal === c.total && f.communityHome === c.home && f.communityDraw === c.draw && f.communityAway === c.away) continue;
  await upsertDoc(token, projectId, `fixtures/${fid}`, { communityHome: c.home, communityDraw: c.draw, communityAway: c.away, communityTotal: c.total }, { merge: true });
}
console.log(`results stored: ${resolved}; predictions scored (changed): ${pointWrites}; leaderboard rows: ${entries.length}; fixtures with community data: ${community.size}`);
