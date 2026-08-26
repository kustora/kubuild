---
title: 'API @kubuild/editor'
description: 'Referensi API komponen visual builder, store, dan utilitas di @kubuild/editor.'
---

# Referensi API `@kubuild/editor`

Paket `@kubuild/editor` mengekspor canvas visual, panel inspector, tree layers, dan hook manajemen status visual builder.

## Komponen

### `<KubuildEditor />`

Komponen utama pembungkus visual builder lengkap dengan toolbar, panel komponen, canvas, layers navigator, dan inspector.

```tsx
import { KubuildEditor } from '@kubuild/editor';

<KubuildEditor
  initialDocument={document}
  registry={componentRegistry}
  context={runtimeContext}
  variableCatalog={variableCatalog}
  onChange={(doc) => handleSave(doc)}
  onDiagnostic={(diag) => console.warn(diag)}
  className="h-full"
/>
```

#### Properti (Props)

| Prop | Tipe | Deskripsi |
| :--- | :--- | :--- |
| `initialDocument` | `PageDocument` *(opsional)* | Dokumen awal untuk dimuat ke dalam editor. |
| `registry` | `ComponentRegistry` *(opsional)* | Registry komponen default atau kustom. |
| `context` | `RuntimeContext` *(opsional)* | Konteks variabel runtime host. |
| `variableCatalog` | `VariableCatalog` *(opsional)* | Daftar variabel untuk interpolasi binding mustache. |
| `onChange` | `(doc: PageDocument) => void` *(opsional)* | Callback saat dokumen mengalami perubahan. |
| `onDiagnostic` | `(diag: Diagnostic) => void` *(opsional)* | Penangan diagnostik error/warning. |

---

### `<TableSpreadsheetEditor />`

Modal spreadsheet visual dan inspector docked untuk manipulasi baris/kolom tabel dan penggabungan sel.

```tsx
import { TableSpreadsheetEditor } from '@kubuild/editor';

<TableSpreadsheetEditor
  registry={registry}
  tableNode={tableComponentNode}
  mode="floating" // 'floating' | 'docked' | 'hidden'
  onToggleMode={() => {}}
  onClose={() => {}}
/>
```

---

### Hook `useEditorStore()`

Hook Zustand untuk mengakses state transien dan pemicu aksi editor.

```ts
import { useEditorStore } from '@kubuild/editor';

const {
  document,
  selectedNodeId,
  viewport,
  setViewport,
  selectNode,
  updateNodeProps,
  updateNodeStyles,
  undo,
  redo,
  canUndo,
  canRedo,
} = useEditorStore();
```
