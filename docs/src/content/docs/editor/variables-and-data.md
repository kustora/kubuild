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
    group: 'User',
    type: 'string',
    description: 'The authenticated user first name',
    sampleValue: 'Sarah',
  },
  {
    key: 'user.email',
    label: 'User Email',
    group: 'User',
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
1. Click **Bind variable…** under the property field (only variables whose `type` matches the field are offered).
2. Type to search by label, key, description, or group. Results are grouped under their `group` label.
3. Click an entry (or press Enter for the first match) to bind it.

### Grouping

`group` is an optional, editor-only label the host supplies already localized (e.g. `'Store'`, `'Product'`). Entries without one are grouped by the first segment of their `key`, so `order.invoiceId` above lands in `order`. Groups appear in the order they first occur in the catalog, so the host controls ordering by how it builds the list. `group` is never written into the document.

The same catalog feeds the `{{ }}` autocomplete in the Action Builder. Inside action pipelines host variables live under the `variables` scope, so the entries are inserted as `{{variables.user.firstName}}`.

The canvas immediately renders using the `sampleValue` from the catalog so designers see realistic layouts with varying text lengths and data values. When exported or rendered via `@kubuild/renderer`, the document AST retains the raw binding expression `{{user.firstName}}` ready for production runtime interpolation.
