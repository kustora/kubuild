---
title: 'API @kubuild/react'
description: 'Entrypoint React terpadu (all-in-one) untuk builder visual, renderer, skema dokumen, dan pustaka komponen KUBUILD.'
---

# Referensi API `@kubuild/react`

`@kubuild/react` adalah meta-package terpadu yang mengekspor seluruh lapisan KUBUILD ke dalam satu dependensi praktis. Dengan memasang `@kubuild/react`, aplikasi host langsung mendapatkan akses ke visual builder (`<KubuildEditor />`), pure recursive renderer (`<KubuildRenderer />`), schema dokumen, registry komponen, dan engine manipulasi dokumen.

---

## Instalasi

```bash
npm install @kubuild/react
# atau
pnpm add @kubuild/react
# atau
bun add @kubuild/react
```

---

## Lapisan yang Di-reexport

`@kubuild/react` menggabungkan modul-modul berikut ke dalam satu import:

```
┌─────────────────────────────────────────────────────────────┐
│                       @kubuild/react                        │
├───────────────┬─────────────────┬──────────────┬────────────┤
│   @kubuild/   │    @kubuild/    │  @kubuild/   │ @kubuild/  │
│    editor     │    renderer     │  components  │    core    │
│ (Visual UI)   │ (Pure Renderer) │  (Registry)  │  (Engine)  │
├───────────────┴─────────────────┴──────────────┴────────────┤
│                       @kubuild/schema                       │
│                     (Skema Dokumen Zod)                     │
└─────────────────────────────────────────────────────────────┘
```

1. **`@kubuild/editor`** — `<KubuildEditor />`, `<EditorCanvas />`, `<LeftSidebar />`, `<InspectorPanel />`, `<TableSpreadsheetEditor />`, `EditorConfig`, `useEditorStore`
2. **`@kubuild/renderer`** — `<KubuildRenderer />`, `RenderContextProvider`, `resolveNodeStyles`, `collectStateStylesCss`, `collectAnimationStylesCss`
3. **`@kubuild/components`** — `ComponentRegistry`, `createDefaultComponentRegistry`, `coreComponentDefinitions`, `STARTER_BLOCKS`
4. **`@kubuild/core`** — `createBlankDocument`, `validateDocument`, `findNodeById`, `resolveBinding`, `sanitizeHtml`, `sanitizeUrl`
5. **`@kubuild/schema`** — `PageDocument`, `Node`, `PageDocumentSchema`, `AnimationConfig`, `ResponsiveStyles`

---

## Komponen Utama

### 1. `<KubuildEditor />`

Visual page builder interaktif lengkap dengan drag-and-drop, inline text editing, live code viewer, style inspector, dan konfigurasi modularitas (`config`).

```tsx
import { KubuildEditor, createBlankDocument } from '@kubuild/react';

export function EditorView() {
  const [document, setDocument] = useState(() => createBlankDocument('Landing Page Saya'));

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

Renderer React murni rekursif tanpa elemen UI editor builder. Cocok untuk halaman publik, live preview, maupun penerbitan halaman produksi.

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

## Contoh Lengkap Dual-Mode (Editor + Live Preview)

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
    createBlankDocument('Beranda Utama')
  );
  const [viewMode, setViewMode] = useState<'editor' | 'preview'>('editor');

  const context: RuntimeContext = {
    variables: {
      user_name: 'Budi Santoso',
      company_name: 'PT Kustora Digital',
    },
  };

  return (
    <div className="h-screen flex flex-col">
      <header className="px-4 py-2 bg-slate-900 text-white flex items-center justify-between">
        <span className="font-semibold text-sm">KUBUILD Studio</span>
        <button
          type="button"
          onClick={() => setViewMode(viewMode === 'editor' ? 'preview' : 'editor')}
          className="px-3 py-1 bg-blue-600 hover:bg-blue-500 rounded text-xs font-medium cursor-pointer"
        >
          {viewMode === 'editor' ? 'Live Preview' : 'Kembali ke Editor'}
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
