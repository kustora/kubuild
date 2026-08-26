---
title: 'Inspector & Panel Styling'
description: 'Pengaturan styling CSS visual, penyesuaian responsif, dan properti komponen di KUBUILD.'
---

# Inspector & Panel Styling

**Panel Inspector** yang terletak di sisi kanan area kerja memberikan kontrol presisi terhadap style, tata letak, konfigurasi properti komponen, dan binding data dinamis.

## Bagian Pengaturan

Saat sebuah node dipilih, inspector menampilkan pengaturan dalam grup terstruktur:

### 1. Properti Komponen & Konten
- Opsi spesifik komponen (varian tombol, tautan URL, alt gambar, pengaturan tabel).
- Input teks langsung dengan tombol penyisipan variabel dinamis.

### 2. Tata Letak (Layout) & Flexbox / Grid
- **Display**: `block`, `flex`, `grid`, `inline-flex`, `none`.
- **Arah Flex**: `row`, `column`, `row-reverse`, `column-reverse`.
- **Perataan**: `justify-content` dan `align-items`.
- **Gap & Wrap**: Jarak antar elemen dan kontrol pembungkusan baris.

### 3. Box Model Spacing
- Widget visual interaktif untuk margin dan padding.
- Kontrol individual untuk sisi atas, kanan, bawah, dan kiri atau nilai seragam.

### 4. Tipografi
- Pemilihan jenis font (Font Family) terintegrasi Google Fonts.
- Ukuran font, tinggi baris (line height), jarak antar huruf (letter spacing), dan ketebalan (font weight).
- Perataan teks (`left`, `center`, `right`, `justify`).

### 5. Warna, Latar Belakang & Border
- Warna solid, gradien linear, dan gambar latar belakang dengan pengatur opasitas.
- Ketebalan border, gaya border (`solid`, `dashed`, `dotted`), warna, dan radius sudut (border radius).
- Presets dan kustomisasi bayangan kotak (Box Shadow).

## Penyesuaian Responsif (Breakpoint Overrides)

Ketika Anda beralih ke viewport **Tablet** atau **Mobile** di toolbar atas, setiap perubahan style yang dilakukan pada panel inspector akan otomatis disimpan di dalam objek `responsive` node tersebut tanpa merusak tampilan desktop.
