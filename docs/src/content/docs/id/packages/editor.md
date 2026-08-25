---
title: '@kubuild/editor'
description: Kanvas visual, state UI Zustand, drag & drop, dan panel inspector properti.
---

`@kubuild/editor` menyediakan antarmuka visual builder lengkap dengan kanvas interaktif, mekanisme drag-and-drop, palet komponen, pohon layer, dan inspector style.

## Instalasi

```bash
pnpm add @kubuild/editor
```

## State Store Zustand

Editor menggunakan store Zustand khusus untuk mengelola state UI sementara (*transient UI state*):

- **Selected Node ID**: Elemen yang sedang dipilih dan aktif di inspector.
- **Hovered Node ID**: Elemen yang sedang disorot oleh kursor mouse.
- **Active Breakpoint**: Mode tampilan kanvas (`desktop`, `tablet`, `mobile`).
- **Drag & Drop Position**: Koordinat dan indikator target peletakan elemen.

Struktur data dokumen itu sendiri tetap menjadi sumber kebenaran tunggal di `@kubuild/core` dan tidak pernah dimutasi secara langsung oleh store Zustand.

## Penggunaan

```tsx
import React from 'react';
import { EditorCanvas, EditorProvider } from '@kubuild/editor';
import { createBlankDocument } from '@kubuild/core';

export function VisualBuilder() {
  const doc = createBlankDocument({ title: 'Template Baru' });

  return (
    <EditorProvider initialDocument={doc}>
      <div className="flex h-screen w-screen">
        <EditorCanvas />
      </div>
    </EditorProvider>
  );
}
```
