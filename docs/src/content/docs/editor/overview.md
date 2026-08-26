---
title: 'Editor Overview & Canvas'
description: 'Architecture and user experience of the KUBUILD visual editor canvas.'
---

# Editor Overview & Canvas

`@kubuild/editor` provides a visual drag-and-drop page builder designed for developers and end-users alike. It features responsive viewport switching, direct text editing, floating navigators, and spreadsheet table tools.

## Key Features

- **Multi-device Viewport Switcher**: Real-time canvas preview switching between Desktop (100% / max-6xl), Tablet (768px), and Mobile (375px).
- **Direct Inline Text Editing**: Double-click any typography element (headings, paragraphs, buttons, list items) to edit text inline with WYSIWYG selection controls.
- **Layers & Hierarchy Navigator**: Inspect the component tree with support for both docked and floating modes, drag-to-reorder, rename, lock, and visibility toggle.
- **Visual Inspector Panel**: Fine-tune styles across typography, colors, layout (Flexbox/Grid), spacing (margin/padding box model), borders, effects, and responsive overrides.
- **Table & Spreadsheet Studio**: Visual table editor with row/column insertions, cell merging (`colspan`/`rowspan`), formatting, and formula/binding helpers.
- **Dynamic Variable Binding**: Mustache syntax (`{{user.name}}`) dynamic data picker connected with host application data schemas.
- **Universal Import/Export**: Export as `.stora` package zip, clean HTML bundle, or AST JSON. Import templates, HTML code, or zip bundles seamlessly.

## Architecture

The visual editor splits responsibilities cleanly between transient UI state and persistent document state:

```
┌───────────────────────────────────────────────────────────┐
│                    KUBUILD Editor                         │
├─────────────────┬───────────────────────┬─────────────────┤
│ Component Panel │     Visual Canvas     │ Inspector Panel │
│                 │                       │                 │
│  - Primitives   │  - Viewport Switcher  │  - Style Props  │
│  - Layouts      │  - Drop Targets       │  - Breakpoints  │
│  - Semantic UI  │  - Direct Text Edit   │  - Props Schema │
│  - Custom Reg   │  - Table Spreadsheet  │  - Data Bindings│
├─────────────────┴───────────────────────┴─────────────────┤
│  Zustand Store (Transient UI) + Core Engine (AST & Undo)  │
└───────────────────────────────────────────────────────────┘
```

## Embedding the Editor

To render the complete builder interface in your application:

```tsx
import React, { useState } from 'react';
import { KubuildEditor } from '@kubuild/editor';
import { createBlankDocument } from '@kubuild/core';
import { createDefaultComponentRegistry } from '@kubuild/components';
import { PageDocument } from '@kubuild/schema';

export function VisualBuilderApp() {
  const [doc, setDoc] = useState<PageDocument>(() => 
    createBlankDocument({ title: 'Landing Page' })
  );

  return (
    <div className="h-screen w-screen">
      <KubuildEditor
        initialDocument={doc}
        registry={createDefaultComponentRegistry()}
        onChange={(newDoc) => {
          setDoc(newDoc);
          console.log('Document updated:', newDoc);
        }}
        variableCatalog={[
          { key: 'user.name', label: 'User Full Name', type: 'string', sampleValue: 'Alex Doe' },
          { key: 'pricing.tier', label: 'Plan Tier', type: 'string', sampleValue: 'Enterprise' }
        ]}
      />
    </div>
  );
}
```

## Canvas Shortcuts & Interactions

| Shortcut / Action | Action Description |
| :--- | :--- |
| **Click Element** | Selects node and opens properties in the Inspector |
| **Double-Click Text** | Enters direct inline WYSIWYG text editing mode |
| **Escape (`Esc`)** | Deselects active node or exits inline text editing |
| **Delete / Backspace** | Removes the currently selected element from the document |
| **Cmd / Ctrl + Z** | Undo the last action |
| **Cmd / Ctrl + Shift + Z** | Redo the last undone action |
| **Cmd / Ctrl + D** | Duplicate the selected element |
