import type { APIRoute } from 'astro';
import { allPosts, SITE_NAME } from '../lib/site';

// llms-full.txt: the complete text of every published post in one clean Markdown file.
export const GET: APIRoute = async ({ site }) => {
  const base = site!.href.replace(/\/$/, '');
  const parts = [`# ${SITE_NAME} - full content\n`];
  for (const { section, entry } of await allPosts()) {
    const d = entry.data;
    parts.push(
      `\n---\n\n# ${d.title}\n\nURL: ${base}/${section}/${entry.id}\nPublished: ${d.publishedAt.toISOString().slice(0, 10)}${d.updatedAt ? `\nUpdated: ${d.updatedAt.toISOString().slice(0, 10)}` : ''}\n\n**Short answer:** ${d.answer}\n\n${entry.body ?? ''}\n\n## FAQ\n\n${d.faq.map((f) => `**${f.q}**\n${f.a}`).join('\n\n')}\n`,
    );
  }
  return new Response(parts.join(''), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
