# @kubuild/schema

[![npm version](https://img.shields.io/npm/v/@kubuild/schema.svg)](https://www.npmjs.com/package/@kubuild/schema)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue)](https://www.typescriptlang.org/)

Zod schemas and inferred TypeScript definitions for the **KUBUILD** portable page document format (`.stora`), Action Pipeline, Form Configuration, and JSON Schema generation utilities.

---

## 📦 Installation

```bash
# Using pnpm (recommended)
pnpm add @kubuild/schema

# Using npm
npm install @kubuild/schema

# Using yarn
yarn add @kubuild/schema
```

---

## ✨ Features

- **Runtime Validation with Zod**: Strict validation and sanitization for all page document structures, node trees, styles, and action pipelines.
- **Portable Document Model**: Type-safe definitions for `PageDocument`, `Node`, `StyleObject`, `Metadata`, and `AnimationConfig`.
- **Action Pipeline Schema**: Rich action trigger models (`onClick`, `onSubmit`, `onChange`, `onLoad`) and step definitions (`apiRequest`, `showToast`, `openModal`, `closeModal`, `navigate`, `custom`).
- **Form & Field Binding Schema**: Data structures for form configuration, field validation rules (regex, required, min/max length, email), and variable state binding.
- **JSON Schema Export**: Utility functions (`generateJsonSchema`) to produce standard JSON Schema definitions for external tooling and validators.

---

## 🚀 Quick Usage

### Validating a Page Document

```typescript
import { PageDocumentSchema, type PageDocument } from '@kubuild/schema';

const untrustedData = {
  schema: 'stora.page',
  version: '1.0.0',
  metadata: {
    title: 'My Landing Page',
    createdAt: new Date().toISOString()
  },
  document: {
    id: 'root-1',
    type: 'container',
    children: [
      {
        id: 'heading-1',
        type: 'heading',
        props: { content: 'Welcome to KUBUILD' },
        styles: { fontSize: '2rem', fontWeight: 'bold' }
      }
    ]
  }
};

// Validates and returns strongly typed PageDocument
const result = PageDocumentSchema.safeParse(untrustedData);

if (result.success) {
  const page: PageDocument = result.data;
  console.log('Document valid:', page.metadata.title);
} else {
  console.error('Validation errors:', result.error.format());
}
```

### Validating Action Pipelines

```typescript
import { ActionPipelineSchema, type ActionPipeline } from '@kubuild/schema';

const pipelineData = {
  id: 'pipeline-submit-form',
  name: 'Submit Lead Form',
  trigger: 'onSubmit',
  steps: [
    {
      id: 'step-api-1',
      type: 'apiRequest',
      name: 'Send to Backend',
      config: {
        url: 'https://api.example.com/leads',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{{form}}'
      },
      onSuccess: [
        {
          id: 'step-toast-success',
          type: 'showToast',
          name: 'Success Notification',
          config: {
            message: 'Thank you! We will get in touch.',
            type: 'success'
          }
        }
      ]
    }
  ]
};

const pipeline: ActionPipeline = ActionPipelineSchema.parse(pipelineData);
```

---

## 📄 License

MIT © [KUBUILD](https://github.com/kustora/kubuild)
