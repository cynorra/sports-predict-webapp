import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkImages } from './image-quality.mjs';

const ALT = 'A chart showing the expected score for a team against its rating gap';
const fm = (src = '/images/a-post.svg', alt = ALT) => `title: "x"\nimage:\n  src: "${src}"\n  alt: "${alt}"\nauthor: "y"`;
const fig = (extra = '') => `<figure>\n<img src="/images/a-post-fig.svg" alt="${ALT}" width="1200" height="600" loading="lazy" decoding="async"${extra}>\n<figcaption>Caption.</figcaption>\n</figure>`;
const sizes = { '/images/a-post.svg': 3000, '/images/a-post.png': 30000, '/images/a-post-fig.svg': 5000 };
const fileSize = (p) => sizes[p] ?? null;
const run = (o) => checkImages({ fm: fm(), raw: fig(), minFigures: 1, fileSize, ...o });

test('a complete post passes', () => assert.deepEqual(run({}), []));
test('missing cover is reported', () => assert.match(run({ fm: 'title: "x"' })[0], /missing cover image/));
test('short alt text is rejected', () => assert.ok(run({ fm: fm('/images/a-post.svg', 'chart') }).some((e) => /cover alt/.test(e))));
test('alt must not start with "image of"', () => assert.ok(run({ fm: fm('/images/a-post.svg', 'Image of a chart showing the expected score by rating gap') }).some((e) => /image of/.test(e))));
test('missing cover files are reported', () => {
  const e = run({ fileSize: () => null });
  assert.ok(e.some((x) => /cover file missing/.test(x)) && e.some((x) => /PNG missing/.test(x)));
});
test('oversized files are rejected', () => assert.ok(run({ fileSize: (p) => (p.endsWith('.png') ? 900000 : 3000) }).some((e) => /PNG is/.test(e))));
test('figure without width/height or lazy loading fails', () => {
  const e = run({ raw: `<figure><img src="/images/a-post-fig.svg" alt="${ALT}"><figcaption>c</figcaption></figure>` });
  assert.ok(e.some((x) => /width and height/.test(x)) && e.some((x) => /lazy/.test(x)));
});
test('figure without caption fails', () => assert.ok(run({ raw: fig().replace(/<figcaption>.*<\/figcaption>/s, '') }).some((e) => /figcaption/.test(e))));
test('markdown images are rejected', () => assert.ok(run({ raw: `${fig()}\n\n![x](/images/a-post-fig.svg)` }).some((e) => /markdown image/.test(e))));
test('external figure sources are rejected', () => assert.ok(run({ raw: fig().replace('/images/a-post-fig.svg', 'https://x.test/a.svg') }).some((e) => /local/.test(e))));
test('minimum figure count is enforced', () => assert.ok(run({ raw: '', minFigures: 1 }).some((e) => /min 1/.test(e))));
