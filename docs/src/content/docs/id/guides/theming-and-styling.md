---
title: Tema & Desain Responsif
description: Mengelola gaya multi-breakpoint, palet warna, dan token desain portabel.
---

KUBUILD menggunakan mesin styling portabel yang dirancang untuk menghasilkan tampilan konsisten di berbagai perangkat tanpa ketergantungan langsung pada framework CSS tertentu.

## Breakpoint Responsif

KUBUILD mendukung empat tingkatan breakpoint:

1. **`base`**: Gaya dasar yang berlaku untuk semua ukuran layar.
2. **`desktop`**: Override khusus layar lebar ($\ge 1024\text{px}$).
3. **`tablet`**: Override khusus layar tablet ($768\text{px} - 1023\text{px}$).
4. **`mobile`**: Override khusus layar smartphone ($< 768\text{px}$).

Rentangnya tidak saling tumpang tindih. Satu layar mendapat `base` ditambah tepat satu layer, dan `tablet` tidak menurun ke `mobile` (begitu juga `desktop` ke layar yang lebih kecil). Ini sama dengan tampilan preview per device di editor.

Nilai-nilai ini hanya didefinisikan di satu tempat, yaitu konstanta `BREAKPOINTS` yang diekspor dari `@kubuild/schema`. Editor, renderer runtime, dan code generator semuanya membacanya. `BREAKPOINT_MEDIA_QUERIES` berisi media query yang sesuai (`(min-width: 1024px)`, `(min-width: 768px) and (max-width: 1023.98px)`, `(max-width: 767.98px)`), dan `getBreakpointForWidth(width)` memetakan lebar piksel ke sebuah layer.

### Cara renderer menerapkan breakpoint

- **Halaman publik** (`<KubuildRenderer mode="runtime" />` tanpa prop `viewport`) memakai `responsive: 'css'`. Layer `base` dirender inline, dan override `desktop`/`tablet`/`mobile` setiap node menjadi rule `@media` yang ter-scope ke `[data-kubuild-node="…"]`. Lebar browser yang sebenarnya menentukan layer yang dipakai, jadi resize dan rotasi layar tetap benar. Output hanya bergantung pada dokumen, sehingga markup hasil SSR dan hidrasi identik.
- **Canvas editor dan preview device** (`mode="editor"`, atau render apa pun yang memberikan `viewport`) memakai `responsive: 'viewport'`. Layer yang dipilih digabung ke style inline.
- **HTML ekspor** (`generateDocumentCss` / `generateStandaloneHtml`) menghasilkan override yang sama di bawah media query yang sama.

## Contoh Struktur Gaya Responsif

```json
{
  "style": {
    "base": {
      "display": "flex",
      "flexDirection": "row",
      "gap": "24px",
      "padding": { "top": "32px", "right": "32px", "bottom": "32px", "left": "32px" }
    },
    "mobile": {
      "flexDirection": "column",
      "padding": { "top": "16px", "right": "16px", "bottom": "16px", "left": "16px" }
    }
  }
}
```

Pada tampilan layar mobile, susunan elemen secara otomatis bertransisi dari format baris (*row*) menjadi kolom (*column*) dengan pengurangan ukuran padding.
