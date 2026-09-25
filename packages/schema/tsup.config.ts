import { defineConfig } from 'tsup';

export default defineConfig({
  // `types` and `validate` are separate entries so `@kubuild/schema/types` and
  // `@kubuild/schema/validate` can be consumed without zod in their declarations (STORA-552).
  entry: ['src/index.ts', 'src/types.ts', 'src/validate.ts'],
  format: ['cjs', 'esm'],
  dts: false,
  clean: false,
  sourcemap: true,
  outExtension({ format }) {
    return {
      js: format === 'cjs' ? '.cjs' : '.js',
    };
  },
});
