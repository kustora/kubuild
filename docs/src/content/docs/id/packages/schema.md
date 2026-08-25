---
title: '@kubuild/schema'
description: Skema runtime Zod, tipe TypeScript, dan generator JSON Schema untuk KUBUILD.
---

`@kubuild/schema` mendefinisikan kontrak tipe data untuk struktur dokumen, simpul elemen (*node*), token gaya, dan manifes paket aset.

## Instalasi

```bash
pnpm add @kubuild/schema
```

## Ekspor Utama

### Skema & Tipe TypeScript

- **`PageDocumentSchema`** / **`type PageDocument`**: Model data dokumen halaman lengkap.
- **`NodeSchema`** / **`type Node`**: Definisi elemen UI tunggal.
- **`ResponsiveStyleSchema`** / **`type ResponsiveStyle`**: Aturan gaya responsif untuk `base`, `desktop`, `tablet`, dan `mobile`.
- **`VariableBindingSchema`** / **`type VariableBinding`**: Binding ekspresi variabel dinamis.
- **`StoraPackageManifestSchema`**: Validasi manifes arsip paket `.stora`.

### Penggunaan

```ts
import { PageDocumentSchema, CURRENT_SCHEMA_VERSION, SCHEMA_NAME } from '@kubuild/schema';

// Validasi data JSON dokumen eksternal
const parseResult = PageDocumentSchema.safeParse(rawJsonData);

if (!parseResult.success) {
  console.error('Error validasi skema:', parseResult.error.format());
} else {
  const document = parseResult.data;
}
```
