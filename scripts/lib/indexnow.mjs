// IndexNow (Bing, Yandex, Seznam, Naver and others; Google does not use it). Pure helpers, unit-tested.
// Protocol: https://www.indexnow.org/documentation  - the key is public by design: it must be served as /<key>.txt.
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

export const ENDPOINT = 'https://api.indexnow.org/indexnow';
const KEY_FILE = /^[a-f0-9]{32}\.txt$/;

/** The key is the name of the 32-hex .txt file in public/ whose content equals its name. */
export function findKey(root) {
  const dir = join(root, 'public');
  if (!existsSync(dir)) return null;
  for (const f of readdirSync(dir).filter((x) => KEY_FILE.test(x))) {
    const key = f.slice(0, -4);
    if (readFileSync(join(dir, f), 'utf8').trim() === key) return key;
  }
  return null;
}

export function buildPayload({ base, key, urls }) {
  const host = new URL(base).host;
  return { host, key, keyLocation: `${base.replace(/\/$/, '')}/${key}.txt`, urlList: urls };
}

/** URLs of posts that went live in (now - windowMs, now], plus the section indexes they appear on. */
export function recentUrls(root, base, windowMs, now = Date.now()) {
  const b = base.replace(/\/$/, '');
  const urls = new Set();
  for (const s of ['guides', 'analysis', 'news']) {
    const dir = join(root, 'src', 'content', s);
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir).filter((x) => x.endsWith('.md'))) {
      const raw = readFileSync(join(dir, f), 'utf8').replace(/\r\n/g, '\n');
      const pub = /^publishedAt:\s*(\S+)/m.exec(raw)?.[1];
      const upd = /^updatedAt:\s*(\S+)/m.exec(raw)?.[1];
      if (!pub || /^queued:\s*true/m.test(raw) || /^draft:\s*true/m.test(raw)) continue;
      const t = new Date(upd ?? pub).getTime();
      if (t <= now && now - t < windowMs) { urls.add(`${b}/${s}/${f.replace(/\.md$/, '')}/`); urls.add(`${b}/${s}/`); }
    }
  }
  if (urls.size) urls.add(`${b}/`);
  return [...urls];
}
