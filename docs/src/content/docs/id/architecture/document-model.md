---
title: Model Dokumen (Document Model)
description: Penjelasan mendalam tentang PageDocument, struktur Node, gaya responsif, dan data binding.
---

Struktur data utama dalam KUBUILD adalah `PageDocument`. Model ini merepresentasikan pohon ter-normalisasi (*flat normalized tree*) yang dapat diserialisasi menjadi JSON, mencakup elemen visual, konfigurasi gaya, variabel dinamis, dan aksi pengguna.

## Spesifikasi Skema

Objek `PageDocument` mematuhi format JSON berikut:

```json
{
  "schema": "stora.page",
  "version": 1,
  "id": "doc_01j7k5m9...",
  "metadata": {
    "title": "Landing Page Peluncuran Produk",
    "description": "Template landing page konversi tinggi",
    "createdAt": "2026-08-25T00:00:00.000Z",
    "updatedAt": "2026-08-25T00:00:00.000Z"
  },
  "rootNodeId": "root_node_id",
  "nodes": {
    "root_node_id": {
      "id": "root_node_id",
      "type": "Container",
      "name": "Page Root",
      "parentId": null,
      "children": ["hero_section_id"],
      "props": {},
      "style": {
        "base": {
          "padding": { "top": "0px", "right": "0px", "bottom": "0px", "left": "0px" }
        }
      }
    }
  },
  "variables": {},
  "actions": {},
  "assets": {}
}
```

## Struktur Node (Simpul Elemen)

Setiap elemen antarmuka disimpan dalam record flat `nodes` menggunakan ID unik:

- **`id`**: String identifikasi unik.
- **`type`**: Tipe komponen terdaftar (misalnya `Container`, `Heading`, `Button`, `Image`, `CustomCard`).
- **`name`**: Nama elemen yang dapat dikustomisasi untuk panel layer.
- **`parentId`**: ID milik induk elemen (`null` untuk container akar).
- **`children`**: Array urutan ID elemen anak.
- **`props`**: Nilai properti spesifik komponen yang tervalidasi skema.
- **`style`**: Kamus gaya multi-breakpoint (`base`, `desktop`, `tablet`, `mobile`).
- **`bindings`**: Pemetaan variabel dinamis atau sumber data eksternal.

## Sistem Gaya Responsif Multi-Breakpoint

Nilai style diturunkan secara hierarkis dengan aturan fallback dari `base`:

```ts
interface ResponsiveStyle {
  base?: StyleProperties;
  desktop?: Partial<StyleProperties>;
  tablet?: Partial<StyleProperties>;
  mobile?: Partial<StyleProperties>;
}
```

Ketika ditampilkan pada viewport tablet, renderer akan menggabungkan gaya `base` dengan properti spesifik yang didefinisikan pada `tablet`.
