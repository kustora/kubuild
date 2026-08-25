---
title: '@kubuild/renderer'
description: Renderer React rekursif murni untuk PageDocument dengan dukungan layout responsif.
---

`@kubuild/renderer` mengubah pohon data `PageDocument` menjadi elemen React yang bersih, interaktif, dan mudah diakses tanpa beban antarmuka builder.

## Instalasi

```bash
pnpm add @kubuild/renderer
```

## Penggunaan Dasar

```tsx
import React from 'react';
import { DocumentRenderer } from '@kubuild/renderer';
import type { PageDocument } from '@kubuild/schema';

export function WebPage({ document }: { document: PageDocument }) {
  return (
    <DocumentRenderer
      document={document}
      activeBreakpoint="desktop" // 'base' | 'desktop' | 'tablet' | 'mobile'
      runtimeContext={{
        variables: { userName: 'Budi' },
        onAction: (actionId, payload) => console.log('Aksi dipicu:', actionId, payload),
      }}
    />
  );
}
```

## Fitur Unggulan

- **Traversal Rekursif Cepat**: Efisiensi rendering pohon elemen bertingkat.
- **Interpolasi Variabel Dinamis**: Mengevaluasi ekspresi dalam teks properti seperti `"Halo, {{userName}}!"`.
- **Eksekusi Aksi Interaktif**: Memanggil callback runtime saat tombol atau link diklik.
- **Styling Terisolasi**: Menghitung style responsif tanpa konflik class CSS global.
