---
title: '@kubuild/components'
description: Component type registry, definition schemas, and standard built-in components.
---

`@kubuild/components` handles the component definition catalog and dynamic registry for KUBUILD.

## Installation

```bash
pnpm add @kubuild/components
```

## Creating a Component Registry

Components are defined with clear prop schemas, style capabilities, and child slot rules:

```ts
import { ComponentRegistry } from '@kubuild/components';

export const registry = new ComponentRegistry();

registry.register({
  type: 'AlertBanner',
  displayName: 'Alert Banner',
  category: 'Feedback',
  icon: 'info',
  propsSchema: {
    message: { type: 'string', default: 'Important update' },
    type: { type: 'select', options: ['info', 'warning', 'success', 'error'], default: 'info' },
  },
  supportsChildren: false,
});
```
