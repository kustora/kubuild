---
title: 'API @kubuild/renderer'
description: 'Referensi API DocumentRenderer, preview adapter, dan style resolver di @kubuild/renderer.'
---

# Referensi API `@kubuild/renderer`

Paket `@kubuild/renderer` menyediakan runtime produksi dan pratinjau interaktif untuk mengubah AST dokumen KUBUILD menjadi virtual DOM React atau HTML statis dengan performa tinggi.

## Komponen `<DocumentRenderer />`

```tsx
import { DocumentRenderer } from '@kubuild/renderer';
import { createDefaultComponentRegistry } from '@kubuild/components';

export function HalamanPublik({ doc, dataPengguna }) {
  return (
    <DocumentRenderer
      document={doc}
      registry={createDefaultComponentRegistry()}
      context={{
        variables: {
          user: dataPengguna,
          tahun: new Date().getFullYear(),
        },
      }}
      breakpoint="desktop"
      mode="render"
    />
  );
}
```

## Utilitas `resolveNodeStyles`

Menggabungkan style `base` dengan penyesuaian breakpoint aktif (`desktop`, `tablet`, `mobile`).
