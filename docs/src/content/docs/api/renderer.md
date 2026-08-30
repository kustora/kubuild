---
title: '@kubuild/renderer API'
description: 'Pure recursive React rendering engine, style compiler, runtime context provider, and HTML generator in @kubuild/renderer.'
---

# `@kubuild/renderer` API Reference

Package `@kubuild/renderer` is the lightweight, recursive React rendering engine for KUBUILD. It converts a `PageDocument` tree into high-performance React elements with zero editor chrome, full design token resolution, CSS pseudo-state compilation, and animation execution.

---

## Primary Component

### `<KubuildRenderer />`

The top-level recursive renderer component.

```tsx
import { KubuildRenderer } from '@kubuild/renderer';
import { createDefaultComponentRegistry } from '@kubuild/components';

<KubuildRenderer
  document={document}
  registry={createDefaultComponentRegistry()}
  context={{
    variables: { username: 'Jane Doe' },
    actions: { onSubscribe: (payload) => handleSubscribe(payload) },
  }}
  viewport="desktop" // 'desktop' | 'tablet' | 'mobile'
  mode="runtime"     // 'runtime' | 'editor' | 'preview'
  className="landing-page"
  onNodeClick={(nodeId, e) => console.log('Clicked node:', nodeId)}
  onDiagnostic={(diag) => console.warn(diag)}
/>
```

#### Props

| Prop | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `document` | `PageDocument` | **required** | The document AST tree to render. |
| `registry` | `ComponentRegistry` | `createDefaultComponentRegistry()` | Component registry mapping node types to definitions and renderers. |
| `context` | `RenderContext` | `undefined` | Host runtime context (variables, actions, asset resolver). |
| `viewport` | `'desktop' \| 'tablet' \| 'mobile'` | `'desktop'` | Target viewport for responsive style computation. |
| `mode` | `'runtime' \| 'editor' \| 'preview'` | `'runtime'` | Execution mode. In `editor` mode, error boundaries render inline diagnostic boxes; in `runtime` mode, errors fail gracefully. |
| `className` | `string` | `undefined` | CSS class for the root wrapper div. |
| `onNodeClick` | `(nodeId: string, event: React.MouseEvent) => void` | `undefined` | Node selection click handler. |
| `onNodePropChange` | `(nodeId: string, prop: string, value: unknown) => void` | `undefined` | Direct inline text editing handler. |
| `onActionDispatch` | `(action: ActionBinding) => void` | `undefined` | Custom action dispatcher handler. |
| `onDiagnostic` | `(diag: Diagnostic) => void` | `undefined` | Error and warning diagnostic listener. |

---

## Context Provider

### `<RenderContextProvider />`

Supplies ambient runtime variables and asset resolution functions down the React component tree.

```tsx
import { RenderContextProvider } from '@kubuild/renderer';

<RenderContextProvider
  value={{
    variables: { siteTitle: 'Acme SaaS' },
    assetProvider: {
      resolveUrl: (assetId) => `https://cdn.example.com/assets/${assetId}`,
    },
  }}
>
  <KubuildRenderer document={doc} />
</RenderContextProvider>
```

---

## Styling & Animation Compilers

### 1. `resolveNodeStyles(node, viewport, state?)`
Resolves cascading responsive styles for a specific node and viewport (`base` -> `tablet` -> `mobile`), returning a clean React CSS `style` object.

```typescript
import { resolveNodeStyles } from '@kubuild/renderer';

const cssStyles = resolveNodeStyles(buttonNode, 'mobile', ':hover');
```

### 2. `collectStateStylesCss(document)`
Compiles all pseudo-state overrides (`:hover`, `:active`, `:focus`) across the document into scoped CSS rules.

```typescript
import { collectStateStylesCss } from '@kubuild/renderer';

const styleSheetCss = collectStateStylesCss(document);
```

### 3. `collectAnimationStylesCss(document)`
Compiles keyframe animations and scroll entrance effects defined in `node.animation` into CSS classes.

```typescript
import { collectAnimationStylesCss, replayNodeAnimation } from '@kubuild/renderer';

const animCss = collectAnimationStylesCss(document);

// Trigger programmatic replay of an element's entrance animation
replayNodeAnimation('card-1');
```

---

## Error Boundaries

### `<ComponentErrorBoundary />`

Wraps individual node rendering. In editor mode, displays an informative red alert card containing the component type and error message instead of crashing the application.

---

## HTML Code Generation

### `generateHtmlFromDocument(doc, options?)`

Renders the entire `PageDocument` to clean, standalone, semantic HTML & CSS string without running React in a browser:

```typescript
import { generateHtmlFromDocument } from '@kubuild/renderer';
import { createDefaultComponentRegistry } from '@kubuild/components';

const htmlString = generateHtmlFromDocument(document, {
  registry: createDefaultComponentRegistry(),
  minify: true,
  includeStyles: true,
});
```
