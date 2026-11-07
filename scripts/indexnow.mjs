// Tells IndexNow-enabled search engines about posts that just went live.
//   SITE_URL=https://your-domain.com node scripts/indexnow.mjs [--since-hours 3] [--dry]
// Refuses to run against the placeholder domain. Needs the key file in public/ (see scripts/lib/indexnow.mjs).
import { ENDPOINT, findKey, buildPayload, recentUrls } from './lib/indexnow.mjs';

const args = process.argv.slice(2);
const root = process.cwd();
const base = (process.env.SITE_URL || '').replace(/\/$/, '');
const hours = Number(args[args.indexOf('--since-hours') + 1]) || 3;

if (!base || /example\.com/.test(base)) { console.log('indexnow: SITE_URL is not set to the real domain, nothing sent'); process.exit(0); }
const key = findKey(root);
if (!key) { console.error('indexnow: no key file in public/ (32 hex characters, content equal to the file name)'); process.exit(1); }
const urls = recentUrls(root, base, hours * 3600e3);
if (!urls.length) { console.log(`indexnow: no post went live in the last ${hours} h, nothing sent`); process.exit(0); }
const payload = buildPayload({ base, key, urls });
if (args.includes('--dry')) { console.log(JSON.stringify(payload, null, 2)); process.exit(0); }
const res = await fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' }, body: JSON.stringify(payload) });
console.log(`indexnow: ${urls.length} URL(s) submitted, HTTP ${res.status}`);
if (![200, 202].includes(res.status)) process.exit(1);
