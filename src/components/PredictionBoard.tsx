import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { firebaseConfigured, hadSession, loadCommunity, loadNickname, loadPicks, savePick, saveNickname, signIn, signOutUser, watchUser, type AppUser, type Community, type Pick } from '../lib/firebase';

export interface Fixture {
  id: string;
  competition: string;
  home: string;
  away: string;
  kickoff: string; // ISO
  homeCrest?: string;
  awayCrest?: string;
  model: { home: number; away: number; pHome: number; pDraw: number; pAway: number };
}

type Status = 'idle' | 'saving' | 'saved' | 'error';
const pct = (n: number) => `${Math.round(n * 100)}%`;

function Crest({ src, name }: { src?: string; name: string }) {
  const [bad, setBad] = useState(false);
  if (!src || bad) {
    return <span aria-hidden="true" className="display flex h-12 w-12 items-center justify-center border border-line bg-paper text-lg font-bold">{name.slice(0, 3).toUpperCase()}</span>;
  }
  return <img src={src} alt="" width={48} height={48} loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setBad(true)} className="h-12 w-12 object-contain" />;
}

function ProbBar({ h, d, a }: { h: number; d: number; a: number }) {
  const reduce = useReducedMotion();
  const seg = (v: number, cls: string) => (
    <motion.div initial={reduce ? false : { width: 0 }} whileInView={{ width: `${v * 100}%` }} viewport={{ once: true }} transition={{ duration: 0.7, ease: 'easeOut' }} className={`h-full ${cls}`} />
  );
  return (
    <div role="img" aria-label={`Model: home win ${pct(h)}, draw ${pct(d)}, away win ${pct(a)}`}>
      <div className="flex h-1.5 w-full overflow-hidden bg-line">{seg(h, 'bg-ink')}{seg(d, 'bg-slate-400')}{seg(a, 'bg-gold')}</div>
      <div className="mt-1.5 grid grid-cols-3 text-[11px] font-semibold uppercase tracking-wider text-slate-600">
        <span>Home {pct(h)}</span><span className="text-center">Draw {pct(d)}</span><span className="text-right">Away {pct(a)}</span>
      </div>
    </div>
  );
}

const complete = (p?: Pick) => Boolean(p && p.h !== '' && p.a !== '');

function Card({ f, value, status, community, onChange }: { f: Fixture; value: Pick; status: Status; community?: Community; onChange: (v: Pick) => void }) {
  const ms = new Date(f.kickoff).getTime() - Date.now();
  const locked = ms <= 0;
  const h = Math.floor(ms / 3.6e6);
  const left = locked ? 'Locked' : h >= 24 ? `${Math.floor(h / 24)}d ${h % 24}h` : `${h}h ${Math.floor((ms % 3.6e6) / 6e4)}m`;
  const kick = new Date(f.kickoff).toLocaleString('en-US', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
  const input = (key: 'h' | 'a') => (
    <input
      inputMode="numeric"
      maxLength={2}
      disabled={locked}
      value={value[key]}
      placeholder="–"
      onChange={(e) => onChange({ ...value, [key]: e.target.value.replace(/\D/g, '') })}
      aria-label={`${key === 'h' ? f.home : f.away} goals`}
      className="digit h-14 w-12 text-center text-4xl outline-none placeholder:text-white/30 focus:ring-4 focus:ring-gold disabled:opacity-50"
    />
  );
  return (
    <li className="card">
      <div className="flex justify-between border-b border-line px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-600">
        <span>{f.competition} · {kick} UTC</span>
        <span className={locked ? '' : 'text-pitch'}>{locked ? 'Locked' : `Locks in ${left}`}</span>
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 py-5">
        <div className="flex flex-col items-center gap-2 text-center"><Crest src={f.homeCrest} name={f.home} /><span className="display text-[1.4rem] font-bold leading-none">{f.home}</span></div>
        <div className="flex items-center gap-1.5">{input('h')}<span className="display text-2xl text-slate-400">:</span>{input('a')}</div>
        <div className="flex flex-col items-center gap-2 text-center"><Crest src={f.awayCrest} name={f.away} /><span className="display text-[1.4rem] font-bold leading-none">{f.away}</span></div>
      </div>
      <div className="border-t border-line bg-paper/60 px-4 py-3">
        <ProbBar h={f.model.pHome} d={f.model.pDraw} a={f.model.pAway} />
        <p className="mt-2 text-xs text-slate-600">Model scoreline <strong className="digit px-1.5 py-0.5 text-sm">{f.model.home}–{f.model.away}</strong></p>
        {community && community.total >= 10 && complete(value) && (
          <p className="mt-1 text-xs text-slate-600">
            {community.total} players: {pct(community.home / community.total)} home win, {pct(community.draw / community.total)} draw, {pct(community.away / community.total)} away win
          </p>
        )}
        <p className="mt-1 h-4 text-xs" aria-live="polite">
          {status === 'saving' && <span className="text-slate-500">Saving…</span>}
          {status === 'saved' && <span className="font-semibold text-pitch">Saved to your account</span>}
          {status === 'error' && <span className="text-red-700">Could not save. The match may have started.</span>}
        </p>
      </div>
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
      <div className="card mb-5 flex flex-wrap items-center justify-between gap-3 p-4">
        <p className="text-sm text-slate-600">
          {filled}/{fixtures.length} predictions entered. Scoring: exact score 10 pts, correct result and goal difference 5 pts, correct result 3 pts.
        </p>
        {firebaseConfigured && (user ? (
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span>Signed in as <strong>{user.name}</strong></span>
            <a href="/profile" className="rounded border border-pitch bg-pitch/5 px-3 py-1 font-semibold text-pitch hover:bg-pitch/10">My Profile</a>
            <button type="button" onClick={() => { void signOutUser(); setUser(null); }} className="rounded border border-slate-400 px-3 py-1 font-semibold hover:bg-slate-100">Sign out</button>
          </div>
        ) : (
          <button type="button" onClick={doSignIn} disabled={authBusy} className="display bg-ink px-5 py-2 text-lg font-bold uppercase tracking-wider text-white hover:bg-pitch disabled:opacity-60">
            {authBusy ? 'Opening…' : 'Sign in with Google to save'}
          </button>
        ))}
      </div>
      {user && (
        <div className="card mb-5 p-4 text-sm">
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
      <ul className="grid gap-5 md:grid-cols-2">
        {fixtures.map((f) => (
          <Card key={f.id} f={f} value={picks[f.id] ?? { h: '', a: '' }} status={status[f.id] ?? 'idle'} community={community[f.id]} onChange={(v) => update(f.id, v)} />
        ))}
      </ul>
    </div>
  );
}
