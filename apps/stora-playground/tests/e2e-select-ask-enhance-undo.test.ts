import { describe, it, expect, beforeEach } from 'vitest';
import type { Node } from '@kubuild/schema';
import type { AiChatRequest, AiChatResponse, AiRefactorNodeRequest } from '@kubuild/ai';
import { createBlankDocument, deepClone } from '@kubuild/core';
import { createDefaultComponentRegistry } from '@kubuild/components';
import {
  useEditorStore,
  diffEnhanceNode,
  runEnhanceNode,
  applyEnhanceCandidate,
  type EnhanceCandidate,
} from '@kubuild/editor';

/**
 * STORA-523 (docs/TASKS_AI_PROVIDER_EMBED.md, EPIC-56) — end-to-end reproduction of Flow B
 * and Flow C from docs/PRD_AI_PROVIDER_EMBED.md §3.3/§3.4: select a node, ask AI a general
 * question (document must stay untouched — chat never mutates the document, per NFR-1),
 * then enhance the selected node, apply the result, and undo it back to the exact
 * pre-enhance state.
 *
 * Only the AI network boundary is faked (`refactorNode`/a chat "ask" call, matching the
 * shapes `useAiGenerator`/`useAiChat` return). The real `@kubuild/editor` store, the real
 * `@kubuild/core` command engine/history manager, and the real STORA-509 normalize/validate
 * pipeline (via `runEnhanceNode`'s use of `normalizeAndValidateRefactoredNode`) are all
 * exercised as-is — no mocked command engine.
 */

const registry = createDefaultComponentRegistry();

function docWithButton(): ReturnType<typeof createBlankDocument> {
  const doc = createBlankDocument('Select Ask Enhance Undo E2E');
  const node: Node = {
    id: 'cta-button',
    type: 'button',
    props: { label: 'Sign up' },
    styles: { base: { backgroundColor: '#cccccc', color: '#000000' } },
    children: [],
  };
  doc.document.children = [node];
  return doc;
}

function makeApplyDeps() {
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

/** Fake "ask AI a general question" boundary — mirrors `useAiChat().sendMessage`'s shape. */
function fakeAskAiGeneralQuestion(answer: string) {
  return async (_request: AiChatRequest): Promise<AiChatResponse> => ({
    message: { role: 'assistant', content: answer, timestamp: Date.now() },
  });
}

describe('E2E (STORA-523): select -> ask -> enhance -> apply -> undo', () => {
  beforeEach(() => {
    useEditorStore.getState().setDocument(docWithButton());
    useEditorStore.getState().selectNode('cta-button');
  });

  it('asking AI a general question about the selection never touches the document, then enhance+apply+undo restores the exact prior node', async () => {
    // 1. Select a node — matches Flow B/C's precondition.
    expect(useEditorStore.getState().selectedNodeId).toBe('cta-button');
    const preAskDoc = useEditorStore.getState().document;
    const preAskCanUndo = useEditorStore.getState().canUndo;
    const preAskCanRedo = useEditorStore.getState().canRedo;

    // 2. Flow B — general question, with selection context attached to the request exactly
    // like the AI Chat Panel would (STORA-502/506). The answer is chat-only text; nothing
    // is dispatched to the store.
    const ask = fakeAskAiGeneralQuestion('This button uses a low-contrast gray background.');
    const chatResponse = await ask({
      messages: [{ role: 'user', content: 'kenapa button ini gak menonjol?' }],
      currentDocument: useEditorStore.getState().document,
      selectedNodeId: useEditorStore.getState().selectedNodeId ?? undefined,
    });

    expect(chatResponse.message.role).toBe('assistant');
    expect(chatResponse.message.content.length).toBeGreaterThan(0);
    // Document, undo/redo state are byte-for-byte unchanged after a pure ask.
    expect(useEditorStore.getState().document).toBe(preAskDoc);
    expect(useEditorStore.getState().canUndo).toBe(preAskCanUndo);
    expect(useEditorStore.getState().canRedo).toBe(preAskCanRedo);
    expect(useEditorStore.getState().canUndo).toBe(false);

    // 3. Flow C — enhance the selected node. Snapshot the original node before any
    // candidate is generated, so undo can be checked against it byte-for-byte later.
    const originalNode = deepClone(
      useEditorStore.getState().getSelectedNode()!,
    );

    const fakeRefactorNode = async (params: AiRefactorNodeRequest): Promise<Node | null> => ({
      // Raw AI response deliberately carries a wrong id/type — normalizeAndValidateRefactoredNode
      // (invoked inside runEnhanceNode) must pin them back to the original's.
      id: 'ignored-by-normalizer',
      type: 'container',
      props: { label: 'Sign up free — no card required' },
      styles: { base: { backgroundColor: '#4f46e5', color: '#ffffff' } },
    } as unknown as Node);

    const outcome = await runEnhanceNode(fakeRefactorNode, {
      node: originalNode,
      instruction: 'make it pop',
    });

    expect(outcome.status).toBe('success');
    if (outcome.status !== 'success') return;

    expect(outcome.candidateNode.id).toBe('cta-button');
    expect(outcome.candidateNode.type).toBe('button');

    // Candidate generation alone must not have touched the document or history yet.
    expect(useEditorStore.getState().document).toBe(preAskDoc);
    expect(useEditorStore.getState().canUndo).toBe(false);

    const diff = diffEnhanceNode(outcome.originalNode, outcome.candidateNode);
    expect(diff.fields.length).toBeGreaterThan(0);

    const candidate: EnhanceCandidate = {
      originalNode: outcome.originalNode,
      candidateNode: outcome.candidateNode,
      diff,
    };

    // 4. Apply — through the exact same command-engine path manual editing uses.
    const applyResult = applyEnhanceCandidate(candidate, makeApplyDeps());
    expect(applyResult.success).toBe(true);

    const afterApply = useEditorStore.getState().getSelectedNode();
    expect(afterApply?.props?.label).toBe('Sign up free — no card required');
    expect(afterApply?.styles?.base).toMatchObject({ backgroundColor: '#4f46e5', color: '#ffffff' });
    expect(useEditorStore.getState().canUndo).toBe(true);

    // 5. Undo — the node must come back byte-for-byte identical to its pre-enhance state.
    useEditorStore.getState().undo();

    const afterUndo = useEditorStore.getState().getSelectedNode();
    expect(afterUndo).toEqual(originalNode);
    expect(useEditorStore.getState().canUndo).toBe(false);
  });

  it('discarding an enhance candidate (never applying it) leaves zero entries in undo/redo history', async () => {
    expect(useEditorStore.getState().canUndo).toBe(false);
    expect(useEditorStore.getState().canRedo).toBe(false);
    const before = useEditorStore.getState().document;

    const originalNode = deepClone(useEditorStore.getState().getSelectedNode()!);

    const fakeRefactorNode = async (): Promise<Node | null> => ({
      id: 'cta-button',
      type: 'button',
      props: { label: 'A much bolder call to action' },
    });

    const outcome = await runEnhanceNode(fakeRefactorNode, {
      node: originalNode,
      instruction: 'make it bolder',
    });
    expect(outcome.status).toBe('success');

    // The user reviews the diff/preview and clicks Discard — i.e. `applyEnhanceCandidate`
    // is simply never called. Nothing about the document or history may change as a result.
    expect(useEditorStore.getState().document).toBe(before);
    expect(useEditorStore.getState().canUndo).toBe(false);
    expect(useEditorStore.getState().canRedo).toBe(false);
    expect(useEditorStore.getState().getSelectedNode()).toEqual(originalNode);
  });
});
