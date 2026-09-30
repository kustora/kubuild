---
title: Model Dokumen (Document Model)
description: Penjelasan mendalam tentang PageDocument, struktur Node, gaya responsif, dan data binding.
---

Struktur data utama dalam KUBUILD adalah `PageDocument`. Model ini berupa **pohon** node yang dapat diserialisasi, berakar pada satu node `page`, ditambah metadata tingkat dokumen, konfigurasi tracking, dan token tema. Dokumen adalah sumber kebenaran: editor hanya mengubahnya melalui command, renderer hanya membacanya.

## Spesifikasi Skema

`PageDocument` minimal yang valid terlihat seperti ini:

<!-- docs-check: PageDocument -->
```json
{
  "schema": "stora.page",
  "version": "1.2.0",
  "metadata": {
    "title": "Landing Page Peluncuran Produk",
    "description": "Template landing page konversi tinggi",
    "createdAt": "2026-08-25T00:00:00.000Z",
    "updatedAt": "2026-08-25T00:00:00.000Z"
  },
  "theme": {
    "colors": { "primary": "#2563eb" }
  },
  "document": {
    "id": "root",
    "type": "page",
    "props": {},
    "styles": { "base": { "padding": "0px" } },
    "children": [
      {
        "id": "hero",
        "type": "section",
        "children": [
          {
            "id": "hero-title",
            "type": "heading",
            "props": {
              "level": 1,
              "text": { "type": "variable", "key": "product.name", "fallback": "Produk kami" }
            }
          },
          {
            "id": "hero-cta",
            "type": "button",
            "props": { "label": "Beli sekarang" },
            "styles": { "base": { "backgroundColor": "var(--kb-color-primary)" } }
          }
        ]
      }
    ]
  }
}
```

Field tingkat atas:

- **`schema`**: Selalu literal `"stora.page"` (`SCHEMA_NAME`).
- **`version`**: String versi skema dokumen. Dokumen baru memakai `CURRENT_SCHEMA_VERSION` (saat ini `"1.2.0"`); dokumen lama ditingkatkan dengan `migrateDocument` dari `@kubuild/core`.
- **`metadata`**: Opsional — judul, deskripsi, penulis, tag, kategori, timestamp, dan data host `custom`.
- **`tracking`**: Konfigurasi tracking pixel/CAPI opsional (tidak pernah berisi secret).
- **`theme`**: Token desain opsional (`colors`, `fonts`, `radii`, `spacing`), direferensikan dari style sebagai `var(--kb-color-<key>)` dst. Lihat [Tema & Desain Responsif](/id/guides/theming-and-styling/).
- **`document`**: Node akar; `type`-nya wajib `"page"`.

## Struktur Node (Simpul Elemen)

Setiap node adalah objek biasa; anak-anaknya disarangkan langsung (tidak ada map node datar):

- **`id`**: String identifikasi unik dan deterministik (tidak bergantung pada key React).
- **`type`**: Tipe komponen terdaftar (`section`, `heading`, `button`, `image`, atau tipe custom yang didaftarkan di `ComponentRegistry` host).
- **`props`**: Nilai khusus komponen. Prop apa pun bisa berupa variable binding (`{ "type": "variable", "key": "...", "fallback": ... }`) yang di-resolve dari `RuntimeContext.variables`, atau referensi aset (`{ "type": "asset", "assetId": "...", "fallbackUrl": "..." }`). Komponen teks memakai satu prop kanonis — `text` (heading, text, paragraph, link, badge, blockquote) atau `label` (button).
- **`styles`**: Layer gaya responsif (lihat di bawah).
- **`actions`**: `ActionPipeline[]` opsional — trigger (`click`, `submit`, ...) beserta langkah-langkah berurutan.
- **`animation`**: Konfigurasi animasi masuk/hover/loop opsional.
- **`formConfig`**: Konfigurasi validasi/binding form opsional untuk node form.
- **`children`**: Node anak berurutan.

## Sistem Gaya Responsif Multi-Breakpoint

`styles` berbentuk `{ base, desktop, tablet, mobile, states }`. Setiap layer memetakan properti CSS camelCase ke nilai skalar (string, number, boolean, atau `null`); `states` memetakan selector pseudo-class seperti `":hover"` ke layer serupa.

```ts
import type { ResponsiveStyles } from '@kubuild/schema/types';

const cardStyles: ResponsiveStyles = {
  base: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 },
  tablet: { gridTemplateColumns: 'repeat(2, 1fr)' },
  mobile: { gridTemplateColumns: '1fr', gap: 16 },
  states: { ':hover': { boxShadow: '0 8px 24px rgba(0,0,0,0.12)' } },
};
```

Setiap layer breakpoint digabung di atas `base` secara terpisah, tanpa saling menurun. Rentangnya berasal dari konstanta bersama `BREAKPOINTS` di `@kubuild/schema`: `mobile` < 768px, `tablet` 768–1023px, `desktop` ≥ 1024px. Halaman publik menerapkannya sebagai rule `@media` ter-scope (`responsive: 'css'`). Canvas editor menggabungkan layer viewport yang sedang dipreview ke style inline (`responsive: 'viewport'`).
