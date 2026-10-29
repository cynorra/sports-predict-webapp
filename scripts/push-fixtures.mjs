// Mirrors src/data/fixtures.json into Firestore (fixtures/{id}) so firestore.rules can lock predictions at the real kickoff.
// Env: FIREBASE_SERVICE_ACCOUNT (service-account JSON as one string), FIREBASE_PROJECT_ID (optional, defaults to project_id in the JSON).
// Without the secret it exits quietly with code 0 (nothing to do), so forks and local runs are harmless.
import { readFileSync } from 'node:fs';
import { getAccessToken, upsertDoc } from './lib/firestore-rest.mjs';

const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
if (!raw) { console.log('FIREBASE_SERVICE_ACCOUNT not set - skipping Firestore mirror.'); process.exit(0); }

let sa;
try { sa = JSON.parse(raw); } catch { console.error('FIREBASE_SERVICE_ACCOUNT is not valid JSON.'); process.exit(1); }
if (!sa.client_email || !sa.private_key) { console.error('FIREBASE_SERVICE_ACCOUNT is missing client_email or private_key.'); process.exit(1); }
const projectId = process.env.FIREBASE_PROJECT_ID || sa.project_id;
if (!projectId) { console.error('No project id (set FIREBASE_PROJECT_ID or use a full service-account JSON).'); process.exit(1); }

const { fixtures } = JSON.parse(readFileSync('src/data/fixtures.json', 'utf8'));
const token = await getAccessToken(sa);
for (const f of fixtures) {
  await upsertDoc(token, projectId, `fixtures/${f.id}`, {
    home: f.home, away: f.away, competition: f.competition, kickoff: new Date(f.kickoff), updatedAt: new Date(),
  }, { merge: true }); // merge: keep homeGoals/awayGoals/community* written by score-predictions.mjs
}
console.log(`mirrored ${fixtures.length} fixtures to Firestore project ${projectId}`);
