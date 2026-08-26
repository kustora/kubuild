---
title: '@kubuild/react API'
description: 'Unified all-in-one React bundle for KUBUILD builder, renderer, schema, and components.'
---

# `@kubuild/react` API Reference

`@kubuild/react` is the all-in-one meta-package providing everything needed to build, edit, and render KUBUILD pages in React applications with a single dependency.

## Installation

```bash
npm install @kubuild/react
# or
pnpm add @kubuild/react
# or
bun add @kubuild/react
```

## Re-exported Modules

`@kubuild/react` bundles and re-exports:

- **`@kubuild/editor`**: `<KubuildEditor />`, `<EditorCanvas />`, `<TableSpreadsheetEditor />`, `useEditorStore`
- **`@kubuild/renderer`**: `<DocumentRenderer />`, `<PreviewAdapter />`, `RenderContextProvider`
- **`@kubuild/components`**: `ComponentRegistry`, `createDefaultComponentRegistry`, standard definitions
- **`@kubuild/core`**: `createBlankDocument`, `HistoryManager`, `resolveBindings`, `sanitizeHtml`
- **`@kubuild/schema`**: `PageDocument`, `Node`, `PageDocumentSchema`, type guards

## Quick All-in-One Example

```tsx
import React, { useState } from 'react';
import { 
  KubuildEditor, 
  DocumentRenderer, 
  createBlankDocument, 
  createDefaultComponentRegistry,
  PageDocument 
} from '@kubuild/react';

export function App() {
  const [doc, setDoc] = useState<PageDocument>(() =>
    createBlankDocument({ title: 'My Page' })
  );
  const [mode, setMode] = useState<'edit' | 'preview'>('edit');

  return (
    <div className="h-screen flex flex-col">
      <header className="p-3 border-b flex justify-between">
        <h1 className="font-bold">Page Builder</h1>
        <button 
          onClick={() => setMode(mode === 'edit' ? 'preview' : 'edit')}
          className="px-4 py-1.5 bg-blue-600 text-white rounded"
        >
          {mode === 'edit' ? 'Preview' : 'Back to Editor'}
        </button>
      </header>

      <main className="flex-1 overflow-hidden">
        {mode === 'edit' ? (
          <KubuildEditor 
            initialDocument={doc} 
            onChange={setDoc} 
          />
        ) : (
          <DocumentRenderer 
            document={doc} 
            mode="render" 
          />
        )}
      </main>
    </div>
  );
}
```
