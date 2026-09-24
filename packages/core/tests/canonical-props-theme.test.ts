import { describe, it, expect } from 'vitest';
import {
  CURRENT_SCHEMA_VERSION,
  PROJECT_SCHEMA_NAME,
  type PageDocument,
  type Node,
} from '@kubuild/schema';
import {
  migrateDocument,
  canonicalizeTextPropsInPlace,
  loadProjectDocument,
  validateDocument,
  updateTheme,
  exportPackage,
  importPackage,
  findNodeById,
} from '../src';

function legacyDoc(children: Node[], version = '1.1.0'): Record<string, unknown> {
  return {
    schema: 'stora.page',
    version,
    metadata: { title: 'Legacy', description: '', author: '', tags: [], category: 'general', version: '1.0.0' },
    document: { id: 'root', type: 'page', props: {}, styles: {}, children },
  };
}

const LEGACY_CHILDREN: Node[] = [
  { id: 'p1', type: 'paragraph', props: { content: 'Para' } },
  { id: 't1', type: 'text', props: { content: 'Block text' } },
  { id: 't2', type: 'text', props: { content: 'Inline', as: 'span' } },
  { id: 'h1', type: 'heading', props: { text: 'Kept', content: 'Dropped', level: 2 } },
  { id: 'b1', type: 'badge', props: { label: 'NEW' } },
  { id: 'l1', type: 'link', props: { label: 'Go', href: '/x' } },
  { id: 'q1', type: 'blockquote', props: { quote: 'Shown before', text: 'Hidden before' } },
  { id: 'btn', type: 'button', props: { text: 'Buy' } },
  { id: 'img', type: 'image', props: { src: '/a.png', label: 'not a text component' } },
];

describe('STORA-550: canonical text prop migration (1.1.0 -> 1.2.0)', () => {
  it('bumps CURRENT_SCHEMA_VERSION to 1.2.0 with a registered 1.1.0 -> 1.2.0 step', () => {
    expect(CURRENT_SCHEMA_VERSION).toBe('1.2.0');
    const result = migrateDocument(legacyDoc([]));
    expect(result.success).toBe(true);
    expect(result.diagnostic.migrationPath).toEqual(['1.1.0', '1.2.0']);
  });

  it('dry-run reports the path and the would-be renames without producing a document', () => {
    const raw = legacyDoc(LEGACY_CHILDREN);
    const snapshot = JSON.parse(JSON.stringify(raw));
    const result = migrateDocument(raw, { dryRun: true });

    expect(result.success).toBe(true);
    expect(result.document).toBeUndefined();
    expect(result.diagnostic.dryRun).toBe(true);
    expect(result.diagnostic.stepsApplied).toBe(1);
    const warning = result.diagnostic.warnings?.find((w) => w.code === 'PROP_ALIAS_MIGRATED');
    expect(warning?.step).toBe('1.1.0->1.2.0');
    expect(warning?.paths).toContain('document.children.0.props.content');
    expect(raw).toEqual(snapshot); // input untouched
  });

  it('apply renames aliases to canonical names, preserving what the old renderer displayed', () => {
    const result = migrateDocument(legacyDoc(LEGACY_CHILDREN));
    expect(result.success).toBe(true);
    const doc = result.document!;
    expect(doc.version).toBe('1.2.0');
    const props = (id: string) => findNodeById(doc.document, id)?.props;

    expect(props('p1')).toEqual({ text: 'Para' });
    // content-only text nodes rendered as <p>; keep that
    expect(props('t1')).toEqual({ text: 'Block text', as: 'p' });
    expect(props('t2')).toEqual({ text: 'Inline', as: 'span' });
    // canonical already present wins, alias dropped
    expect(props('h1')).toEqual({ text: 'Kept', level: 2 });
    expect(props('b1')).toEqual({ text: 'NEW' });
    expect(props('l1')).toEqual({ text: 'Go', href: '/x' });
    // legacy blockquote rendered `quote` first
    expect(props('q1')).toEqual({ text: 'Shown before' });
    expect(props('btn')).toEqual({ label: 'Buy' });
    // unrelated components untouched
    expect(props('img')).toEqual({ src: '/a.png', label: 'not a text component' });

    const warning = result.diagnostic.warnings?.find((w) => w.code === 'PROP_ALIAS_MIGRATED');
    expect(warning?.paths?.length).toBe(8);
  });

  it('migrates older documents through the whole chain', () => {
    const result = migrateDocument(legacyDoc([{ id: 'p1', type: 'paragraph', props: { content: 'Old' } }], '1.0.0'));
    expect(result.success).toBe(true);
    expect(result.diagnostic.migrationPath).toEqual(['1.0.0', '1.1.0', '1.2.0']);
    expect(findNodeById(result.document!.document, 'p1')?.props).toEqual({ text: 'Old' });
  });

  it('canonicalizeTextPropsInPlace walks nested children', () => {
    const tree = {
      id: 'root',
      type: 'page',
      children: [{ id: 's', type: 'section', children: [{ id: 'b', type: 'badge', props: { label: 'x' } }] }],
    };
    expect(canonicalizeTextPropsInPlace(tree)).toEqual(['document.children.0.children.0.props.label']);
    expect(tree.children[0].children[0].props).toEqual({ text: 'x' });
  });

  it('loadProjectDocument migrates legacy artboard documents', () => {
    const page = legacyDoc([{ id: 'p1', type: 'paragraph', props: { content: 'In project' } }]);
    const result = loadProjectDocument({
      schema: PROJECT_SCHEMA_NAME,
      version: '1.0.0',
      artboards: [{ id: 'a1', name: 'Home', artboardType: 'page', document: page }],
    });
    expect(result.success).toBe(true);
    const artboardDoc = result.project!.artboards[0].document;
    expect(artboardDoc.version).toBe('1.2.0');
    expect(findNodeById(artboardDoc.document, 'p1')?.props).toEqual({ text: 'In project' });
  });
});

function currentDoc(theme?: unknown): PageDocument {
  return {
    schema: 'stora.page',
    version: CURRENT_SCHEMA_VERSION,
    ...(theme !== undefined ? { theme } : {}),
    document: {
      id: 'root',
      type: 'page',
      props: {},
      styles: {},
      children: [
        {
          id: 'hero',
          type: 'section',
          props: {},
          styles: { base: { backgroundColor: 'var(--kb-color-primary)', borderRadius: 'var(--kb-radius-md)' } },
          children: [],
        },
      ],
    },
  } as PageDocument;
}

describe('STORA-551: document theme', () => {
  it('accepts a theme and token references in node styles', () => {
    const doc = currentDoc({
      colors: { primary: '#2563eb', 'text-muted': 'rgb(100, 116, 139)' },
      fonts: { body: '"Inter", sans-serif' },
      radii: { md: 8 },
      spacing: { lg: '24px' },
    });
    const result = validateDocument(doc);
    expect(result.valid).toBe(true);
    expect(result.data?.theme?.colors?.primary).toBe('#2563eb');
  });

  it.each([
    ['declaration break-out', { colors: { primary: 'red; } body { display:none' } }],
    ['markup', { colors: { primary: '</style><script>alert(1)</script>' } }],
    ['javascript url', { colors: { primary: 'url(javascript:alert(1))' } }],
    ['css url()', { fonts: { body: 'url(https://evil.example/x.woff)' } }],
    ['expression()', { colors: { primary: 'expression(alert(1))' } }],
    ['@import', { fonts: { body: '@import "x"' } }],
    ['backslash escape', { colors: { primary: '\\3c script' } }],
    ['unsafe key', { colors: { 'a;b': '#fff' } }],
    ['prototype key', { colors: { __proto__x: '#fff' } }],
    ['non-finite number', { spacing: { lg: Number.POSITIVE_INFINITY } }],
  ])('rejects theme injection: %s', (_label, theme) => {
    const result = validateDocument(currentDoc(theme));
    expect(result.valid).toBe(false);
  });

  it('updateTheme merges, removes tokens with null and rejects unsafe values', () => {
    const first = updateTheme(currentDoc(), { theme: { colors: { primary: '#111111', accent: '#222222' } } });
    expect(first.event.type).toBe('THEME_UPDATED');
    expect(first.document.theme).toEqual({ colors: { primary: '#111111', accent: '#222222' } });

    const second = updateTheme(first.document, { theme: { colors: { accent: null }, radii: { md: '6px' } } });
    expect(second.document.theme).toEqual({ colors: { primary: '#111111' }, radii: { md: '6px' } });
    expect(first.document.theme).toEqual({ colors: { primary: '#111111', accent: '#222222' } }); // immutable

    expect(() => updateTheme(second.document, { theme: { colors: { primary: 'red;}' } } })).toThrow();
    expect(updateTheme(second.document, { theme: null }).document.theme).toBeUndefined();
  });

  it('keeps the theme through .stora export and import', async () => {
    const doc = currentDoc({ colors: { primary: '#2563eb' }, spacing: { lg: 24 } });
    const exported = await exportPackage(doc);
    if (!exported.success) throw new Error(exported.diagnosticMessage);
    expect(exported.page.theme).toEqual({ colors: { primary: '#2563eb' }, spacing: { lg: 24 } });
    const imported = await importPackage(exported.archive);
    if (!imported.success) throw new Error(JSON.stringify(imported));
    expect(imported.document.theme).toEqual({ colors: { primary: '#2563eb' }, spacing: { lg: 24 } });
  });
});
