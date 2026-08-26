---
title: '@kubuild/schema API'
description: 'JSON schemas, Zod definitions, AST node types, and validator guards in @kubuild/schema.'
---

# `@kubuild/schema` API Reference

Package `@kubuild/schema` defines the portable `.stora` document specification, node tree structure, responsive style representations, and Zod validation schemas.

## Data Types

### `PageDocument`

The top-level container representing an entire builder page.

```ts
interface PageDocument {
  schema: 'stora.page';
  version: '1.0.0';
  metadata?: DocumentMetadata;
  document: RootPageNode;
}
```

### `Node` (AST Element)

The recursive node object representing every layout container, widget, typography block, or semantic element.

```ts
interface Node {
  id: string;                         // Unique, deterministic element identifier
  type: string;                       // Registered component name ('Box', 'Button', 'Text', etc.)
  props?: Record<string, unknown>;    // Component properties
  styles?: ResponsiveStyles;          // Base and breakpoint-specific styles
  children?: Node[];                  // Child nodes for layout containers
}
```

### `ResponsiveStyles`

Responsive CSS style definitions organized by viewport breakpoint.

```ts
interface ResponsiveStyles {
  base?: Record<string, string | number>;
  desktop?: Record<string, string | number>;
  tablet?: Record<string, string | number>;
  mobile?: Record<string, string | number>;
}
```

### `DocumentMetadata`

```ts
interface DocumentMetadata {
  title: string;
  description?: string;
  author?: string;
  createdAt?: string;
  updatedAt?: string;
  tags?: string[];
  category?: string;
  version?: string;
  custom?: Record<string, unknown>;
}
```

---

## Zod Schemas

All types are paired with matching Zod schemas for runtime schema validation:

- `PageDocumentSchema`
- `NodeSchema`
- `ResponsiveStylesSchema`
- `DocumentMetadataSchema`
- `AssetReferenceSchema`
- `VariableBindingSchema`

```ts
import { PageDocumentSchema } from '@kubuild/schema';

const parseResult = PageDocumentSchema.safeParse(untrustedJson);
if (!parseResult.success) {
  console.error(parseResult.error.format());
}
```

---

## Type Guards & Helpers

### `collectNodeIds(node)`

Returns an array of all node IDs in a subtree.

```ts
import { collectNodeIds } from '@kubuild/schema';

const ids = collectNodeIds(rootNode);
```

### `validateNodeIdUniqueness(node)`

Checks that every node in the document has a unique ID, returning any duplicates.

```ts
import { validateNodeIdUniqueness } from '@kubuild/schema';

const { valid, duplicateIds } = validateNodeIdUniqueness(rootNode);
```

### `generateDeterministicNodeId(prefix, indexOrKey)`

Generates stable IDs for generated or duplicated nodes (e.g. `button_1`, `hero_header_0`).
