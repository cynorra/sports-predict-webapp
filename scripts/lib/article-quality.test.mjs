// Run with: npm test   (node --test). Guards the quality gates themselves: if a refactor breaks one, CI fails before anything ships.
import test from 'node:test';
import assert from 'node:assert/strict';
import { validateArticle, findFirstPartyClaim, findFirstPersonExperience, findHypeClaim, findYmylTopic, countFalsePrecision, findFabricatedAnecdote, titleHasYear, findInventedNumberInMeta, countYearFraming } from './article-quality.mjs';

const clean = { title: 'How Home Advantage Works', excerpt: 'Home advantage is real but modest.', meta_description: 'Why hosts win more often and how to use it.', content: 'Hosts win roughly 45% of matches. Our model adds a modest bonus for the home side.' };

test('clean article passes, and "our model" is allowed', () => assert.deepEqual(validateArticle(clean), []));

test('first-party claims are caught', () => {
  for (const s of ['Our analysts watched the game.', 'We tested the model on a thousand games.', 'According to our own data, hosts win.', 'We spoke to the coach.', 'Our insiders say he is injured.'])
    assert.ok(findFirstPartyClaim(s), s);
});

test('first-person experience is caught, reader questions are not', () => {
  assert.ok(findFirstPersonExperience("I've seen this formation fail many times."));
  assert.ok(findFirstPersonExperience('As a former scout, he knows talent.'));
  assert.equal(findFirstPersonExperience('How can I improve my predictions?'), null);
});

test('hype and tipster language is caught', () => {
  assert.ok(findHypeClaim({ title: 'Sure win tonight', content: '' }));
  assert.ok(findHypeClaim({ title: 'Fine', content: 'This is a banker for the weekend.' }));
  assert.equal(findHypeClaim({ title: 'A balanced preview', content: 'The model estimates a narrow home win.' }), null);
});

test('betting advice topics are caught', () => {
  assert.ok(findYmylTopic('Best bets for the weekend'));
  assert.ok(findYmylTopic('Get a free bet with bet365'));
  assert.equal(findYmylTopic('Poisson models explained'), null);
});

test('false precision counts decimals outside tables only', () => {
  assert.ok(countFalsePrecision('Rates rose 14.3%, then 22.7%, then 18.4%, then 31.9%.').total > 3);
  assert.equal(countFalsePrecision('| 1-0 | 12.8% |\n| 2-0 | 12.1% |\n| 1-1 | 10.2% |\n| 2-1 | 9.7% |').total, 0);
  assert.equal(countFalsePrecision('Between 12.5-14.5% of matches.').total, 0);
});

test('invented anecdotes need an illustrative marker', () => {
  assert.ok(findFabricatedAnecdote('Last season a mid-table club lost six games in a row.'));
  assert.equal(findFabricatedAnecdote('Imagine a mid-table club that lost six games in a row.'), null);
});

test('year in title, year framing and numbers in meta', () => {
  assert.equal(titleHasYear('Best Predictions 2026'), '2026');
  assert.equal(titleHasYear('Best Predictions'), null);
  const now = new Date('2026-10-29T00:00:00Z');
  assert.ok(countYearFraming('In 2026 things changed. For 2026 plan ahead. During 2025 it began.', now) > 2);
  assert.equal(countYearFraming('The 2024-25 season introduced a new format.', now), 0);
  assert.ok(findInventedNumberInMeta('Wins 64% of matches', '', 'Title'));
  assert.equal(findInventedNumberInMeta('Eight matches each', 'All 36 clubs in one table', 'Title'), null);
});
