---
title: '@kubuild/components API'
description: 'ComponentRegistry, ComponentDefinition schema, and standard primitive library.'
---

# `@kubuild/components` API Reference

Package `@kubuild/components` contains the registry system, validation policies, and standard component definitions for KUBUILD.

## Registry API

### `ComponentRegistry`

Manages registered component definitions, default styles, allowed parent/child hierarchies, and renderer implementations.

```ts
import { ComponentRegistry, createDefaultComponentRegistry } from '@kubuild/components';

// Initialize standard registry
const registry = createDefaultComponentRegistry();

// Check if a component is registered
const isRegistered = registry.has('button');

// Retrieve definition
const buttonDef = registry.get('button');
```

---

## `ComponentDefinition` Interface

```ts
interface ComponentDefinition {
  type: string;                   // Unique type identifier ('heading', 'button', 'custom-hero')
  label: string;                  // Human readable display name
  category: 'layout' | 'typography' | 'media' | 'interactive' | 'data' | 'custom';
  icon?: string;                  // Icon identifier for the component palette
  acceptsChildren: boolean;       // Whether other nodes can be dropped inside
  allowedChildren?: string[];     // Whitelist of child component types
  disallowedParents?: string[];   // Blacklist of disallowed parent component types
  defaultProps: Record<string, unknown>;
  defaultStyles: ResponsiveStyles;
  editableTextProp?: string;      // Prop name enabled for direct inline canvas text editing
  schema?: z.ZodType<any>;        // Validation schema for custom props
}
```

---

## Standard Component Catalog

### Layout Components

- **`page`**: The root document container.
- **`section`**: Full-width horizontal section container with responsive default padding.
- **`container`**: Max-width centered content wrapper (`max-w-7xl`).
- **`columns`**: Multi-column responsive flex/grid container.
- **`box`**: Versatile container element for generic styling and grouping.

### Content & Typography

- **`heading`**: Semantic `<h1>`–`<h6>` headings with level and editable text.
- **`text`**: Rich paragraphs with inline formatting and variable bindings.
- **`button`**: Clickable action and link buttons with variant presets.

### Media & Structured Data

- **`image`**: Responsive image with alt text, asset resolution, and lazy loading.
- **`table`**: Full structured table with rows (`table-row`) and cells (`table-cell`).
- **`unordered-list` / `ordered-list`**: Semantic `<ul>` / `<ol>` lists.
- **`list-item`**: Nested `<li>` items with support for rich text and icons.
- **`collection`**: Dynamic repeating list bound to an array variable (e.g. `{{products}}`).

---

## Registering Custom Components

```ts
import { ComponentRegistry } from '@kubuild/components';

export function registerCustomPricingCard(registry: ComponentRegistry) {
  registry.register({
    type: 'pricing-card',
    label: 'Pricing Card',
    category: 'custom',
    acceptsChildren: true,
    defaultProps: {
      planName: 'Pro Tier',
      priceMonthly: '$49',
      features: ['Unlimited Projects', 'Priority Support'],
    },
    defaultStyles: {
      base: {
        padding: '24px',
        backgroundColor: '#ffffff',
        borderRadius: '12px',
        border: '1px solid #e2e8f0',
      },
    },
  });
}
```
