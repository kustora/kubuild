import { describe, it, expect, beforeEach } from 'vitest';
import type { Node, PageDocument } from '@kubuild/schema';
import { createBlankDocument, findNodeById } from '@kubuild/core';
import { createDefaultComponentRegistry } from '@kubuild/components';
import type { AgentOpRecord } from '@kubuild/ai';
import { useEditorStore } from '../src/store';
import { applyAgentOps, partitionAutoApplicableOps } from '../src/ai/apply-agent-ops';

const registry = createDefaultComponentRegistry();

function makeDeps() {
  return {
    updateNodeProps: (nodeId: string, props: Record<string, unknown>, merge: boolean) =>
      useEditorStore.getState().updateNodeProps(nodeId, props, registry, merge),
    updateNodeStyle: (
      nodeId: string,
      styles: Record<string, unknown>,
      breakpoint: 'base' | 'desktop' | 'tablet' | 'mobile',
      merge: boolean,
    ) => useEditorStore.getState().updateNodeStyle(nodeId, styles, breakpoint, merge),
    updateNodeStateStyle: (
      nodeId: string,
      styles: Record<string, unknown>,
      state: string,
      merge: boolean,
    ) => useEditorStore.getState().updateNodeStateStyle(nodeId, styles, state, merge),
    insertNodeTree: (parentId: string, node: Node, index?: number) =>
      useEditorStore.getState().insertNodeTree(parentId, node, index),
    moveNode: (nodeId: string, targetParentId: string, index?: number) =>
      useEditorStore.getState().moveComponent(nodeId, targetParentId, registry, index),
    deleteNode: (nodeId: string) => useEditorStore.getState().deleteComponent(nodeId),
    duplicateNode: (nodeId: string, targetParentId?: string, index?: number) =>
      useEditorStore.getState().duplicateComponent(nodeId, registry, targetParentId, index),
    replaceNodeSubtree: (nodeId: string, node: Node) =>
      useEditorStore.getState().replaceNodeSubtree(nodeId, node, registry),
    beginHistoryTransaction: () => useEditorStore.getState().beginHistoryTransaction(),
    endHistoryTransaction: () => useEditorStore.getState().endHistoryTransaction(),
    getNode: (nodeId: string) =>
      findNodeById(useEditorStore.getState().document.document, nodeId),
  };
}

function record(id: string, op: AgentOpRecord['op'], destructive = false): AgentOpRecord {
  return { id, op, summary: `${op.kind} ${id}`, destructive };
}

function docWithHero(): PageDocument {
  const doc = createBlankDocument('Agent Ops Test');
  return {
    ...doc,
    document: {
      ...doc.document,
      children: [
        {
          id: 'hero',
          type: 'section',
          children: [
            {
              id: 'cta-btn',
              type: 'button',
              props: { label: 'Coba Gratis' },
              styles: { base: { backgroundColor: '#3b82f6' } },
            },
          ],
        },
      ],
    },
  } as PageDocument;
}

describe('applyAgentOps (STORA-530)', () => {
  beforeEach(() => {
    useEditorStore.getState().setDocument(docWithHero());
  });

  it('applies a props op through the store and makes it undoable', () => {
    const result = applyAgentOps(
      [record('1', { kind: 'update-props', nodeId: 'cta-btn', props: { label: 'Mulai' }, merge: true })],
      makeDeps(),
    );

    expect(result.success).toBe(true);
    expect(findNodeById(useEditorStore.getState().document.document, 'cta-btn')?.props?.label).toBe(
      'Mulai',
    );

    useEditorStore.getState().undo();
    expect(findNodeById(useEditorStore.getState().document.document, 'cta-btn')?.props?.label).toBe(
      'Coba Gratis',
    );
  });

  it('routes a state-layer style op to updateNodeStateStyle, leaving base untouched', () => {
    applyAgentOps(
      [
        record('1', {
          kind: 'update-styles',
          nodeId: 'cta-btn',
          styles: { backgroundColor: '#15803d' },
          state: ':hover',
          merge: true,
        }),
      ],
      makeDeps(),
    );

    const node = findNodeById(useEditorStore.getState().document.document, 'cta-btn');
    expect(node?.styles?.states?.[':hover']).toEqual({ backgroundColor: '#15803d' });
    expect(node?.styles?.base?.backgroundColor).toBe('#3b82f6');
  });

  it('collapses a whole multi-op run into ONE undo entry', () => {
    const before = useEditorStore.getState().document;

    const result = applyAgentOps(
      [
        record('1', { kind: 'update-props', nodeId: 'cta-btn', props: { label: 'Mulai' }, merge: true }),
        record('2', {
          kind: 'update-styles',
          nodeId: 'cta-btn',
          styles: { backgroundColor: '#16a34a' },
          breakpoint: 'base',
          merge: true,
        }),
        record('3', {
          kind: 'insert-node',
          parentId: 'hero',
          node: { id: 'sub-note', type: 'text', props: { text: 'Tanpa kartu kredit' } },
        }),
      ],
      makeDeps(),
    );

    expect(result.success).toBe(true);
    expect(result.appliedOpIds).toEqual(['1', '2', '3']);

    // One Ctrl+Z must revert the entire agent turn, not just the last op.
    useEditorStore.getState().undo();
    expect(useEditorStore.getState().document).toEqual(before);
    expect(useEditorStore.getState().canUndo).toBe(false);
  });

  it('stops at the first failing op and reports which one failed', () => {
    const result = applyAgentOps(
      [
        record('1', { kind: 'update-props', nodeId: 'cta-btn', props: { label: 'Mulai' }, merge: true }),
        record('2', { kind: 'update-props', nodeId: 'ghost-node', props: { label: 'X' }, merge: true }),
        record('3', { kind: 'delete-node', nodeId: 'hero' }, true),
      ],
      makeDeps(),
    );

    expect(result.success).toBe(false);
    expect(result.failedOpId).toBe('2');
    expect(result.appliedOpIds).toEqual(['1']);
    // The op after the failure was never attempted.
    expect(findNodeById(useEditorStore.getState().document.document, 'hero')).not.toBeNull();
  });

  it('preserves actions/animation on a replace-node op', () => {
    const doc = docWithHero();
    doc.document.children![0].children![0].actions = [
      { id: 'act-1', trigger: 'click', steps: [] },
    ] as never;
    useEditorStore.getState().setDocument(doc);

    applyAgentOps(
      [
        record('1', {
          kind: 'replace-node',
          nodeId: 'cta-btn',
          node: { id: 'cta-btn', type: 'button', props: { label: 'Baru' } },
        }, true),
      ],
      makeDeps(),
    );

    const node = findNodeById(useEditorStore.getState().document.document, 'cta-btn');
    expect(node?.props?.label).toBe('Baru');
    // The agent pipeline never reasons about actions — Apply must not silently drop them.
    expect(node?.actions).toHaveLength(1);
  });

  it('applies nothing for an empty op list', () => {
    const before = useEditorStore.getState().document;
    const result = applyAgentOps([], makeDeps());
    expect(result.success).toBe(true);
    expect(useEditorStore.getState().document).toBe(before);
  });
});

describe('partitionAutoApplicableOps (STORA-530)', () => {
  it('auto-applies safe ops when nothing is destructive', () => {
    const ops = [
      record('1', { kind: 'update-props', nodeId: 'a', props: {}, merge: true }),
      record('2', { kind: 'update-props', nodeId: 'b', props: {}, merge: true }),
    ];
    expect(partitionAutoApplicableOps(ops)).toEqual({ autoApplicable: ops, needsConfirmation: [] });
  });

  it('holds back a destructive op and everything after it', () => {
    const safe = record('1', { kind: 'update-props', nodeId: 'a', props: {}, merge: true });
    const destructive = record('2', { kind: 'delete-node', nodeId: 'b' }, true);
    const after = record('3', { kind: 'update-props', nodeId: 'c', props: {}, merge: true });

    const result = partitionAutoApplicableOps([safe, destructive, after]);

    expect(result.autoApplicable).toEqual([safe]);
    // Ops after a deletion may depend on it, so they wait for the same confirmation.
    expect(result.needsConfirmation).toEqual([destructive, after]);
  });
});
