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
