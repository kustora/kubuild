---
title: '@kubuild/renderer API'
description: 'API reference for DocumentRenderer, preview adapters, style resolution, and context in @kubuild/renderer.'
---

# `@kubuild/renderer` API Reference

Package `@kubuild/renderer` provides the production runtime and interactive preview renderer for converting KUBUILD AST documents into performant, accessible React virtual DOM trees or static HTML.

## Components

### `<DocumentRenderer />`

The primary renderer component for displaying a `PageDocument` in production applications or inside preview frames.

```tsx
import { DocumentRenderer } from '@kubuild/renderer';
import { createDefaultComponentRegistry } from '@kubuild/components';

export function PublishedPageView({ document, userData }) {
  return (
    <DocumentRenderer
      document={document}
      registry={createDefaultComponentRegistry()}
      context={{
        variables: {
          user: userData,
          currentYear: new Date().getFullYear(),
        },
        onAction: (actionType, payload) => {
          console.log('User triggered action:', actionType, payload);
        },
      }}
      breakpoint="desktop" // 'desktop' | 'tablet' | 'mobile'
      mode="render"       // 'render' | 'preview' | 'edit'
    />
  );
}
```

#### Props

| Prop | Type | Description |
| :--- | :--- | :--- |
| `document` | `PageDocument` | The AST document to render. |
| `registry` | `ComponentRegistry` *(optional)* | Custom or default component registry. |
| `context` | `RenderContext` *(optional)* | Dynamic variable mapping and action handlers. |
| `breakpoint` | `'desktop' \| 'tablet' \| 'mobile'` *(optional)* | Active viewport for responsive style computation. Defaults to `'desktop'`. |
| `mode` | `'render' \| 'preview' \| 'edit'` *(optional)* | Render mode. `'edit'` enables inline text editing and node selection identifiers. |
| `onNodeClick` | `(nodeId: string, e: MouseEvent) => void` *(optional)* | Callback when an element is clicked in preview/edit mode. |
| `onDiagnostic` | `(diagnostic: Diagnostic) => void` *(optional)* | Diagnostic error/warning handler. |

---

### `<PreviewAdapter />`

Wraps the renderer inside an isolated `<iframe>` or viewport simulation container with automatic CSS scoping and event bridging.

```tsx
import { PreviewAdapter } from '@kubuild/renderer';

<PreviewAdapter
  document={document}
  viewport="tablet"
  zoom={1.0}
/>
```

---

### `<ComponentErrorBoundary />`

Isolates rendering failures in individual custom components, rendering a graceful fallback badge instead of crashing the entire page.

---

## Utilities & Helpers

### `resolveNodeStyles(styles, breakpoint)`

Computes the final flattened CSS properties for a node by layering `base` styles with the specified active breakpoint overrides.

```ts
import { resolveNodeStyles } from '@kubuild/renderer';

const css = resolveNodeStyles(node.styles, 'mobile');
```
