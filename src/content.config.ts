import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// Required on every post: short answer (answer) and FAQ (faq) for AEO/GEO
const base = z.object({
  title: z.string().min(30).max(60),
  description: z.string().min(120).max(158),
  answer: z.string().min(120).max(300), // Short-answer box: for AI overviews and featured snippets
  publishedAt: z.coerce.date(), // full ISO datetime; posts dated in the future stay hidden until then
  updatedAt: z.coerce.date().optional(),
  author: z.string().default('Eren Şimşir'),
  sport: z.enum(['football', 'basketball', 'tennis', 'f1', 'general']).default('football'),
  keywords: z.array(z.string()).default([]),
  faq: z.array(z.object({ q: z.string(), a: z.string() })).default([]),
  draft: z.boolean().default(false),
  queued: z.boolean().default(false), // set by scripts/schedule-posts.mjs; hidden until publishedAt has passed
});

const guides = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/guides' }),
  schema: base,
});

const analysis = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/analysis' }),
  schema: base.extend({
    homeTeam: z.string(),
    awayTeam: z.string(),
    competition: z.string(),
    kickoff: z.coerce.date(),
    prediction: z.object({
      home: z.number().int(),
      away: z.number().int(),
      pHome: z.number(), // 0-1 probabilities (model output)
      pDraw: z.number(),
      pAway: z.number(),
    }),
  }),
});

const news = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/news' }),
  schema: base,
});

const pages = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/pages' }),
  schema: z.object({ title: z.string(), description: z.string(), updatedAt: z.coerce.date() }),
});

export const collections = { guides, analysis, news, pages };
