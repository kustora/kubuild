---
title: 'API @kubuild/core'
description: 'Referensi API command engine, validasi, serialisasi, keamanan, dan template di @kubuild/core.'
---

# Referensi API `@kubuild/core`

Paket `@kubuild/core` menyediakan engine inti tanpa UI (headless) untuk transformasi dokumen, stack riwayat undo/redo, validasi, sanitasi keamanan, serta utilitas impor/ekspor.

## Utilitas Dokumen

### `createBlankDocument(options?)`

Membuat `PageDocument` awal yang valid dengan metadata dan root page container.

```ts
import { createBlankDocument } from '@kubuild/core';

const doc = createBlankDocument({
  title: 'Halaman Baru',
});
```

### `HistoryManager`

Mengelola stack riwayat undo/redo menggunakan command delta yang immutable.

```ts
import { HistoryManager, InsertNodeCommand } from '@kubuild/core';

const history = new HistoryManager(initialDocument);
const updatedDoc = history.execute(new InsertNodeCommand({ ... }));
const undoneDoc = history.undo();
```

---

## Validasi & Resolusi

### `validateDocument(doc)`

Memvalidasi kesesuaian dokumen terhadap skema JSON dan aturan hierarki.

### `resolveBindings(templateStr, context)`

Menginterpolasi variabel mustache secara aman:

```ts
import { resolveBindings } from '@kubuild/core';

const text = resolveBindings('Halo, {{user.name}}!', {
  variables: { user: { name: 'Budi' } },
});
// Hasil: "Halo, Budi!"
```
