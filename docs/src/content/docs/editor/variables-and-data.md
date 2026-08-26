---
title: 'Variables & Data Catalog'
description: 'Dynamic mustache bindings, variable catalog schema, and preview state in KUBUILD.'
---

# Variables & Dynamic Data Catalog

KUBUILD provides built-in dynamic templating support. Documents can reference runtime data using mustache expressions like `{{user.name}}` or `{{cart.total}}`. The editor includes a **Variable Catalog** system that lets hosts declare available fields and preview test values in the canvas without live backend execution.

## Variable Catalog Definition

A `VariableCatalog` is a list of bindable variable descriptors supplied by the host application:

```ts
import { VariableCatalog } from '@kubuild/core';

export const appVariableCatalog: VariableCatalog = [
  {
    key: 'user.firstName',
    label: 'User First Name',
    type: 'string',
    description: 'The authenticated user first name',
    sampleValue: 'Sarah',
  },
  {
    key: 'user.email',
    label: 'User Email',
    type: 'string',
    description: 'Primary contact email address',
    sampleValue: 'sarah@example.com',
  },
  {
    key: 'order.invoiceId',
    label: 'Invoice ID',
    type: 'string',
    sampleValue: 'INV-2026-8941',
  },
  {
    key: 'order.totalAmount',
    label: 'Total Amount',
    type: 'number',
    sampleValue: 249.99,
  },
];
```

## Passing to the Editor

Pass `variableCatalog` to `KubuildEditor`:

```tsx
<KubuildEditor
  initialDocument={document}
  variableCatalog={appVariableCatalog}
  onChange={handleDocumentChange}
/>
```

## Variable Picker UI

In any text input, heading, image URL, or button link property inside the Inspector:
1. Click the `{ }` icon next to the property field.
2. Search through available variables categorized by namespace (`user`, `order`, `company`, etc.).
3. Click to insert or bind.

The canvas immediately renders using the `sampleValue` from the catalog so designers see realistic layouts with varying text lengths and data values. When exported or rendered via `@kubuild/renderer`, the document AST retains the raw binding expression `{{user.firstName}}` ready for production runtime interpolation.
