import { getCollection } from 'astro:content';
import { SECTIONS, isLive, type Section } from './sections';

export const SITE_NAME = 'ScoreRadar';
export const SITE_TAGLINE = 'Data-driven football predictions, match analysis and guides';

export async function allPosts() {
  const out = [];
  for (const section of Object.keys(SECTIONS) as Section[]) {
    for (const e of await getCollection(section, isLive)) out.push({ section, entry: e });
  }
  return out.sort((a, b) => b.entry.data.publishedAt.getTime() - a.entry.data.publishedAt.getTime());
}

export const PAGE_SIZE = 12;

/** Sections that have at least one live post. Empty sections are hidden from the menu, home page and sitemap. */
export async function liveSections(): Promise<Section[]> {
  const out: Section[] = [];
  for (const section of Object.keys(SECTIONS) as Section[]) if ((await getCollection(section, isLive)).length) out.push(section);
  return out;
}

/** Up to n other live posts, same section first, newest first. */
export async function relatedPosts(section: Section, id: string, n = 3) {
  const all = (await allPosts()).filter((p) => !(p.section === section && p.entry.id === id));
  const same = all.filter((p) => p.section === section);
  return [...same, ...all.filter((p) => p.section !== section)].slice(0, n);
}
