---
title: '@kubuild/core API'
description: 'Framework-agnostic engine for document tree manipulation, immutable command pipeline, history engine, schema validation, and migration.'
---

# `@kubuild/core` API Reference

Package `@kubuild/core` is the pure TypeScript, zero-DOM engine driving KUBUILD. It manages the document model, executes immutable state mutations, enforces undo/redo history, performs structural validation, and provides portable import/export sanitization.

---

## Document Factory & Helpers

### `createBlankDocument(title?)`

Creates a valid, pristine `PageDocument` compliant with the current schema specification.

```typescript
import { createBlankDocument } from '@kubuild/core';

const doc = createBlankDocument('Home Page');
```

### Tree Utilities

| Utility Function | Parameters | Returns | Description |
| :--- | :--- | :--- | :--- |
| `findNodeById(rootNode, targetId)` | `Node, string` | `Node \| null` | Recursively searches the node tree by ID. |
| `findNodeLocation(rootNode, targetId)` | `Node, string` | `{ parent: Node \| null; index: number; node: Node } \| null` | Finds a node along with its parent reference and child array index. |
| `isDescendantOf(rootNode, candidateDescendantId)` | `Node, string` | `boolean` | Checks if a given node is inside another node's descendant subtree. |
| `collectNodeIdSet(rootNode)` | `Node` | `Set<string>` | Collects all unique node IDs across the entire tree. |
| `cloneTreeWithNewIds(node, prefix?, existingIds?)` | `Node, string?, Set<string>?` | `{ clonedNode: Node; idMap: Map<string, string> }` | Deep-clones a node subtree while generating fresh non-colliding UUIDs. |

---

## Command Engine & Mutators

KUBUILD forbids direct in-place node mutation. All changes flow through pure immutable command functions returning a modified copy of the `PageDocument`.

```typescript
import {
  insertNode,
  moveNode,
  updateProps,
  updateStyle,
  deleteNode,
  duplicateNode,
} from '@kubuild/core';

// Insert node
const docAfterInsert = insertNode(doc, {
  parentId: 'section-1',
  node: { id: 'btn-1', type: 'button', props: { label: 'Click Me' } },
  index: 0,
});

// Update props
const docAfterProps = updateProps(doc, {
  nodeId: 'btn-1',
  props: { label: 'Submit Form' },
  merge: true,
});

// Update style breakpoint
const docAfterStyle = updateStyle(doc, {
  nodeId: 'btn-1',
  styles: { backgroundColor: '#3b82f6', color: '#ffffff' },
  breakpoint: 'base',
});

// Delete node
const docAfterDelete = deleteNode(doc, { nodeId: 'btn-1' });
```

---

## History & Undo/Redo Engine

### `DocumentHistoryManager`

A generic, immutable undo/redo history manager that tracks document states with configurable history size and linear branching.

```typescript
import { DocumentHistoryManager, createBlankDocument } from '@kubuild/core';

const history = new DocumentHistoryManager(createBlankDocument(), { maxHistory: 50 });

// Execute an action through the history manager
const result = history.execute((currentDoc) => {
  return updateProps(currentDoc, { nodeId: 'hero-1', props: { title: 'Updated Title' } });
});

console.log(history.canUndo); // true
console.log(history.canRedo); // false

// Undo previous state
const previousDoc = history.undo();

// Redo undone state
const restoredDoc = history.redo();
```

---

## Validation & Cycle Detection

### `validateDocument(doc, options?)`

Performs deep structural schema validation, duplicate ID detection, hierarchy cycle checks, and component registry policy compliance.

```typescript
import { validateDocument } from '@kubuild/core';
import { createDefaultComponentRegistry } from '@kubuild/components';

const registry = createDefaultComponentRegistry();
const validation = validateDocument(doc, { registry });

if (!validation.valid) {
  console.error('Validation failed:');
  for (const error of validation.errors) {
    console.error(`- [${error.code}] ${error.message} at node #${error.nodeId}`);
  }
}
```

---

## Migration Engine

### `migrateDocument(rawDoc, targetVersion?)`

Safely migrates documents between schema versions with validation and automatic backward-compatibility transformers.

```typescript
import { migrateDocument } from '@kubuild/core';

const migrationResult = migrateDocument(legacyJsonDocument, '1.0.0');

if (migrationResult.success) {
  console.log('Migrated document:', migrationResult.document);
} else {
  console.error('Migration failed:', migrationResult.errors);
}
```

---

## Security & Runtime Resolvers

- **`sanitizeHtml(rawHtml)`**: Cleans raw HTML inputs against XSS and script injection attacks.
- **`sanitizeUrl(url)`**: Validates and strips dangerous URL protocols (`javascript:`, `data:text/html`).
- **`resolveBinding(binding, context)`**: Evaluates variable bindings (`{{ user.name }}`) against the runtime context.
