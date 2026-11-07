import test from 'node:test';
import assert from 'node:assert/strict';
import { checkSources } from './source-quality.mjs';

const good = `## Body\ntext\n\n## Sources\n\n- [IFAB Law 11](https://www.theifab.com/laws/latest/offside/), the Laws of the Game. Defines the offside position.\n- [Offside on Wikipedia](https://en.wikipedia.org/wiki/Offside_(association_football)). Background and history of the law.\n- [Dixon and Coles 1997](https://doi.org/10.1111/1467-9876.00065), Journal of the Royal Statistical Society. Low-score correction.\n`;
test('a post with named deep sources passes', () => assert.deepEqual(checkSources(good), []));
test('missing section fails', () => assert.equal(checkSources('## Body\ntext\n').length, 1));
test('homepage-only sources fail', () => {
  const bad = `## Sources\n- [IFAB](https://www.theifab.com), laws of the game here.\n- [FIFA](https://www.fifa.com), the governing body site.\n- [UEFA](https://www.uefa.com), the European body site.\n`;
  assert.ok(checkSources(bad).some((e) => /deep source/.test(e)));
});
test('all-Wikipedia sources fail', () => {
  const bad = `## Sources\n- [A](https://en.wikipedia.org/wiki/A), article about a topic of interest.\n- [B](https://en.wikipedia.org/wiki/B), article about another topic.\n- [C](https://en.wikipedia.org/wiki/C), article about a third topic.\n`;
  assert.ok(checkSources(bad).some((e) => /Wikipedia/.test(e)));
});
test('items without a description fail', () => {
  const bad = `## Sources\n- [A](https://a.org/x/y)\n- [B](https://b.org/x/y)\n- [C](https://c.org/x/y)\n`;
  assert.ok(checkSources(bad).some((e) => /no description/.test(e)));
});
