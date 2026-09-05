import { describe, it, expect, beforeEach } from 'vitest';
import type { Node } from '@kubuild/schema';
import { createBlankDocument } from '@kubuild/core';
import { createDefaultComponentRegistry } from '@kubuild/components';
import { useEditorStore } from '../src/store';
import {
  diffEnhanceNode,
  runEnhanceNode,
  applyEnhanceCandidate,
  type EnhanceCandidate,
} from '../src/ai/enhance-node';

const registry = createDefaultComponentRegistry();

function docWithHeading(overrides: Partial<Node> = {}): { doc: ReturnType<typeof createBlankDocument>; node: Node } {
  const doc = createBlankDocument('Enhance Node Test');
  const node: Node = {
    id: 'heading-1',
    type: 'heading',
    props: { text: 'Original Title', level: 2 },
    styles: { base: { color: '#000000' } },
    children: [],
    ...overrides,
  };
  doc.document.children = [node];
  return { doc, node };
}

describe('diffEnhanceNode (STORA-513)', () => {
  it('returns no fields and childrenChanged=false for identical nodes', () => {
    const node: Node = { id: 'a', type: 'heading', props: { text: 'Hi' }, styles: { base: { color: 'red' } } };
    const diff = diffEnhanceNode(node, { ...node });
    expect(diff.fields).toHaveLength(0);
    expect(diff.childrenChanged).toBe(false);
  });

  it('surfaces only the changed prop, not the whole props object', () => {
    const original: Node = { id: 'a', type: 'heading', props: { text: 'Hi', level: 2 } };
    const candidate: Node = { id: 'a', type: 'heading', props: { text: 'Hello there', level: 2 } };
    const diff = diffEnhanceNode(original, candidate);
    expect(diff.fields).toEqual([{ path: 'props.text', before: 'Hi', after: 'Hello there' }]);
  });

  it('surfaces a changed base-breakpoint style field with its dotted path', () => {
    const original: Node = { id: 'a', type: 'heading', props: {}, styles: { base: { color: '#000000' } } };
    const candidate: Node = { id: 'a', type: 'heading', props: {}, styles: { base: { color: '#ffffff' } } };
    const diff = diffEnhanceNode(original, candidate);
    expect(diff.fields).toEqual([{ path: 'styles.base.color', before: '#000000', after: '#ffffff' }]);
  });

  it('surfaces a changed pseudo-state style field', () => {
    const original: Node = { id: 'a', type: 'button', props: {}, styles: { states: { ':hover': { color: 'blue' } } } };
    const candidate: Node = { id: 'a', type: 'button', props: {}, styles: { states: { ':hover': { color: 'red' } } } };
    const diff = diffEnhanceNode(original, candidate);
    expect(diff.fields).toEqual([{ path: 'styles.states.:hover.color', before: 'blue', after: 'red' }]);
  });

  it('flags childrenChanged when nested children differ, without dumping them as a field', () => {
    const original: Node = { id: 'a', type: 'container', props: {}, children: [{ id: 'c1', type: 'text', props: { text: 'x' } }] };
    const candidate: Node = { id: 'a', type: 'container', props: {}, children: [{ id: 'c1', type: 'text', props: { text: 'y' } }] };
    const diff = diffEnhanceNode(original, candidate);
    expect(diff.childrenChanged).toBe(true);
    expect(diff.fields.every((f) => !f.path.startsWith('children'))).toBe(true);
  });
});

describe('runEnhanceNode (STORA-512: refactorNode -> STORA-509 pipeline reuse)', () => {
  it('returns a validated candidate on success, preserving original id/type', async () => {
    const { node } = docWithHeading();
    const fakeRefactorNode = async (_params: unknown): Promise<Node | null> => ({
      // AI response is raw/untyped JSON — deliberately includes a wrong id/type to prove
      // normalizeAndValidateRefactoredNode pins them back to the original.
      id: 'some-other-id',
      type: 'container',
      props: { text: 'Enhanced Title', level: 2 },
      styles: { base: { color: '#ffffff' } },
    } as unknown as Node);

    const outcome = await runEnhanceNode(fakeRefactorNode, { node, instruction: 'make it pop' });

    expect(outcome.status).toBe('success');
    if (outcome.status === 'success') {
      expect(outcome.candidateNode.id).toBe('heading-1');
      expect(outcome.candidateNode.type).toBe('heading');
      expect(outcome.candidateNode.props?.text).toBe('Enhanced Title');
      expect(outcome.originalNode).toBe(node);
    }
  });

  it('reports "no-result" without throwing when the network boundary returns null (aborted/failed)', async () => {
    const { node } = docWithHeading();
    const fakeRefactorNode = async (): Promise<Node | null> => null;

    const outcome = await runEnhanceNode(fakeRefactorNode, { node, instruction: 'anything' });
    expect(outcome.status).toBe('no-result');
  });

  it('reports "invalid" (not a thrown exception) when the raw result fails security validation', async () => {
    const { node } = docWithHeading();
    const fakeRefactorNode = async (): Promise<Node | null> =>
      ({
        id: 'heading-1',
        type: 'heading',
        props: { text: 'x' },
        children: [
          { id: 'c1', type: 'text', props: { text: 'a' } },
          { id: 'c2', type: 'text', props: { text: 'b' } },
        ],
      }) as unknown as Node;

    const outcome = await runEnhanceNode(
      fakeRefactorNode,
      { node, instruction: 'add children' },
      { securityLimits: { maxNodeCount: 1 } },
    );

    expect(outcome.status).toBe('invalid');
    if (outcome.status === 'invalid') {
      expect(outcome.message.length).toBeGreaterThan(0);
    }
  });

  it('the candidate never touches the document — no store mutation happens at this stage', async () => {
    const { doc, node } = docWithHeading();
    useEditorStore.getState().setDocument(doc);
    const before = useEditorStore.getState().document;

    const fakeRefactorNode = async (): Promise<Node | null> => ({
      id: 'heading-1',
      type: 'heading',
      props: { text: 'Enhanced Title' },
    });

    await runEnhanceNode(fakeRefactorNode, { node, instruction: 'make it pop' });

    expect(useEditorStore.getState().document).toBe(before);
    expect(useEditorStore.getState().canUndo).toBe(false);
  });
});

describe('applyEnhanceCandidate (STORA-514)', () => {
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
      updateNodeStateStyle: (nodeId: string, styles: Record<string, unknown>, state: string, merge: boolean) =>
        useEditorStore.getState().updateNodeStateStyle(nodeId, styles, state, merge),
      replaceNodeSubtree: (nodeId: string, node: Node) =>
        useEditorStore.getState().replaceNodeSubtree(nodeId, node, registry),
      beginHistoryTransaction: () => useEditorStore.getState().beginHistoryTransaction(),
      endHistoryTransaction: () => useEditorStore.getState().endHistoryTransaction(),
    };
  }

  beforeEach(() => {
    useEditorStore.getState().setDocument(createBlankDocument('Apply Enhance Test'));
  });

  it('applies a props-only change via updateNodeProps (single undo entry)', () => {
    const { doc, node } = docWithHeading();
    useEditorStore.getState().setDocument(doc);

    const candidateNode: Node = { ...node, props: { text: 'Enhanced Title', level: 2 } };
    const candidate: EnhanceCandidate = {
      originalNode: node,
      candidateNode,
      diff: diffEnhanceNode(node, candidateNode),
    };

    const result = applyEnhanceCandidate(candidate, makeDeps());
    expect(result.success).toBe(true);

    const applied = useEditorStore.getState().document.document.children?.[0];
    expect(applied?.props?.text).toBe('Enhanced Title');
    expect(useEditorStore.getState().canUndo).toBe(true);

    useEditorStore.getState().undo();
    expect(useEditorStore.getState().document.document.children?.[0].props?.text).toBe('Original Title');
    expect(useEditorStore.getState().canUndo).toBe(false);
  });

  it('applies a combined props+style change as a single grouped undo step', () => {
    const { doc, node } = docWithHeading();
    useEditorStore.getState().setDocument(doc);

    const candidateNode: Node = {
      ...node,
      props: { text: 'Enhanced Title', level: 2 },
      styles: { base: { color: '#ffffff' } },
    };
    const candidate: EnhanceCandidate = {
      originalNode: node,
      candidateNode,
      diff: diffEnhanceNode(node, candidateNode),
    };

    const result = applyEnhanceCandidate(candidate, makeDeps());
    expect(result.success).toBe(true);

    const applied = useEditorStore.getState().document.document.children?.[0];
    expect(applied?.props?.text).toBe('Enhanced Title');
    expect(applied?.styles?.base).toEqual({ color: '#ffffff' });

    // One undo() must revert BOTH the props change and the style change together.
    useEditorStore.getState().undo();
    const restored = useEditorStore.getState().document.document.children?.[0];
    expect(restored?.props?.text).toBe('Original Title');
    expect(restored?.styles?.base).toEqual({ color: '#000000' });
    expect(useEditorStore.getState().canUndo).toBe(false);
  });

  it('falls back to replaceNode when children changed, preserving original animation/actions/formConfig', () => {
    const { doc, node } = docWithHeading({
      actions: [{ trigger: 'click', steps: [] }],
    });
    useEditorStore.getState().setDocument(doc);

    // Simulates the normalizer's output: props/styles/children only, animation/actions/
    // formConfig are never carried by `normalizeAndValidateRefactoredNode`.
    const candidateNode: Node = {
      id: node.id,
      type: node.type,
      props: { text: 'Enhanced Title' },
      children: [{ id: 'badge-1', type: 'text', props: { text: 'New' } }],
    };
    const candidate: EnhanceCandidate = {
      originalNode: node,
      candidateNode,
      diff: diffEnhanceNode(node, candidateNode),
    };
    expect(candidate.diff.childrenChanged).toBe(true);

    const result = applyEnhanceCandidate(candidate, makeDeps());
    expect(result.success).toBe(true);

    const applied = useEditorStore.getState().document.document.children?.[0];
    expect(applied?.props?.text).toBe('Enhanced Title');
    expect(applied?.children?.[0]?.id).toBe('badge-1');
    // Original actions must survive the replace even though the candidate never carried them.
    expect(applied?.actions).toEqual([{ trigger: 'click', steps: [] }]);

    useEditorStore.getState().undo();
    const restored = useEditorStore.getState().document.document.children?.[0];
    expect(restored?.props?.text).toBe('Original Title');
    expect(restored?.children ?? []).toHaveLength(0);
  });

  it('surfaces a registry validation failure without dispatching (document unchanged)', () => {
    const { doc, node } = docWithHeading();
    useEditorStore.getState().setDocument(doc);
    const before = useEditorStore.getState().document;

    const candidateNode: Node = { ...node, props: { text: '' } };
    const candidate: EnhanceCandidate = {
      originalNode: node,
      candidateNode,
      diff: diffEnhanceNode(node, candidateNode),
    };

    const result = applyEnhanceCandidate(candidate, makeDeps());
    expect(result.success).toBe(false);
    expect(result.error).toContain('non-empty');
    expect(useEditorStore.getState().document).toBe(before);
    expect(useEditorStore.getState().canUndo).toBe(false);
  });

  it('is a no-op success when the diff has no fields and no children change', () => {
    const { doc, node } = docWithHeading();
    useEditorStore.getState().setDocument(doc);
    const before = useEditorStore.getState().document;

    const candidate: EnhanceCandidate = {
      originalNode: node,
      candidateNode: { ...node },
      diff: diffEnhanceNode(node, { ...node }),
    };

    const result = applyEnhanceCandidate(candidate, makeDeps());
    expect(result.success).toBe(true);
    expect(useEditorStore.getState().document).toBe(before);
  });
});
