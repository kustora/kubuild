import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: false,
  // Clean before emitting: `tsc --emitDeclarationOnly` (run after tsup) doesn't remove
  // orphaned .d.ts files, so a since-moved module leaves a stale declaration at the old
  // path that shadows the real one via `export * from './store'` — and Turbo then caches
  // that stale file as a build output, silently masking type changes in dependents.
  clean: true,
  sourcemap: true,
  external: ['react', 'react-dom'],
  outExtension({ format }) {
    return {
      js: format === 'cjs' ? '.cjs' : '.js',
    };
  },
});
