import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'definitions/index': 'src/definitions/index.ts',
    'traits/index': 'src/traits/index.ts',
    'blocks/index': 'src/blocks/index.ts',
  },
  format: ['cjs', 'esm'],
  dts: false,
  clean: true,
  sourcemap: true,
});
