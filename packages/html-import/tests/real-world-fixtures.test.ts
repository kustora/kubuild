/**
 * @kubuild/html-import
 * Real-world HTML fixture suite (STORA-620): plain CSS landing page, Bootstrap, static
 * Webflow/Framer exports and AI-generated Tailwind markup. Snapshots a timing-free summary
 * of `HtmlImportReport` so fidelity regressions/improvements show up as snapshot diffs.
 */

import { describe, expect, it } from 'vitest';
import { importHtml } from '../src/index.js';
import { expectSafeDocument, readFixture, summarizeImport } from './fixture-helpers.js';

const IMPORT_OPTIONS = { baseUrl: 'https://site.example.com/' } as const;

const REAL_WORLD_FIXTURES = [
  'landing-plain-css.html',
  'bootstrap.html',
  'webflow-export.html',
  'framer-export.html',
  // Tailwind utility classes are mapped to portable styles (STORA-622).
  'ai-tailwind.html',
] as const;

describe('real-world HTML fixtures (STORA-620)', () => {
  it.each(REAL_WORLD_FIXTURES)('%s imports into a safe, schema-valid document', async (name) => {
    const result = await importHtml(readFixture('real-world', name), IMPORT_OPTIONS);

    const document = expectSafeDocument(result);
    expect(document.document.type).toBe('page');
    expect(result.report.stats.nodeCount).toBeGreaterThan(10);
    expect(result.report.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    expect(summarizeImport(result)).toMatchSnapshot();
  });

  it('imports the typical landing page in under one second', async () => {
    const html = readFixture('real-world', 'landing-plain-css.html');
    const start = performance.now();
    const result = await importHtml(html, IMPORT_OPTIONS);
    const elapsed = performance.now() - start;

    expect(result.success).toBe(true);
    expect(elapsed).toBeLessThan(1000);
  });
});
