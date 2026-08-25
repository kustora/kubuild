---
title: '@kubuild/schema'
description: Runtime Zod schemas, TypeScript types, and JSON Schema generators.
---

`@kubuild/schema` defines the contract for document structures, node definitions, style tokens, and asset manifests.

## Installation

```bash
pnpm add @kubuild/schema
```

## Key Exports

### Schemas & TypeScript Types

- **`PageDocumentSchema`** / **`type PageDocument`**: Full document data model.
- **`NodeSchema`** / **`type Node`**: Individual UI element definition.
- **`ResponsiveStyleSchema`** / **`type ResponsiveStyle`**: Responsive style rules across `base`, `desktop`, `tablet`, `mobile`.
- **`VariableBindingSchema`** / **`type VariableBinding`**: Dynamic property expression evaluation bindings.
- **`StoraPackageManifestSchema`**: Archive header validation.

### Utilities

```ts
import { PageDocumentSchema, CURRENT_SCHEMA_VERSION, SCHEMA_NAME } from '@kubuild/schema';

// Validate untrusted document JSON
const parseResult = PageDocumentSchema.safeParse(rawJsonData);

if (!parseResult.success) {
  console.error('Validation errors:', parseResult.error.format());
} else {
  const document = parseResult.data;
}
```
