---
title: 'API @kubuild/react'
description: 'Meta-package React serba-lengkap untuk visual builder, renderer, skema, dan komponen KUBUILD.'
---

# Referensi API `@kubuild/react`

`@kubuild/react` adalah meta-package praktis yang menggabungkan seluruh modul KUBUILD ke dalam satu dependensi React.

## Instalasi

```bash
npm install @kubuild/react
# atau
pnpm add @kubuild/react
# atau
bun add @kubuild/react
```

## Ekspor Terpadu

Paket ini mengekspor ulang fungsionalitas dari:
- `@kubuild/editor` (`<KubuildEditor />`, `useEditorStore`)
- `@kubuild/renderer` (`<DocumentRenderer />`, `<PreviewAdapter />`)
- `@kubuild/components` (`ComponentRegistry`, `createDefaultComponentRegistry`)
- `@kubuild/core` (`createBlankDocument`, `HistoryManager`, `resolveBindings`)
- `@kubuild/schema` (`PageDocument`, `Node`, `PageDocumentSchema`)
