# @kubuild/react

[![npm version](https://img.shields.io/npm/v/@kubuild/react.svg)](https://www.npmjs.com/package/@kubuild/react)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue)](https://www.typescriptlang.org/)

Unified React entrypoint for **KUBUILD**: combines `@kubuild/schema`, `@kubuild/core`, `@kubuild/components`, `@kubuild/renderer`, and `@kubuild/editor` into a single, comprehensive package.

---

## 📦 Installation

```bash
# Using pnpm (recommended)
pnpm add @kubuild/react react react-dom

# Using npm
npm install @kubuild/react react react-dom

# Using yarn
yarn add @kubuild/react react react-dom
```

---

## ✨ Features

- **All-in-One Convenience**: Single package install that gives you the complete visual page builder suite:
  - 🎨 **Visual Editor** (`@kubuild/editor`)
  - ⚡ **Recursive Renderer** (`@kubuild/renderer`)
  - 🧩 **Component Registry & Templates** (`@kubuild/components`)
  - ⚙️ **Command Engine, Pipeline Executor & Undo/Redo** (`@kubuild/core`)
  - 📐 **Zod Schemas & Document Types** (`@kubuild/schema`)
- **Seamless Types & Re-exports**: Everything is re-exported from the top-level `@kubuild/react` module.
- **Production Ready**: Fully tree-shakeable with ESM and CJS builds.

---

## 🚀 Quick Usage

### Full Page Builder Application

```tsx
import React from 'react';
import {
  Editor,
  Renderer,
  PageDocumentSchema,
  type PageDocument
} from '@kubuild/react';

const initialDoc: PageDocument = {
  schema: 'stora.page',
  version: '1.0.0',
  metadata: {
    title: 'Landing Page'
  },
  document: {
    id: 'root-1',
    type: 'container',
    children: [
      {
        id: 'heading-1',
        type: 'heading',
        props: { content: 'Welcome to KUBUILD' },
        styles: { fontSize: '2.5rem', fontWeight: 'bold' }
      }
    ]
  }
};

export const App: React.FC = () => {
  const [isEditing, setIsEditing] = React.useState(true);
  const [doc, setDoc] = React.useState<PageDocument>(initialDoc);

  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <button
        onClick={() => setIsEditing(!isEditing)}
        style={{ position: 'fixed', top: 12, right: 12, zIndex: 9999 }}
      >
        {isEditing ? 'Switch to Preview' : 'Back to Editor'}
      </button>

      {isEditing ? (
        <Editor
          initialDocument={doc}
          onSave={(newDoc) => setDoc(newDoc)}
        />
      ) : (
        <div style={{ padding: '2rem' }}>
          <Renderer document={doc} />
        </div>
      )}
    </div>
  );
};
```

---

## 🏗️ Architecture

`@kubuild/react` serves as the umbrella package for the KUBUILD ecosystem:

```
@kubuild/react
├── @kubuild/editor      (Visual builder UI, canvas, inspector, action builder)
├── @kubuild/renderer    (Recursive React renderer, action dispatcher, styles)
├── @kubuild/components  (Registry, definitions, starter form templates)
├── @kubuild/core        (Document engine, pipeline executor, state store)
└── @kubuild/schema      (Zod validation schemas, TypeScript interfaces)
```

---

## 📄 License

MIT © [KUBUILD](https://github.com/kustora/kubuild)
