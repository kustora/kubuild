---
title: '@kubuild/core'
description: Core engine dokumen yang independen dari framework, command engine, riwayat undo/redo, validator, dan migrasi.
---

`@kubuild/core` adalah engine inti di balik KUBUILD yang tidak memiliki ketergantungan pada React maupun DOM browser.

## Instalasi

```bash
pnpm add @kubuild/core
```

## Fitur Utama

### 1. Command Dispatcher
Mengeksekusi manipulasi dokumen dengan menjaga data tetap *immutable*:

```ts
import { executeCommand, insertNodeCommand, updatePropsCommand, deleteNodeCommand } from '@kubuild/core';

const res = executeCommand(doc, insertNodeCommand({
  parentId: doc.rootNodeId,
  type: 'Heading',
  props: { text: 'Judul Baru' },
}));
```

### 2. History Engine
Mengelola antrean riwayat Undo dan Redo secara transaksional:

```ts
import { HistoryEngine } from '@kubuild/core';

const history = new HistoryEngine(doc);
history.execute(command);
const undoneDoc = history.undo();
```

### 3. Validasi Pohon Node & Deteksi Siklus
Mendeteksi node yang tidak terhubung (*orphaned*), loop sirkular antara parent-child, dan anomali struktur:

```ts
import { validateDocumentTree } from '@kubuild/core';

const validation = validateDocumentTree(doc);
if (!validation.isValid) {
  console.error('Error struktur pohon:', validation.errors);
}
```

### 4. Migrasi Skema Versi
Melakukan upgrade struktur dokumen dari versi lama ke versi baru secara aman:

```ts
import { migrateDocument } from '@kubuild/core';

const migrationResult = migrateDocument(oldDocumentJson, { targetVersion: 2 });
```
