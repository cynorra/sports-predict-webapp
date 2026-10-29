// Browser-side Firebase helpers. Config comes from PUBLIC_FIREBASE_* build-time variables (public by design; the data is
// protected by firestore.rules). The SDK is imported lazily and ONLY after the visitor clicks "Sign in" or already has a
// session, so visitors who never sign in load no Firebase code and trigger no Firebase storage or network calls.

const cfg = {
  apiKey: import.meta.env.PUBLIC_FIREBASE_API_KEY as string | undefined,
  authDomain: import.meta.env.PUBLIC_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: import.meta.env.PUBLIC_FIREBASE_PROJECT_ID as string | undefined,
  appId: import.meta.env.PUBLIC_FIREBASE_APP_ID as string | undefined,
};

export const firebaseConfigured = Boolean(cfg.apiKey && cfg.projectId && cfg.authDomain && cfg.appId);
const SESSION_FLAG = 'skorradar-auth';
export const hadSession = () => { try { return localStorage.getItem(SESSION_FLAG) === '1'; } catch { return false; } };
const setSessionFlag = (on: boolean) => { try { on ? localStorage.setItem(SESSION_FLAG, '1') : localStorage.removeItem(SESSION_FLAG); } catch {} };

export interface AppUser { uid: string; name: string }
export type Pick = { h: string; a: string };

async function sdk() {
  const [{ initializeApp, getApps, getApp }, auth, fs] = await Promise.all([import('firebase/app'), import('firebase/auth'), import('firebase/firestore')]);
  const app = getApps().length ? getApp() : initializeApp(cfg as Record<string, string>);
  return { auth, fs, authInst: auth.getAuth(app), db: fs.getFirestore(app) };
}

const toUser = (u: { uid: string; displayName: string | null } | null): AppUser | null =>
  u ? { uid: u.uid, name: (u.displayName ?? 'Player').split(' ')[0].slice(0, 24) } : null;

export async function watchUser(cb: (u: AppUser | null) => void): Promise<() => void> {
  const { auth, authInst } = await sdk();
  return auth.onAuthStateChanged(authInst, (u) => { setSessionFlag(Boolean(u)); cb(toUser(u)); });
}

export async function signIn(): Promise<void> {
  const { auth, authInst } = await sdk();
  await auth.signInWithPopup(authInst, new auth.GoogleAuthProvider());
}

export async function signOutUser(): Promise<void> {
  const { auth, authInst } = await sdk();
  await auth.signOut(authInst);
}

export async function loadPicks(uid: string): Promise<Record<string, Pick>> {
  const { fs, db } = await sdk();
  const snap = await fs.getDocs(fs.query(fs.collection(db, 'predictions'), fs.where('uid', '==', uid)));
  const out: Record<string, Pick> = {};
  snap.forEach((d) => { const x = d.data(); out[x.fixtureId] = { h: String(x.home), a: String(x.away) }; });
  return out;
}

// Rules reject the write if the match has started (kickoff is read from the server-written fixtures/{id} document).
export async function savePick(uid: string, fixtureId: string, p: Pick): Promise<void> {
  const { fs, db } = await sdk();
  await fs.setDoc(fs.doc(db, 'predictions', `${uid}_${fixtureId}`), {
    uid, fixtureId, home: parseInt(p.h, 10), away: parseInt(p.a, 10), updatedAt: fs.serverTimestamp(),
  });
}
