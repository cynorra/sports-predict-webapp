import type { APIRoute } from 'astro';
import { allPosts, SITE_NAME, SITE_TAGLINE } from '../lib/site';
import { SECTIONS, type Section } from '../lib/sections';

// llms.txt (llmstxt.org): a curated, human- and LLM-readable map of the site's best content.
export const GET: APIRoute = async ({ site }) => {
  const base = site!.href.replace(/\/$/, '');
  const posts = await allPosts();
  const lines = [
    `# ${SITE_NAME}`,
    '',
    `> ${SITE_TAGLINE}. English-language site. Predictions come from a published Elo + Poisson model; see ${base}/methodology.`,
    '',
    'Predictions are probabilistic estimates for information and entertainment, not betting advice.',
  ];
  for (const section of Object.keys(SECTIONS) as Section[]) {
    const items = posts.filter((p) => p.section === section);
    lines.push('', `## ${SECTIONS[section].title}`, '');
    for (const { entry } of items) lines.push(`- [${entry.data.title}](${base}/${section}/${entry.id}): ${entry.data.answer}`);
    if (!items.length) lines.push('- (no posts yet)');
  }
  lines.push('', '## Optional', '', `- [Methodology](${base}/methodology): how predictions are produced and graded`, `- [Editorial policy](${base}/editorial-policy): sourcing, corrections and AI-use disclosure`, `- [Full content for LLMs](${base}/llms-full.txt)`);
  return new Response(lines.join('\n') + '\n', { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
