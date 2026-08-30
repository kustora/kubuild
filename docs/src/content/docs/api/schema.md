---
title: '@kubuild/schema API'
description: 'Zod schemas, inferred TypeScript types, JSON Schema generation, and portable document definitions in @kubuild/schema.'
---

# `@kubuild/schema` API Reference

Package `@kubuild/schema` defines the single source of truth for the portable `.stora` web document format. It provides runtime Zod schemas, inferred TypeScript interfaces, and JSON Schema generation utilities.

---

## Core Constants

```typescript
import { SCHEMA_NAME, CURRENT_SCHEMA_VERSION } from '@kubuild/schema';

console.log(SCHEMA_NAME);            // "stora.page"
console.log(CURRENT_SCHEMA_VERSION); // "1.0.0"
```

---

## Primary Document Schemas

### `PageDocumentSchema`

Defines the root container structure for a serialized page.

```typescript
import { PageDocumentSchema, type PageDocument } from '@kubuild/schema';

// Parse or validate untrusted JSON input
const pageDoc: PageDocument = PageDocumentSchema.parse(rawJsonData);
```

#### Document Structure

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

Recursive node tree representing UI elements, nested children, properties, styles, and animation configurations.

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

## Styling & Responsive Schemas

### `ResponsiveStyles`

Stores breakpoint-specific styling layers:

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

A safe, sanitized key-value dictionary mapping CSS properties to primitive values. String values are verified against CSS/HTML injection attacks (e.g., `javascript:`, `@import`, `<script>`).

---

## Animation Schema (`AnimationConfig`)

```typescript
export interface AnimationConfig {
  type: 'none' | 'fadeIn' | 'slideUp' | 'slideDown' | 'slideLeft' | 'slideRight' | 'zoomIn' | 'bounce';
  duration?: number;   // Milliseconds (e.g. 500)
  delay?: number;      // Milliseconds (e.g. 100)
  easing?: 'ease' | 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';
  once?: boolean;      // Replay on every scroll entry or once only
  hoverEffect?: 'none' | 'lift' | 'scale' | 'glow' | 'pulse';
  loopEffect?: 'none' | 'float' | 'pulse' | 'spin';
}
```

---

## Dynamic Bindings & Asset References

### 1. `VariableBindingSchema`
Represents runtime dynamic variables (e.g. `{{ site.title }}`):
```typescript
export interface VariableBinding {
  type: 'variable';
  key: string;
  fallback?: unknown;
}
```

### 2. `AssetReferenceSchema`
Represents assets bundled inside the `.stora` package or hosted via external CDN:
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
Represents interactive triggers (navigation, modal open, form submit):
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
  console.log('Dynamic variable key:', propValue.key);
}
```

---

## JSON Schema Generation

Export the Zod schemas directly to JSON Schema standard (draft-07) for cross-language validation in Go, Rust, or Python:

```typescript
import { getPageDocumentJsonSchema } from '@kubuild/schema';

const jsonSchema = getPageDocumentJsonSchema();
```
