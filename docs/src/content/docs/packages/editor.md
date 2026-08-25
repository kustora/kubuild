---
title: '@kubuild/editor'
description: Visual canvas, Zustand UI state store, drag & drop, and inspector panels.
---

`@kubuild/editor` provides the visual builder experience, including the canvas, drag-and-drop mechanics, component palette, layer tree, and styling inspector.

## Installation

```bash
pnpm add @kubuild/editor
```

## Zustand Editor Store

The editor uses a dedicated Zustand store strictly for transient UI state:

- **Selected Node ID**: The currently highlighted node in the inspector.
- **Hovered Node ID**: The node under the cursor.
- **Active Breakpoint**: Current canvas preview mode (`desktop`, `tablet`, `mobile`).
- **Drag & Drop Position**: Coordinates and drop target indicator.

The actual document itself remains the source of truth in `@kubuild/core` and is never mutated directly by the store.

## Basic Usage

```tsx
import React from 'react';
import { EditorCanvas, EditorProvider } from '@kubuild/editor';
import { createBlankDocument } from '@kubuild/core';

export function VisualBuilder() {
  const doc = createBlankDocument({ title: 'New Template' });

  return (
    <EditorProvider initialDocument={doc}>
      <div className="flex h-screen w-screen">
        <EditorCanvas />
      </div>
    </EditorProvider>
  );
}
```
