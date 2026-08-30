---
title: 'API @kubuild/core'
description: 'Engine agnostik-framework untuk manipulasi tree dokumen, pipeline command mutasi immutable, history undo/redo, validasi, dan migrasi skema.'
---

# Referensi API `@kubuild/core`

Paket `@kubuild/core` adalah engine TypeScript murni tanpa dependensi DOM/React yang menggerakkan KUBUILD. Paket ini mengelola model dokumen, menjalankan mutasi state immutable, mengelola riwayat undo/redo, menjalankan validasi struktur, dan menyediakan utilitas keamanan import/export.

---

## Pembuatan Dokumen & Utilitas Tree

### `createBlankDocument(title?)`

Membuat dokumen `PageDocument` baru yang valid dan siap digunakan sesuai spesifikasi skema terkini.

```typescript
import { createBlankDocument } from '@kubuild/core';

const doc = createBlankDocument('Halaman Utama');
```

### Utilitas Tree Dokumen

| Fungsi Utilitas | Parameter | Mengembalikan | Deskripsi |
| :--- | :--- | :--- | :--- |
| `findNodeById(rootNode, targetId)` | `Node, string` | `Node \| null` | Mencari node secara rekursif berdasarkan ID. |
| `findNodeLocation(rootNode, targetId)` | `Node, string` | `{ parent: Node \| null; index: number; node: Node } \| null` | Menemukan node beserta referensi parent dan indeks array anak. |
| `isDescendantOf(rootNode, candidateDescendantId)` | `Node, string` | `boolean` | Memeriksa apakah suatu node berada di dalam subtree turunan node lain. |
| `collectNodeIdSet(rootNode)` | `Node` | `Set<string>` | Mengumpulkan semua set ID unik node di seluruh pohon dokumen. |
| `cloneTreeWithNewIds(node, prefix?, existingIds?)` | `Node, string?, Set<string>?` | `{ clonedNode: Node; idMap: Map<string, string> }` | Menduplikasi subtree node dengan men-generate UUID baru yang bebas konflik. |

---

## Command Engine & Mutator Dokumen

KUBUILD melarang mutasi langsung pada objek node. Semua perubahan harus melalui fungsi command murni (pure immutable) yang mengembalikan salinan baru dari `PageDocument`.

```typescript
import {
  insertNode,
  moveNode,
  updateProps,
  updateStyle,
  deleteNode,
  duplicateNode,
} from '@kubuild/core';

// Menyisipkan node baru
const docAfterInsert = insertNode(doc, {
  parentId: 'section-1',
  node: { id: 'btn-1', type: 'button', props: { label: 'Klik Saya' } },
  index: 0,
});

// Memperbarui properti props
const docAfterProps = updateProps(doc, {
  nodeId: 'btn-1',
  props: { label: 'Kirim Formulir' },
  merge: true,
});

// Memperbarui style breakpoint
const docAfterStyle = updateStyle(doc, {
  nodeId: 'btn-1',
  styles: { backgroundColor: '#3b82f6', color: '#ffffff' },
  breakpoint: 'base',
});

// Menghapus node
const docAfterDelete = deleteNode(doc, { nodeId: 'btn-1' });
```

---

## Engine Riwayat (History & Undo/Redo)

### `DocumentHistoryManager`

Pengelola riwayat undo/redo immutable yang melacak status dokumen dengan batas memori riwayat yang dapat dikonfigurasi.

```typescript
import { DocumentHistoryManager, createBlankDocument } from '@kubuild/core';

const history = new DocumentHistoryManager(createBlankDocument(), { maxHistory: 50 });

// Menjalankan mutasi melalui history manager
const result = history.execute((currentDoc) => {
  return updateProps(currentDoc, { nodeId: 'hero-1', props: { title: 'Judul Baru' } });
});

console.log(history.canUndo); // true
console.log(history.canRedo); // false

// Mengembalikan ke status sebelumnya (Undo)
const previousDoc = history.undo();

// Menjalankan kembali perubahan (Redo)
const restoredDoc = history.redo();
```

---

## Validasi & Deteksi Siklus (Cycle Detection)

### `validateDocument(doc, options?)`

Menjalankan validasi skema menyeluruh, mendeteksi ID duplikat, siklus hierarki melingkar, dan kepatuhan aturan registry komponen.

```typescript
import { validateDocument } from '@kubuild/core';
import { createDefaultComponentRegistry } from '@kubuild/components';

const registry = createDefaultComponentRegistry();
const validation = validateDocument(doc, { registry });

if (!validation.valid) {
  console.error('Validasi gagal:');
  for (const error of validation.errors) {
    console.error(`- [${error.code}] ${error.message} pada node #${error.nodeId}`);
  }
}
```

---

## Engine Migrasi Skema

### `migrateDocument(rawDoc, targetVersion?)`

Memigrasikan dokumen JSON versi lama ke versi skema terbaru secara aman dengan transformer backward-compatibility otomatis.

```typescript
import { migrateDocument } from '@kubuild/core';

const migrationResult = migrateDocument(legacyJsonDocument, '1.0.0');

if (migrationResult.success) {
  console.log('Dokumen hasil migrasi:', migrationResult.document);
} else {
  console.error('Migrasi gagal:', migrationResult.errors);
}
```

---

## Utilitas Keamanan & Runtime

- **`sanitizeHtml(rawHtml)`**: Membersihkan input string HTML dari serangan XSS dan injeksi script berbahaya.
- **`sanitizeUrl(url)`**: Memvalidasi URL dan memblokir protokol berisiko (`javascript:`, `data:text/html`).
- **`resolveBinding(binding, context)`**: Mengevaluasi variabel binding template (`{{ user.name }}`) terhadap konteks data runtime.
