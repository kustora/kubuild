# @kubuild/editor

[![npm version](https://img.shields.io/npm/v/@kubuild/editor.svg)](https://www.npmjs.com/package/@kubuild/editor)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue)](https://www.typescriptlang.org/)

Visual page builder editor for **KUBUILD** featuring an interactive canvas, Action Builder modal, Form Validation & Debugger panels, variable autocomplete, style manager, and mobile-responsive layout.

---

## 📦 Installation

```bash
# Using pnpm (recommended)
pnpm add @kubuild/editor @kubuild/components @kubuild/core @kubuild/renderer @kubuild/schema react react-dom zustand lucide-react

# Using npm
npm install @kubuild/editor @kubuild/components @kubuild/core @kubuild/renderer @kubuild/schema react react-dom zustand lucide-react

# Using yarn
yarn add @kubuild/editor @kubuild/components @kubuild/core @kubuild/renderer @kubuild/schema react react-dom zustand lucide-react
```

---

## ✨ Features

- **Interactive Visual Canvas**:
  - Drag-and-drop components and pre-built starter blocks from side panels onto the canvas with real-time drop indicators.
  - Inline text editing with rich styling support.
  - Multi-viewport switcher (Desktop, Tablet, Mobile) with zoom, pan, and alignment guides.
  - Breadcrumbs navigator and tree hierarchy layers panel.
- **Action Builder System**:
  - `ActionBuilderModal`: Visual modal for composing multi-step action workflows (`onClick`, `onSubmit`, `onChange`).
  - `ActionStepForm`: Dedicated configuration forms for API requests, Toast feedback, Modal toggles, Navigation, and Custom handlers.
  - `ActionBranchEditor`: Visual branch management for handling Success and Error outcomes in asynchronous actions.
- **Form Validation & Live Debugger**:
  - `ActionDebuggerPanel`: Real-time inspection of runtime state, form input values, and live action execution logs.
  - `FormValidationRulesPanel`: Visual editor for managing form field validation rules (required, regex, email, min/max length).
- **Variable System & Autocomplete**:
  - `VariableAutocompleteInput` & Textarea: Intelligent suggestion popups for template variables (e.g. `{{form.email}}`, `{{user.name}}`).
  - `VariablePicker`: Hierarchical variable catalog for browsing available data sources.
- **Style Manager Accordion**:
  - Granular control over Dimensions, Typography, Backgrounds, Borders, Layouts (Flexbox & CSS Grid), Spacing (Box Model), and Motion/Animations.
- **Mobile & Touch Friendly**:
  - Adaptive toolbar and bottom navigation bar for mobile devices.
  - Pointer and touch event drag support for floating navigator and table spreadsheet modals.
  - Responsive slide-over drawer drawers for sidebars and inspectors.
- **State Management**:
  - High-performance reactive store built on Zustand, seamlessly wired to `@kubuild/core` CommandEngine for unlimited undo/redo.

---

## 🚀 Quick Usage

### Embedding the Editor

```tsx
import React from 'react';
import { Editor, useEditorStore } from '@kubuild/editor';
import type { PageDocument } from '@kubuild/schema';

const initialPage: PageDocument = {
  schema: 'stora.page',
  version: '1.0.0',
  metadata: { title: 'New Web Page' },
  document: {
    id: 'root',
    type: 'container',
    children: []
  }
};

export const PageBuilderApp: React.FC = () => {
  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <Editor
        initialDocument={initialPage}
        onSave={(document) => {
          console.log('Saved document:', document);
        }}
        onExport={(format, data) => {
          console.log(`Exported as ${format}:`, data);
        }}
      />
    </div>
  );
};
```

### Accessing Editor State Programmatically

```typescript
import { useEditorStore } from '@kubuild/editor';

// Access active selection or trigger commands outside the canvas
const selectedNodeId = useEditorStore((state) => state.selectedNodeId);
const undo = useEditorStore((state) => state.undo);
const redo = useEditorStore((state) => state.redo);
```

---

## 📄 License

MIT © [KUBUILD](https://github.com/kustora/kubuild)
