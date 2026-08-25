---
title: Command Engine & History
description: Deterministic mutations, Command pattern, HistoryEngine, and Undo/Redo mechanisms.
---

KUBUILD employs the **Command Pattern** to manage all modifications to the `PageDocument`. Direct node mutations are prohibited to maintain strict immutability, transactional reliability, and timeline replay.

## Core Commands

All edits translate into structured command payloads:

- **`INSERT_NODE`**: Adds a new child node at a specific index under a parent container.
- **`MOVE_NODE`**: Repositions a node within the same parent or moves it across containers.
- **`UPDATE_PROPS`**: Updates component-specific props with partial merging.
- **`UPDATE_STYLE`**: Modifies base or breakpoint-specific style properties.
- **`DELETE_NODE`**: Recursively removes a node and all its descendants.
- **`DUPLICATE_NODE`**: Clones a node tree with freshly generated IDs.

## Executing Commands

Commands are dispatched via the pure `executeCommand` function in `@kubuild/core`:

```ts
import { executeCommand, insertNodeCommand } from '@kubuild/core';

const command = insertNodeCommand({
  parentId: 'root_node',
  type: 'Button',
  props: { label: 'Click Me', variant: 'primary' },
});

const result = executeCommand(currentDoc, command);

if (result.success) {
  // result.document is the new immutable state
  console.log('Document updated successfully');
} else {
  console.error('Command failed:', result.error);
}
```

## HistoryEngine (Undo / Redo)

The `HistoryEngine` maintains past and future command stacks with snapshot compression:

```ts
import { HistoryEngine } from '@kubuild/core';

const history = new HistoryEngine(initialDocument, { maxHistory: 50 });

// Apply command
history.execute(insertNodeCommand({ ... }));

// Undo
if (history.canUndo()) {
  const previousDoc = history.undo();
}

// Redo
if (history.canRedo()) {
  const nextDoc = history.redo();
}
```
