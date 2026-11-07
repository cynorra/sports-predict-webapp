import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildPayload, findKey, recentUrls } from './indexnow.mjs';

const mk = () => {
  const root = mkdtempSync(join(tmpdir(), 'inow-'));
  mkdirSync(join(root, 'public')); mkdirSync(join(root, 'src', 'content', 'guides'), { recursive: true });
  return root;
};
test('payload carries host, key and key location', () => {
  const p = buildPayload({ base: 'https://a.com/', key: 'k'.repeat(32), urls: ['https://a.com/x/'] });
  assert.equal(p.host, 'a.com');
  assert.equal(p.keyLocation, `https://a.com/${'k'.repeat(32)}.txt`);
});
test('key is found only when the file content equals its name', () => {
  const root = mk(); const key = 'a1'.repeat(16);
  writeFileSync(join(root, 'public', `${key}.txt`), 'wrong');
  assert.equal(findKey(root), null);
  writeFileSync(join(root, 'public', `${key}.txt`), key);
  assert.equal(findKey(root), key);
});
test('only posts that just went live are submitted, queued and old ones are not', () => {
  const root = mk(); const now = Date.parse('2026-11-10T12:00:00Z');
  const g = (n, extra) => writeFileSync(join(root, 'src', 'content', 'guides', `${n}.md`), `---\ntitle: x\n${extra}\n---\nbody`);
  g('fresh', 'publishedAt: 2026-11-10T10:00:00.000Z');
  g('old', 'publishedAt: 2026-11-01T10:00:00.000Z');
  g('queued', 'publishedAt: 2026-11-10T11:00:00.000Z\nqueued: true');
  g('future', 'publishedAt: 2026-11-11T10:00:00.000Z');
  const urls = recentUrls(root, 'https://a.com', 3 * 3600e3, now);
  assert.deepEqual(urls.sort(), ['https://a.com/', 'https://a.com/guides/', 'https://a.com/guides/fresh/']);
});
