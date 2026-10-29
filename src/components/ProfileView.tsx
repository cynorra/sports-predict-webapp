import { useEffect, useState } from 'react';
import { firebaseConfigured, hadSession, loadHistory, signIn, signOutUser, watchUser, type AppUser, type HistoryRow } from '../lib/firebase';

export default function ProfileView() {
  const [user, setUser] = useState<AppUser | null>(null);
  const [rows, setRows] = useState<HistoryRow[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!firebaseConfigured || !hadSession()) return;
    let stop: (() => void) | undefined;
    watchUser(setUser).then((s) => { stop = s; }).catch(() => {});
    return () => stop?.();
  }, []);

  useEffect(() => {
    if (!user) { setRows(null); return; }
    loadHistory(user.uid).then(setRows).catch(() => setError('Could not load your predictions.'));
  }, [user?.uid]);

  const connect = async () => {
    setError('');
    try { await watchUser(setUser); await signIn(); } catch { setError('Sign-in failed. Please try again.'); }
  };

  if (!firebaseConfigured) return <p className="text-slate-600">Accounts are not connected yet.</p>;
  if (!user) {
    return (
      <div className="rounded-lg bg-white p-6 shadow-sm">
        <p className="text-slate-700">Sign in to see your saved predictions and points.</p>
        <button type="button" onClick={connect} className="mt-3 rounded bg-pitch px-4 py-2 text-sm font-semibold text-white hover:bg-pitch-dark">Sign in with Google</button>
        {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
      </div>
    );
  }

  const total = (rows ?? []).reduce((s, r) => s + (r.points ?? 0), 0);
  const scored = (rows ?? []).filter((r) => r.points != null).length;
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p>Signed in as <strong>{user.name}</strong> · {scored} scored matches · <strong>{total}</strong> points</p>
        <button type="button" onClick={() => { void signOutUser(); setUser(null); }} className="rounded border border-slate-400 px-3 py-1 text-sm font-semibold hover:bg-slate-100">Sign out</button>
      </div>
      {error && <p role="alert" className="mb-3 text-sm text-red-700">{error}</p>}
      {rows === null ? <p className="text-slate-500">Loading…</p> : rows.length === 0 ? (
        <p className="rounded-lg bg-white p-5 shadow-sm text-slate-700">You have no saved predictions yet. Make some on the <a className="text-pitch underline" href="/predict">prediction page</a>.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Your predictions</caption>
            <thead className="border-b bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-2">Match</th><th className="px-4 py-2">Your pick</th><th className="px-4 py-2">Result</th><th className="px-4 py-2 text-right">Points</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.fixtureId} className="border-b last:border-0">
                  <td className="px-4 py-2">{r.home} - {r.away}</td>
                  <td className="px-4 py-2">{r.pick}</td>
                  <td className="px-4 py-2">{r.result ?? 'Pending'}</td>
                  <td className="px-4 py-2 text-right font-bold">{r.points ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
