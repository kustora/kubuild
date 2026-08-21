import { create } from 'zustand';
import { PageDocument, Node } from '@kubuild/schema';
import { createBlankDocument, findNodeById } from '@kubuild/core';

export type Viewport = 'desktop' | 'tablet' | 'mobile';

export interface EditorState {
  document: PageDocument;
  selectedNodeId: string | null;
  hoveredNodeId: string | null;
  viewport: Viewport;
  isDirty: boolean;

  setDocument: (document: PageDocument) => void;
  selectNode: (nodeId: string | null) => void;
  hoverNode: (nodeId: string | null) => void;
  setViewport: (viewport: Viewport) => void;
  getSelectedNode: () => Node | null;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  document: createBlankDocument(),
  selectedNodeId: null,
  hoveredNodeId: null,
  viewport: 'desktop',
  isDirty: false,

  setDocument: (document) => set({ document, isDirty: false, selectedNodeId: null }),
  selectNode: (nodeId) => set({ selectedNodeId: nodeId }),
  hoverNode: (nodeId) => set({ hoveredNodeId: nodeId }),
  setViewport: (viewport) => set({ viewport }),
  getSelectedNode: () => {
    const { document, selectedNodeId } = get();
    if (!selectedNodeId) return null;
    return findNodeById(document.document, selectedNodeId);
  },
}));
