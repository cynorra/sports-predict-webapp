// Fails (exit 1) if anything that looks like a credential is present in the project files.
// Runs in `npm run build`, in CI before anything else, and can be run by hand: node scripts/check-secrets.mjs
// Real secrets belong in GitHub Actions secrets / the host's environment settings, never in the repo.
// A line can be exempted with the marker `secret-scan:allow` (use sparingly, with a reason).
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

export const RULES = [
  ['private key block', /-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY/],
  ['Google API key', /AIza[0-9A-Za-z_-]{35}/],
  ['GitHub token', /\bgh[pousr]_[A-Za-z0-9]{30,}/],
  ['GitHub fine-grained token', /\bgithub_pat_[A-Za-z0-9_]{40,}/],
  ['AWS access key id', /\bAKIA[0-9A-Z]{16}\b/],
  ['Slack token', /\bxox[abprs]-[A-Za-z0-9-]{10,}/],
  ['Stripe/OpenAI/Anthropic style key', /\b(?:sk|rk)[-_](?:live|test|ant|proj)?[-_]?[A-Za-z0-9_-]{30,}/],
  ['JWT', /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/],
  ['credentialed URL', /\b[a-z][a-z0-9+.-]*:\/\/[^\s/:@]+:[^\s/@]{3,}@[^\s/]+/i],
  // (?<![A-Za-z]) instead of \b so names with underscores (FOOTBALL_DATA_TOKEN, STRIPE_SECRET) are caught too
  ['hard-coded secret assignment', /(?<![A-Za-z])(?:api[_-]?key|secret|token|passw(?:or)?d|auth[_-]?token|access[_-]?key)(?![A-Za-z])["']?\s*[:=]\s*["'][A-Za-z0-9_\-+/=.]{16,}["']/i],
  ['long hex value next to a key-like word', /(?<![A-Za-z])(?:key|token|secret|auth)[A-Za-z_ -]{0,20}["'`:= ]+[0-9a-f]{32,}(?![0-9a-f])/i],
];

const SKIP_DIRS = new Set(['node_modules', 'dist', '.astro', '.git', '.cache', '.vercel', '.netlify']);
const SKIP_FILES = new Set(['package-lock.json']);
const SKIP_EXT = /\.(png|jpe?g|gif|webp|ico|woff2?|ttf|pdf|zip|gz|mp4)$/i;

export function scanText(text, name = '') {
  const hits = [];
  text.split(/\r?\n/).forEach((line, i) => {
    if (line.includes('secret-scan:allow')) return;
    for (const [label, re] of RULES) if (re.test(line)) hits.push({ file: name, line: i + 1, rule: label });
  });
  return hits;
}

export function scanDir(root) {
  const hits = [];
  const walk = (dir) => {
    for (const f of readdirSync(dir)) {
      const p = join(dir, f);
      const st = statSync(p);
      if (st.isDirectory()) { if (!SKIP_DIRS.has(f)) walk(p); continue; }
      if (SKIP_FILES.has(f) || SKIP_EXT.test(f) || st.size > 1_000_000) continue;
      const rel = relative(root, p).split(sep).join('/');
      if (/^\.env(\..*)?$/.test(f) && f !== '.env.example') {
        // Locally a gitignored .env is normal. In CI the checkout only contains committed files, so an .env there was committed.
        if (process.env.CI) hits.push({ file: rel, line: 0, rule: 'env file committed to the repository' });
        continue;
      }
      hits.push(...scanText(readFileSync(p, 'utf8'), rel));
    }
  };
  walk(root);
  return hits;
}

if (process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('check-secrets.mjs')) {
  const hits = scanDir(process.cwd());
  // Report file, line and rule only - never print the matched text, so a leak does not get copied into CI logs.
  hits.forEach((h) => console.error(`SECRET? ${h.file}:${h.line}  ${h.rule}`));
  console.log(hits.length ? `\n${hits.length} possible secret(s) found. Move them to GitHub Actions secrets / host env vars and rotate them.` : 'secret scan: clean');
  process.exit(hits.length ? 1 : 0);
}
