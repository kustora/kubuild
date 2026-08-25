---
title: '@kubuild/react'
description: Unified consumer entrypoint combining Schema, Core, Components, Renderer, and Editor.
---

`@kubuild/react` is the primary high-level package for integrating KUBUILD into React, Next.js, or Vite applications.

## Installation

```bash
pnpm add @kubuild/react
```

## Everything in One Place

`@kubuild/react` re-exports all core utilities and exposes first-class components:

```tsx
import {
  KubuildEditor,
  KubuildRenderer,
  createBlankDocument,
  ComponentRegistry,
  type PageDocument,
} from '@kubuild/react';
```

## Key Components

### `<KubuildEditor />`

Renders the full visual builder environment:

| Prop | Type | Description |
| :--- | :--- | :--- |
| `initialDocument` | `PageDocument` | Initial document loaded into the canvas. |
| `onChange` | `(doc: PageDocument) => void` | Triggered whenever the document changes via commands. |
| `onSave` | `(doc: PageDocument) => void` | Invoked when the user clicks the Save button. |
| `customComponents`| `ComponentDefinition[]` | Optional array of application-specific custom components. |

### `<KubuildRenderer />`

Headless renderer component for production pages:

| Prop | Type | Description |
| :--- | :--- | :--- |
| `document` | `PageDocument` | The page document to render. |
| `variables` | `Record<string, any>` | Runtime dynamic variable values. |
| `onAction` | `(actionId, payload) => void` | Custom action click handler. |
