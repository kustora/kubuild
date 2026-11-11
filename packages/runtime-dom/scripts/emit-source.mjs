#!/usr/bin/env node
// Wraps dist/kubuild-runtime.js as a string module (`@kubuild/runtime-dom/source`) so
// exporters can write the bundle into a ZIP or inline it without a bundler `?raw` import.
import { readFileSync, writeFileSync } from 'node:fs';

const source = readFileSync('dist/kubuild-runtime.js', 'utf8');
const { version } = JSON.parse(readFileSync('package.json', 'utf8'));
const body = [
  `KUBUILD_RUNTIME_SOURCE = ${JSON.stringify(source)}`,
  `KUBUILD_RUNTIME_FILENAME = "kubuild-runtime.js"`,
  `KUBUILD_RUNTIME_VERSION = ${JSON.stringify(version)}`,
];
const types = [
  'export declare const KUBUILD_RUNTIME_SOURCE: string;',
  'export declare const KUBUILD_RUNTIME_FILENAME: "kubuild-runtime.js";',
  'export declare const KUBUILD_RUNTIME_VERSION: string;',
  '',
].join('\n');

writeFileSync('dist/source.js', body.map((line) => `export const ${line};`).join('\n') + '\n');
writeFileSync('dist/source.cjs', body.map((line) => `exports.${line};`).join('\n') + '\n');
writeFileSync('dist/source.d.ts', types);
writeFileSync('dist/source.d.cts', types);
console.log(`emit-source: kubuild-runtime.js ${(source.length / 1024).toFixed(1)} KiB`);
