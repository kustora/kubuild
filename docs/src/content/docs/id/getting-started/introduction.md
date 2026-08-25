---
title: Pengenalan
description: Gambaran umum tentang engine pembuat halaman KUBUILD dan filosofi dasarnya.
---

**KUBUILD** (nama sandi `BUILDER-01`) adalah engine pembuat halaman web visual yang dapat diintegrasikan (*embeddable*), bebas dari ketergantungan backend (*backend-agnostic*), dan dirancang untuk portabilitas antar aplikasi.

Berbeda dengan website builder konvensional yang menyatukan editor kanvas dengan database atau CMS tertentu, KUBUILD memisahkan setiap fungsionalitas ke dalam modul-modul terisolasi yang saling melengkapi:

```
@kubuild/schema  →  @kubuild/core  →  @kubuild/components  →  @kubuild/renderer  →  @kubuild/editor  →  @kubuild/react
```

## Filosofi Utama

### 1. Dokumen Sebagai Sumber Kebenaran Tunggal (*Single Source of Truth*)
Editor visual tidak pernah memutasi data simpul (*node*) atau gaya (*style*) secara langsung di memori. Dokumen adalah sumber kebenaran tunggal yang bersifat *immutable*. Seluruh perubahan dieksekusi melalui *command dispatch*, memungkinkan fitur *undo/redo*, riwayat perubahan, dan migrasi versi yang aman.

### 2. Core Engine Tanpa Ketergantungan Framework
`@kubuild/core` sama sekali tidak memiliki dependensi terhadap React, Vue, maupun browser DOM. Validasi dokumen, transformasi skema, dan manipulasi pohon dokumen dapat dijalankan di lingkungan Node.js, Edge worker, CLI, maupun browser.

### 3. Format Portabel `.stora`
Halaman dan template dapat diekspor menjadi paket portabel `.stora` yang berisi manifes dokumen, struktur komponen, token gaya, serta aset media yang telah disanitasi.

Siklus hidup dokumen:
> **Buat (Create) → Kustomisasi (Customize) → Ekspor (Export) → Bagikan (Share) → Impor (Import) → Kustomisasi (Customize) → Publikasi (Publish)**

## Struktur Paket

| Paket | Tanggung Jawab |
| :--- | :--- |
| **`@kubuild/schema`** | Skema Zod & tipe TypeScript untuk `PageDocument`, `Node`, token gaya responsif, dan ekspor JSON Schema. |
| **`@kubuild/core`** | Command engine independen, `HistoryEngine` (undo/redo), `migration.ts`, dan `validator.ts`. |
| **`@kubuild/components`** | Registry komponen dan definisi komponen dasar. |
| **`@kubuild/renderer`** | Renderer React rekursif yang mengubah pohon `PageDocument` menjadi tampilan halaman web interaktif. |
| **`@kubuild/editor`** | Editor visual kanvas dengan manajemen state Zustand untuk seleksi, hover, dan viewport responsif. |
| **`@kubuild/react`** | Wrapper siap pakai untuk developer yang mengekspor komponen `KubuildEditor`, `KubuildRenderer`, dan helper pembuatan dokumen. |
