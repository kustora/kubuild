import { describe, it, expect } from 'vitest';
import { createBlankDocument } from '@kubuild/core';
import { useEditorStore } from '../src/store';
import { buildAiChatContext } from '../src/utils/ai-context';

describe('buildAiChatContext (STORA-502)', () => {
  it('reflects the currently selected node and current document snapshot', () => {
    const doc = createBlankDocument('AI Context Test');
    doc.document.children = [
      { id: 'button-1', type: 'button', props: { text: 'Click me' } },
    ];
    useEditorStore.getState().setDocument(doc);
    useEditorStore.getState().selectNode('button-1');

    const state = useEditorStore.getState();
    const context = buildAiChatContext(state);

    expect(context.selectedNodeId).toBe('button-1');
    expect(context.currentDocument).toBe(state.document);
    expect(context.currentDocument?.document.children?.some((n) => n.id === 'button-1')).toBe(true);
  });

  it('updates selectedNodeId in the built context when canvas selection changes', () => {
    const doc = createBlankDocument('AI Context Test 2');
    doc.document.children = [
      { id: 'node-a', type: 'text', props: { text: 'A' } },
      { id: 'node-b', type: 'text', props: { text: 'B' } },
    ];
    useEditorStore.getState().setDocument(doc);

    useEditorStore.getState().selectNode('node-a');
    const contextA = buildAiChatContext(useEditorStore.getState());
    expect(contextA.selectedNodeId).toBe('node-a');

    useEditorStore.getState().selectNode('node-b');
    const contextB = buildAiChatContext(useEditorStore.getState());
    expect(contextB.selectedNodeId).toBe('node-b');
  });

  it('omits selectedNodeId (undefined, not null) when there is no active selection', () => {
    const doc = createBlankDocument('AI Context Test 3');
    useEditorStore.getState().setDocument(doc);
    useEditorStore.getState().selectNode(null);

    const context = buildAiChatContext(useEditorStore.getState());

    expect(context.selectedNodeId).toBeUndefined();
  });

  it('never includes variableCatalog preview-only sample values in the document snapshot', () => {
    const doc = createBlankDocument('AI Context Test 4');
    useEditorStore.getState().setDocument(doc);
    useEditorStore.getState().setVariableCatalog([
      { key: 'site.name', label: 'Site Name', type: 'string', sampleValue: 'Preview-only Site Name' },
    ]);
    useEditorStore.getState().selectNode(null);

    const state = useEditorStore.getState();
    const context = buildAiChatContext(state);

    // The catalog exists on store state but must never surface inside the AI request context.
    expect(state.variableCatalog.length).toBe(1);
    expect(context).not.toHaveProperty('variableCatalog');
    expect(JSON.stringify(context)).not.toContain('Preview-only Site Name');
  });
});
