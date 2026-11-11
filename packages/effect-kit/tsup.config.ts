import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/dom.ts'],
  format: ['cjs', 'esm'],
  dts: false,
  clean: true,
  sourcemap: true,
  outExtension({ format }) {
    return {
      js: format === 'cjs' ? '.cjs' : '.js',
    };
  },
});
