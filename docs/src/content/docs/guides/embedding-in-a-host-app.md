---
title: Embedding KUBUILD in a Host App
description: End-to-end integration of the editor and renderer into your own product — custom components, host blocks, templates, saving, the imperative handle, action handlers, backend validation and public rendering.
sidebar:
  order: 1
---

This guide walks through a realistic integration: a funnel/landing-page builder inside a host application (for example a Next.js front end with a Node back end). The host owns products, storage, auth and routing; KUBUILD owns the page document, the editor and the renderer.

The pieces, in the order a page travels through them:

1. A **custom component** that renders host data (`context.variables`).
2. **Host blocks** — ready-made sections in the editor's Blocks tab.
3. **Templates** — "new page from template" and "replace with template".
4. The **editor** with `onSave`, dirty tracking, autosave and the unsaved-changes prompt.
5. The **`EditorHandle`** ref for imperative control.
6. **Host action handlers**.
7. **Backend validation** with the zod-free `@kubuild/schema/types` and `@kubuild/schema/validate`.
8. **Public rendering** with `KubuildRenderer`.

Everything below imports from the individual packages (`@kubuild/schema`, `@kubuild/core`, `@kubuild/components`, `@kubuild/renderer`, `@kubuild/editor`); `@kubuild/react` re-exports all of them if you prefer a single import.

## 1. A custom component that reads `context.variables`

Custom components are registered in a `ComponentRegistry`. The `renderer` slot takes a React component; the renderer calls it with the node, its resolved props, computed styles, the runtime `context` and an `onClick` handler (needed so the editor can select the node).

This product card stores only a variable *key* in the document (`productKey`) and reads the actual product from `context.variables` at render time, so the same page shows the right product for every checkout and never copies host data into the document.

<!-- docs-check: file=product-card.tsx -->
```tsx
import React from 'react';
import type { RenderContext } from '@kubuild/core';
import { ComponentRegistry, createDefaultComponentRegistry } from '@kubuild/components';
import type { Node, PageDocument } from '@kubuild/schema';

/** Props the renderer passes to every custom component `renderer`. */
export interface CustomRendererProps {
  node: Node;
  document: PageDocument;
  props: Record<string, unknown>;
  styles: React.CSSProperties;
  context?: RenderContext;
  children?: React.ReactNode;
  onClick?: (event: React.MouseEvent) => void;
}

export interface Product {
  name: string;
  price: string;
  imageUrl?: string;
}

function isProduct(value: unknown): value is Product {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Product).name === 'string' &&
    typeof (value as Product).price === 'string'
  );
}

export function ProductCard({ node, props, styles, context, onClick }: CustomRendererProps) {
  const key = typeof props.productKey === 'string' ? props.productKey : 'product';
  const product = context?.variables?.[key];

  return (
    // `data-kubuild-node` lets responsive @media rules and editor selection target this node.
    <div data-kubuild-node={node.id} style={styles} onClick={onClick}>
      {isProduct(product) ? (
        <>
          {product.imageUrl && <img src={product.imageUrl} alt={product.name} width={320} />}
          <h3>{product.name}</h3>
          <p>{product.price}</p>
        </>
      ) : (
        <p>No product bound to “{key}”.</p>
      )}
    </div>
  );
}

/** Built-in components plus the host's own. Create it once and share it. */
export function createHostRegistry(): ComponentRegistry {
  const registry = createDefaultComponentRegistry();
  registry.register({
    type: 'product-card',
    label: 'Product Card',
    category: 'custom',
    description: 'Shows the product bound to a runtime variable.',
    acceptsChildren: false,
    defaultProps: { productKey: 'product' },
    defaultStyles: { base: { padding: '24px', borderRadius: '12px', border: '1px solid #e2e8f0' } },
    propFields: [
      {
        name: 'productKey',
        label: 'Product variable',
        type: 'string',
        defaultValue: 'product',
        description: 'Key in context.variables that holds the product.',
      },
    ],
    renderer: ProductCard,
  });
  return registry;
}
```

In the editor, pass a `variableCatalog` so the canvas previews the card with sample data; sample values are preview-only and are never written into the document (see step 4).

## 2. Host blocks

A `BlockDefinition` is a named, categorised node-tree factory. Pass your blocks through the `blocks` prop; with `blocksMode="append"` (the default) they are added to the built-in `STARTER_BLOCKS` (a host block with the same `id` replaces the starter), with `blocksMode="replace"` only your blocks are shown. Blocks are grouped by `category` / `categoryLabel` in the Blocks tab, `thumbnailSvg` is rendered as the preview, and the same registry backs canvas drag-and-drop and `ref.insertBlock(id)`.

<!-- docs-check: file=host-blocks.ts -->
```ts
import type { BlockDefinition } from '@kubuild/components';

export const productHeroBlock: BlockDefinition = {
  id: 'host-product-hero',
  name: 'Product hero',
  category: 'funnel',
  categoryLabel: 'Funnel',
  description: 'Headline, product card and a buy button.',
  thumbnailSvg:
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 24"><rect width="40" height="24" rx="3" fill="#e2e8f0"/></svg>',
  // `generateId` produces unique node ids; always use it instead of fixed ids.
  createNodeTree: (generateId = (prefix = 'node') => `${prefix}-${Math.random().toString(36).slice(2)}`) => ({
    id: generateId('section'),
    type: 'section',
    styles: {
      base: { display: 'flex', flexDirection: 'row', gap: '32px', padding: '48px' },
      mobile: { flexDirection: 'column', padding: '24px' },
    },
    children: [
      {
        id: generateId('heading'),
        type: 'heading',
        props: { text: 'Everything you need to launch', level: 1 },
      },
      { id: generateId('product'), type: 'product-card', props: { productKey: 'product' } },
      {
        id: generateId('button'),
        type: 'button',
        props: { label: 'Buy now', action: { type: 'checkout', payload: { productKey: 'product' } } },
      },
    ],
  }),
};

export const hostBlocks: BlockDefinition[] = [productHeroBlock];
```

The button uses a legacy `props.action` with a host-defined type (`checkout`); step 6 shows how the host handles it.

## 3. Templates

A `TemplateRecord` wraps a complete `PageDocument` plus catalogue metadata. `createTemplateRecord` from `@kubuild/core` fills defaults and extracts `requirements` (required custom components/capabilities) from the document.

<!-- docs-check: file=templates.ts -->
```ts
import { createTemplateRecord } from '@kubuild/core';
import type { PageDocument, TemplateRecord } from '@kubuild/schema';

const salesPage: PageDocument = {
  schema: 'stora.page',
  version: '1.2.0',
  theme: { colors: { primary: '#2563eb' } },
  document: {
    id: 'root',
    type: 'page',
    children: [
      {
        id: 'hero',
        type: 'section',
        children: [
          { id: 'hero-title', type: 'heading', props: { text: 'Limited offer', level: 1 } },
          { id: 'hero-product', type: 'product-card', props: { productKey: 'product' } },
        ],
      },
    ],
  },
};

export const hostTemplates: TemplateRecord[] = [
  createTemplateRecord({
    id: 'tpl-sales-basic',
    name: 'Basic sales page',
    description: 'Hero with the bound product.',
    category: 'landing',
    tags: ['sales', 'product'],
    document: salesPage,
  }),
];
```

With a non-empty `templates` prop the editor toolbar gets a **Templates** action. Applying a template asks for confirmation in an editor dialog, replaces the page with a clone (fresh node ids; actions, animations and form configs preserved) as one undoable step, and calls `onApplyTemplate(template, doc)`. Templates whose `requirements.requiredComponents` are missing from the registry are flagged and cannot be applied.

The same gallery is exported as `TemplatePicker` for "new page from template" screens outside the editor (it previews templates read-only with `KubuildRenderer`):

```tsx
import { cloneTemplateAsPage } from '@kubuild/core';
import { TemplatePicker } from '@kubuild/editor';
import type { PageDocument } from '@kubuild/schema';
import { createHostRegistry } from './product-card';
import { hostTemplates } from './templates';

const registry = createHostRegistry();

export function NewPageDialog({ onCreate }: { onCreate: (doc: PageDocument) => void }) {
  return (
    <TemplatePicker
      templates={hostTemplates}
      registry={registry}
      context={{ variables: { product: { name: 'Sample product', price: '$49' } } }}
      applyLabel="Create page"
      onApply={(template) => onCreate(cloneTemplateAsPage(template))}
    />
  );
}
```

## 4. The editor: saving and dirty state

<!-- docs-check: file=PageEditor.tsx -->
```tsx
import React from 'react';
import { KubuildEditor, type EditorHandle } from '@kubuild/editor';
import type { VariableCatalog } from '@kubuild/core';
import type { PageDocument } from '@kubuild/schema';
import { createHostRegistry } from './product-card';
import { hostBlocks } from './host-blocks';
import { hostTemplates } from './templates';

const registry = createHostRegistry();

const variableCatalog: VariableCatalog = [
  {
    key: 'product',
    label: 'Product',
    type: 'object',
    sampleValue: { name: 'Sample product', price: '$49' },
  },
];

export interface PageEditorProps {
  pageId: string;
  initialDocument: PageDocument;
  editorRef?: React.Ref<EditorHandle>;
}

export function PageEditor({ pageId, initialDocument, editorRef }: PageEditorProps) {
  const [dirty, setDirty] = React.useState(false);

  return (
    <div style={{ height: '100vh' }}>
      <p>{dirty ? 'Unsaved changes' : 'All changes saved'}</p>
      <KubuildEditor
        ref={editorRef}
        initialDocument={initialDocument}
        registry={registry}
        variableCatalog={variableCatalog}
        blocks={hostBlocks}
        blocksMode="append"
        templates={hostTemplates}
        onApplyTemplate={(template) => console.log('applied template', template.id)}
        onSave={async (doc) => {
          const response = await fetch(`/api/pages/${pageId}`, {
            method: 'PUT',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(doc),
          });
          // A rejection shows the editor's "error" save status and keeps the page dirty.
          if (!response.ok) throw new Error(`Save failed: ${response.status}`);
        }}
        onDirtyChange={setDirty}
        autosave={{ debounceMs: 2000 }}
        warnOnUnsavedChanges
      />
    </div>
  );
}
```

- **`onSave(doc)`** (`Promise<void> | void`) enables the toolbar Save button with a `saving` / `saved` / `error` status and the Cmd/Ctrl+S shortcut. The dirty flag resets only after it resolves; concurrent saves are queued so the latest document always lands last.
- **`onDirtyChange(isDirty)`** fires whenever the dirty state flips.
- **`autosave: { debounceMs }`** saves automatically after the last edit (requires `onSave`).
- **`warnOnUnsavedChanges`** shows the browser's "leave site?" prompt while dirty. It defaults to `true` whenever `onSave` is set; pass `false` to disable it.
- **`onChange(doc)`** still fires on every document change if you want to mirror the document elsewhere.

## 5. The imperative `EditorHandle`

`KubuildEditor` forwards a ref of type `EditorHandle`:

| Method | Description |
| :--- | :--- |
| `getDocument()` | The document currently being edited. |
| `replaceDocument(doc, { keepHistory? })` | Swap the document without remounting. Validated with `validateDocument`; returns `{ success, errors, warnings, error? }` and leaves the editor untouched when invalid. With `keepHistory: true` the swap is one undo step and the selection is kept where nodes still exist. |
| `insertBlock(blockOrId, targetId?, index?)` | Insert a `BlockDefinition` (or the id of one in the block registry) into `targetId` (default: selected node, else the page root). Returns `{ success, nodeId?, error? }`. |
| `applyTemplate(template)` | Replace the page with a clone of `template` (undoable). |
| `undo()` / `redo()` / `canUndo()` / `canRedo()` | History control. |
| `isDirty()` | Whether there are edits not yet persisted through `onSave`. |
| `save()` | Run `onSave` now; resolves `false` when there is no handler or the save failed. |

```tsx
import React from 'react';
import type { EditorHandle } from '@kubuild/editor';
import type { PageDocument } from '@kubuild/schema';
import { PageEditor } from './PageEditor';

export function EditorScreen({ pageId, draft, published }: {
  pageId: string;
  draft: PageDocument;
  published: PageDocument;
}) {
  const editorRef = React.useRef<EditorHandle>(null);

  const revertToPublished = () => {
    const result = editorRef.current?.replaceDocument(published, { keepHistory: true });
    if (result && !result.success) console.error('Rejected:', result.errors);
  };

  return (
    <>
      <button onClick={revertToPublished}>Revert to published</button>
      <button onClick={() => editorRef.current?.insertBlock('host-product-hero')}>Add product hero</button>
      <button onClick={() => editorRef.current?.undo()}>Undo</button>
      <button onClick={() => void editorRef.current?.save()}>Save now</button>
      <PageEditor pageId={pageId} initialDocument={draft} editorRef={editorRef} />
    </>
  );
}
```

## 6. Host action handlers

Pages trigger behaviour in two ways:

- **Action pipelines** (`node.actions`, the canonical format) run built-in step types: `navigate`, `api_request`, `show_toast`, `open_modal`/`close_modal`/`toggle_modal`, `set_state`, `reset_form`, `copy_clipboard`, `track_event` and `custom_event`. A `custom_event` step dispatches a DOM `CustomEvent` on `window` (and mirrors it to `dataLayer`), which is the simplest hook for host code; `api_request` calls a host endpoint.
- **Legacy `props.action`** (`{ type, payload }`) is dispatched to `context.actionRegistry`. Host handlers always win. When the host registers none, `navigate`, `open_modal`, `close_modal`, `toggle_modal` and `show_toast` fall back to built-in handlers (`BUILTIN_LEGACY_ACTION_TYPES`); any other unregistered type produces an `UNKNOWN_ACTION` diagnostic (also shown on the editor canvas). Built-in handlers never run in the editor, so clicking a button there never navigates away.

Handlers receive the payload with variable bindings already resolved, plus `{ nodeId, document, variables }`:

<!-- docs-check: file=actions.ts -->
```ts
import type { ActionHandler, ActionRegistry } from '@kubuild/core';

export function createHostActionRegistry(
  startCheckout: (productId: string) => Promise<void>,
): ActionRegistry {
  const handlers = new Map<string, ActionHandler>();
  const registry: ActionRegistry = {
    get: (type) => handlers.get(type),
    register: (type, handler) => void handlers.set(type, handler),
    unregister: (type) => void handlers.delete(type),
  };

  registry.register('checkout', async (payload, { variables }) => {
    const key = typeof payload?.productKey === 'string' ? payload.productKey : 'product';
    const product = variables?.[key] as { id?: string } | undefined;
    if (product?.id) await startCheckout(product.id);
  });

  // Overrides the built-in legacy `navigate` handler, e.g. to use the host router.
  registry.register('navigate', (payload) => {
    if (typeof payload?.url === 'string') window.history.pushState({}, '', payload.url);
  });

  return registry;
}
```

`createMinimalRenderContext({ variables, assets, actions })` from `@kubuild/renderer` builds a context with an in-memory action registry if you do not need a custom one.

## 7. Validating documents on the backend

`@kubuild/schema` bundles zod v4, and its main entry's type declarations reference zod. A backend on another zod major (or without zod) should use the zod-free subpaths:

- **`@kubuild/schema/types`** — plain TypeScript interfaces (`PageDocument`, `Node`, `ResponsiveStyles`, `ActionPipeline`, `Theme`, `TemplateRecord`, `Manifest`, ...).
- **`@kubuild/schema/validate`** — `validateDocument`, `validateNode`, `validateTemplateRecord`, `validateManifest`, `validateTheme`, `validateProjectDocument` and `isValidPageDocument`. Each returns a plain `{ success: true, data, issues: [] } | { success: false, issues }`, with issues as `{ path, message, code }`.

```ts
import type { PageDocument } from '@kubuild/schema/types';
import { validateDocument } from '@kubuild/schema/validate';

export function parsePageBody(body: unknown): PageDocument {
  const result = validateDocument(body);
  if (!result.success) {
    const details = result.issues.map((issue) => `${issue.path || '(root)'}: ${issue.message}`);
    throw new Error(`Invalid page document:\n${details.join('\n')}`);
  }
  return result.data; // defaults applied, safe to store
}
```

This is a structural schema check (including the style/theme injection screening). For component-registry, child-policy, cycle and security checks, also run `validateDocument(doc, { componentRegistry })` from `@kubuild/core` where the registry is available, and `migrateDocument` for documents saved by an older version.

## 8. Public rendering with `KubuildRenderer`

Published pages render with `mode="runtime"`. Without a `viewport` prop the renderer uses `responsive="css"`: base styles inline plus scoped `@media` rules for `tablet`/`mobile`/`desktop`, so the real screen width decides and server-rendered markup matches the hydrated client. `context.theme` overrides document theme tokens per tenant without touching the stored document.

```tsx
import React from 'react';
import { KubuildRenderer } from '@kubuild/renderer';
import type { RuntimeContext } from '@kubuild/core';
import type { PageDocument } from '@kubuild/schema';
import { createHostRegistry, type Product } from './product-card';
import { createHostActionRegistry } from './actions';

const registry = createHostRegistry();

export function PublishedPage({
  doc,
  product,
  brandColor,
}: {
  doc: PageDocument;
  product: Product & { id: string };
  brandColor: string;
}) {
  const context = React.useMemo<RuntimeContext>(
    () => ({
      variables: { product },
      actionRegistry: createHostActionRegistry(async (productId) => {
        window.location.assign(`/checkout/${productId}`);
      }),
      theme: { colors: { primary: brandColor } },
      onDiagnostic: (diagnostic) => console.warn('[kubuild]', diagnostic.code, diagnostic.message),
    }),
    [product, brandColor],
  );

  return <KubuildRenderer document={doc} registry={registry} context={context} mode="runtime" />;
}
```

Use the **same registry** in the editor and the renderer so custom types resolve in both. For static hosting or email-like exports, `generateStandaloneHtml(doc)` from `@kubuild/renderer` produces a self-contained HTML page with the same breakpoint rules (custom React renderers are not part of the static output).

## Checklist

- One shared `ComponentRegistry` (built-ins + custom types) for editor, renderer, `exportPackage` and `importPackage`.
- Host data flows in through `context.variables` (runtime) and `variableCatalog` (editor preview), never into the document.
- Persist with `onSave`; swap documents with `ref.replaceDocument` instead of remounting.
- Validate every document that crosses a trust boundary (`@kubuild/schema/validate` on the server, `importPackage` for `.stora` files).
- Render public pages with `mode="runtime"` and let `responsive="css"` handle breakpoints.
