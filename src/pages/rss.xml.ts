import type { APIRoute } from 'astro';
import { allPosts, SITE_NAME, SITE_TAGLINE } from '../lib/site';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export const GET: APIRoute = async ({ site }) => {
  const base = site!.href.replace(/\/$/, '');
  const items = (await allPosts()).slice(0, 30).map(({ section, entry }) => {
    const u = `${base}/${section}/${entry.id}`;
    return `<item><title>${esc(entry.data.title)}</title><link>${u}</link><guid>${u}</guid><pubDate>${entry.data.publishedAt.toUTCString()}</pubDate><description>${esc(entry.data.description)}</description></item>`;
  });
  const xml = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>${SITE_NAME}</title><link>${base}</link><description>${esc(SITE_TAGLINE)}</description><language>en-us</language>${items.join('')}</channel></rss>`;
  return new Response(xml, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } });
};
