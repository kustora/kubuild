---
title: 'Store & State Management'
description: 'Zustand editor store, command dispatchers, and undo/redo architecture.'
---

# Store & State Management

The editor uses Zustand to handle transient UI state while delegating immutable document updates to the `@kubuild/core` Command Engine.

## `useEditorStore` State Shape

```ts
interface EditorStoreState {
  // Document State
  document: PageDocument;
  canUndo: boolean;
  canRedo: boolean;

  // Selection & Active Elements
  selectedNodeId: string | null;
  hoveredNodeId: string | null;
  activeBreakpoint: 'desktop' | 'tablet' | 'mobile';

  // Panel & Viewport Modes
  viewport: 'desktop' | 'tablet' | 'mobile';
  navigatorMode: 'docked' | 'floating' | 'hidden';
  tableSpreadsheetMode: 'docked' | 'floating' | 'hidden';
  isImportModalOpen: boolean;

  // Host Configuration & Callbacks
  variableCatalog: VariableCatalog;
  onChangeHandler: ((doc: PageDocument) => void) | null;
}
```

## State Actions & Dispatchers

```ts
import { useEditorStore } from '@kubuild/editor';

function CustomToolbarAction() {
  const {
    document,
    selectedNodeId,
    selectNode,
    updateNodeProps,
    updateNodeStyles,
    insertNode,
    deleteNode,
    undo,
    redo,
  } = useEditorStore();

  const handleUpdate = () => {
    if (!selectedNodeId) return;
    updateNodeStyles(selectedNodeId, {
      backgroundColor: '#3b82f6',
      borderRadius: '8px',
    });
  };

  return (
    <button onClick={handleUpdate}>Apply Blue Accent</button>
  );
}
```

## Immutable History & Transactions

Every document mutation goes through the core command engine, ensuring:
1. **Full Undo/Redo Integrity**: State is tracked using delta command transactions.
2. **Schema Safety**: Mutations adhere to node constraints (e.g. valid prop types, container rules).
3. **Change Callbacks**: Triggers `onChange` immediately with the updated immutable `PageDocument`.
