import type { APIRoute } from 'astro';
import { allPosts, SITE_NAME, SITE_TAGLINE } from '../lib/site';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const GET: APIRoute = async ({ site }) => {
  const base = site!.href.replace(/\/$/, '');
  const posts = (await allPosts()).slice(0, 30);
  const newest = posts[0]?.entry.data;
  const items = posts.map(({ section, entry }) => {
    const u = `${base}/${section}/${entry.id}`;
    const d = entry.data;
    return `<item><title>${esc(d.title)}</title><link>${u}</link><guid isPermaLink="true">${u}</guid><pubDate>${d.publishedAt.toUTCString()}</pubDate><dc:creator>${esc(d.author)}</dc:creator><category>${esc(section)}</category><description>${esc(d.description)}</description></item>`;
  });
  const last = (newest?.updatedAt ?? newest?.publishedAt ?? new Date()).toUTCString();
  const xml = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/"><channel><title>${SITE_NAME}</title><link>${base}</link><atom:link href="${base}/rss.xml" rel="self" type="application/rss+xml"/><description>${esc(SITE_TAGLINE)}</description><language>en-us</language><lastBuildDate>${last}</lastBuildDate>${items.join('')}</channel></rss>`;
  return new Response(xml, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } });
};
