---
title: Format Paket Portabel .stora
description: Spesifikasi arsip template portabel .stora dan model keamanannya.
---

Format `.stora` adalah format paket terbuka dan portabel yang dirancang untuk menyimpan, mendistribusikan, dan menggunakan kembali halaman web atau template landing page di berbagai platform secara aman.

## Struktur Berkas Paket

Paket `.stora` merupakan berkas arsip ZIP dengan struktur internal berikut:

```
my-landing-template.stora (ZIP)
├── manifest.json       # Metadata, versi engine yang dibutuhkan, indeks aset
├── document.json       # Payload lengkap struktur PageDocument
└── assets/             # Berkas gambar dan media yang dibundel
    ├── hero-cover.webp
    └── company-logo.svg
```

### 1. `manifest.json`

Menyimpan metadata paket, informasi pembuat, kompatibilitas versi, dan daftar aset:

```json
{
  "format": "stora.package",
  "version": 1,
  "packageId": "pkg_01j7n8q2...",
  "name": "SaaS Launch Starter",
  "description": "Template landing page SaaS yang bersih dan responsif",
  "author": {
    "name": "Kustora Team",
    "url": "https://kustora.com"
  },
  "compatibility": {
    "schemaVersion": 1,
    "minEngineVersion": "0.1.0"
  },
  "assets": [
    { "id": "asset_hero", "path": "assets/hero-cover.webp", "mimeType": "image/webp" },
    { "id": "asset_logo", "path": "assets/company-logo.svg", "mimeType": "image/svg+xml" }
  ]
}
```

### 2. Model Keamanan dan Sanitasi

Setiap paket `.stora` yang diimpor diperlakukan sebagai **data yang belum terpercaya**:

- **Bebas Eksekusi Kode Sembarang**: Template tidak dapat menyisipkan kode JavaScript atau skrip executable.
- **Validasi Skema Ketat**: Dokumen wajib lolos pengujian Zod skema `PageDocumentSchema`.
- **Sanitasi Aset**: Aset vektor SVG dibersihkan dari tag berbahaya seperti `<script>` atau atribut inline JavaScript.
- **Perlindungan Path Traversal**: Nama berkas di dalam arsip divalidasi agar tidak dapat menembus direktori sistem (`../`).
