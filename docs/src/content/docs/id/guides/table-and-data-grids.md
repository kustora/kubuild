---
title: 'Bekerja dengan Tabel & Data Grid'
description: 'Cara membangun tabel harga, spreadsheet, komparasi data, dan formula di KUBUILD.'
---

# Bekerja dengan Tabel & Data Grid

KUBUILD menyertakan tool khusus untuk pembuatan tabel visual, mendukung data grid terstruktur, penggabungan sel (`colspan`/`rowspan`), border kustom, dan interpolasi data dinamis.

## Menyisipkan Tabel

1. Buka **Pustaka Komponen** di panel sebelah kiri.
2. Pada kategori **Data / Content**, tarik komponen **Table** ke canvas atau kontainer.
3. Secara default, tabel berukuran 3x3 dengan baris header akan dibuat.

## Menggunakan Toolbar Spreadsheet

Saat memilih tabel di canvas:
- Toolbar **Spreadsheet Editor** akan muncul di atas tabel.
- Anda dapat beralih antara mode **Docked** atau **Floating Window**.

### Operasi yang Tersedia

- **Tambah Kolom Kanan / Kiri**: Klik tombol `+ Col` untuk menambah kolom.
- **Tambah Baris Atas / Bawah**: Klik tombol `+ Row` untuk menambah baris data.
- **Penggabungan Sel (Merge Cells)**: Pilih beberapa sel yang berdekatan dan klik **Merge Cells**.
- **Konversi Header**: Ubah sel menjadi `<th>` untuk tipografi tebal dan semantik header.
