import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@kubuild/schema': fileURLToPath(new URL('../../packages/schema/src', import.meta.url)),
      '@kubuild/core': fileURLToPath(new URL('../../packages/core/src', import.meta.url)),
      '@kubuild/components': fileURLToPath(new URL('../../packages/components/src', import.meta.url)),
      '@kubuild/renderer': fileURLToPath(new URL('../../packages/renderer/src', import.meta.url)),
      '@kubuild/editor': fileURLToPath(new URL('../../packages/editor/src', import.meta.url)),
      '@kubuild/react': fileURLToPath(new URL('../../packages/react/src', import.meta.url)),
    },
  },
  server: {
    port: 3000,
    open: false,
  },
});
