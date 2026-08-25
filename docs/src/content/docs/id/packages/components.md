---
title: '@kubuild/components'
description: Registry tipe komponen, skema definisi, dan katalog komponen bawaan.
---

`@kubuild/components` mengelola katalog definisi komponen dan registry dinamis untuk sistem KUBUILD.

## Instalasi

```bash
pnpm add @kubuild/components
```

## Membuat & Mendaftarkan Komponen

Komponen didefinisikan secara deklaratif lengkap dengan skema properti, kemampuan style, dan aturan hierarki anak:

```ts
import { ComponentRegistry } from '@kubuild/components';

export const registry = new ComponentRegistry();

registry.register({
  type: 'AlertBanner',
  displayName: 'Alert Banner',
  category: 'Feedback',
  icon: 'info',
  propsSchema: {
    message: { type: 'string', default: 'Pemberitahuan penting' },
    type: { type: 'select', options: ['info', 'warning', 'success', 'error'], default: 'info' },
  },
  supportsChildren: false,
});
```
