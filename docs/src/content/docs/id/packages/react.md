---
title: '@kubuild/react'
description: Entrypoint utama yang menyatukan Schema, Core, Components, Renderer, dan Editor.
---

`@kubuild/react` adalah paket tingkat tinggi utama untuk mengintegrasikan seluruh fungsionalitas KUBUILD ke dalam aplikasi React, Next.js, atau Vite.

## Instalasi

```bash
pnpm add @kubuild/react
```

## Seluruh Modul dalam Satu Tempat

`@kubuild/react` mengekspor ulang utilitas penting dan menyediakan komponen siap pakai:

```tsx
import {
  KubuildEditor,
  KubuildRenderer,
  createBlankDocument,
  ComponentRegistry,
  type PageDocument,
} from '@kubuild/react';
```

## Komponen Utama

### `<KubuildEditor />`

Merender antarmuka visual builder lengkap:

| Prop | Tipe | Deskripsi |
| :--- | :--- | :--- |
| `initialDocument` | `PageDocument` | Dokumen awal yang dimuat ke dalam kanvas builder. |
| `onChange` | `(doc: PageDocument) => void` | Callback saat dokumen mengalami perubahan state. |
| `onSave` | `(doc: PageDocument) => void` | Callback saat pengguna menekan tombol Simpan. |
| `customComponents`| `ComponentDefinition[]` | Daftar komponen kustom tambahan khusus aplikasi Anda. |

### `<KubuildRenderer />`

Komponen renderer headless untuk halaman produksi:

| Prop | Tipe | Deskripsi |
| :--- | :--- | :--- |
| `document` | `PageDocument` | Objek dokumen halaman yang akan ditampilkan. |
| `variables` | `Record<string, any>` | Nilai variabel dinamis saat runtime. |
| `onAction` | `(actionId, payload) => void` | Handler saat elemen interaktif memicu event aksi. |
