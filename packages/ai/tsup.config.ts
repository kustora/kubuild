import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'server/index': 'src/server/index.ts',
    // Node-only (reads skill folders from disk), so kept out of the edge-safe server entry.
    'server/skills-loader': 'src/server/skills-loader.ts',
    'server/adapters/index': 'src/server/adapters/index.ts',
    'client/index': 'src/client/index.ts',
    'react/index': 'src/react/index.ts',
  },
  format: ['cjs', 'esm'],
  dts: false,
  clean: true,
  sourcemap: true,
});
