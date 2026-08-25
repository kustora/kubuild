---
title: Ekspor & Impor Paket .stora
description: Cara menserialisasi, mengekspor, membagikan, dan mengimpor paket template .stora.
---

KUBUILD mendukung portabilitas penuh melalui berkas paket `.stora`.

## Mengekspor Dokumen Halaman

Untuk mengompres dan mengunduh dokumen menjadi berkas `.stora`:

```ts
import { exportToStoraPackage } from '@kubuild/editor';

async function handleExport(document: PageDocument) {
  const blob = await exportToStoraPackage(document, {
    packageName: 'Template SaaS Keren',
    author: 'Pengguna Kustora',
  });

  // Picu unduhan berkas di browser
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'template-saas.stora';
  a.click();
}
```

## Mengimpor Paket .stora Secara Aman

Proses impor akan memvalidasi integritas manifes, membersihkan tag SVG berbahaya, dan menjalankan migrasi versi skema bila diperlukan:

```ts
import { importFromStoraPackage } from '@kubuild/editor';

async function handleFileSelect(file: File) {
  try {
    const importedDocument = await importFromStoraPackage(file);
    console.log('Berhasil mengimpor dokumen:', importedDocument.metadata.title);
  } catch (err) {
    console.error('Gagal mengimpor paket .stora:', err);
  }
}
```
