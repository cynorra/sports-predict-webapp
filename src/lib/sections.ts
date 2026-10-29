export const SECTIONS = {
  analysis: { title: 'Match Analysis & Predictions', blurb: 'Weekly previews of the biggest matches: form, injuries, head-to-head and a statistical score prediction.' },
  news: { title: 'Sports News', blurb: 'Football and wider sports news with context, analysis and sources.' },
  guides: { title: 'Guides', blurb: 'Tournament formats, rules and how to make better predictions.' },
} as const;
export type Section = keyof typeof SECTIONS;

// A post is live when it is not a draft, not waiting for scheduling and its publish time has passed.
export const isLive = (e: { data: { draft: boolean; queued: boolean; publishedAt: Date } }) =>
  !e.data.draft && !e.data.queued && e.data.publishedAt.getTime() <= Date.now();
