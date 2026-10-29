// Assigns natural publish times to posts marked `queued: true`.  (rules: yukle-next/universal-adsense-site-standard.md section 2)
//
//   node scripts/schedule-posts.mjs            assign dates to queued posts (writes frontmatter)
//   node scripts/schedule-posts.mjs --dry      show the plan without writing
//   node scripts/schedule-posts.mjs --plan 20  print the next 20 publishing days (Mon-Fri) with slot counts
//   node scripts/schedule-posts.mjs --due      exit 0 if a post went live in the last 70 minutes (used by the CI cron)
//
// Rhythm: publishing days are Mon-Fri only (weekends are skipped, not counted). Every block of 4 publishing days is
// a shuffle of [1, 1, 2, 0] posts. The empty day sits at a different position than in the previous block and never
// directly follows it, so the pattern does not visibly repeat. Times are random between 09:00 and 17:00 US Eastern
// (daylight saving handled), at least 3 hours apart on a two-post day. `publishedAt` is the real go-live time:
// the post is hidden by the build until that instant has passed, so nothing is back-dated or faked.
// Everything is seeded by the date, so re-running gives the same plan.
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = decodeURIComponent(new URL('../src/content/', import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1');
const SECTIONS = ['guides', 'analysis', 'news'];
const BASE = [1, 1, 2, 0];
const TZ = 'America/New_York';
const WINDOW = [9, 16.75]; // local hours; latest start 16:45 so the post is live before 17:00
const MIN_GAP_H = 3;
const WEEKENDS = process.env.PUBLISH_WEEKENDS === 'true'; // standard: off by default. Football previews are the one case where you may want it on.

const hash = (s) => { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
const rng = (seed) => () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const day = (d) => d.toISOString().slice(0, 10);
const addDays = (d, n) => new Date(d.getTime() + n * 864e5);
const isPublishDay = (d) => WEEKENDS || (d.getUTCDay() !== 0 && d.getUTCDay() !== 6);

// Local wall-clock time in TZ -> UTC ms (handles DST by measuring the zone offset at that instant)
function zonedToUtc(y, m, d, hh, mm) {
  const guess = Date.UTC(y, m, d, hh, mm);
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: TZ, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' }).formatToParts(new Date(guess));
  const g = Object.fromEntries(parts.map((p) => [p.type, +p.value]));
  const asLocal = Date.UTC(g.year, g.month - 1, g.day, g.hour, g.minute);
  return guess - (asLocal - guess);
}

function block(start, prevZero) {
  const r = rng(hash('block-' + day(start)));
  for (let tries = 0; tries < 200; tries++) {
    const a = [...BASE];
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    const z = a.indexOf(0);
    if (z === prevZero) continue;
    if (prevZero === 3 && z === 0) continue; // never two empty publishing days in a row
    return a;
  }
  return [...BASE];
}

// Slot timestamps (ms) for the next `nDays` publishing days starting at `from` (UTC midnight)
export function plan(from, nDays, prevZero = -1) {
  const dates = [];
  for (let d = from; dates.length < nDays; d = addDays(d, 1)) if (isPublishDay(d)) dates.push(d);
  const slots = [];
  let pz = prevZero;
  for (let b = 0; b * 4 < dates.length; b++) {
    const chunk = dates.slice(b * 4, b * 4 + 4);
    const counts = block(chunk[0], pz);
    pz = counts.indexOf(0);
    chunk.forEach((d, i) => {
      const n = counts[i];
      const r = rng(hash('times-' + day(d)));
      const hours = [];
      for (let guard = 0; hours.length < n && guard < 500; guard++) {
        const h = WINDOW[0] + r() * (WINDOW[1] - WINDOW[0]);
        if (hours.every((x) => Math.abs(x - h) >= MIN_GAP_H)) hours.push(h);
      }
      hours.sort((a, c) => a - c).forEach((h) => {
        slots.push(zonedToUtc(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), Math.floor(h), Math.floor((h % 1) * 60)));
      });
    });
  }
  return { slots, dates };
}

function readPosts() {
  const out = [];
  for (const s of SECTIONS) {
    const dir = join(ROOT, s);
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir).filter((x) => x.endsWith('.md'))) {
      const path = join(dir, f);
      const raw = readFileSync(path, 'utf8');
      const date = /^publishedAt:\s*(\S+)/m.exec(raw)?.[1];
      out.push({ path, raw, date: date ? new Date(date) : null, queued: /^queued:\s*true\s*$/m.test(raw), draft: /^draft:\s*true\s*$/m.test(raw) });
    }
  }
  return out;
}

const args = process.argv.slice(2);
const now = Date.now();
const todayUtc = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate()));

if (import.meta.url === `file://${process.argv[1].replace(/\\/g, '/').replace(/^([A-Z]):/, '/$1:')}` || process.argv[1]?.endsWith('schedule-posts.mjs')) {
  const posts = readPosts();

  if (args.includes('--due')) {
    const due = posts.some((p) => !p.queued && !p.draft && p.date && p.date.getTime() <= now && now - p.date.getTime() < 70 * 60000);
    console.log(due ? 'a post went live in the last 70 minutes' : 'nothing due');
    process.exit(due ? 0 : 1);
  }

  if (args.includes('--plan')) {
    const n = Number(args[args.indexOf('--plan') + 1] || 20);
    const { slots, dates } = plan(todayUtc, n);
    const fmt = new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
    for (const d of dates) {
      const todays = slots.filter((s) => day(new Date(zonedToUtc(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 12, 0))) === day(new Date(s)) || Math.abs(s - zonedToUtc(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 12, 0)) < 8 * 36e5);
      console.log(`${day(d)} ${d.toUTCString().slice(0, 3)}  ${todays.length}  ${todays.map((s) => fmt.format(new Date(s)) + ' ET').join('  ')}`);
    }
    process.exit(0);
  }

  const queued = posts.filter((p) => p.queued).sort((a, b) => a.path.localeCompare(b.path));
  if (!queued.length) { console.log('no queued posts'); process.exit(0); }
  const taken = posts.filter((p) => !p.queued && p.date).map((p) => p.date.getTime());
  const lastTaken = taken.length ? Math.max(...taken) : 0;
  const lastDay = new Date(lastTaken);
  const startDay = lastTaken > todayUtc.getTime() ? new Date(Date.UTC(lastDay.getUTCFullYear(), lastDay.getUTCMonth(), lastDay.getUTCDate())) : todayUtc;
  const { slots } = plan(startDay, Math.max(8, queued.length * 3 + 4));
  const free = slots.filter((s) => s > Math.max(lastTaken, now));
  queued.forEach((p, i) => {
    const iso = new Date(free[i]).toISOString();
    const next = p.raw.replace(/^publishedAt:.*$/m, `publishedAt: ${iso}`).replace(/^queued:\s*true\s*\r?\n/m, '');
    console.log(`${args.includes('--dry') ? '[dry] ' : ''}${p.path.split(/[\\/]/).slice(-2).join('/')}  ->  ${iso}`);
    if (!args.includes('--dry')) writeFileSync(p.path, next);
  });
}
