import { defineConfig, passthroughImageService } from 'astro/config';
import starlight from '@astrojs/starlight';

// https://astro.build/config
export default defineConfig({
  image: {
    service: passthroughImageService(),
  },
  integrations: [
    starlight({
      title: 'KUBUILD',
      description:
        'Embeddable, backend-agnostic web page builder engine & portable .stora package ecosystem.',
      defaultLocale: 'root',
      locales: {
        root: {
          label: 'English',
          lang: 'en',
        },
        id: {
          label: 'Bahasa Indonesia',
          lang: 'id',
        },
      },
      social: {
        github: 'https://github.com/kustora/kubuild',
      },
      sidebar: [
        {
          label: 'Getting Started',
          translations: {
            id: 'Memulai',
          },
          autogenerate: { directory: 'getting-started' },
        },
        {
          label: 'Architecture',
          translations: {
            id: 'Arsitektur',
          },
          autogenerate: { directory: 'architecture' },
        },
        {
          label: 'Packages',
          translations: {
            id: 'Paket / Modul',
          },
          autogenerate: { directory: 'packages' },
        },
        {
          label: 'Guides',
          translations: {
            id: 'Panduan',
          },
          autogenerate: { directory: 'guides' },
        },
      ],
      customCss: ['./src/styles/custom.css'],
    }),
  ],
});
