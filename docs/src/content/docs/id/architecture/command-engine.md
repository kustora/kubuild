---
title: Command Engine & History
description: Mutasi deterministik, pola Command, HistoryEngine, dan mekanisme Undo/Redo.
---

KUBUILD menggunakan pola desain **Command Pattern** untuk menangani setiap perubahan data pada `PageDocument`. Mutasi langsung pada objek dokumen dilarang demi menjaga sifat *immutable*, keandalan transaksional, dan kemampuan memutar ulang riwayat (*replay*).

## Daftar Command Utama

Seluruh interaksi builder dikonversi menjadi payload command terstruktur:

- **`INSERT_NODE`**: Menambahkan elemen baru pada indeks tertentu di dalam container induk.
- **`MOVE_NODE`**: Memindahkan elemen ke posisi baru dalam satu container atau antar container.
- **`UPDATE_PROPS`**: Memperbarui properti spesifik komponen dengan penggabungan parsial (*partial merge*).
- **`UPDATE_STYLE`**: Mengubah properti gaya untuk breakpoint `base` maupun breakpoint responsif lainnya.
- **`DELETE_NODE`**: Menghapus elemen secara rekursif beserta seluruh elemen anaknya.
- **`DUPLICATE_NODE`**: Menggandakan sub-pohon elemen dengan menghasilkan ID baru secara otomatis.

## Eksekusi Command

Command dieksekusi melalui fungsi murni `executeCommand` dari modul `@kubuild/core`:

```ts
import { executeCommand, insertNodeCommand } from '@kubuild/core';

const command = insertNodeCommand({
  parentId: 'root_node',
  type: 'Button',
  props: { label: 'Klik Saya', variant: 'primary' },
});

const result = executeCommand(currentDoc, command);

if (result.success) {
  // result.document adalah state dokumen baru yang immutable
  console.log('Dokumen berhasil diperbarui');
} else {
  console.error('Eksekusi gagal:', result.error);
}
```

## HistoryEngine (Undo / Redo)

Kelas `HistoryEngine` mengelola tumpukan riwayat aksi (*undo/redo stack*) secara efisien:

```ts
import { HistoryEngine } from '@kubuild/core';

const history = new HistoryEngine(initialDocument, { maxHistory: 50 });

// Menjalankan aksi command
history.execute(insertNodeCommand({ ... }));

// Membatalkan aksi (Undo)
if (history.canUndo()) {
  const previousDoc = history.undo();
}

// Mengulangi aksi (Redo)
if (history.canRedo()) {
  const nextDoc = history.redo();
}
```
