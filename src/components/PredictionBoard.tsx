import { useEffect, useMemo, useRef, useState } from 'react';
import { firebaseConfigured, hadSession, loadCommunity, loadNickname, loadPicks, savePick, saveNickname, signIn, signOutUser, watchUser, type AppUser, type Community, type Pick } from '../lib/firebase';

export interface Fixture {
  id: string;
  competition: string;
  home: string;
  away: string;
  kickoff: string; // ISO
  model: { home: number; away: number; pHome: number; pDraw: number; pAway: number };
}

type Status = 'idle' | 'saving' | 'saved' | 'error';
const pct = (n: number) => `${Math.round(n * 100)}%`;
const complete = (p?: Pick) => Boolean(p && p.h !== '' && p.a !== '');

function Card({ f, value, status, community, onChange }: { f: Fixture; value: Pick; status: Status; community?: Community; onChange: (v: Pick) => void }) {
  const ms = new Date(f.kickoff).getTime() - Date.now();
  const locked = ms <= 0;
  const h = Math.floor(ms / 3.6e6);
  const left = locked ? 'Locked' : h >= 24 ? `${Math.floor(h / 24)}d ${h % 24}h` : `${h}h ${Math.floor((ms % 3.6e6) / 6e4)}m`;
  const input = (key: 'h' | 'a') => (
    <input
      inputMode="numeric"
      maxLength={2}
      disabled={locked}
      value={value[key]}
      onChange={(e) => onChange({ ...value, [key]: e.target.value.replace(/\D/g, '') })}
      aria-label={`${key === 'h' ? f.home : f.away} goals`}
      className="h-12 w-12 rounded border border-slate-300 text-center text-xl font-bold disabled:bg-slate-100"
    />
  );
  return (
    <li className="rounded-lg bg-white p-4 shadow-sm">
      <div className="flex justify-between text-xs text-slate-500">
        <span>{f.competition}</span>
        <span>{locked ? 'Locked' : `Locks in ${left}`}</span>
      </div>
      <div className="mt-3 flex items-center justify-between gap-2">
        <span className="flex-1 text-right font-semibold">{f.home}</span>
        {input('h')}
        <span className="text-slate-400">-</span>
        {input('a')}
        <span className="flex-1 font-semibold">{f.away}</span>
      </div>
      <p className="mt-3 text-center text-xs text-slate-600">
        Model: {f.model.home}-{f.model.away} · {pct(f.model.pHome)} / {pct(f.model.pDraw)} / {pct(f.model.pAway)}
      </p>
      {community && community.total >= 10 && complete(value) && (
        <p className="mt-1 text-center text-xs text-slate-600">
          {community.total} players: {pct(community.home / community.total)} home win, {pct(community.draw / community.total)} draw, {pct(community.away / community.total)} away win
        </p>
      )}
      <p className="mt-1 h-4 text-center text-xs" aria-live="polite">
        {status === 'saving' && <span className="text-slate-500">Saving…</span>}
        {status === 'saved' && <span className="text-pitch">Saved to your account</span>}
        {status === 'error' && <span className="text-red-700">Could not save. The match may have started.</span>}
      </p>
    </li>
  );
}

export default function PredictionBoard({ fixtures }: { fixtures: Fixture[] }) {
  const [picks, setPicks] = useState<Record<string, Pick>>(() => {
    try { return JSON.parse(localStorage.getItem('picks') ?? '{}'); } catch { return {}; }
  });
  const [user, setUser] = useState<AppUser | null>(null);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState('');
  const [status, setStatus] = useState<Record<string, Status>>({});
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const watching = useRef(false);
  const [nickname, setNickname] = useState('');
  const [nickDraft, setNickDraft] = useState('');
  const [nickMsg, setNickMsg] = useState('');
  const [community, setCommunity] = useState<Record<string, Community>>({});
  const kickoff = useMemo(() => Object.fromEntries(fixtures.map((f) => [f.id, new Date(f.kickoff).getTime()])), [fixtures]);
  const filled = useMemo(() => Object.values(picks).filter(complete).length, [picks]);

  const persistLocal = (next: Record<string, Pick>) => { try { localStorage.setItem('picks', JSON.stringify(next)); } catch {} };
  const mark = (id: string, s: Status) => setStatus((prev) => ({ ...prev, [id]: s }));

  // Start Firebase only when the visitor already has a session; first-time visitors load nothing until they click Sign in.
  useEffect(() => {
    if (!firebaseConfigured || !hadSession()) return;
    let stop: (() => void) | undefined;
    watching.current = true;
    watchUser(setUser).then((s) => { stop = s; }).catch(() => {});
    return () => stop?.();
  }, []);

  // After sign-in: pull saved picks from the account and upload any local picks the account does not have yet.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    loadPicks(user.uid).then(async (remote) => {
      if (cancelled) return;
      const merged = { ...picks, ...remote };
      setPicks(merged);
      persistLocal(merged);
      for (const f of fixtures) {
        if (!remote[f.id] && complete(picks[f.id]) && kickoff[f.id] > Date.now()) {
          try { await savePick(user.uid, f.id, picks[f.id]); mark(f.id, 'saved'); } catch { mark(f.id, 'error'); }
        }
      }
    }).catch(() => {});
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  // Leaderboard name and community pick counts, loaded once the player is signed in.
  useEffect(() => {
    if (!user) return;
    loadNickname(user.uid).then((n) => { setNickname(n); setNickDraft(n); }).catch(() => {});
    loadCommunity().then(setCommunity).catch(() => {});
  }, [user?.uid]);

  const saveNick = async () => {
    const n = nickDraft.trim();
    if (!user || n.length < 2 || n.length > 24) { setNickMsg('Use 2 to 24 characters.'); return; }
    try { await saveNickname(user.uid, n); setNickname(n); setNickMsg('Saved. You will appear on the leaderboard once you score points.'); }
    catch { setNickMsg('Could not save the name.'); }
  };

  const update = (id: string, v: Pick) => {
    const next = { ...picks, [id]: v };
    setPicks(next);
    persistLocal(next);
    if (!user || !complete(v) || kickoff[id] <= Date.now()) return;
    clearTimeout(timers.current[id]);
    mark(id, 'saving');
    timers.current[id] = setTimeout(() => {
      savePick(user.uid, id, v).then(() => mark(id, 'saved')).catch(() => mark(id, 'error'));
    }, 800);
  };

  const doSignIn = async () => {
    setAuthBusy(true); setAuthError('');
    try {
      if (!watching.current) { watching.current = true; await watchUser(setUser); }
      await signIn();
    }
    catch (e: any) { setAuthError(e?.code === 'auth/popup-closed-by-user' ? '' : 'Sign-in failed. Please try again.'); }
    finally { setAuthBusy(false); }
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-white p-4 shadow-sm">
        <p className="text-sm text-slate-600">
          {filled}/{fixtures.length} predictions entered. Scoring: exact score 10 pts, correct result and goal difference 5 pts, correct result 3 pts.
        </p>
        {firebaseConfigured && (user ? (
          <div className="flex items-center gap-3 text-sm">
            <span>Signed in as <strong>{user.name}</strong></span>
            <button type="button" onClick={() => { void signOutUser(); setUser(null); }} className="rounded border border-slate-400 px-3 py-1 font-semibold hover:bg-slate-100">Sign out</button>
          </div>
        ) : (
          <button type="button" onClick={doSignIn} disabled={authBusy} className="rounded bg-pitch px-4 py-2 text-sm font-semibold text-white hover:bg-pitch-dark disabled:opacity-60">
            {authBusy ? 'Opening…' : 'Sign in with Google to save'}
          </button>
        ))}
      </div>
      {user && (
        <div className="mb-4 rounded-lg bg-white p-4 text-sm shadow-sm">
          <label htmlFor="nick" className="font-semibold">Leaderboard name</label>
          <p className="text-xs text-slate-500">Optional. Shown publicly on the leaderboard. Leave it empty to stay off the leaderboard.</p>
          <div className="mt-2 flex gap-2">
            <input id="nick" value={nickDraft} maxLength={24} onChange={(e) => setNickDraft(e.target.value)} className="w-56 rounded border border-slate-300 px-2 py-1" />
            <button type="button" onClick={saveNick} className="rounded bg-pitch px-3 py-1 font-semibold text-white hover:bg-pitch-dark">{nickname ? 'Update' : 'Save'}</button>
          </div>
          {nickMsg && <p className="mt-1 text-xs text-slate-600" aria-live="polite">{nickMsg}</p>}
        </div>
      )}
      {authError && <p role="alert" className="mb-3 text-sm text-red-700">{authError}</p>}
      {!user && <p className="mb-4 text-xs text-slate-500">Without an account your picks stay on this device only.</p>}
      <ul className="grid gap-4 md:grid-cols-2">
        {fixtures.map((f) => (
          <Card key={f.id} f={f} value={picks[f.id] ?? { h: '', a: '' }} status={status[f.id] ?? 'idle'} community={community[f.id]} onChange={(v) => update(f.id, v)} />
        ))}
      </ul>
    </div>
  );
}
