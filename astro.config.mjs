import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://pastodel.ru',
  output: 'static',
  integrations: [sitemap()]
});
