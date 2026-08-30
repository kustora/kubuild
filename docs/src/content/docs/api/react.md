---
title: '@kubuild/react API'
description: 'Unified all-in-one React entrypoint for KUBUILD builder, renderer, schema, components, and core utilities.'
---

# `@kubuild/react` API Reference

`@kubuild/react` is the unified meta-package that re-exports all layers of KUBUILD. By installing `@kubuild/react`, consumers get access to the visual editor (`<KubuildEditor />`), the recursive renderer (`<KubuildRenderer />`), the schema definitions, component registry, and document commands from a single dependency.

---

## Installation

```bash
npm install @kubuild/react
# or
pnpm add @kubuild/react
# or
bun add @kubuild/react
```

---

## Re-Exported Layers

`@kubuild/react` consolidates the following specialized packages into one top-level import:

```
┌─────────────────────────────────────────────────────────────┐
│                       @kubuild/react                        │
├───────────────┬─────────────────┬──────────────┬────────────┤
│   @kubuild/   │    @kubuild/    │  @kubuild/   │ @kubuild/  │
│    editor     │    renderer     │  components  │    core    │
│  (Builder UI) │ (Pure Renderer) │  (Registry)  │  (Engine)  │
├───────────────┴─────────────────┴──────────────┴────────────┤
│                       @kubuild/schema                       │
│                     (Zod Document Schema)                   │
└─────────────────────────────────────────────────────────────┘
```

1. **`@kubuild/editor`** — `<KubuildEditor />`, `<EditorCanvas />`, `<LeftSidebar />`, `<InspectorPanel />`, `<TableSpreadsheetEditor />`, `EditorConfig`, `useEditorStore`
2. **`@kubuild/renderer`** — `<KubuildRenderer />`, `RenderContextProvider`, `resolveNodeStyles`, `collectStateStylesCss`, `collectAnimationStylesCss`
3. **`@kubuild/components`** — `ComponentRegistry`, `createDefaultComponentRegistry`, `coreComponentDefinitions`, `STARTER_BLOCKS`
4. **`@kubuild/core`** — `createBlankDocument`, `validateDocument`, `findNodeById`, `resolveBinding`, `sanitizeHtml`, `sanitizeUrl`
5. **`@kubuild/schema`** — `PageDocument`, `Node`, `PageDocumentSchema`, `AnimationConfig`, `ResponsiveStyles`

---

## Primary Components

### 1. `<KubuildEditor />`

Interactive visual page builder with drag-and-drop, inline editing, live code viewer, style inspector, and modular configuration.

```tsx
import { KubuildEditor, createBlankDocument } from '@kubuild/react';

export function EditorView() {
  const [document, setDocument] = useState(() => createBlankDocument('My Landing Page'));

  return (
    <KubuildEditor
      initialDocument={document}
      onChange={(updatedDoc) => setDocument(updatedDoc)}
      config={{
        toolbar: { showExportImport: true },
        sidebar: { availableTabs: ['components', 'blocks', 'layers'] },
        inspector: { showStyles: true, showTraits: true },
      }}
      className="h-screen"
    />
  );
}
```

### 2. `<KubuildRenderer />`

Pure recursive React renderer with zero editor chrome. Ideal for end-user landing pages, live previews, and production publishing.

```tsx
import { KubuildRenderer, createDefaultComponentRegistry } from '@kubuild/react';

export function PublishedPageView({ document, runtimeContext }) {
  return (
    <KubuildRenderer
      document={document}
      registry={createDefaultComponentRegistry()}
      context={runtimeContext}
      viewport="desktop" // 'desktop' | 'tablet' | 'mobile'
      mode="runtime"     // 'runtime' | 'editor' | 'preview'
    />
  );
}
```

---

## Complete Dual-Mode (Editor + Live Preview) Example

```tsx
import React, { useState } from 'react';
import {
  KubuildEditor,
  KubuildRenderer,
  createBlankDocument,
  PageDocument,
  RuntimeContext,
} from '@kubuild/react';

export function App() {
  const [doc, setDoc] = useState<PageDocument>(() =>
    createBlankDocument('Homepage')
  );
  const [viewMode, setViewMode] = useState<'editor' | 'preview'>('editor');

  const context: RuntimeContext = {
    variables: {
      user_name: 'Alex Johnson',
      company_name: 'Acme Corp',
    },
  };

  return (
    <div className="h-screen flex flex-col">
      <header className="px-4 py-2 bg-slate-900 text-white flex items-center justify-between">
        <span className="font-semibold text-sm">KUBUILD Studio</span>
        <button
          type="button"
          onClick={() => setViewMode(viewMode === 'editor' ? 'preview' : 'editor')}
          className="px-3 py-1 bg-blue-600 hover:bg-blue-500 rounded text-xs font-medium"
        >
          {viewMode === 'editor' ? 'Live Preview' : 'Back to Editor'}
        </button>
      </header>

      <main className="flex-1 overflow-hidden">
        {viewMode === 'editor' ? (
          <KubuildEditor
            initialDocument={doc}
            context={context}
            onChange={setDoc}
          />
        ) : (
          <div className="w-full h-full overflow-auto bg-white">
            <KubuildRenderer
              document={doc}
              context={context}
              mode="runtime"
            />
          </div>
        )}
      </main>
    </div>
  );
}
```
