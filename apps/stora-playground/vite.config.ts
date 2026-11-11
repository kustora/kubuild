import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      // Subpaths first: aliases are prefix matches, so `@kubuild/core` would swallow them.
      '@kubuild/core/effect-manifest': fileURLToPath(
        new URL('../../packages/core/src/effects/manifest-format.ts', import.meta.url),
      ),
      // Generated at build time (the bundled page runtime as a string), so it comes from dist.
      '@kubuild/runtime-dom/source': fileURLToPath(new URL('../../packages/runtime-dom/dist/source.js', import.meta.url)),
      '@kubuild/runtime-dom': fileURLToPath(new URL('../../packages/runtime-dom/src', import.meta.url)),
      '@kubuild/plugin-parallax/dom': fileURLToPath(new URL('../../packages/plugin-parallax/src/dom.ts', import.meta.url)),
      '@kubuild/plugin-parallax': fileURLToPath(new URL('../../packages/plugin-parallax/src', import.meta.url)),
      '@kubuild/schema': fileURLToPath(new URL('../../packages/schema/src', import.meta.url)),
      '@kubuild/core': fileURLToPath(new URL('../../packages/core/src', import.meta.url)),
      '@kubuild/components': fileURLToPath(new URL('../../packages/components/src', import.meta.url)),
      '@kubuild/renderer': fileURLToPath(new URL('../../packages/renderer/src', import.meta.url)),
      '@kubuild/editor': fileURLToPath(new URL('../../packages/editor/src', import.meta.url)),
      '@kubuild/react': fileURLToPath(new URL('../../packages/react/src', import.meta.url)),
    },
  },
  server: {
    port: 3031,
    open: false,
    allowedHosts: ['demo.stora.page'],
  },
  preview: {
    port: 3031,
    allowedHosts: ['demo.stora.page'],
  },
});
