// Minimal Firestore server client using only Node built-ins (no firebase-admin: no extra dependencies in CI).
// Authenticates with a service-account JSON (kept in the GitHub Actions secret FIREBASE_SERVICE_ACCOUNT) via a signed JWT.
// A service account bypasses firestore.rules, which is exactly why only trusted workflows may hold it.
import { createSign } from 'node:crypto';

const b64url = (b) => Buffer.from(b).toString('base64url');

export function signJwt(sa, { now = Math.floor(Date.now() / 1000), scope = 'https://www.googleapis.com/auth/datastore' } = {}) {
  const head = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const body = b64url(JSON.stringify({ iss: sa.client_email, scope, aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 }));
  const sig = createSign('RSA-SHA256').update(`${head}.${body}`).sign(sa.private_key).toString('base64url');
  return `${head}.${body}.${sig}`;
}

export async function getAccessToken(sa) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: signJwt(sa) }),
  });
  if (!res.ok) throw new Error(`token exchange failed: HTTP ${res.status}`); // never include the response body: it can echo credentials
  return (await res.json()).access_token;
}

// Plain JS value -> Firestore REST value. Dates become timestamps; integers stay integers.
export function toValue(v) {
  if (v instanceof Date) return { timestampValue: v.toISOString() };
  if (typeof v === 'string') return { stringValue: v };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (v === null) return { nullValue: null };
  throw new Error(`unsupported Firestore value type: ${typeof v}`);
}
export const toFields = (obj) => Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, toValue(v)]));

const docsBase = (projectId) => `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents`;

// Query-string that limits a PATCH to the given fields (merge). Without it a PATCH replaces the whole document.
export const updateMask = (keys) => '?' + keys.map((k) => 'updateMask.fieldPaths=' + encodeURIComponent(k)).join('&');

// Creates a document, or with { merge: true } updates only the given fields of an existing one (path like "fixtures/123").
export async function upsertDoc(token, projectId, path, obj, { merge = false } = {}) {
  const res = await fetch(`${docsBase(projectId)}/${path}${merge ? updateMask(Object.keys(obj)) : ''}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: toFields(obj) }),
  });
  if (!res.ok) throw new Error(`write ${path} failed: HTTP ${res.status}`);
}

// Firestore REST value -> plain JS value
export function fromValue(v) {
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('timestampValue' in v) return new Date(v.timestampValue);
  if ('nullValue' in v) return null;
  return undefined;
}
export const fromDoc = (d) => ({ id: d.name.split('/').pop(), ...Object.fromEntries(Object.entries(d.fields || {}).map(([k, val]) => [k, fromValue(val)])) });

// All documents of a collection (follows pagination).
export async function listDocs(token, projectId, collection) {
  const out = [];
  let pageToken = '';
  do {
    const res = await fetch(`${docsBase(projectId)}/${collection}?pageSize=300${pageToken ? '&pageToken=' + encodeURIComponent(pageToken) : ''}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`list ${collection} failed: HTTP ${res.status}`);
    const j = await res.json();
    out.push(...(j.documents || []).map(fromDoc));
    pageToken = j.nextPageToken || '';
  } while (pageToken);
  return out;
}
