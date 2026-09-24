import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { createDefaultComponentRegistry, STARTER_BLOCKS } from '@kubuild/components';
import type { BlockDefinition } from '@kubuild/components';
import { createBlankDocument, insertNode, findNodeById } from '@kubuild/core';
import { TemplateRecordSchema } from '@kubuild/schema';
import type { PageDocument, TemplateRecord } from '@kubuild/schema';
import * as editorApi from '../src';
import { useEditorStore, resolveBlockRegistry } from '../src/store';
import { BlocksPanel } from '../src/components/panels/blocks-panel';
import { createEditorSaveController } from '../src/components/layout/save-controller';
import { createEditorHandle } from '../src/components/layout/editor-handle';
import { TemplatePicker, resolveTemplateThumbnailUrl } from '../src/components/templates/template-picker';
import { KubuildEditor } from '../src/components/layout/editor';
import { getMissingTemplateComponents } from '../src/utils/template-requirements';

const registry = createDefaultComponentRegistry();

const hostBlock: BlockDefinition = {
  id: 'host-faq',
  name: 'Host FAQ',
  category: 'host-sales',
  categoryLabel: 'Sales Sections',
  description: 'FAQ section from the host',
  thumbnailSvg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10"/></svg>',
  createNodeTree: (gen = (p = 'node') => `${p}-x`) => ({
    id: gen('section'),
    type: 'section',
    props: {},
    children: [{ id: gen('heading'), type: 'heading', props: { text: 'FAQ', level: 2 } }],
  }),
};

function docWithHeading(text = 'Original'): PageDocument {
  const doc = createBlankDocument('Host API');
  doc.document.children = [{ id: 'h1', type: 'heading', props: { text, level: 1 } }];
  return doc;
}

function makeTemplate(overrides: Partial<Record<string, unknown>> = {}): TemplateRecord {
  const doc = createBlankDocument('Template');
  doc.document.children = [
    { id: 'tpl-heading', type: 'heading', props: { text: 'From template', level: 1 } },
  ];
  return TemplateRecordSchema.parse({
    id: 'tpl-landing',
    name: 'Landing',
    description: 'A landing page',
    category: 'landing',
    tags: ['sales'],
    document: doc,
    ...overrides,
  });
}

const insertText = (id: string) =>
  useEditorStore.getState().dispatch((doc) =>
    insertNode(doc, { parentId: doc.document.id, node: { id, type: 'text', props: { text: id } } }),
  );

beforeEach(() => {
  useEditorStore.getState().setBlockRegistry(resolveBlockRegistry());
  useEditorStore.getState().setDocument(docWithHeading());
});

describe('STORA-535: block registry', () => {
  it('append keeps starters, appends host blocks and overrides by id', () => {
    const override: BlockDefinition = { ...STARTER_BLOCKS[0], name: 'Overridden' };
    const result = resolveBlockRegistry([hostBlock, override], 'append');
    expect(result).toHaveLength(STARTER_BLOCKS.length + 1);
    expect(result[0].name).toBe('Overridden');
    expect(result[result.length - 1].id).toBe('host-faq');
  });

  it('replace uses only host blocks (deduplicated by id)', () => {
    const dup = { ...hostBlock, name: 'Second' };
    expect(resolveBlockRegistry([hostBlock, dup], 'replace').map((b) => b.name)).toEqual(['Second']);
    expect(resolveBlockRegistry(undefined, 'replace')).toHaveLength(STARTER_BLOCKS.length);
  });

  it('insertBlock(id) reads host blocks from the store registry', () => {
    const store = useEditorStore.getState();
    expect(store.insertBlock('host-faq').success).toBe(false);

    store.setBlockRegistry(resolveBlockRegistry([hostBlock]));
    const result = useEditorStore.getState().insertBlock('host-faq', 'root-page');
    expect(result.success).toBe(true);
    const inserted = findNodeById(useEditorStore.getState().document.document, result.nodeId!);
    expect(inserted?.type).toBe('section');
    expect(useEditorStore.getState().getBlockDefinition(STARTER_BLOCKS[0].id)).toBeDefined();
  });

  it('replace mode drops starter ids from insertBlock', () => {
    useEditorStore.getState().setBlockRegistry(resolveBlockRegistry([hostBlock], 'replace'));
    expect(useEditorStore.getState().insertBlock(STARTER_BLOCKS[0].id).success).toBe(false);
  });

  it('BlocksPanel renders host categories as labelled groups with SVG thumbnails', () => {
    // SSR reads the store's initial snapshot (zustand getServerSnapshot), so the resolved
    // registry is passed explicitly here; the store path is covered by insertBlock above.
    const html = renderToString(
      <BlocksPanel registry={registry} blocks={resolveBlockRegistry([hostBlock])} />,
    );
    expect(html).toContain('data-block-category="host-sales"');
    expect(html).toContain('Sales Sections');
    expect(html).toContain('data-block-id="host-faq"');
    expect(html).toContain('data-testid="block-thumbnail-svg"');
    expect(html).toContain('data:image/svg+xml;charset=utf-8,%3Csvg');
    // Starters are still listed in append mode.
    expect(html).toContain(`data-block-id="${STARTER_BLOCKS[0].id}"`);
  });
});

describe('STORA-538: replaceDocument / EditorHandle', () => {
  it('rejects an invalid document with validation errors and keeps the current one', () => {
    const before = useEditorStore.getState().document;
    const bad = { ...docWithHeading(), document: { id: '', type: 'page' } } as unknown as PageDocument;
    const result = useEditorStore.getState().replaceDocument(bad, { registry });
    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(useEditorStore.getState().document).toBe(before);
  });

  it('replace → undo restores the previous document when keepHistory is true', () => {
    const handle = createEditorHandle(useEditorStore, { registry: () => registry });
    const original = handle.getDocument();
    useEditorStore.getState().selectNode('h1');

    const next = docWithHeading('Replaced');
    const result = handle.replaceDocument(next, { keepHistory: true });
    expect(result.success).toBe(true);
    expect(findNodeById(handle.getDocument().document, 'h1')?.props?.text).toBe('Replaced');
    // Selection survives because the node id still exists.
    expect(useEditorStore.getState().selectedNodeId).toBe('h1');
    expect(handle.canUndo()).toBe(true);
    expect(handle.isDirty()).toBe(true);

    handle.undo();
    expect(handle.getDocument()).toEqual(original);
    handle.redo();
    expect(findNodeById(handle.getDocument().document, 'h1')?.props?.text).toBe('Replaced');
  });

  it('replace without keepHistory resets history', () => {
    insertText('t1');
    expect(useEditorStore.getState().canUndo).toBe(true);
    const handle = createEditorHandle(useEditorStore, { registry: () => registry });
    expect(handle.replaceDocument(docWithHeading('Fresh')).success).toBe(true);
    expect(handle.canUndo()).toBe(false);
    expect(handle.isDirty()).toBe(false);
  });

  it('isolates the store from later mutation of the host document', () => {
    const next = docWithHeading('Host');
    useEditorStore.getState().replaceDocument(next);
    next.document.children![0].props!.text = 'mutated';
    expect(findNodeById(useEditorStore.getState().document.document, 'h1')?.props?.text).toBe('Host');
  });

  it('handle.insertBlock accepts a definition or an id plus target', () => {
    const handle = createEditorHandle(useEditorStore, { registry: () => registry });
    expect(handle.insertBlock(hostBlock, 'root-page').success).toBe(true);
    expect(handle.insertBlock(STARTER_BLOCKS[0].id, 'root-page').success).toBe(true);
    expect(useEditorStore.getState().document.document.children).toHaveLength(3);
  });

  it('handle.save resolves false without a save function', async () => {
    const handle = createEditorHandle(useEditorStore, { registry: () => registry });
    await expect(handle.save()).resolves.toBe(false);
  });
});

describe('STORA-536: templates', () => {
  it('applyTemplate replaces the page with fresh ids and is undoable', () => {
    const original = useEditorStore.getState().document;
    const result = useEditorStore.getState().applyTemplate(makeTemplate(), { registry });
    expect(result.success).toBe(true);
    const doc = useEditorStore.getState().document;
    expect(doc).toBe(result.document);
    expect(findNodeById(doc.document, 'tpl-heading')).toBeNull();
    expect(doc.document.children?.[0].props?.text).toBe('From template');

    useEditorStore.getState().undo();
    expect(useEditorStore.getState().document).toEqual(original);
  });

  it('refuses templates whose required components are not registered', () => {
    const template = makeTemplate({
      requirements: { requiredComponents: ['host-product-card'], requiredCapabilities: [] },
    });
    expect(getMissingTemplateComponents(template, registry)).toEqual(['host-product-card']);
    const before = useEditorStore.getState().document;
    const result = useEditorStore.getState().applyTemplate(template, { registry });
    expect(result.success).toBe(false);
    expect(result.missingComponents).toEqual(['host-product-card']);
    expect(useEditorStore.getState().document).toBe(before);
  });

  it('reports a template without an inline document as an error', () => {
    const template = makeTemplate({ document: undefined });
    const result = useEditorStore.getState().applyTemplate(template, { registry });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/inline document/);
  });

  it('TemplatePicker renders cards, a category filter, a preview and flags missing components', () => {
    const blocked = makeTemplate({
      id: 'tpl-checkout',
      name: 'Checkout',
      category: 'checkout',
      thumbnail: 'https://cdn.example.com/checkout.png',
      requirements: { requiredComponents: ['host-order-form'], requiredCapabilities: [] },
    });
    const html = renderToString(
      <TemplatePicker templates={[makeTemplate(), blocked]} registry={registry} onApply={() => {}} />,
    );
    expect(html).toContain('data-testid="template-picker"');
    expect(html).toContain('data-template-id="tpl-landing"');
    expect(html).toContain('data-template-id="tpl-checkout"');
    expect(html).toContain('data-testid="template-category"');
    expect(html).toContain('#sales');
    expect(html).toContain('https://cdn.example.com/checkout.png');
    expect(html).toContain('Missing components: host-order-form');
    // The first (applicable) template is previewed with the real renderer.
    expect(html).toContain('data-testid="template-preview"');
    expect(html).toContain('From template');
  });

  it('resolveTemplateThumbnailUrl drops unsafe URLs', () => {
    expect(resolveTemplateThumbnailUrl('javascript:alert(1)')).toBeNull();
    expect(resolveTemplateThumbnailUrl({ url: 'https://a.test/x.png' })).toBe('https://a.test/x.png');
    expect(
      resolveTemplateThumbnailUrl({ type: 'asset', assetId: 'a', fallbackUrl: 'https://a.test/y.png' }),
    ).toBe('https://a.test/y.png');
    expect(resolveTemplateThumbnailUrl({ type: 'asset', assetId: 'a' })).toBeNull();
  });
});

describe('STORA-537: save controller', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('resets isDirty after a successful onSave and reports dirty transitions', async () => {
    const onSave = vi.fn();
    const onDirtyChange = vi.fn();
    const controller = createEditorSaveController(useEditorStore, {
      onSave: () => onSave,
      onDirtyChange: () => onDirtyChange,
    });

    insertText('t1');
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);

    await expect(controller.save()).resolves.toBe(true);
    expect(onSave).toHaveBeenCalledWith(useEditorStore.getState().document);
    expect(useEditorStore.getState().isDirty).toBe(false);
    expect(onDirtyChange).toHaveBeenLastCalledWith(false);
    expect(controller.getState().status).toBe('saved');
    controller.dispose();
  });

  it('stays dirty when the document changed while the save was in flight', async () => {
    let resolveSave!: () => void;
    const controller = createEditorSaveController(useEditorStore, {
      onSave: () => () => new Promise<void>((resolve) => (resolveSave = resolve)),
    });
    insertText('t1');
    const pending = controller.save();
    expect(controller.getState().status).toBe('saving');
    insertText('t2');
    resolveSave();
    await pending;
    expect(useEditorStore.getState().isDirty).toBe(true);
    controller.dispose();
  });

  it('marks the save as failed and keeps the editor dirty when onSave rejects', async () => {
    const controller = createEditorSaveController(useEditorStore, {
      onSave: () => () => Promise.reject(new Error('offline')),
    });
    insertText('t1');
    await expect(controller.save()).resolves.toBe(false);
    expect(controller.getState().status).toBe('error');
    expect((controller.getState().error as Error).message).toBe('offline');
    expect(useEditorStore.getState().isDirty).toBe(true);
    controller.dispose();
  });

  it('queues a save requested while another is in flight', async () => {
    const saved: PageDocument[] = [];
    let release!: () => void;
    const controller = createEditorSaveController(useEditorStore, {
      onSave: () => async (doc) => {
        saved.push(doc);
        if (saved.length === 1) await new Promise<void>((resolve) => (release = resolve));
      },
    });
    insertText('t1');
    const first = controller.save();
    insertText('t2');
    const second = controller.save();
    expect(controller.save()).toBe(second);
    release();
    await first;
    await second;
    expect(saved).toHaveLength(2);
    expect(saved[1]).toBe(useEditorStore.getState().document);
    expect(useEditorStore.getState().isDirty).toBe(false);
    controller.dispose();
  });

  it('autosaves after the debounce window following the last edit', async () => {
    vi.useFakeTimers();
    const onSave = vi.fn();
    const controller = createEditorSaveController(useEditorStore, {
      onSave: () => onSave,
      autosave: () => ({ debounceMs: 500 }),
    });
    insertText('t1');
    vi.advanceTimersByTime(300);
    insertText('t2');
    vi.advanceTimersByTime(300);
    expect(onSave).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(250);
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(useEditorStore.getState().isDirty).toBe(false);
    controller.dispose();
  });

  it('markSaved(doc) only clears dirty when doc is still current', () => {
    insertText('t1');
    const snapshot = useEditorStore.getState().document;
    insertText('t2');
    useEditorStore.getState().markSaved(snapshot);
    expect(useEditorStore.getState().isDirty).toBe(true);
    useEditorStore.getState().markSaved();
    expect(useEditorStore.getState().isDirty).toBe(false);
  });
});

describe('KubuildEditor host integration props', () => {
  it('renders the Save button/status only with onSave, and Templates only with templates', () => {
    const plain = renderToString(<KubuildEditor registry={registry} />);
    expect(plain).not.toContain('data-testid="toolbar-save"');
    expect(plain).not.toContain('data-testid="toolbar-templates"');

    const html = renderToString(
      <KubuildEditor registry={registry} onSave={() => {}} templates={[makeTemplate()]} />,
    );
    expect(html).toContain('data-testid="toolbar-save"');
    expect(html).toContain('data-testid="save-status"');
    expect(html).toContain('data-testid="toolbar-templates"');
  });

  it('accepts a ref (forwardRef) and exports the host API', () => {
    const ref = React.createRef<editorApi.EditorHandle>();
    expect(() => renderToString(<KubuildEditor ref={ref} registry={registry} />)).not.toThrow();
    expect(typeof editorApi.TemplatePicker).toBe('function');
    expect(typeof editorApi.TemplatePickerDialog).toBe('function');
    expect(typeof editorApi.ConfirmDialog).toBe('function');
    expect(typeof editorApi.createEditorHandle).toBe('function');
    expect(typeof editorApi.createEditorSaveController).toBe('function');
    expect(typeof editorApi.resolveBlockRegistry).toBe('function');
    expect(typeof editorApi.getMissingTemplateComponents).toBe('function');
  });
});
