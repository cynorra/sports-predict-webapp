import { useEffect, useState } from 'react';

interface Row { nickname: string; points: number; played: number; exact: number }

// Reads the public leaderboard collection through the Firestore REST API: no Firebase SDK, no cookies or storage for visitors.
export default function LeaderboardTable({ projectId, apiKey }: { projectId?: string; apiKey?: string }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!projectId || !apiKey) return;
    const body = { structuredQuery: { from: [{ collectionId: 'leaderboard' }], orderBy: [{ field: { fieldPath: 'points' }, direction: 'DESCENDING' }, { field: { fieldPath: 'exact' }, direction: 'DESCENDING' }], limit: 50 } };
    fetch(`https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents:runQuery?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((j: any[]) => setRows(j.filter((x) => x.document).map((x) => {
        const f = x.document.fields;
        return { nickname: f.nickname?.stringValue ?? '?', points: Number(f.points?.integerValue ?? 0), played: Number(f.played?.integerValue ?? 0), exact: Number(f.exact?.integerValue ?? 0) };
      })))
      .catch(() => setError(true));
  }, [projectId, apiKey]);

  if (!projectId || !apiKey) return <p className="text-slate-600">The leaderboard is not connected yet.</p>;
  if (error) return <p role="alert" className="text-red-700">Could not load the leaderboard. Please try again later.</p>;
  if (!rows) return <p className="text-slate-500">Loading…</p>;
  if (!rows.length) return <p className="rounded-lg bg-white p-5 shadow-sm text-slate-700">No one is ranked yet. Points are added a few hours after each match finishes.</p>;

  let rank = 0, prev = '';
  return (
    <div className="overflow-x-auto rounded-lg bg-white shadow-sm">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">Leaderboard of the top 50 players</caption>
        <thead className="border-b bg-slate-50 text-xs uppercase text-slate-500">
          <tr><th className="px-4 py-2">#</th><th className="px-4 py-2">Player</th><th className="px-4 py-2 text-right">Points</th><th className="px-4 py-2 text-right">Matches</th><th className="px-4 py-2 text-right">Exact scores</th></tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const key = `${r.points}-${r.exact}`;
            if (key !== prev) { rank = i + 1; prev = key; }
            return (
              <tr key={i} className="border-b last:border-0">
                <td className="px-4 py-2 font-semibold">{rank}</td>
                <td className="px-4 py-2">{r.nickname}</td>
                <td className="px-4 py-2 text-right font-bold">{r.points}</td>
                <td className="px-4 py-2 text-right">{r.played}</td>
                <td className="px-4 py-2 text-right">{r.exact}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
