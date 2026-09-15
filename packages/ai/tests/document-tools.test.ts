import { describe, it, expect } from 'vitest';
import type { PageDocument } from '@kubuild/schema';
import { createDocumentTools, type AgentTool, type ToolExecutionContext } from '../src/server/tools';
import type { AiCompiledComponentSpec } from '../src/types';

const CATALOG: AiCompiledComponentSpec[] = [
  { type: 'page', label: 'Page', category: 'layout', acceptsChildren: true },
  { type: 'section', label: 'Section', category: 'layout', acceptsChildren: true },
  {
    type: 'container',
    label: 'Container',
    category: 'layout',
    acceptsChildren: true,
    allowedChildren: ['heading', 'button', 'paragraph'],
  },
  { type: 'heading', label: 'Heading', category: 'content', acceptsChildren: false },
  { type: 'paragraph', label: 'Paragraph', category: 'content', acceptsChildren: false },
  { type: 'button', label: 'Button', category: 'content', acceptsChildren: false },
  { type: 'image', label: 'Image', category: 'media', acceptsChildren: false },
];

function makeDocument(): PageDocument {
  return {
    schema: 'stora.page',
    version: '1.0.0',
    metadata: { title: 'Landing', description: 'demo', tags: [], category: 'landing', version: '1.0.0' },
    document: {
      id: 'root-page',
      type: 'page',
      styles: { base: { backgroundColor: '#ffffff' } },
      children: [
        {
          id: 'hero',
          type: 'section',
          children: [
            {
              id: 'hero-box',
              type: 'container',
              children: [
                { id: 'hero-title', type: 'heading', props: { text: 'Bangun website cepat', level: 1 } },
                {
                  id: 'cta-btn',
                  type: 'button',
                  props: { label: 'Coba Gratis' },
                  styles: { base: { backgroundColor: '#3b82f6', color: '#ffffff' } },
                },
              ],
            },
          ],
        },
        { id: 'footer', type: 'section', children: [] },
      ],
    },
  } as PageDocument;
}

function tool(name: string): AgentTool {
  const found = createDocumentTools().find((t) => t.definition.name === name);
  if (!found) throw new Error(`tool ${name} not registered`);
  return found;
}

function makeContext(overrides: Partial<ToolExecutionContext> = {}): ToolExecutionContext {
  return { document: makeDocument(), catalog: CATALOG, ...overrides };
}

describe('document read tools (STORA-530)', () => {
  it('get_page_outline renders every node with id, type and label', async () => {
    const result = await tool('get_page_outline').execute({}, makeContext());
    const outline = (result.content as { outline: string }).outline;

    expect(result.ok).toBe(true);
    expect(outline).toContain('#cta-btn (button) "Coba Gratis"');
    expect(outline).toContain('#hero (section)');
  });

  it('read_node returns props, parent, position and siblings without the subtree by default', async () => {
    const result = await tool('read_node').execute({ nodeId: 'cta-btn' }, makeContext());
    const payload = result.content as Record<string, any>;

    expect(result.ok).toBe(true);
    expect(payload.node.props.label).toBe('Coba Gratis');
    expect(payload.parentId).toBe('hero-box');
    expect(payload.index).toBe(1);
    expect(payload.ancestors.map((a: any) => a.id)).toEqual(['root-page', 'hero', 'hero-box']);
    expect(payload.siblings.map((s: any) => s.id)).toEqual(['hero-title', 'cta-btn']);
  });

  it('read_node rejects an invented node id and suggests real ones', async () => {
    const result = await tool('read_node').execute({ nodeId: 'cta-button' }, makeContext());
    const payload = result.content as Record<string, any>;

    expect(result.ok).toBe(false);
    expect(payload.error).toContain('cta-button');
    expect(payload.suggestedNodeIds).toContain('cta-btn');
  });

  it('find_nodes matches on type and visible text', async () => {
    const result = await tool('find_nodes').execute(
      { type: 'button', textContains: 'gratis' },
      makeContext(),
    );
    const payload = result.content as Record<string, any>;

    expect(payload.matches).toEqual([{ id: 'cta-btn', type: 'button', label: 'Coba Gratis' }]);
  });

  it('find_nodes refuses an unfiltered search', async () => {
    const result = await tool('find_nodes').execute({}, makeContext());
    expect(result.ok).toBe(false);
  });
});

describe('document write tools (STORA-530)', () => {
  it('update_node_props emits a surgical op and leaves the rest of the tree untouched', async () => {
    const context = makeContext();
    const result = await tool('update_node_props').execute(
      { nodeId: 'cta-btn', props: { label: 'Mulai Gratis' } },
      context,
    );

    expect(result.ok).toBe(true);
    expect(result.op).toEqual({
      kind: 'update-props',
      nodeId: 'cta-btn',
      props: { label: 'Mulai Gratis' },
      merge: true,
    });

    // The snapshot advanced, but the caller's document object is untouched — the user's
    // canvas is never mutated by a tool call.
    const updated = result.document!.document.children![0].children![0].children![1];
    expect(updated.props?.label).toBe('Mulai Gratis');
    expect(context.document.document.children![0].children![0].children![1].props?.label).toBe(
      'Coba Gratis',
    );
  });

  it('update_node_styles writes a pseudo-state layer when state is given', async () => {
    const result = await tool('update_node_styles').execute(
      { nodeId: 'cta-btn', styles: { backgroundColor: '#15803d' }, state: 'hover' },
      makeContext(),
    );

    expect(result.ok).toBe(true);
    expect(result.op).toMatchObject({ kind: 'update-styles', state: ':hover', nodeId: 'cta-btn' });
    const node = result.document!.document.children![0].children![0].children![1];
    expect(node.styles?.states?.[':hover']).toEqual({ backgroundColor: '#15803d' });
    // The base layer is left alone — that's the whole point of a state write.
    expect(node.styles?.base?.backgroundColor).toBe('#3b82f6');
  });

  it('update_node_styles rejects nested style values instead of silently dropping them', async () => {
    const result = await tool('update_node_styles').execute(
      { nodeId: 'cta-btn', styles: { ':hover': { color: 'red' } } },
      makeContext(),
    );

    expect(result.ok).toBe(false);
    expect((result.content as any).error).toContain('primitives');
  });

  it('update_node_styles rejects breakpoint and state together', async () => {
    const result = await tool('update_node_styles').execute(
      { nodeId: 'cta-btn', styles: { color: 'red' }, breakpoint: 'mobile', state: ':hover' },
      makeContext(),
    );
    expect(result.ok).toBe(false);
  });

  it('insert_component rejects a type that is not in the catalog', async () => {
    const result = await tool('insert_component').execute(
      { parentId: 'hero-box', type: 'carousel-3d' },
      makeContext(),
    );

    expect(result.ok).toBe(false);
    expect((result.content as any).error).toContain('Unknown component type');
  });

  it('insert_component enforces allowedChildren', async () => {
    const result = await tool('insert_component').execute(
      { parentId: 'hero-box', type: 'image' },
      makeContext(),
    );

    expect(result.ok).toBe(false);
    expect((result.content as any).error).toContain('only accepts children');
  });

  it('insert_component refuses to nest inside a leaf component', async () => {
    const result = await tool('insert_component').execute(
      { parentId: 'cta-btn', type: 'heading' },
      makeContext(),
    );

    expect(result.ok).toBe(false);
    expect((result.content as any).error).toContain('cannot contain children');
  });

  it('insert_component assigns a non-colliding id and records an insert op', async () => {
    const result = await tool('insert_component').execute(
      { parentId: 'hero-box', type: 'paragraph', props: { text: 'Tanpa kartu kredit.' }, index: 1 },
      makeContext(),
    );

    expect(result.ok).toBe(true);
    expect(result.op).toMatchObject({ kind: 'insert-node', parentId: 'hero-box', index: 1 });
    const inserted = result.document!.document.children![0].children![0].children![1];
    expect(inserted.type).toBe('paragraph');
    expect(inserted.id).not.toBe('cta-btn');
  });

  it('insert_section delegates to the engine section generator', async () => {
    const context = makeContext({
      generateSection: async () => ({
        id: 'faq',
        type: 'section',
        children: [{ id: 'faq-title', type: 'heading', props: { text: 'FAQ' } }],
      }),
    });

    const result = await tool('insert_section').execute({ prompt: 'section FAQ' }, context);

    expect(result.ok).toBe(true);
    expect(result.op).toMatchObject({ kind: 'insert-node', parentId: 'root-page' });
    expect(result.document!.document.children).toHaveLength(3);
  });

  it('insert_section reports unavailability rather than failing the run', async () => {
    const result = await tool('insert_section').execute({ prompt: 'section FAQ' }, makeContext());
    expect(result.ok).toBe(false);
    expect((result.content as any).error).toContain('not available');
  });

  it('move_node checks nesting rules at the destination', async () => {
    const result = await tool('move_node').execute(
      { nodeId: 'hero-box', targetParentId: 'cta-btn' },
      makeContext(),
    );
    expect(result.ok).toBe(false);
  });

  it('delete_node demands an explicit reason', async () => {
    const withoutReason = await tool('delete_node').execute({ nodeId: 'footer' }, makeContext());
    expect(withoutReason.ok).toBe(false);

    const withReason = await tool('delete_node').execute(
      { nodeId: 'footer', reason: 'user minta hapus footer' },
      makeContext(),
    );
    expect(withReason.ok).toBe(true);
    expect(withReason.op).toEqual({ kind: 'delete-node', nodeId: 'footer' });
  });

  it('delete_node and replace_node are flagged destructive', () => {
    expect(tool('delete_node').destructive).toBe(true);
    expect(tool('replace_node').destructive).toBe(true);
    expect(tool('update_node_props').destructive).toBeUndefined();
  });

  it('replace_node keeps the target id and type', async () => {
    const result = await tool('replace_node').execute(
      {
        nodeId: 'hero-box',
        reason: 'restrukturisasi jadi dua kolom',
        node: {
          type: 'container',
          children: [{ type: 'heading', props: { text: 'Judul baru' } }],
        },
      },
      makeContext(),
    );

    expect(result.ok).toBe(true);
    const replaced = result.document!.document.children![0].children![0];
    expect(replaced.id).toBe('hero-box');
    expect(replaced.type).toBe('container');
    expect(replaced.children![0].props?.text).toBe('Judul baru');
  });

  it('rejects a write that would violate document security limits', async () => {
    const result = await tool('update_node_props').execute(
      { nodeId: 'cta-btn', props: { label: 'x'.repeat(50) } },
      makeContext({ securityLimits: { maxStringLength: 10 } }),
    );

    expect(result.ok).toBe(false);
    expect((result.content as any).error).toContain('security check');
    expect(result.op).toBeUndefined();
  });

  it('createDocumentTools can exclude tools and drop writes entirely', () => {
    expect(createDocumentTools({ exclude: ['delete_node'] }).map((t) => t.definition.name)).not.toContain(
      'delete_node',
    );
    expect(createDocumentTools({ allowWrites: false }).every((t) => t.kind === 'read')).toBe(true);
  });
});
