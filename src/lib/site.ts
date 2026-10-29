import { getCollection } from 'astro:content';
import { SECTIONS, isLive, type Section } from './sections';

export const SITE_NAME = 'SkorRadar';
export const SITE_TAGLINE = 'Data-driven football predictions, match analysis and sports news';

export async function allPosts() {
  const out = [];
  for (const section of Object.keys(SECTIONS) as Section[]) {
    for (const e of await getCollection(section, isLive)) out.push({ section, entry: e });
  }
  return out.sort((a, b) => b.entry.data.publishedAt.getTime() - a.entry.data.publishedAt.getTime());
}
