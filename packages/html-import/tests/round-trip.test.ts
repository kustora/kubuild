/**
 * @kubuild/html-import
 * Round-trip tests: `generateStandaloneHtml` → `importHtml` → `compareDocumentsSemantically` (STORA-619).
 *
 * The renderer is imported from source as a test-only dependency so `@kubuild/html-import`
 * never depends on `@kubuild/renderer` at runtime.
 */

import { describe, it, expect } from 'vitest';
import {
  CURRENT_SCHEMA_VERSION,
  starterPageFixture,
  type PageDocument,
} from '@kubuild/schema';
import { compareDocumentsSemantically, type SemanticCompareOptions } from '@kubuild/core';
import { importHtml } from '../src/index.js';
import { generateStandaloneHtml } from '../../renderer/src/code-generator.js';

/**
 * Allowed differences for an HTML round-trip. Everything else (structure, order, types,
 * main props, per-breakpoint and state styles) must survive.
 */
const HTML_ROUND_TRIP_OPTIONS: SemanticCompareOptions = {
  // Importer assigns deterministic `node-*` IDs; HTML carries no node identity.
  ignoreNodeIds: true,
  // Only title/description/lang are representable in standalone HTML.
  ignoreMetadataKeys: ['author', 'tags', 'category', 'version', 'thumbnail', 'locale'],
  // Both render as <p>; a flex `container` and `flex` both render as a display:flex <div>.
  typeAliases: [
    ['text', 'paragraph'],
    ['container', 'flex'],
  ],
  ignoreProps: {
    // Page title is emitted as <title> (metadata.title), not as a page prop.
    page: ['title'],
    // Not emitted by the code generator.
    container: ['maxWidth'],
    text: ['as'],
    image: ['asset', 'width', 'height', 'loading'],
    // Generator default attribute (`type="button"`).
    button: ['type'],
    // Importer also writes the legacy `ordered` alias next to canonical `tag`.
    list: ['ordered'],
  },
  // css-tree drops optional whitespace (`rgba(0, 0, 0, .1)` → `rgba(0,0,0,.1)`).
  normalizeStyleWhitespace: true,
};

async function roundTrip(doc: PageDocument) {
  const html = generateStandaloneHtml(doc, { cssOptions: { includeReset: false } });
  const result = await importHtml(html);
  expect(result.success, result.error).toBe(true);
  return { html, result, comparison: compareDocumentsSemantically(doc, result.document!, HTML_ROUND_TRIP_OPTIONS) };
}

const responsiveFixture: PageDocument = {
  schema: 'stora.page',
  version: CURRENT_SCHEMA_VERSION,
  metadata: { title: 'Responsive Fixture', description: 'Breakpoints and states' },
  document: {
    id: 'root',
    type: 'page',
    props: {},
    styles: { base: { minHeight: '100vh', backgroundColor: '#ffffff', color: '#0f172a' } },
    children: [
      {
        id: 'hero',
        type: 'section',
        props: {},
        styles: {
          base: { paddingTop: '96px', paddingBottom: '96px' },
          tablet: { paddingTop: '64px', paddingBottom: '64px' },
          mobile: { paddingTop: '32px', paddingBottom: '32px' },
        },
        children: [
          {
            id: 'title',
            type: 'heading',
            props: { text: 'Responsive title', level: 2 },
            styles: { base: { fontSize: '40px' }, tablet: { fontSize: '32px' }, mobile: { fontSize: '24px' } },
            children: [],
          },
          {
            id: 'intro',
            type: 'paragraph',
            props: { text: 'Intro copy' },
            styles: { base: { color: '#475569' } },
            children: [],
          },
          {
            id: 'cta',
            type: 'button',
            props: { label: 'Start now' },
            styles: {
              base: { backgroundColor: '#2563eb', color: '#ffffff', paddingTop: '12px', paddingBottom: '12px' },
              states: { ':hover': { backgroundColor: '#1d4ed8' } },
            },
            children: [],
          },
        ],
      },
      {
        id: 'features',
        type: 'list',
        props: { tag: 'ul' },
        styles: {},
        children: [
          { id: 'f1', type: 'list-item', props: { text: 'Fast' }, styles: {}, children: [] },
          { id: 'f2', type: 'list-item', props: { text: 'Portable' }, styles: {}, children: [] },
        ],
      },
      {
        id: 'more',
        type: 'link',
        props: { text: 'Read the docs', href: 'https://example.com/docs' },
        styles: {},
        children: [],
      },
      { id: 'rule', type: 'divider', props: {}, styles: {}, children: [] },
    ],
  },
};

describe('HTML round-trip: generateStandaloneHtml → importHtml (STORA-619)', () => {
  it('starter page fixture survives the round-trip semantically', async () => {
    const { comparison } = await roundTrip(starterPageFixture);
    expect(comparison.differences).toEqual([]);
    expect(comparison.equivalent).toBe(true);
  });

  it('preserves per-breakpoint overrides, hover states, lists, links and dividers', async () => {
    const { comparison } = await roundTrip(responsiveFixture);
    expect(comparison.differences).toEqual([]);
  });

  it('hoists the exported <main> page root instead of adding a wrapper section', async () => {
    const { result } = await roundTrip(starterPageFixture);
    const root = result.document!.document;
    expect(root.type).toBe('page');
    expect(root.children?.[0]?.type).toBe('section');
    expect(root.styles?.base?.backgroundColor).toBe('#ffffff');
  });

  it('does not repeat inherited text styles on descendants', async () => {
    const { result } = await roundTrip(starterPageFixture);
    const section = result.document!.document.children![0];
    expect(section.styles?.base?.fontFamily).toBeUndefined();
    expect(section.styles?.base?.color).toBeUndefined();
  });

  it('reports real differences when the allowances do not cover them', async () => {
    const { result } = await roundTrip(starterPageFixture);
    const strict = compareDocumentsSemantically(starterPageFixture, result.document!);
    expect(strict.equivalent).toBe(false);
    expect(strict.differences.some((d) => d.kind === 'NODE_TYPE')).toBe(true);
  });
});
