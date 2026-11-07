// lastmod for the sitemap, from real front matter dates only (updatedAt, else publishedAt). Nothing is invented:
// a URL with no known date simply gets no <lastmod>. Section indexes use the newest live post in the section.
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const SECTIONS = ['guides', 'analysis', 'news'];
const frontMatter = (raw) => /^---[\s\S]*?^---/m.exec(raw)?.[0] ?? '';
const field = (raw, k) => new RegExp('^' + k + ':\\s*(\\S+)', 'm').exec(frontMatter(raw))?.[1];

export function lastmodMap(root, now = Date.now()) {
  const map = new Map();
  const newest = {};
  for (const s of SECTIONS) {
    const dir = join(root, 'src', 'content', s);
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir).filter((x) => x.endsWith('.md'))) {
      const raw = readFileSync(join(dir, f), 'utf8').replace(/\r\n/g, '\n');
      const pub = field(raw, 'publishedAt');
      if (!pub || /^queued:\s*true/m.test(raw) || /^draft:\s*true/m.test(raw) || new Date(pub).getTime() > now) continue;
      const d = new Date(field(raw, 'updatedAt') ?? pub);
      map.set(`/${s}/${f.replace(/\.md$/, '')}/`, d);
      if (!newest[s] || d > newest[s]) newest[s] = d;
    }
  }
  for (const [s, d] of Object.entries(newest)) map.set(`/${s}/`, d);
  const pages = join(root, 'src', 'content', 'pages');
  if (existsSync(pages)) for (const f of readdirSync(pages).filter((x) => x.endsWith('.md'))) {
    const u = field(readFileSync(join(pages, f), 'utf8').replace(/\r\n/g, '\n'), 'updatedAt');
    if (u) map.set(`/${f.replace(/\.md$/, '')}/`, new Date(u));
  }
  return map;
}
