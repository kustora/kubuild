---
title: Document Model
description: Deep dive into PageDocument, Node structure, styles, and data bindings.
---

The core data structure in KUBUILD is the `PageDocument`. It represents a normalized, serializable tree of UI elements, styles, dynamic variables, and custom actions.

## Schema Specification

A `PageDocument` object adheres to the following JSON structure:

```json
{
  "schema": "stora.page",
  "version": 1,
  "id": "doc_01j7k5m9...",
  "metadata": {
    "title": "Product Launch Landing",
    "description": "High-converting landing page template",
    "createdAt": "2026-08-25T00:00:00.000Z",
    "updatedAt": "2026-08-25T00:00:00.000Z"
  },
  "rootNodeId": "root_node_id",
  "nodes": {
    "root_node_id": {
      "id": "root_node_id",
      "type": "Container",
      "name": "Page Root",
      "parentId": null,
      "children": ["hero_section_id"],
      "props": {},
      "style": {
        "base": {
          "padding": { "top": "0px", "right": "0px", "bottom": "0px", "left": "0px" }
        }
      }
    }
  },
  "variables": {},
  "actions": {},
  "assets": {}
}
```

## Node Structure

Every UI node is indexed in the flat `nodes` record by its unique identifier (`id`):

- **`id`**: Unique string identifier.
- **`type`**: Registered component type (e.g., `Container`, `Heading`, `Button`, `Image`, `CustomCard`).
- **`name`**: User-customizable label displayed in the Layers panel.
- **`parentId`**: The parent node's ID (`null` for the root container).
- **`children`**: Array of ordered child node IDs.
- **`props`**: Component-specific property values matching the registered schema.
- **`style`**: Multi-breakpoint style dictionary (`base`, `desktop`, `tablet`, `mobile`).
- **`bindings`**: Optional dynamic variable or data source bindings.

## Multi-Breakpoint Responsive Styling

Styles are applied hierarchically with mobile-first or base fallback rules:

```ts
interface ResponsiveStyle {
  base?: StyleProperties;
  desktop?: Partial<StyleProperties>;
  tablet?: Partial<StyleProperties>;
  mobile?: Partial<StyleProperties>;
}
```

When rendering on a tablet viewport, the renderer merges `base` styles with `tablet` overrides seamlessly.
