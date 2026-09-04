# @kubuild/components

[![npm version](https://img.shields.io/npm/v/@kubuild/components.svg)](https://www.npmjs.com/package/@kubuild/components)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue)](https://www.typescriptlang.org/)

Component registry, schema definitions, traits, prop types, and starter form/layout block templates for **KUBUILD**.

---

## 📦 Installation

```bash
# Using pnpm (recommended)
pnpm add @kubuild/components @kubuild/core @kubuild/schema

# Using npm
npm install @kubuild/components @kubuild/core @kubuild/schema

# Using yarn
yarn add @kubuild/components @kubuild/core @kubuild/schema
```

---

## ✨ Features

- **Component Registry**: Unified registry (`componentRegistry`) of built-in components:
  - Layout: `container`, `section`, `grid`, `flex`
  - Typography: `heading`, `text`, `paragraph`, `link`
  - Media: `image`, `video`, `icon`
  - Interactive & Forms: `form`, `input`, `textarea`, `select`, `checkbox`, `radio`, `button`, `button-submit`
  - Data & Modals: `table`, `table-row`, `table-cell`, `modal`
- **Component Traits**: Declarative configuration for traits (properties, labels, input types, default values, validation rules).
- **Starter Block Templates**: Production-ready blocks in `STARTER_BLOCKS`:
  - **Contact Us Form**: Form block with validation, inputs (Name, Email, Message), and submit action.
  - **Newsletter Subscription**: Inline form with email input and submit handler.
  - **Lead Generation**: Multi-field lead capture form.
  - **Hero & Content Sections**: Responsive hero banners and feature grids.
- **Structural Integrity Rules**: Enforces parent-child constraints (e.g. table cells must be inside table rows, form inputs must be inside form nodes, submit buttons cannot be nested inside another button).

---

## 🚀 Quick Usage

### Accessing the Component Registry

```typescript
import { componentRegistry } from '@kubuild/components';

// Retrieve definition for a specific component
const buttonDef = componentRegistry.get('button');

console.log('Button default props:', buttonDef?.defaultProps);
console.log('Button traits:', buttonDef?.traits);

// Check all registered components
const allComponents = componentRegistry.getAll();
```

### Using Starter Form Templates

```typescript
import { STARTER_BLOCKS } from '@kubuild/components';

// Find the Contact Us starter block
const contactFormBlock = STARTER_BLOCKS.find(b => b.id === 'contact-us-form');

if (contactFormBlock) {
  console.log('Template name:', contactFormBlock.name);
  console.log('Preconfigured node tree:', contactFormBlock.node);
}
```

### Registering Custom Components

```typescript
import { componentRegistry, type ComponentDefinition } from '@kubuild/components';

const customCardDef: ComponentDefinition = {
  type: 'custom-card',
  name: 'Custom Card',
  category: 'Custom',
  icon: 'credit-card',
  defaultProps: {
    title: 'Card Title',
    body: 'Card description content.'
  },
  traits: [
    {
      name: 'title',
      label: 'Title',
      type: 'text'
    },
    {
      name: 'body',
      label: 'Body Text',
      type: 'textarea'
    }
  ]
};

componentRegistry.register(customCardDef);
```

---

## 📄 License

MIT © [KUBUILD](https://github.com/kustora/kubuild)
