---
title: '@kubuild/renderer'
description: Pure recursive React renderer for PageDocuments with responsive layout support.
---

`@kubuild/renderer` transforms a `PageDocument` tree into pure, accessible React elements without any builder UI baggage.

## Installation

```bash
pnpm add @kubuild/renderer
```

## Basic Usage

```tsx
import React from 'react';
import { DocumentRenderer } from '@kubuild/renderer';
import type { PageDocument } from '@kubuild/schema';

export function WebPage({ document }: { document: PageDocument }) {
  return (
    <DocumentRenderer
      document={document}
      activeBreakpoint="desktop" // 'base' | 'desktop' | 'tablet' | 'mobile'
      runtimeContext={{
        variables: { userName: 'Alex' },
        onAction: (actionId, payload) => console.log('Action triggered:', actionId, payload),
      }}
    />
  );
}
```

## Features

- **Recursive Tree Traversal**: Efficient rendering of container-child hierarchies.
- **Dynamic Variable Interpolation**: Evaluates expressions in props like `"Hello, {{userName}}!"`.
- **Action Dispatching**: Invokes runtime callbacks when buttons or links are clicked.
- **Isolated Styling**: Computes CSS without stylesheet collisions.
