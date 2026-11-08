import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import node from '@astrojs/node';
import tailwindcss from '@tailwindcss/vite';
import hideUnpublishedLinks from './scripts/lib/hide-unpublished-links.mjs';
import { lastmodMap } from './scripts/lib/lastmod.mjs';

// SITE_URL: yayına alırken gerçek alan adıyla değiştirin (canonical, sitemap, OG için şart)
const site = process.env.SITE_URL ?? 'https://todayssoccergames.com';

const lastmod = lastmodMap(process.cwd());

export default defineConfig({
  site,
  output: 'static',
  adapter: node({ mode: 'standalone' }),
  integrations: [react(), sitemap({
    filter: (p) => !p.includes('/profile'),
    serialize(item) {
      const d = lastmod.get(new URL(item.url).pathname);
      if (d) item.lastmod = d.toISOString();
      return item;
    },
  })],
  markdown: { remarkPlugins: [hideUnpublishedLinks] },
  vite: { plugins: [tailwindcss()] },
});
