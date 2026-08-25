---
title: '@kubuild/core'
description: Framework-agnostic document engine, commands, undo/redo history, validators, and migrations.
---

`@kubuild/core` is the framework-agnostic engine at the heart of KUBUILD. It has zero React or DOM dependencies.

## Installation

```bash
pnpm add @kubuild/core
```

## Features

### 1. Command Dispatcher
Executes document mutations while preserving immutability:

```ts
import { executeCommand, insertNodeCommand, updatePropsCommand, deleteNodeCommand } from '@kubuild/core';

const res = executeCommand(doc, insertNodeCommand({
  parentId: doc.rootNodeId,
  type: 'Heading',
  props: { text: 'Title' },
}));
```

### 2. History Engine
Manages transactional Undo / Redo state:

```ts
import { HistoryEngine } from '@kubuild/core';

const history = new HistoryEngine(doc);
history.execute(command);
const undoneDoc = history.undo();
```

### 3. Tree Validation & Cycle Detection
Detects orphaned nodes, invalid parent-child loops, and schema anomalies:

```ts
import { validateDocumentTree } from '@kubuild/core';

const validation = validateDocumentTree(doc);
if (!validation.isValid) {
  console.error('Tree errors:', validation.errors);
}
```

### 4. Schema Migration
Upgrades older document schema versions with dry-run support:

```ts
import { migrateDocument } from '@kubuild/core';

const migrationResult = migrateDocument(oldDocumentJson, { targetVersion: 2 });
```
