// Topic groups for the /guides hub. A guide belongs to the first topic that lists its slug; unlisted guides fall into "More guides",
// so a new post is never lost. Only topics that contain at least one live guide are shown.
export interface GuideTopic { id: string; title: string; blurb: string; slugs: string[] }

export const TOPICS: GuideTopic[] = [
  {
    id: 'score-predictions',
    title: 'Football score predictions',
    blurb: 'How to predict football scores step by step, why draws and low scores are more common than fans expect, and how the Soccer Games Today game awards points for soccer score predictions.',
    slugs: [
      'how-to-predict-football-scores',
      'how-points-work-in-the-prediction-game',
      'why-football-draws-happen-and-how-often',
      'home-advantage-in-football-how-big-is-it',
      'small-samples-and-football-form-luck-or-skill',
      'clean-sheets-in-football-how-often-teams-keep-one',
    ],
  },
  {
    id: 'ratings-and-models',
    title: 'Ratings, xG and models',
    blurb: 'The maths behind a football score forecast: Elo ratings, the Poisson distribution, expected goals (xG) and expected points, explained without jargon.',
    slugs: [
      'elo-ratings-in-football-explained',
      'poisson-distribution-football-goals-explained',
      'what-is-xg-expected-goals-explained',
      'expected-points-xpts-football-explained',
      'elo-ratings-for-new-teams-why-few-matches-mean-doubt',
      'fifa-world-ranking-vs-elo-ratings-difference',
    ],
  },
  {
    id: 'records',
    title: 'Records and top scorers',
    blurb: 'World Cup top scorers, the most goals in a Premier League season and other records, each with the numbers traced to a named source.',
    slugs: ['world-cup-all-time-top-scorers', 'champions-league-all-time-top-scorers', 'most-goals-in-a-premier-league-season', 'premier-league-scoring-records'],
  },
  {
    id: 'tournaments',
    title: 'Tournaments and formats',
    blurb: 'How the Champions League league phase and the 48-team World Cup work, and what each format means for results.',
    slugs: ['how-the-new-champions-league-format-works', 'how-the-48-team-world-cup-format-works'],
  },
  {
    id: 'rules',
    title: 'Rules explained',
    blurb: 'Offside, VAR, cards, tiebreakers, extra time and formations in plain language.',
    slugs: [
      'offside-rule-in-football-explained-simply',
      'var-in-football-explained-what-it-can-review',
      'yellow-and-red-cards-in-football-rules-and-suspensions',
      'football-league-table-tiebreakers-explained',
      'extra-time-and-penalty-shootouts-explained',
      'football-formations-explained-442-433-352',
    ],
  },
];

/** Guides to point new readers at first, in order. Only live ones are shown. */
export const START_HERE = ['how-to-predict-football-scores', 'elo-ratings-in-football-explained', 'what-is-xg-expected-goals-explained'];

/** Group live guide entries by topic (newest first inside a topic). Empty topics are dropped. */
export function groupGuides<T extends { id: string; data: { publishedAt: Date } }>(entries: T[]) {
  const byDate = (a: T, b: T) => b.data.publishedAt.getTime() - a.data.publishedAt.getTime();
  const used = new Set<string>();
  const groups = TOPICS.map((t) => {
    const items = t.slugs.map((s) => entries.find((e) => e.id === s)).filter((e): e is T => Boolean(e));
    items.forEach((e) => used.add(e.id));
    return { ...t, items: items.sort(byDate) };
  });
  const rest = entries.filter((e) => !used.has(e.id)).sort(byDate);
  if (rest.length) groups.push({ id: 'more', title: 'More guides', blurb: 'Further explainers from Soccer Games Today.', slugs: [], items: rest });
  return groups.filter((g) => g.items.length > 0);
}
