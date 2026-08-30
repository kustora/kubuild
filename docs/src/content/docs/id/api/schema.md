---
title: 'API @kubuild/schema'
description: 'Skema Zod, inferensi tipe TypeScript, generator JSON Schema, dan definisi dokumen portabel di @kubuild/schema.'
---

# Referensi API `@kubuild/schema`

Paket `@kubuild/schema` mendefinisikan *single source of truth* untuk format dokumen web portabel `.stora`. Paket ini menyediakan validasi runtime skema Zod, interface TypeScript, dan utilitas export generator JSON Schema.

---

## Konstanta Utama

```typescript
import { SCHEMA_NAME, CURRENT_SCHEMA_VERSION } from '@kubuild/schema';

console.log(SCHEMA_NAME);            // "stora.page"
console.log(CURRENT_SCHEMA_VERSION); // "1.0.0"
```

---

## Skema Dokumen Utama

### `PageDocumentSchema`

Mendefinisikan struktur container dokumen tingkat atas untuk halaman yang diserialisasi.

```typescript
import { PageDocumentSchema, type PageDocument } from '@kubuild/schema';

// Parsing atau validasi data JSON mentah
const pageDoc: PageDocument = PageDocumentSchema.parse(rawJsonData);
```

#### Struktur Dokumen

```typescript
export interface PageDocument {
  schema: 'stora.page';
  version: string;
  metadata: {
    title: string;
    description?: string;
    author?: string;
    tags?: string[];
    category?: string;
    createdAt?: string;
    updatedAt?: string;
    thumbnail?: string;
  };
  document: Node;
}
```

---

### `NodeSchema`

Pohon node rekursif yang merepresentasikan elemen antarmuka, elemen anak tersarang, properti, gaya visual, dan animasi.

```typescript
export interface Node {
  id: string;
  type: string;
  props?: Record<string, unknown>;
  styles?: ResponsiveStyles;
  children?: Node[];
  animation?: AnimationConfig;
}
```

---

## Skema Styling & Responsivitas

### `ResponsiveStyles`

Menyimpan layer styling spesifik per breakpoint:

```typescript
export interface ResponsiveStyles {
  base?: StyleDefinition;
  desktop?: StyleDefinition;
  tablet?: StyleDefinition;
  mobile?: StyleDefinition;
  states?: {
    ':hover'?: StyleDefinition;
    ':active'?: StyleDefinition;
    ':focus'?: StyleDefinition;
    [customState: string]: StyleDefinition | undefined;
  };
}
```

### `StyleDefinition`

Kamus key-value properti CSS yang aman. Seluruh nilai string disaring secara ketat dari injeksi script berbahaya (misalnya `javascript:`, `@import`, `<script>`).

---

## Skema Animasi (`AnimationConfig`)

```typescript
export interface AnimationConfig {
  type: 'none' | 'fadeIn' | 'slideUp' | 'slideDown' | 'slideLeft' | 'slideRight' | 'zoomIn' | 'bounce';
  duration?: number;   // Durasi dalam milidetik (contoh: 500)
  delay?: number;      // Delay dalam milidetik (contoh: 100)
  easing?: 'ease' | 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';
  once?: boolean;      // Replay setiap scroll atau sekali saja
  hoverEffect?: 'none' | 'lift' | 'scale' | 'glow' | 'pulse';
  loopEffect?: 'none' | 'float' | 'pulse' | 'spin';
}
```

---

## Dynamic Binding & Referensi Aset

### 1. `VariableBindingSchema`
Representasi variabel dinamis runtime (misal: `{{ site.title }}`):
```typescript
export interface VariableBinding {
  type: 'variable';
  key: string;
  fallback?: unknown;
}
```

### 2. `AssetReferenceSchema`
Representasi aset yang dibundel di dalam package `.stora` atau di-host di CDN eksternal:
```typescript
export interface AssetReference {
  type: 'asset';
  assetId: string;
  filename?: string;
  mimeType?: string;
  fallbackUrl?: string;
}
```

### 3. `ActionBindingSchema`
Representasi pemicu interaksi (navigasi, buka modal, submit form):
```typescript
export interface ActionBinding {
  type: string;
  payload?: Record<string, unknown>;
}
```

---

## Type Guards

```typescript
import {
  isVariableBinding,
  isAssetReference,
  isActionBinding,
} from '@kubuild/schema';

if (isVariableBinding(propValue)) {
  console.log('Kunci variabel:', propValue.key);
}
```

---

## Generator JSON Schema

Mengekspor skema Zod secara langsung ke standar JSON Schema (draft-07) untuk validasi lintas bahasa (Go, Rust, Python, dll.):

```typescript
import { getPageDocumentJsonSchema } from '@kubuild/schema';

const jsonSchema = getPageDocumentJsonSchema();
```
