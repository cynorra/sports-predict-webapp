import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import node from '@astrojs/node';
import tailwindcss from '@tailwindcss/vite';

// SITE_URL: yayına alırken gerçek alan adıyla değiştirin (canonical, sitemap, OG için şart)
const site = process.env.SITE_URL ?? 'https://example.com';

export default defineConfig({
  site,
  output: 'static',
  i18n: { defaultLocale: 'en', locales: ['en', 'tr'], routing: { prefixDefaultLocale: false } },
  adapter: node({ mode: 'standalone' }),
  integrations: [react(), sitemap({ filter: (p) => !p.includes('/profile') })],
  vite: { plugins: [tailwindcss()] },
});
