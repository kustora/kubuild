---
title: 'List Semantik & Hierarki Tata Letak'
description: 'Membangun daftar berbutir/bernomor yang aksesibel, layout multi-kolom, dan kontainer flex responsif.'
---

# List Semantik & Hierarki Tata Letak

Hierarki DOM yang bersih dan aksesibel adalah prinsip utama keluaran rendering KUBUILD.

## Aturan Hierarki Layout

KUBUILD menerapkan hierarki struktural yang teratur:

```
Page (Root Dokumen)
└── Section (Baris lebar penuh)
    └── Container / Columns (Pembungkus batas lebar)
        └── Content Nodes (Heading, Text, Button, Table, List, Box)
```

## List Semantik

KUBUILD menyediakan elemen list standar:

- **`unordered-list`**: Dihasilkan sebagai tag `<ul>` aksesibel dengan penanda poin kustom.
- **`ordered-list`**: Dihasilkan sebagai tag `<ol>` dengan penomoran angka atau huruf.
- **`list-item`**: Dihasilkan sebagai tag `<li>` dengan dukungan pengeditan teks inline.

### Menambahkan Item List di Canvas

1. Tarik komponen **Unordered List** atau **Ordered List** ke dalam kontainer.
2. Klik ganda item untuk mengedit teks secara langsung.
3. Tekan tombol `Enter` pada akhir teks item untuk membuat item list baru secara instan.
4. Tekan `Backspace` pada item kosong untuk menghapusnya.
