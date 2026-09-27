#!/usr/bin/env node
// Type-checks the built `dist` declarations the way an external backend sees them: a consumer
// project using `module/moduleResolution: NodeNext`, once as ESM and once as CommonJS, with
// `skipLibCheck: false`. Guards against extensionless relative re-exports in `.d.ts` files and
// against CJS consumers resolving ESM-only declarations.
//
// Run after `pnpm run build`: node scripts/check-nodenext-consumer.mjs
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const tsc = join(root, 'node_modules', '.bin', 'tsc');
const packages = ['schema', 'core', 'components', 'renderer', 'editor', 'react', 'ai'];

const source = `
import { CURRENT_SCHEMA_VERSION, SCHEMA_NAME, type PageDocument } from '@kubuild/schema';
import type { PageDocument as TypesOnlyPageDocument } from '@kubuild/schema/types';
import { validateDocument } from '@kubuild/schema/validate';
import * as core from '@kubuild/core';
import * as components from '@kubuild/components';
import * as blocks from '@kubuild/components/blocks';
import * as renderer from '@kubuild/renderer';
import * as editor from '@kubuild/editor';
import * as react from '@kubuild/react';
import * as ai from '@kubuild/ai';
import * as aiServer from '@kubuild/ai/server';

const version: string = CURRENT_SCHEMA_VERSION;
const name: 'stora.page' = SCHEMA_NAME;
declare const doc: PageDocument;
const typesOnly: TypesOnlyPageDocument = doc;
type Exported =
  | keyof typeof core
  | keyof typeof components
  | keyof typeof blocks
  | keyof typeof renderer
  | keyof typeof editor
  | keyof typeof react
  | keyof typeof ai
  | keyof typeof aiServer;
export type { Exported };
export { version, name, typesOnly, validateDocument };
`;

const workDir = mkdtempSync(join(tmpdir(), 'kubuild-nodenext-'));
let failed = false;
try {
  for (const type of ['module', 'commonjs']) {
    const dir = join(workDir, type);
    mkdirSync(join(dir, 'node_modules', '@kubuild'), { recursive: true });
    for (const pkg of packages) {
      symlinkSync(join(root, 'packages', pkg), join(dir, 'node_modules', '@kubuild', pkg), 'dir');
    }
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ type }));
    writeFileSync(
      join(dir, 'tsconfig.json'),
      JSON.stringify({
        compilerOptions: {
          module: 'NodeNext',
          moduleResolution: 'NodeNext',
          strict: true,
          noEmit: true,
          skipLibCheck: false,
          types: [],
        },
        include: ['index.ts'],
      }),
    );
    writeFileSync(join(dir, 'index.ts'), source);

    try {
      execFileSync(tsc, ['-p', dir], { stdio: 'pipe' });
      console.log(`NodeNext ${type} consumer: OK`);
    } catch (error) {
      failed = true;
      console.error(`NodeNext ${type} consumer: FAILED`);
      console.error(String(error.stdout ?? error));
    }
  }
} finally {
  rmSync(workDir, { recursive: true, force: true });
}

process.exit(failed ? 1 : 0);
