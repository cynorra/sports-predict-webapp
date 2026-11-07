import test from 'node:test';
import assert from 'node:assert/strict';
import { unwrapHidden } from './hide-unpublished-links.mjs';

test('links to hidden posts become plain text, others stay links', () => {
  const tree = { type: 'root', children: [{ type: 'paragraph', children: [
    { type: 'text', value: 'See ' },
    { type: 'link', url: '/guides/future-post', children: [{ type: 'text', value: 'the future guide' }] },
    { type: 'text', value: ' and ' },
    { type: 'link', url: '/guides/live-post#x', children: [{ type: 'text', value: 'the live one' }] },
  ] }] };
  unwrapHidden(tree, new Set(['/guides/future-post']));
  const kids = tree.children[0].children;
  assert.deepEqual(kids.map((k) => k.type), ['text', 'text', 'text', 'link']);
  assert.equal(kids[1].value, 'the future guide');
});
