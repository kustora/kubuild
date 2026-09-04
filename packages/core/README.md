# @kubuild/core

[![npm version](https://img.shields.io/npm/v/@kubuild/core.svg)](https://www.npmjs.com/package/@kubuild/core)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue)](https://www.typescriptlang.org/)

Framework-agnostic engine for **KUBUILD**: document tree utilities, command engine, history stack (undo/redo), Action Pipeline Executor, Runtime State Store, Validation Engine, template interpolation, migration, and export/import.

Core contains **zero UI/DOM dependencies** and runs seamlessly in Node.js, Cloudflare Workers, Electron, and the browser.

---

## 📦 Installation

```bash
# Using pnpm (recommended)
pnpm add @kubuild/core @kubuild/schema

# Using npm
npm install @kubuild/core @kubuild/schema

# Using yarn
yarn add @kubuild/core @kubuild/schema
```

---

## ✨ Features

- **Document Tree Manipulation**: Safe operations for finding, inserting, moving, cloning, and removing nodes (`findNodeById`, `insertNode`, `removeNode`, `moveNode`).
- **Command Engine & History**: Transactional command pattern with an undo/redo stack (`CommandEngine`, `InsertNodeCommand`, `UpdateNodePropsCommand`, `UpdateNodeStylesCommand`).
- **Action Pipeline Executor**: Comprehensive runner for executing multi-step action flows (`ActionPipelineExecutor`), evaluating success/error branches and conditional expressions.
- **Runtime State Store**: Lightweight reactive store (`RuntimeStateStore`) for managing form values, execution logs, response data, and runtime variables.
- **Validation Engine**: Built-in validators for form fields and models (required, email, regex, min/max length, custom rules).
- **Template Interpolation**: Powerful variable interpolation supporting syntax like `{{form.name}}`, `{{user.id}}`, or `{{response.data}}`.
- **Portable Export & Import**: Pack page documents and assets into portable `.stora` archives (compressed zip via `fflate`) and unpack them back into memory.
- **Security Defense**: Strict XSS prevention, safe URL sanitization, and style value validation.

---

## 🚀 Quick Usage

### Command Engine & Undo/Redo

```typescript
import { CommandEngine, InsertNodeCommand } from '@kubuild/core';
import type { PageDocument, Node } from '@kubuild/schema';

const engine = new CommandEngine(initialPageDocument);

// Execute a command to insert a new node
const buttonNode: Node = {
  id: 'btn-1',
  type: 'button',
  props: { label: 'Click Me' },
  styles: { backgroundColor: '#3b82f6', color: '#ffffff' }
};

engine.execute(new InsertNodeCommand(engine.getDocument(), 'root-1', buttonNode));

// Undo the insertion
engine.undo();

// Redo the insertion
engine.redo();

const currentDoc: PageDocument = engine.getDocument();
```

### Action Pipeline Execution & Interpolation

```typescript
import {
  ActionPipelineExecutor,
  RuntimeStateStore,
  interpolateTemplate
} from '@kubuild/core';
import type { ActionPipeline } from '@kubuild/schema';

// 1. Initialize State Store
const stateStore = new RuntimeStateStore({
  form: { email: 'user@example.com', name: 'Alex' },
  user: { role: 'admin' }
});

// 2. Interpolate template string
const greeting = interpolateTemplate('Hello {{form.name}}! Role: {{user.role}}', stateStore.getState());
console.log(greeting); // "Hello Alex! Role: admin"

// 3. Execute Pipeline
const executor = new ActionPipelineExecutor({
  stateStore,
  runners: {
    async apiRequest(step, context) {
      const response = await fetch(step.config.url, { method: step.config.method });
      return await response.json();
    }
  }
});

const result = await executor.execute(pipelineDefinition);
```

### Exporting & Importing `.stora` Files

```typescript
import { exportStoraArchive, importStoraArchive } from '@kubuild/core';

// Export document to binary .stora buffer (zip)
const storaBuffer: Uint8Array = await exportStoraArchive(pageDocument, {
  includeAssets: true
});

// Import .stora buffer back into validated PageDocument
const importedDocument = await importStoraArchive(storaBuffer);
```

---

## 📄 License

MIT © [KUBUILD](https://github.com/kustora/kubuild)
