---
title: '@kubuild/editor API'
description: 'API reference for the visual builder components, store, and utilities in @kubuild/editor.'
---

# `@kubuild/editor` API Reference

Package `@kubuild/editor` exports the visual canvas, inspector, layer tree, and state management hooks.

## Components

### `<KubuildEditor />`

The top-level visual editor wrapper component with pre-wired layout, toolbar, component panel, canvas, navigator, and inspector.

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

#### Props

| Prop | Type | Description |
| :--- | :--- | :--- |
| `initialDocument` | `PageDocument` *(optional)* | Initial document to load into the editor store. |
| `registry` | `ComponentRegistry` *(optional)* | Custom or default component registry with definitions and renderer components. |
| `context` | `RuntimeContext` *(optional)* | Host runtime variables and context. |
| `variableCatalog` | `VariableCatalog` *(optional)* | Available schema variables for mustache binding interpolation. |
| `onChange` | `(doc: PageDocument) => void` *(optional)* | Callback executed on every document modification. |
| `onDiagnostic` | `(diag: Diagnostic) => void` *(optional)* | Diagnostic error/warning handler. |
| `className` | `string` *(optional)* | Root CSS class for styling the container. |

---

### `<EditorCanvas />`

The visual viewport rendering nodes using `@kubuild/renderer` with active drop targets, drag handlers, bounding box indicators, and inline text editing overlays.

```tsx
import { EditorCanvas } from '@kubuild/editor';

<EditorCanvas
  registry={registry}
  context={previewContext}
  viewport="desktop" // 'desktop' | 'tablet' | 'mobile'
  onDiagnostic={onDiagnostic}
/>
```

---

### `<TableSpreadsheetEditor />`

Visual table spreadsheet modal and docked inspector for grid manipulation, cell merges, and styling.

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

### `<InspectorPanel />` & `<LayersPanel />`

- `<InspectorPanel registry={registry} />`: The property and visual CSS style inspector.
- `<LayersPanel registry={registry} />`: The hierarchical tree view of components with drag-to-reorder and visibility controls.

---

## Store & Hooks

### `useEditorStore()`

Zustand hook accessing transient editor state and action dispatchers.

```ts
import { useEditorStore } from '@kubuild/editor';

const {
  document,
  selectedNodeId,
  hoveredNodeId,
  viewport,
  setViewport,
  selectNode,
  updateNodeProps,
  updateNodeStyles,
  insertNode,
  deleteNode,
  duplicateNode,
  undo,
  redo,
  canUndo,
  canRedo,
} = useEditorStore();
```

---

## Utilities

### `exportDocumentAsStoraPackage(doc)`

Exports the current `PageDocument` and assets into a portable `.stora` zip `Blob`.

```ts
import { exportDocumentAsStoraPackage } from '@kubuild/editor';

const blob = await exportDocumentAsStoraPackage(doc);
```

### `exportDocumentAsHtml(doc, options?)`

Exports the document as a clean, self-contained semantic HTML page string.

```ts
import { exportDocumentAsHtml } from '@kubuild/editor';

const html = await exportDocumentAsHtml(doc, {
  minify: true,
  inlineStyles: true,
});
```
