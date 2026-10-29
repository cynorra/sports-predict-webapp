import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, createVerify } from 'node:crypto';
import { signJwt, toFields, toValue } from './firestore-rest.mjs';

test('signJwt produces a verifiable RS256 token with the right claims', () => {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const sa = { client_email: 'bot@example-project.iam.gserviceaccount.com', private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }) };
  const jwt = signJwt(sa, { now: 1_800_000_000 });
  const [h, b, s] = jwt.split('.');
  assert.deepEqual(JSON.parse(Buffer.from(h, 'base64url')), { alg: 'RS256', typ: 'JWT' });
  const claims = JSON.parse(Buffer.from(b, 'base64url'));
  assert.equal(claims.iss, sa.client_email);
  assert.equal(claims.aud, 'https://oauth2.googleapis.com/token');
  assert.equal(claims.exp - claims.iat, 3600);
  assert.equal(createVerify('RSA-SHA256').update(`${h}.${b}`).verify(publicKey, Buffer.from(s, 'base64url')), true);
});

test('toFields maps JS values to Firestore REST values', () => {
  assert.deepEqual(toFields({ a: 'x', b: 3, c: 1.5, d: true, e: new Date('2026-11-04T20:00:00Z') }), {
    a: { stringValue: 'x' }, b: { integerValue: '3' }, c: { doubleValue: 1.5 }, d: { booleanValue: true }, e: { timestampValue: '2026-11-04T20:00:00.000Z' },
  });
  assert.throws(() => toValue({}));
});
