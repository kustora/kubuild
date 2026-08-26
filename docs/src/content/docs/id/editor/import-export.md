---
title: 'Sistem Impor & Ekspor'
description: 'Mengekspor paket .stora, bundel HTML standalone, dan mengimpor template eksternal.'
---

# Sistem Impor & Ekspor

KUBUILD menyediakan kapabilitas impor dan ekspor lengkap langsung dari antarmuka visual editor.

## Format Ekspor

- **Paket `.stora` (Arsip ZIP)**: Berisi `manifest.json`, `document.json` (AST lengkap), dan folder `assets/` untuk gambar serta media lokal.
- **Bundel HTML / CSS Standalone**: Halaman HTML5 semantik bersih tanpa ketergantungan runtime framework.
- **JSON AST**: Struktur data JSON murni `PageDocument` yang siap disimpan di database atau ditransmisikan via API.

## Format Impor

- Mengimpor file arsip `.stora` atau `.zip`.
- Mengimpor file JSON dokumen KUBUILD dengan validasi skema otomatis.
- Impor dari snippet HTML atau Figma paste.
- Menggunakan template bawaan (Landing page, SaaS, Tabel Harga, Newsletter).
