---
title: '@kubuild/core API'
description: 'API reference for the command engine, validation, serialization, security, and template utilities in @kubuild/core.'
---

# `@kubuild/core` API Reference

The `@kubuild/core` package provides the headless engine powering document transformations, history stacks, validations, security sanitization, and import/export utilities.

## Document & Tree Utilities

### `createBlankDocument(options?)`

Creates a valid initial `PageDocument` with metadata and empty root container.

```ts
import { createBlankDocument } from '@kubuild/core';

const doc = createBlankDocument({
  title: 'My Landing Page',
  description: 'Marketing campaign page',
});
```

### `findNodeById(doc, nodeId)`

Recursively searches the document node tree for a node matching the specified ID.

```ts
import { findNodeById } from '@kubuild/core';

const node = findNodeById(doc, 'node-123');
```

---

## Command Engine & History

### `HistoryManager`

Manages undo/redo history stacks using immutable delta commands.

```ts
import { HistoryManager, InsertNodeCommand } from '@kubuild/core';

const history = new HistoryManager(initialDocument);

// Execute a command
const newDoc = history.execute(
  new InsertNodeCommand({
    parentId: 'root',
    index: 0,
    node: {
      id: 'button-1',
      type: 'Button',
      props: { label: 'Click Me' },
      styles: {},
    },
  })
);

// Undo / Redo
const undoneDoc = history.undo();
const redoneDoc = history.redo();
```

---

## Validation & Diagnostics

### `validateDocument(doc, options?)`

Validates a `PageDocument` against the JSON schema and semantic tree constraints.

```ts
import { validateDocument } from '@kubuild/core';

const result = validateDocument(doc);
if (!result.valid) {
  console.error('Validation errors:', result.errors);
}
```

---

## Variable Resolution & Template Engine

### `resolveBindings(templateStr, context)`

Interpolates mustache variables inside text and attributes safely.

```ts
import { resolveBindings } from '@kubuild/core';

const output = resolveBindings('Hello, {{user.name}}!', {
  variables: {
    user: { name: 'Sarah Connor' },
  },
});
// output: "Hello, Sarah Connor!"
```

### `buildSampleVariablesFromCatalog(catalog)`

Generates a mock runtime variables object from a `VariableCatalog` for live canvas previews.

```ts
import { buildSampleVariablesFromCatalog } from '@kubuild/core';

const sampleData = buildSampleVariablesFromCatalog(myCatalog);
```

---

## Security & Sanitization

### `sanitizeHtml(rawHtml, options?)`

Sanitizes user-supplied HTML strings to prevent XSS attacks while preserving allowed formatting.

```ts
import { sanitizeHtml } from '@kubuild/core';

const safeHtml = sanitizeHtml('<script>alert(1)</script><p>Safe content</p>');
// Result: "<p>Safe content</p>"
```

---

## Importer & Exporter

### `StoraPackageExporter` & `StoraPackageImporter`

Handles parsing and archiving `.stora` packages.

```ts
import { StoraPackageExporter, StoraPackageImporter } from '@kubuild/core';

// Export to ZIP Blob
const exporter = new StoraPackageExporter();
const zipBlob = await exporter.exportToZip(document);

// Import from ZIP Blob
const importer = new StoraPackageImporter();
const importedDoc = await importer.importFromZip(zipBlob);
```
