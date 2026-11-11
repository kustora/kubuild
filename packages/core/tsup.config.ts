import { defineConfig } from 'tsup';

export default defineConfig({
  entry: { index: 'src/index.ts', 'effect-manifest': 'src/effects/manifest-format.ts' },
  format: ['cjs', 'esm'],
  dts: false,
  clean: true,
  sourcemap: true,
});
