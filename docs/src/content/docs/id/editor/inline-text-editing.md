---
title: 'Pengeditan Teks Inline Langsung'
description: 'Pengeditan dan pemformatan teks langsung di canvas builder KUBUILD.'
---

# Pengeditan Teks Inline Langsung

KUBUILD menyediakan pengeditan teks langsung (WYSIWYG) pada elemen canvas tanpa perlu berpindah ke panel inspector.

## Cara Kerja

1. **Aktifkan Mode Edit**: Klik ganda pada elemen apa pun yang memiliki konten teks (seperti `Heading`, `Text`, `Button`, `ListItem`, `Badge`).
2. **Ketik & Format**: Canvas memunculkan container editable inline yang mempertahankan ukuran font, tinggi baris, jarak huruf, ketebalan font, dan warna yang sama persis.
3. **Format Teks Cepat**: Gunakan toolbar pemformatan melayang untuk menerapkan **Tebal (Bold)**, *Miring (Italic)*, <u>Garis Bawah (Underline)</u>, warna teks, dan font weight.
4. **Simpan Perubahan**: Klik di luar elemen, tekan tombol `Escape`, atau tekan `Enter` (untuk heading/tombol) untuk menyimpan perubahan ke AST dokumen dan riwayat undo/redo.

## Tipe Node yang Didukung

- `Heading` (`text` / level 1–6)
- `Text` / Paragraf (`text`)
- `Button` (`label` / `text`)
- `ListItem` (`text`)
- `Badge` (`label`)
- Sel `Table` (`data.cells[row][col]`)
