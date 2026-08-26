---
title: 'State Store & Manajemen Status'
description: 'Zustand editor store, command dispatcher, dan arsitektur undo/redo.'
---

# State Store & Manajemen Status

Editor menggunakan Zustand untuk mengelola state UI transien serta mendelegasikan pembaruan dokumen immutable ke Command Engine `@kubuild/core`.

## Menggunakan `useEditorStore`

```ts
import { useEditorStore } from '@kubuild/editor';

function CustomActionButton() {
  const {
    document,
    selectedNodeId,
    updateNodeStyles,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useEditorStore();

  return (
    <div>
      <button onClick={() => undo()} disabled={!canUndo}>Undo</button>
      <button onClick={() => redo()} disabled={!canRedo}>Redo</button>
    </div>
  );
}
```

## Integritas Riwayat Undo & Redo

Setiap mutasi dokumen melewati command engine inti, memastikan integritas undo/redo penuh dengan delta command transactions dan memicu callback `onChange` secara instan.
