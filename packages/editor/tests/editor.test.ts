import { describe, it, expect } from 'vitest';
import { useEditorStore } from '../src/store';
import { createBlankDocument } from '@kubuild/core';

describe('Editor Store', () => {
  it('initializes and selects nodes', () => {
    const doc = createBlankDocument('Test Title');
    doc.document.children = [
      {
        id: 'child-node',
        type: 'heading',
        props: { text: 'Title' },
      },
    ];

    useEditorStore.getState().setDocument(doc);
    expect(useEditorStore.getState().document.metadata?.title).toBe('Test Title');

    useEditorStore.getState().selectNode('child-node');
    expect(useEditorStore.getState().selectedNodeId).toBe('child-node');

    const selected = useEditorStore.getState().getSelectedNode();
    expect(selected?.id).toBe('child-node');
  });
});
