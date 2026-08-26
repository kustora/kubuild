---
title: 'API @kubuild/components'
description: 'ComponentRegistry, skema ComponentDefinition, dan pustaka komponen standar.'
---

# Referensi API `@kubuild/components`

Paket `@kubuild/components` berisi sistem registry, kebijakan validasi nesting hierarki, dan definisi komponen bawaan untuk KUBUILD.

## Registry Komponen

```ts
import { ComponentRegistry, createDefaultComponentRegistry } from '@kubuild/components';

const registry = createDefaultComponentRegistry();
const buttonDef = registry.get('button');
```

## Komponen Standar

- **Layout**: `page`, `section`, `container`, `columns`, `box`
- **Tipografi & Konten**: `heading`, `text`, `button`
- **Media & Struktur**: `image`, `table`, `table-row`, `table-cell`, `unordered-list`, `ordered-list`, `list-item`, `collection`
