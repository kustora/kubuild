# @kubuild/renderer

[![npm version](https://img.shields.io/npm/v/@kubuild/renderer.svg)](https://www.npmjs.com/package/@kubuild/renderer)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue)](https://www.typescriptlang.org/)

Pure recursive React renderer for **KUBUILD** page documents with Action Dispatcher, built-in action runners (API requests, modals, toasts, navigation), form runtime context, and CSS style compiler.

---

## 📦 Installation

```bash
# Using pnpm (recommended)
pnpm add @kubuild/renderer @kubuild/components @kubuild/core @kubuild/schema react react-dom

# Using npm
npm install @kubuild/renderer @kubuild/components @kubuild/core @kubuild/schema react react-dom

# Using yarn
yarn add @kubuild/renderer @kubuild/components @kubuild/core @kubuild/schema react react-dom
```

---

## ✨ Features

- **Pure Recursive React Renderer**: High-performance `<Renderer />` component that walks the document node tree recursively and renders React elements.
- **Action Dispatcher & Built-in Action Runners**:
  - `apiRequest`: Performs HTTP requests with URL parameters, headers, method, body interpolation, and success/error branching.
  - `showToast`: Renders toast notifications (success, error, warning, info) via `ToastContainer`.
  - `openModal` / `closeModal`: Triggers modal dialogs with focus trap and backdrop handlers.
  - `navigate`: Client-side or browser redirects with URL interpolation.
  - `custom`: Extensible hooks for application-specific action handlers.
- **Form Runtime Context**: `FormRuntimeProvider` and `useFormRuntime` for state management, field binding, live validation, and submission handling.
- **Dynamic CSS & Animations**: Computes responsive styles across breakpoints (desktop, tablet, mobile), hover/focus pseudo-states, and keyframe animations.
- **Security & XSS Defense**: Sanitizes dangerous `javascript:`, `data:text/html` URLs and prevents CSS injection.
- **Code Generator**: Compiles KUBUILD document trees into production-ready standalone React JSX and Tailwind CSS code.

---

## 🚀 Quick Usage

### Rendering a Page Document

```tsx
import React from 'react';
import { Renderer } from '@kubuild/renderer';
import type { PageDocument } from '@kubuild/schema';

interface PageViewerProps {
  document: PageDocument;
}

export const PageViewer: React.FC<PageViewerProps> = ({ document }) => {
  return (
    <div className="page-container">
      <Renderer
        document={document}
        onAction={(action, context) => {
          console.log('Action triggered:', action.name, context);
        }}
      />
    </div>
  );
};
```

### Rendering with Toast Feedback & Action Dispatcher

```tsx
import React from 'react';
import { Renderer, ToastContainer } from '@kubuild/renderer';
import type { PageDocument } from '@kubuild/schema';

export const InteractiveApp: React.FC<{ doc: PageDocument }> = ({ doc }) => {
  return (
    <>
      <Renderer document={doc} />
      {/* Toast container renders feedback notifications triggered by actions */}
      <ToastContainer position="top-right" />
    </>
  );
};
```

### Generating Standalone React Code

```typescript
import { generateReactCode } from '@kubuild/renderer';
import type { PageDocument } from '@kubuild/schema';

const tsxCode: string = generateReactCode(pageDocument.document, {
  framework: 'react',
  styling: 'tailwind'
});

console.log(tsxCode);
```

---

## 📄 License

MIT © [KUBUILD](https://github.com/kustora/kubuild)
