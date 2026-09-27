#!/usr/bin/env node
// Mirrors every `dist/**/*.d.ts` emitted by `tsc --emitDeclarationOnly` into a `.d.cts` twin.
//
// Packages are `"type": "module"`, so TypeScript treats `.d.ts` files as ESM declarations. A
// CommonJS consumer resolving the `require` condition under `moduleResolution: node16/nodenext`
// needs CJS-flavoured declarations, otherwise the types masquerade as ESM. Relative specifiers
// are rewritten `.js` -> `.cjs` so the `.d.cts` files resolve to each other.
//
// Usage (from a package directory): node ../../scripts/emit-cjs-dts.mjs [distDir]
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';

const distDir = process.argv[2] ?? 'dist';

const walk = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return entry.name.endsWith('.d.ts') ? [full] : [];
  });

const RELATIVE_SPECIFIER =
  /((?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)['"])(\.\.?\/[^'"]*?)\.js(['"])/g;

let count = 0;
for (const file of walk(distDir)) {
  const ctsFile = file.replace(/\.d\.ts$/, '.d.cts');
  const mapFile = `${file}.map`;
  const ctsMapFile = `${ctsFile}.map`;

  let source = readFileSync(file, 'utf8').replace(RELATIVE_SPECIFIER, '$1$2.cjs$3');
  source = source.replace(
    /\/\/# sourceMappingURL=.*\.d\.ts\.map\s*$/,
    `//# sourceMappingURL=${basename(ctsMapFile)}`,
  );
  writeFileSync(ctsFile, source);

  if (existsSync(mapFile)) {
    const map = JSON.parse(readFileSync(mapFile, 'utf8'));
    map.file = basename(ctsFile);
    writeFileSync(ctsMapFile, JSON.stringify(map));
  }
  count++;
}

console.log(`emit-cjs-dts: wrote ${count} .d.cts file(s) in ${distDir}`);
