---
title: Document Model
description: Deep dive into PageDocument, Node structure, styles, and data bindings.
---

The core data structure in KUBUILD is the `PageDocument`. It is a serializable **tree** of nodes rooted at a single `page` node, plus document-level metadata, tracking configuration and theme tokens. The document is the source of truth: the editor changes it only through commands, the renderer only reads it.

## Schema Specification

A minimal, valid `PageDocument` looks like this:

<!-- docs-check: PageDocument -->
```json
{
  "schema": "stora.page",
  "version": "1.2.0",
  "metadata": {
    "title": "Product Launch Landing",
    "description": "High-converting landing page template",
    "createdAt": "2026-08-25T00:00:00.000Z",
    "updatedAt": "2026-08-25T00:00:00.000Z"
  },
  "theme": {
    "colors": { "primary": "#2563eb" }
  },
  "document": {
    "id": "root",
    "type": "page",
    "props": {},
    "styles": { "base": { "padding": "0px" } },
    "children": [
      {
        "id": "hero",
        "type": "section",
        "children": [
          {
            "id": "hero-title",
            "type": "heading",
            "props": {
              "level": 1,
              "text": { "type": "variable", "key": "product.name", "fallback": "Our product" }
            }
          },
          {
            "id": "hero-cta",
            "type": "button",
            "props": { "label": "Buy now" },
            "styles": { "base": { "backgroundColor": "var(--kb-color-primary)" } }
          }
        ]
      }
    ]
  }
}
```

Top-level fields:

- **`schema`**: Always the literal `"stora.page"` (`SCHEMA_NAME`).
- **`version`**: Document schema version string. New documents use `CURRENT_SCHEMA_VERSION` (currently `"1.2.0"`); older documents are upgraded with `migrateDocument` from `@kubuild/core`.
- **`metadata`**: Optional title, description, author, tags, category, timestamps and `custom` host data.
- **`tracking`**: Optional pixel/CAPI tracking configuration (never contains secrets — see the tracking docs).
- **`theme`**: Optional design tokens (`colors`, `fonts`, `radii`, `spacing`), referenced from styles as `var(--kb-color-<key>)` etc. See [Theming & Responsive Design](/guides/theming-and-styling/).
- **`document`**: The root node; its `type` must be `"page"`.

## Node Structure

Every node is a plain object; children are nested inline (there is no flat node map):

- **`id`**: Unique, deterministic string identifier (independent of React keys).
- **`type`**: Registered component type (`section`, `heading`, `button`, `image`, or a custom type registered in the host's `ComponentRegistry`).
- **`props`**: Component-specific values. Any prop may be a variable binding (`{ "type": "variable", "key": "...", "fallback": ... }`) resolved from `RuntimeContext.variables`, or an asset reference (`{ "type": "asset", "assetId": "...", "fallbackUrl": "..." }`). Text components use one canonical prop — `text` (heading, text, paragraph, link, badge, blockquote) or `label` (button).
- **`styles`**: Responsive style layers (see below).
- **`actions`**: Optional `ActionPipeline[]` — trigger (`click`, `submit`, ...) plus ordered steps.
- **`animation`**: Optional entrance/hover/loop animation config.
- **`formConfig`**: Optional form validation/binding config for form nodes.
- **`children`**: Ordered child nodes.

## Multi-Breakpoint Responsive Styling

`styles` has the shape `{ base, desktop, tablet, mobile, states }`. Each layer maps camelCase CSS properties to scalar values (string, number, boolean or `null`); `states` maps a pseudo-class selector such as `":hover"` to another such layer.

```ts
import type { ResponsiveStyles } from '@kubuild/schema/types';

const cardStyles: ResponsiveStyles = {
  base: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 },
  tablet: { gridTemplateColumns: 'repeat(2, 1fr)' },
  mobile: { gridTemplateColumns: '1fr', gap: 16 },
  states: { ':hover': { boxShadow: '0 8px 24px rgba(0,0,0,0.12)' } },
};
```

Each breakpoint layer is merged on top of `base` on its own. Layers do not cascade into each other. Ranges come from the shared `BREAKPOINTS` constant in `@kubuild/schema`: `mobile` < 768px, `tablet` 768–1023px, `desktop` ≥ 1024px. Published pages apply the layers as scoped `@media` rules (`responsive: 'css'`). The editor canvas merges the previewed viewport's layer into inline styles (`responsive: 'viewport'`). The Theming & Responsive Design guide has the details.
