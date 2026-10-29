import test from 'node:test';
import assert from 'node:assert/strict';
import { scanText } from '../check-secrets.mjs';

// Fake credentials are assembled at runtime so this file itself never contains a scannable secret.
const j = (...p) => p.join('');
const fake = {
  google: j('AI', 'za', 'SyA-1234567890abcdefghijklmnopqrstuv'),
  github: j('gh', 'p_', 'a'.repeat(36)),
  aws: j('AK', 'IA', 'ABCDEFGHIJKLMNOP'),
  hex: 'a1b2c3d4'.repeat(4),
  pem: j('-----BEGIN ', 'PRIVATE KEY-----'),
};

test('flags real-looking credentials', () => {
  assert.equal(scanText(`const k = "${fake.google}";`).length > 0, true);
  assert.equal(scanText(fake.github).length > 0, true);
  assert.equal(scanText(fake.aws).length > 0, true);
  assert.equal(scanText(fake.pem).length > 0, true);
  assert.equal(scanText(`FOOTBALL_DATA_TOKEN: "${fake.hex}"`).length > 0, true);
  assert.equal(scanText(`const apiKey = '${fake.hex}abcd';`).length > 0, true);
  assert.equal(scanText(j('postgres', '://admin:', 'hunter22', '@db.example.com/app')).length > 0, true);
});

test('does not flag normal code, env var reads or secret references', () => {
  assert.equal(scanText('const token = process.env.FOOTBALL_DATA_TOKEN;').length, 0);
  assert.equal(scanText('FOOTBALL_DATA_TOKEN: ${{ secrets.FOOTBALL_DATA_TOKEN }}').length, 0);
  assert.equal(scanText('headers: { "X-Auth-Token": token }').length, 0);
  assert.equal(scanText('const hash = "d41d8cd98f00b204e9800998ecf8427e";').length, 0);
  assert.equal(scanText('PUBLIC_ADSENSE_CLIENT=').length, 0);
});

test('allow marker exempts a line and reports line numbers without the secret text', () => {
  assert.equal(scanText(`x = "${fake.google}" // secret-scan:allow`).length, 0);
  const hits = scanText(`ok\n${fake.github}`, 'a.txt');
  assert.deepEqual(Object.keys(hits[0]).sort(), ['file', 'line', 'rule']);
  assert.equal(hits[0].line, 2);
});
