---
title: 'Panel Layers & Tree Navigator'
description: 'Kelola hierarki komponen, susun ulang node, dan atur visibilitas elemen di KUBUILD.'
---

# Panel Layers & Tree Navigator

**Panel Layers** (Tree Navigator) menampilkan AST dokumen dalam bentuk hierarki pohon interaktif. Fitur ini memberi Anda kontrol penuh atas komponen bersarang (nested), urutan bagian, dan struktur kontainer.

## Mode Tampilan

Navigator mendukung dua mode kerja:

1. **Mode Docked (Tersemat)**: Berada di sisi kiri area kerja bersama panel pustaka komponen.
2. **Mode Floating (Melayang)**: Menjadi panel melayang yang dapat dipindahkan ke mana saja di atas canvas.

Peralihan mode dapat dilakukan melalui toolbar atas atau tombol toggle pada header panel.

## Fitur Utama

- **Drag & Drop Reordering**: Tarik layer untuk mengubah urutan komponen atau memindahkan elemen ke dalam kontainer baru.
- **Seleksi & Sorotan Node**: Memilih item pada tree otomatis menyorot dan menggulir elemen di canvas.
- **Kunci & Sembunyikan**: Ikon mata untuk menyembunyikan elemen sementara waktu, dan ikon gembok untuk mengunci posisi elemen.
- **Ubah Nama Layer**: Klik ganda label pada tree untuk memberi nama semantik (contoh: `"Header Utama"`, `"Tabel Harga"`).
- **Aksi Cepat**: Duplikasi node, bungkus dalam kontainer (`Box`), atau hapus node.
