---
title: 'Ringkasan & Canvas Editor'
description: 'Arsitektur dan pengalaman pengguna canvas visual builder KUBUILD.'
---

# Ringkasan & Canvas Editor

`@kubuild/editor` menyediakan pengalaman page builder visual drag-and-drop yang intuitif bagi developer dan content creator. Dilengkapi dengan peralihan viewport responsif, pengeditan teks langsung (inline text edit), navigator layer floating, dan spreadsheet studio.

## Fitur Utama

- **Peralihan Viewport Multi-Perangkat**: Pratinjau canvas real-time antara Desktop (100% / max-6xl), Tablet (768px), dan Mobile (375px).
- **Pengeditan Teks Langsung (Direct Inline Text Edit)**: Klik dua kali pada elemen teks (heading, paragraf, tombol, item list) untuk mengedit teks secara langsung di canvas dengan kontrol format WYSIWYG.
- **Layers & Hierarchy Navigator**: Inspeksi struktur tree komponen dengan dukungan mode docked maupun floating, drag-to-reorder, rename, kunci (lock), dan sembunyikan (hide).
- **Inspector Panel Visual**: Pengaturan style CSS mulai dari tipografi, warna, tata letak (Flexbox/Grid), box model spacing (margin/padding), border, efek, dan penyesuaian breakpoint responsif.
- **Table & Spreadsheet Studio**: Editor visual spreadsheet untuk tabel dengan operasi baris/kolom, penggabungan sel (`colspan`/`rowspan`), dan bantuan formula/binding data.
- **Dynamic Variable Binding**: Penyisipan data dinamis menggunakan format mustache (`{{user.name}}`) yang terhubung langsung dengan katalog variabel aplikasi.
- **Universal Import/Export**: Ekspor ke paket zip `.stora`, bundel HTML bersih, atau JSON AST. Impor template, kode HTML, atau arsip zip secara instan.

## Menjalankan Editor di Aplikasi Anda

```tsx
import React, { useState } from 'react';
import { KubuildEditor } from '@kubuild/editor';
import { createBlankDocument } from '@kubuild/core';
import { createDefaultComponentRegistry } from '@kubuild/components';
import { PageDocument } from '@kubuild/schema';

export function VisualBuilderApp() {
  const [doc, setDoc] = useState<PageDocument>(() => 
    createBlankDocument({ title: 'Halaman Landing' })
  );

  return (
    <div className="h-screen w-screen">
      <KubuildEditor
        initialDocument={doc}
        registry={createDefaultComponentRegistry()}
        onChange={(newDoc) => {
          setDoc(newDoc);
          console.log('Dokumen diperbarui:', newDoc);
        }}
        variableCatalog={[
          { key: 'user.name', label: 'Nama Lengkap Pengguna', type: 'string', sampleValue: 'Budi Santoso' },
          { key: 'pricing.tier', label: 'Paket Langganan', type: 'string', sampleValue: 'Bisnis' }
        ]}
      />
    </div>
  );
}
```

## Pintasan Keyboard & Interaksi Canvas

| Pintasan / Interaksi | Deskripsi Aksi |
| :--- | :--- |
| **Klik Elemen** | Memilih node dan membuka propertinya di Inspector |
| **Klik Ganda Teks** | Masuk ke mode pengeditan teks inline WYSIWYG |
| **Escape (`Esc`)** | Membatalkan pilihan node atau keluar dari mode edit teks |
| **Delete / Backspace** | Menghapus elemen yang sedang dipilih dari dokumen |
| **Cmd / Ctrl + Z** | Undo aksi terakhir |
| **Cmd / Ctrl + Shift + Z** | Redo aksi yang sebelumnya dibatalkan |
| **Cmd / Ctrl + D** | Menduplikasi elemen yang sedang dipilih |
