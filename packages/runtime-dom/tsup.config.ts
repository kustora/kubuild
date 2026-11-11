import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: ['src/index.ts'],
    format: ['cjs', 'esm'],
    dts: false,
    clean: false,
    sourcemap: true,
    outExtension({ format }) {
      return {
        js: format === 'cjs' ? '.cjs' : '.js',
      };
    },
  },
  {
    // The page bundle: one self-contained file, every dependency inlined.
    entry: { 'kubuild-runtime': 'src/standalone.ts' },
    format: ['iife'],
    platform: 'browser',
    target: 'es2020',
    minify: true,
    dts: false,
    clean: false,
    sourcemap: false,
    noExternal: [/.*/],
    outExtension() {
      return { js: '.js' };
    },
  },
]);
