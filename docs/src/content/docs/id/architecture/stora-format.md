---
title: Format Paket Portabel .stora
description: Spesifikasi arsip template portabel .stora dan model keamanannya.
---

Format `.stora` adalah format paket terbuka dan portabel yang dirancang untuk menyimpan, mendistribusikan, dan menggunakan kembali halaman web atau template landing page di berbagai platform secara aman.

## Struktur Berkas Paket

Paket `.stora` merupakan berkas arsip ZIP dengan struktur internal berikut:

```
my-landing-template.stora (ZIP)
├── manifest.json       # Versi skema/paket, komponen & kapabilitas yang dibutuhkan, indeks aset
├── page.json           # Payload lengkap struktur PageDocument
├── metadata.json       # Metadata dokumen (judul, deskripsi, penulis, tag)
└── assets/             # Berkas gambar dan media yang dibundel
    └── hero-cover.webp
```

### 1. `manifest.json`

Mendeskripsikan paket: versi skema dokumen, versi paket, rentang kompatibilitas builder, tipe komponen dan kapabilitas host yang dibutuhkan halaman, serta setiap aset yang dibundel beserta ukuran dan checksum SHA-256-nya (divalidasi oleh `ManifestSchema` dari `@kubuild/schema`):

```json
{
  "schema": "stora.page",
  "schemaVersion": "1.2.0",
  "packageVersion": "1.0.0",
  "builderCompatibility": ">=0.1.0",
  "requiredComponents": ["pricing-card"],
  "requiredCapabilities": ["actionRegistry"],
  "assets": [
    {
      "id": "asset_hero",
      "path": "assets/hero-cover.webp",
      "mimeType": "image/webp",
      "size": 48213,
      "checksum": "sha256-hex-digest"
    }
  ],
  "createdAt": "2026-08-25T00:00:00.000Z"
}
```

### 2. Model Keamanan dan Sanitasi

Setiap paket `.stora` yang diimpor diperlakukan sebagai **data yang belum terpercaya**:

- **Bebas Eksekusi Kode Sembarang**: Template tidak dapat menyisipkan kode JavaScript atau skrip executable.
- **Validasi Skema Ketat**: Dokumen wajib lolos pengujian Zod skema `PageDocumentSchema`, lalu dimigrasikan ke `CURRENT_SCHEMA_VERSION` (saat ini `1.2.0`) bila perlu.
- **Penyaringan Aset**: Tipe berkas executable atau skrip (termasuk ekstensi ganda seperti `logo.exe.png`) ditolak, dan ukuran serta checksum setiap aset wajib cocok dengan manifes.
- **Perlindungan Path Traversal**: Nama berkas di dalam arsip divalidasi agar tidak dapat menembus direktori sistem (`../`).
