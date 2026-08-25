---
title: Gambaran Umum Arsitektur
description: Arsitektur tingkat tinggi, batasan modular antar paket, dan aliran data satu arah.
---

KUBUILD dibangun dengan aturan dependensi satu arah yang ketat dan pemisahan fungsionalitas modular yang bersih.

## Diagram Dependensi Paket

Aliran dependensi paket mengarah ke dalam menuju `@kubuild/schema` dan `@kubuild/core`:

```
@kubuild/schema
       ▲
       │
@kubuild/core
       ▲
       │
@kubuild/components
       ▲
       │
@kubuild/renderer
       ▲
       │
@kubuild/editor
       ▲
       │
@kubuild/react
       ▲
       │
Aplikasi / Pengguna Akhir
```

### Prinsip Mutlak Arsitektur

1. **Pure TypeScript Engine**:
   `@kubuild/core` dijaga dengan ESLint `no-restricted-imports` yang memblokir import dari `react`, `react-dom`, `@kubuild/renderer`, dan `@kubuild/editor`. Paket ini dapat dijalankan secara konsisten di browser, Node.js, maupun Edge server.

2. **State Dokumen yang Immutable**:
   Struktur pohon `PageDocument` bersifat *immutable*. Builder visual tidak memutasi node secara langsung; setiap aksi menghasilkan dokumen baru melalui sistem Command Engine.

3. **Mesin Styling Portabel**:
   Properti visual disimpan sebagai token semantik dan metrik layout terstruktur (`padding`, `fontSize`, `backgroundColor`, override responsif), bukan class CSS statis yang bergantung pada framework luar.

4. **Keamanan Masukan Eksternal (Untrusted Input)**:
   Setiap berkas template atau berkas `.stora` yang diimpor diperlakukan sebagai data yang belum terverifikasi. Berkas tersebut wajib lolos validasi skema Zod, pengecekan siklus pohon node, migrasi versi, dan sanitasi aset media sebelum ditampilkan di kanvas.
