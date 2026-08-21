# KUBUILD Architecture Documentation

**Product:** KUBUILD  
**CODE NAME:** BUILDER-01  
**Document Type:** Architecture Documentation  
**Status:** Draft  
**Version:** 0.1.0

---

## 1. Overview

`kubuild` adalah library web builder yang dirancang untuk membuat, mengedit, merender, mengimpor, dan mengekspor halaman web secara portable.

`kubuild` tidak bergantung pada Stora.page, database tertentu, CMS tertentu, atau backend tertentu.

Stora.page merupakan salah satu consumer dari `kubuild`.

```
                         kubuild
                            |
        +-------------------+-------------------+
        |                   |                   |
     Builder             Renderer           Import/Export
        |                   |                   |
        +-------------------+-------------------+
                            |
                     Document Schema
                            |
                            v
                       .stora Format
```

Prinsip utama:

> Build once, render anywhere, export/import without losing editability.

---

# 2. Architecture Goals

## 2.1 Goals

Architecture `kubuild` harus:

- Framework-independent pada core.
    
- Reusable oleh aplikasi lain.
    
- Memisahkan Builder dan Renderer.
    
- Menggunakan document model sebagai source of truth.
    
- Mendukung static dan dynamic content.
    
- Mendukung template.
    
- Mendukung export/import portable.
    
- Mendukung custom component.
    
- Mendukung custom variable provider.
    
- Mendukung custom action provider.
    
- Tidak bergantung pada backend tertentu.
    
- Memungkinkan ecosystem/community di masa depan.
    

## 2.2 Non-Goals

Untuk MVP, `kubuild` tidak bertanggung jawab terhadap:

- Authentication.
    
- User management.
    
- Billing.
    
- Database business domain.
    
- CMS.
    
- Hosting.
    
- Domain management.
    
- Marketplace backend.
    
- Payment.
    
- Arbitrary JavaScript dari template komunitas.
    

---

# 3. High-Level Architecture

```
                         APPLICATION
                              |
                     +--------+--------+
                     |                 |
                     v                 v
                  Builder           Renderer
                     |                 |
                     +--------+--------+
                              |
                              v
                         kubuild/core
                              |
             +----------------+----------------+
             |                |                |
             v                v                v
         Document          Components       Runtime Context
             |                |                |
             |                |          +-----+------+
             |                |          |            |
             v                v       Variables     Actions
        Serialization    Registry
             |
             v
        .stora Package
```

---

# 4. Core Architecture Principles

## 4.1 Core Must Be Framework Independent

Package `@kubuild/core` harus berupa pure TypeScript.

Core tidak boleh mengimpor:

- React
    
- Vue
    
- Svelte
    
- Tailwind
    
- Browser-specific UI library
    

Core bertanggung jawab terhadap:

- Document.
    
- Node.
    
- Tree operations.
    
- Commands.
    
- History.
    
- Serialization.
    
- Validation.
    
- Migration.
    
- Variable references.
    
- Component definitions.
    

```
@kubuild/core
       |
       +---- React
       +---- Vue
       +---- Svelte
       +---- Other adapters
```

---

# 5. Package Architecture

Recommended monorepo:

```
kubuild/
|
+-- apps/
|   |
|   +-- playground/
|   +-- docs/
|   +-- devtools/
|
+-- packages/
|   |
|   +-- core/
|   |   +-- @kubuild/core
|   |
|   +-- schema/
|   |   +-- @kubuild/schema
|   |
|   +-- react/
|   |   +-- @kubuild/react
|   |
|   +-- editor/
|   |   +-- @kubuild/editor
|   |
|   +-- components/
|   |   +-- @kubuild/components
|   |
|   +-- renderer/
|   |   +-- @kubuild/renderer-react
|   |
|   +-- importer/
|   |   +-- @kubuild/importer
|   |
|   +-- exporter/
|   |   +-- @kubuild/exporter
|   |
|   +-- cli/
|       +-- @kubuild/cli
|
+-- package.json
+-- pnpm-workspace.yaml
+-- turbo.json
```

---

# 6. Dependency Direction

Dependency direction harus mengarah ke core.

```
                   @kubuild/core
                         ^
                         |
              +----------+----------+
              |          |          |
           schema       react    renderer
                         |
                       editor
                         |
                     application
```

`core` tidak boleh mengetahui package di atasnya.

Contoh yang tidak diperbolehkan:

```
core -> React
core -> Tailwind
core -> Editor
core -> Stora.page
```

---

# 7. Recommended Technology Stack

## 7.1 Core

- TypeScript
    
- Zod
    
- Vitest
    

## 7.2 Monorepo

- pnpm
    
- Turborepo
    

## 7.3 Builder UI

- React
    
- TypeScript
    
- Vite
    
- Zustand
    
- dnd-kit
    
- Tailwind CSS
    

## 7.4 Rich Text

- Tiptap
    

## 7.5 Testing

- Vitest
    
- Playwright
    
- React Testing Library
    

## 7.6 Documentation

- VitePress atau Docusaurus
    

---

# 8. Tailwind CSS Policy

Tailwind CSS digunakan untuk **UI milik Builder**, bukan sebagai format styling utama halaman user.

## 8.1 Allowed

```
<div className="flex h-full border-r bg-white">
```

Contoh penggunaan:

- Sidebar.
    
- Toolbar.
    
- Inspector.
    
- Dialog.
    
- Dropdown.
    
- Context menu.
    
- Builder navigation.
    
- Internal design system.
    

## 8.2 Not Recommended

Document user jangan menyimpan:

```
{
  "className": "px-6 py-3 bg-blue-500 rounded-lg"
}
```

Karena hal tersebut membuat document bergantung pada Tailwind.

## 8.3 Recommended

Document menyimpan style abstraction:

```
{
  "styles": {
    "padding": {
      "top": 12,
      "right": 24,
      "bottom": 12,
      "left": 24
    },
    "background": "#3b82f6",
    "borderRadius": 8
  }
}
```

Renderer kemudian menerjemahkan style tersebut menjadi CSS.

---

# 9. Document Model

Document adalah source of truth.

Contoh:

```
{
  "schema": "stora.page",
  "version": "1.0",
  "document": {
    "id": "page_123",
    "type": "page",
    "children": []
  }
}
```

Document terdiri dari Node Tree.

```
Page
|
+-- Section
|   |
|   +-- Container
|       |
|       +-- Heading
|       +-- Text
|       +-- Button
|
+-- Section
|
+-- Footer
```

---

# 10. Node Model

Setiap node mempunyai ID unik.

```
interface Node {
  id: string;
  type: string;
  props?: Record<string, unknown>;
  styles?: StyleDefinition;
  children?: Node[];
}
```

Contoh:

```
{
  "id": "node_hero",
  "type": "hero",
  "props": {
    "title": "Build your website"
  },
  "children": []
}
```

ID digunakan untuk:

- Selection.
    
- Update.
    
- Delete.
    
- Duplicate.
    
- Move.
    
- History.
    
- Collaboration di masa depan.
    

---

# 11. Component Registry

Component tidak boleh hardcoded ke editor.

```
interface ComponentDefinition {
  type: string;
  label: string;
  category: string;
  component: unknown;
  schema?: unknown;
  acceptsChildren?: boolean;
}
```

Registry:

```
registerComponent({
  type: "button",
  label: "Button",
  category: "Basic",
  component: Button,
  acceptsChildren: false
});
```

Registry digunakan oleh:

```
Component Registry
|
+-- Builder
+-- Renderer
+-- Inspector
+-- Drag & Drop
+-- Validation
```

---

# 12. Builder Architecture

Builder adalah runtime untuk editing.

```
Builder
|
+-- Canvas
|
+-- Component Panel
|
+-- Layers Panel
|
+-- Inspector
|
+-- Toolbar
|
+-- Responsive Controls
|
+-- History
|
+-- Clipboard
|
+-- Preview
```

Builder menggunakan `@kubuild/core`.

```
Editor UI
    |
    v
Editor State
    |
    v
Commands
    |
    v
Document
```

---

# 13. Editor State

Zustand digunakan untuk state UI/editor.

Contoh:

```
interface EditorState {
  document: Document;
  selectedNodeId: string | null;
  hoveredNodeId: string | null;
  viewport: "desktop" | "tablet" | "mobile";

  selectNode(id: string): void;
  updateNode(id: string, changes: unknown): void;
  deleteNode(id: string): void;
  duplicateNode(id: string): void;
}
```

Document engine tetap berada di core dan tidak bergantung pada Zustand.

---

# 14. Command System

Mutation sebaiknya melalui command.

Contoh:

```
INSERT_NODE
UPDATE_NODE
DELETE_NODE
MOVE_NODE
DUPLICATE_NODE
UPDATE_STYLE
```

Flow:

```
User Action
    |
    v
Command
    |
    v
Document Mutation
    |
    v
History
```

Keuntungan:

- Undo/redo lebih mudah.
    
- Debugging lebih mudah.
    
- Testing lebih mudah.
    
- Collaboration di masa depan lebih memungkinkan.
    

---

# 15. Undo / Redo

History disediakan oleh core.

```
State 1
   |
   v
State 2
   |
   v
State 3
   |
   v
State 4 <- current
```

Undo:

```
State 3 <- current
```

Redo:

```
State 4 <- current
```

MVP dapat menggunakan snapshot history terlebih dahulu.

Optimization menggunakan command/event history dapat dilakukan kemudian.

---

# 16. Renderer Architecture

Renderer menerima tiga input utama:

```
Document
Runtime Context
Component Registry
```

```
Document
   |
   v
Renderer
   |
   +-- Resolve Component
   +-- Resolve Props
   +-- Resolve Styles
   +-- Resolve Variables
   +-- Render Children
   |
   v
Output
```

Renderer tidak memiliki:

- Sidebar.
    
- Inspector.
    
- Drag & drop.
    
- Selection overlay.
    
- Editor state.
    

---

# 17. Builder Renderer vs Production Renderer

Editor dapat menggunakan renderer dengan editor wrapper:

```
Editor
  |
  v
Editor Wrapper
  |
  v
Component Renderer
```

Production:

```
Production
  |
  v
Component Renderer
```

Dengan demikian component rendering tetap konsisten.

---

# 18. Variable System

Dynamic content menggunakan variable reference.

Contoh:

```
{
  "type": "heading",
  "props": {
    "text": {
      "type": "variable",
      "key": "site.name"
    }
  }
}
```

Runtime:

```
{
  variables: {
    site: {
      name: "My Website"
    }
  }
}
```

Result:

```
{{ site.name }}
        |
        v
"My Website"
```

Core tidak mengetahui sumber variable.

---

# 19. Runtime Context

Recommended abstraction:

```
interface RuntimeContext {
  variables?: Record<string, unknown>;
  actions?: ActionRegistry;
  assets?: AssetProvider;
}
```

Consumer dapat menyediakan implementasi sendiri.

```
Consumer Application
|
+-- Variables
+-- Actions
+-- Assets
+-- Custom Components
```

---

# 20. Collection System

Collection memungkinkan rendering berulang dari array.

Document:

```
{
  "type": "collection",
  "data": {
    "source": "products"
  },
  "children": [
    {
      "type": "card",
      "bindings": {
        "title": "item.name",
        "price": "item.price"
      }
    }
  ]
}
```

Runtime:

```
{
  "variables": {
    "products": [
      {
        "name": "Product A",
        "price": 10000
      },
      {
        "name": "Product B",
        "price": 20000
      }
    ]
  }
}
```

---

# 21. Action System

Action digunakan untuk behavior.

Contoh:

```
{
  "type": "button",
  "props": {
    "text": "Buy Now"
  },
  "action": {
    "type": "navigate",
    "payload": {
      "url": "/checkout"
    }
  }
}
```

Consumer dapat mendaftarkan action:

```
registerAction({
  type: "custom-action",
  execute: async (payload) => {
    // consumer implementation
  }
});
```

`kubuild` hanya menyediakan abstraction.

---

# 22. Asset System

Asset storage harus diabstraksikan.

```
interface AssetProvider {
  upload(file: File): Promise<Asset>;
  delete(assetId: string): Promise<void>;
  resolve(assetId: string): string;
  list(): Promise<Asset[]>;
}
```

Consumer dapat menggunakan:

- Local storage.
    
- S3.
    
- Cloudflare R2.
    
- CDN.
    
- Custom API.
    

---

# 23. Style System

Style document tidak menggunakan Tailwind sebagai source format.

Style abstraction:

```
Layout
+-- display
+-- width
+-- height
+-- position

Spacing
+-- margin
+-- padding

Typography
+-- fontFamily
+-- fontSize
+-- fontWeight
+-- lineHeight

Background
+-- color
+-- image
+-- gradient

Border
+-- width
+-- style
+-- radius

Effects
+-- shadow
+-- opacity
+-- transform
```

---

# 24. Responsive System

Style dapat memiliki breakpoint override.

```
{
  "styles": {
    "desktop": {
      "fontSize": 48
    },
    "tablet": {
      "fontSize": 36
    },
    "mobile": {
      "fontSize": 28
    }
  }
}
```

Builder menyediakan:

```
Desktop
Tablet
Mobile
```

Renderer menentukan style berdasarkan viewport.

---

# 25. Design Tokens

Theme dapat mendefinisikan design tokens.

```
{
  "tokens": {
    "colors": {
      "primary": "#3b82f6",
      "background": "#ffffff",
      "text": "#111827"
    },
    "spacing": {
      "sm": 8,
      "md": 16,
      "lg": 24
    }
  }
}
```

Component dapat menggunakan token.

```
color: token.colors.primary
```

Hal ini memungkinkan perubahan theme tanpa mengubah seluruh document.

---

# 26. Template Architecture

Template adalah reusable document package.

```
Template
|
+-- Metadata
+-- Document
+-- Assets
+-- Design Tokens
+-- Variable Definitions
+-- Requirements
```

Template tidak boleh mengubah page lain.

Saat digunakan:

```
Template
   |
   v
Clone
   |
   v
New Document
```

---

# 27. `.stora` Format

`.stora` adalah portable package.

```
my-landing.stora
|
+-- manifest.json
+-- page.json
+-- metadata.json
|
+-- assets/
    +-- hero.webp
    +-- logo.svg
```

Manifest minimal:

```
{
  "schema": "stora.page",
  "version": "1.0",
  "builder": {
    "minVersion": "1.0"
  },
  "requirements": []
}
```

---

# 28. Export Architecture

```
Document
   |
   +-- Collect Assets
   +-- Collect Metadata
   +-- Collect Requirements
   +-- Validate
   |
   v
Package Builder
   |
   v
.stora
```

Export harus menghasilkan package yang self-contained untuk asset yang memang menjadi bagian dari page.

---

# 29. Import Architecture

```
.stora
   |
   v
Read Package
   |
   v
Validate Manifest
   |
   v
Validate Schema
   |
   v
Check Compatibility
   |
   v
Extract Assets
   |
   v
Migrate Document
   |
   v
Document
```

Importer tidak boleh langsung mempercayai file dari user/community.

Semua package harus divalidasi.

---

# 30. Schema Versioning

Document:

```
{
  "schema": "stora.page",
  "version": "1.0"
}
```

Migration:

```
v1
 |
 +-- migration
 |
 v
v2
 |
 +-- migration
 |
 v
Current Version
```

Schema migration harus deterministic dan testable.

---

# 31. Security Model

`.stora` adalah untrusted input.

Importer harus:

- Validate schema.
    
- Reject invalid structures.
    
- Validate asset metadata.
    
- Prevent path traversal.
    
- Limit package size.
    
- Limit asset size.
    
- Sanitize SVG where necessary.
    
- Never execute JavaScript from imported template.
    
- Never execute arbitrary code during import.
    
- Validate component references.
    

Community template MVP harus bersifat data-driven.

---

# 32. Plugin and Extension Architecture

Jangka panjang, `kubuild` dapat mendukung:

```
Plugin
|
+-- Components
+-- Actions
+-- Data providers
+-- Inspector fields
+-- Panels
+-- Commands
```

Contoh:

```
builder.use(plugin);
```

Namun arbitrary JavaScript dari marketplace tidak boleh langsung dieksekusi tanpa sandbox/permission model.

---

# 33. Stora.page as Consumer

Stora.page menggunakan `kubuild`.

```
Stora.page
|
+-- Authentication
+-- User Management
+-- Pages
+-- Templates
+-- Community
+-- Marketplace
+-- Storage
|
+-- kubuild
    |
    +-- Builder
    +-- Renderer
    +-- Importer
    +-- Exporter
```

Tidak ada dependency balik:

```
kubuild -> Stora.page
```

Yang diperbolehkan:

```
Stora.page -> kubuild
```

---

# 34. Example Consumer Integration

```
import { Builder } from "@kubuild/editor";

export function PageEditor({ document }) {
  return (
    <Builder
      document={document}
      components={components}
      variables={variables}
      assetProvider={assetProvider}
      onChange={handleChange}
    />
  );
}
```

Production:

```
import { Renderer } from "@kubuild/renderer-react";

export function Page({ document }) {
  return (
    <Renderer
      document={document}
      variables={runtimeVariables}
      components={components}
    />
  );
}
```

---

# 35. Technology Boundaries

## Core

Must not depend on:

- React
    
- Tailwind
    
- Browser DOM
    
- Stora.page
    

## Editor

May depend on:

- React
    
- Tailwind
    
- Zustand
    
- dnd-kit
    

## Renderer

Initial implementation may use:

- React
    

The renderer API should remain abstract enough that another renderer can be implemented later.

## Consumer

Responsible for:

- Persistence.
    
- Authentication.
    
- API.
    
- Asset storage.
    
- Variables.
    
- Actions.
    
- Custom components.
    

---

# 36. Recommended Development Order

## Phase 1 — Foundation

1. Monorepo setup.
    
2. TypeScript configuration.
    
3. `@kubuild/core`.
    
4. `@kubuild/schema`.
    
5. Document model.
    
6. Node tree operations.
    
7. Validation.
    
8. Serialization.
    

## Phase 2 — Renderer

1. Component registry.
    
2. Base components.
    
3. Renderer.
    
4. Style resolver.
    
5. Variable resolver.
    
6. Responsive resolver.
    

## Phase 3 — Builder

1. React integration.
    
2. Editor state.
    
3. Canvas.
    
4. Selection.
    
5. Component panel.
    
6. Inspector.
    
7. Drag & drop.
    
8. Tree manipulation.
    
9. Undo/redo.
    

## Phase 4 — Portable Format

1. `.stora` manifest.
    
2. Exporter.
    
3. Importer.
    
4. Asset packaging.
    
5. Validation.
    
6. Migration.
    

## Phase 5 — Template

1. Template schema.
    
2. Template metadata.
    
3. Save as template.
    
4. Template import.
    
5. Template cloning.
    

## Phase 6 — Ecosystem

1. Custom components.
    
2. Actions.
    
3. Variable definitions.
    
4. Plugin API.
    
5. Community templates.
    
6. Marketplace.
    

---

# 37. MVP Architecture

MVP target:

```
                     @kubuild/core
                           |
             +-------------+-------------+
             |                           |
      @kubuild/renderer            @kubuild/editor
             |                           |
             |                     React + Tailwind
             |                           |
             +-------------+-------------+
                           |
                      Document JSON
                           |
                    +------+------+
                    |             |
                 Export         Import
                    |             |
                    +------+------+
                           |
                      .stora Package
```

Required MVP capabilities:

- Document tree.
    
- Component registry.
    
- Basic components.
    
- Renderer.
    
- Builder canvas.
    
- Drag & drop.
    
- Inspector.
    
- Styling.
    
- Responsive.
    
- Undo/redo.
    
- Variables.
    
- Export.
    
- Import.
    
- Template cloning.
    

---

# 38. Architecture Decision Summary

|Decision|Choice|Reason|
|---|---|---|
|Language|TypeScript|Strong typing and ecosystem|
|Monorepo|pnpm + Turborepo|Package-oriented architecture|
|Core|Framework-independent|Reusability|
|Builder UI|React|Mature interactive UI ecosystem|
|Builder bundler|Vite|Fast client-side development|
|State|Zustand|Lightweight editor state|
|DnD|dnd-kit|Flexible nested drag/drop|
|Rich text|Tiptap|Extensible editor|
|Builder UI styling|Tailwind CSS|Fast and consistent UI development|
|Page styling format|kubuild Style Schema|Portable document|
|Validation|Zod|Runtime schema validation|
|Renderer|React initially|Reuse component ecosystem|
|Portable format|`.stora`|Editable export/import|
|Dynamic content|Variables|Backend/framework agnostic|
|Persistence|Consumer responsibility|Core remains independent|

---

# 39. Key Architectural Rule

The most important rule in the entire architecture:

```
                 PAGE DOCUMENT
                       |
          +------------+------------+
          |                         |
       Builder                   Renderer
          |                         |
       Editing                   Runtime
```

The Builder must **never become the source of truth**.

The Document is the source of truth.

Therefore:

```
Builder -> modifies Document
Renderer -> reads Document
Exporter -> serializes Document
Importer -> creates Document
Template -> contains Document
```

This makes the entire ecosystem portable and keeps `kubuild` independent from Stora.page.