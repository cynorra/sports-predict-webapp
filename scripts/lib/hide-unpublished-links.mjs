// Remark plugin: a link to a post that is queued or dated in the future would be a 404 until it goes live,
// so at build time it is rendered as plain text instead. The workflow rebuilds when a post goes live, which
// turns the text into a link automatically. Pure Node built-ins (no extra dependency).
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const SECTIONS = ['guides', 'analysis', 'news'];

export function hiddenPaths(root, now = Date.now()) {
  const hidden = new Set();
  for (const s of SECTIONS) {
    const dir = join(root, 'src', 'content', s);
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir).filter((x) => x.endsWith('.md'))) {
      const raw = readFileSync(join(dir, f), 'utf8');
      const date = /^publishedAt:\s*(\S+)/m.exec(raw)?.[1];
      const queued = /^queued:\s*true\s*$/m.test(raw);
      const draft = /^draft:\s*true\s*$/m.test(raw);
      if (queued || draft || (date && new Date(date).getTime() > now)) hidden.add(`/${s}/${f.replace(/\.md$/, '')}`);
    }
  }
  return hidden;
}

export function unwrapHidden(tree, hidden) {
  const walk = (node) => {
    if (!node.children) return;
    const out = [];
    for (const child of node.children) {
      walk(child);
      if (child.type === 'link' && hidden.has(String(child.url).split('#')[0].replace(/\/$/, ''))) out.push(...child.children);
      else out.push(child);
    }
    node.children = out;
  };
  walk(tree);
}

export default function remarkHideUnpublishedLinks() {
  const hidden = hiddenPaths(process.cwd());
  return (tree) => unwrapHidden(tree, hidden);
}
