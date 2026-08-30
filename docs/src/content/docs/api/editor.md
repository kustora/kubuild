---
title: '@kubuild/editor API'
description: 'Complete API reference for the visual builder components, configuration options, store, and utilities in @kubuild/editor.'
---

# `@kubuild/editor` API Reference

Package `@kubuild/editor` exports the full visual builder suite: canvas, responsive viewport, component & blocks panel, layer tree navigator, style manager inspector, spreadsheet table editor, and modular customization configuration.

---

## Primary Component

### `<KubuildEditor />`

The top-level visual builder wrapper component. It orchestrates the toolbar, sidebar, canvas, floating overlays, and inspector panel with full modularity support via `config`.

```tsx
import { KubuildEditor } from '@kubuild/editor';

<KubuildEditor
  initialDocument={document}
  registry={componentRegistry}
  context={runtimeContext}
  variableCatalog={variableCatalog}
  onChange={(doc) => handleSave(doc)}
  onDiagnostic={(diag) => console.warn(diag)}
  config={{
    toolbar: { showExportImport: false },
    sidebar: { availableTabs: ['components', 'layers'] },
    inspector: { allowedStyleSectors: ['typography', 'decorations'] },
  }}
  className="h-screen"
/>
```

#### Props

| Prop | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `initialDocument` | `PageDocument` | `undefined` | Initial document loaded into the editor state. |
| `registry` | `ComponentRegistry` | `createDefaultComponentRegistry()` | Component registry containing node definitions and renderers. |
| `context` | `RuntimeContext` | `undefined` | Host runtime context (variables, actions, assets). |
| `variableCatalog` | `VariableCatalog` | `[]` | Host variable definitions for autocomplete and mustache binding interpolation. |
| `onChange` | `(doc: PageDocument) => void` | `undefined` | Callback fired on every document mutation command. |
| `onDiagnostic` | `(diag: Diagnostic) => void` | `undefined` | Handler for validation errors and diagnostic events. |
| `config` | `EditorConfig` | `undefined` | Granular visibility and modular feature configuration. |
| `className` | `string` | `undefined` | Optional CSS class name for the editor root container. |

---

## Configuration API (`EditorConfig`)

The `config` prop allows host applications to customize which UI modules, tabs, and controls are rendered in the editor.

### `EditorConfig`

```typescript
export interface EditorConfig {
  toolbar?: boolean | EditorToolbarConfig;
  sidebar?: boolean | EditorSidebarConfig;
  canvas?: EditorCanvasConfig;
  inspector?: boolean | EditorInspectorConfig;
}
```

### `EditorToolbarConfig`

| Field | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `showTitle` | `boolean` | `true` | Show document title badge in toolbar. |
| `showNavigatorToggle` | `boolean` | `true` | Show Navigator (layers) toggle button. |
| `showHistory` | `boolean` | `true` | Show Undo & Redo buttons. |
| `showClipboard` | `boolean` | `true` | Show Copy, Paste, Duplicate, and Delete buttons. |
| `showCodeViewer` | `boolean` | `true` | Show "View Code" (`< >`) modal trigger. |
| `showExportImport` | `boolean` | `true` | Show Import & Export (.stora / JSON) action buttons. |
| `showViewportSwitcher` | `boolean` | `true` | Show Desktop / Tablet / Mobile breakpoint switcher. |
| `showSelectionStatus` | `boolean` | `true` | Show active selected element ID badge. |
| `customActions` | `React.ReactNode` | `undefined` | Custom React nodes/buttons rendered inside the toolbar. |

### `EditorSidebarConfig`

| Field | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `enabled` | `boolean` | `true` | Toggle left sidebar visibility. |
| `defaultTab` | `'components' \| 'blocks' \| 'layers'` | `'components'` | Default active tab on initial render. |
| `availableTabs` | `Array<'components' \| 'blocks' \| 'layers'>` | `['components', 'blocks', 'layers']` | Whitelist of tabs available for user navigation. |

### `EditorCanvasConfig`

| Field | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `showBreadcrumbs` | `boolean` | `true` | Show DOM hierarchy breadcrumbs below the canvas. |
| `showFloatingBadges` | `boolean` | `true` | Show quick action badge overlays on selected canvas node. |

### `EditorInspectorConfig`

| Field | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `enabled` | `boolean` | `true` | Toggle right inspector panel visibility. |
| `showProps` | `boolean` | `true` | Show component functional properties fields. |
| `showTraits` | `boolean` | `true` | Show HTML semantic traits tab (`href`, `alt`, `aria-label`, etc.). |
| `showStyles` | `boolean` | `true` | Show visual Style Manager accordion. |
| `showStateSelector` | `boolean` | `true` | Show pseudo-state layer selector (`:hover`, `:active`, `:focus`). |
| `allowedStyleSectors` | `StyleSectorId[]` | `undefined` | Whitelist of visible style sectors (`'dimension'`, `'spacing'`, `'typography'`, `'decorations'`, `'flex'`, `'motion'`). If omitted, all sectors are visible. |

### Helper: `resolveEditorConfig(config?)`

Merges host configuration with default fallback settings, returning a strongly typed `ResolvedEditorConfig`.

---

## Sub-Components

### `<EditorToolbar />`

Top bar containing document information, history engine actions, clipboard actions, and import/export triggers.

```tsx
import { EditorToolbar } from '@kubuild/editor';

<EditorToolbar
  registry={registry}
  config={{ showExportImport: false }}
/>
```

---

### `<LeftSidebar />`

Sidebar container featuring tabbed navigation between Components, Composite Blocks, and Document Layers.

```tsx
import { LeftSidebar } from '@kubuild/editor';

<LeftSidebar
  registry={registry}
  config={{
    defaultTab: 'components',
    availableTabs: ['components', 'layers'],
  }}
/>
```

---

### `<EditorCanvas />`

The visual viewport that renders the page via `@kubuild/renderer` with active drop targets, direct selection bounding boxes, floating action tags, and keyboard navigation.

```tsx
import { EditorCanvas } from '@kubuild/editor';

<EditorCanvas
  registry={registry}
  context={runtimeContext}
  viewport="desktop" // 'desktop' | 'tablet' | 'mobile'
  onDiagnostic={onDiagnostic}
  config={{ showFloatingBadges: true }}
/>
```

---

### `<InspectorPanel />`

The right-hand property and style manager. Renders component props, semantic HTML traits, box model margins/paddings, typography controls, and CSS motion animations.

```tsx
import { InspectorPanel } from '@kubuild/editor';

<InspectorPanel
  registry={registry}
  document={doc}
  selectedNodeId="node-123"
  config={{
    showTraits: false,
    allowedStyleSectors: ['typography', 'decorations'],
  }}
/>
```

---

### `<StyleManagerAccordion />`

Sector-based visual CSS styling accordion. Supports breakpoint inheritance (`base`, `tablet`, `mobile`) and interactive pseudo-state styling.

```tsx
import { StyleManagerAccordion } from '@kubuild/editor';

<StyleManagerAccordion
  styles={activeStyles}
  animation={nodeAnimation}
  allowedSectors={['dimension', 'typography', 'motion']}
  onCommitStyle={(prop, val) => handleStyleUpdate(prop, val)}
  onCommitAnimation={(anim) => handleAnimUpdate(anim)}
  breakpoint="base"
/>
```

---

### `<TableSpreadsheetEditor />`

Interactive spreadsheet grid editor for table components. Allows inserting/deleting columns & rows, setting table headers, and editing cell data directly.

```tsx
import { TableSpreadsheetEditor } from '@kubuild/editor';

<TableSpreadsheetEditor
  registry={registry}
  tableNode={tableNode}
  mode="floating" // 'floating' | 'docked' | 'hidden'
  onToggleMode={() => {}}
  onClose={() => {}}
/>
```

---

## Store & Hooks

### `useEditorStore()`

Zustand store hook managing editor state, selection, history stack, and command dispatchers.

```typescript
import { useEditorStore } from '@kubuild/editor';

const {
  document,
  selectedNodeId,
  hoveredNodeId,
  viewport,
  isDirty,
  canUndo,
  canRedo,
  clipboard,
  navigatorMode,
  tableSpreadsheetMode,
  setDocument,
  selectNode,
  hoverNode,
  setViewport,
  insertComponent,
  deleteComponent,
  duplicateComponent,
  moveComponent,
  updateNodeProps,
  updateNodeStyle,
  updateNodeStateStyle,
  updateNodeAnimation,
  undo,
  redo,
  copyNode,
  pasteNode,
} = useEditorStore();
```

---

## Export & Import Utilities

```typescript
import {
  downloadDocumentAsStora,
  downloadDocumentAsJson,
  exportDocumentAsStoraPackage,
  exportDocumentAsHtml,
} from '@kubuild/editor';

// Download .stora bundle directly in browser
await downloadDocumentAsStora(doc, 'my-page.stora', { componentRegistry: registry });

// Download raw page.json document schema
downloadDocumentAsJson(doc, 'page.json');

// Generate zip Blob for server upload or storage
const blob = await exportDocumentAsStoraPackage(doc, { componentRegistry: registry });

// Render semantic standalone HTML & CSS output
const html = await exportDocumentAsHtml(doc, {
  registry,
  minify: true,
  inlineStyles: true,
});
```
