---
title: '@kubuild/components API'
description: 'ComponentRegistry, ComponentDefinition schema, HTML Semantic Traits system, and standard component primitives in @kubuild/components.'
---

# `@kubuild/components` API Reference

Package `@kubuild/components` provides the component registration engine, structural parent-child validation policies, semantic HTML trait definitions, prop fields schema, and pre-built composite block templates for KUBUILD.

---

## Component Registry

### `ComponentRegistry<TRenderer>`

A type-safe catalog storing all registered component definitions, default styles, validation rules, and optional renderer attachments.

```typescript
import { ComponentRegistry, createDefaultComponentRegistry } from '@kubuild/components';

// Create a registry populated with all standard KUBUILD components
const registry = createDefaultComponentRegistry();

// Inspect registered components
const isRegistered = registry.has('button');
const buttonDef = registry.get('button');

// Retrieve all components or filter by category
const allComponents = registry.list();
const layoutComponents = registry.listByCategory('layout');

// Validate structural nesting policy
const policy = registry.canInsertChild('container', 'button');
if (!policy.valid) {
  console.error('Invalid placement:', policy.errors);
}
```

#### Registry Methods

| Method | Parameters | Returns | Description |
| :--- | :--- | :--- | :--- |
| `register(def, allowOverride?)` | `ComponentDefinition`, `boolean` | `void` | Registers a component definition. Throws if already registered unless `allowOverride` is true. |
| `unregister(type)` | `string` | `boolean` | Removes a component definition by type identifier. |
| `get(type)` | `string` | `ComponentDefinition \| undefined` | Retrieves a definition by its type name. |
| `has(type)` | `string` | `boolean` | Checks if a component type exists in the registry. |
| `list()` | `none` | `ComponentDefinition[]` | Returns an array of all registered component definitions. |
| `listByCategory(category)` | `ComponentCategory` | `ComponentDefinition[]` | Filters components by category (`'layout'`, `'typography'`, `'media'`, `'form'`, `'interactive'`, `'data'`, `'custom'`). |
| `canInsertChild(parentType, childType)` | `string, string` | `{ valid: boolean; errors: string[] }` | Validates whether `childType` can be placed inside `parentType` based on nesting rules. |

---

## `ComponentDefinition` Schema

Describes everything the builder and renderer need to know about a component type.

```typescript
export interface ComponentDefinition<TRenderer = unknown> {
  /** Unique type identifier ('heading', 'button', 'pricing-card') */
  type: string;
  /** Human-readable display name in component panels */
  label: string;
  /** Functional category */
  category: 'layout' | 'typography' | 'media' | 'form' | 'interactive' | 'data' | 'custom';
  /** Optional icon identifier for UI palettes */
  icon?: string;
  /** Description shown in tooltips and block previews */
  description?: string;
  /** Whether other nodes can be nested inside this component */
  acceptsChildren?: boolean;
  /** Whitelist of allowable child component types */
  allowedChildren?: string[];
  /** Blacklist of disallowed parent component types */
  disallowedParents?: string[];
  /** Baseline default prop values on initial insertion */
  defaultProps?: Record<string, unknown>;
  /** Default responsive styles applied on instantiation */
  defaultStyles?: ResponsiveStyles;
  /** Default child node tree template inserted automatically when instantiated */
  defaultChildren?: ComponentDefaultChildSpec[];
  /** Inspector fields definition for automatic property controls */
  propFields?: ComponentFieldDefinition[];
  /** Semantic HTML traits metadata (href, target, alt, id, aria-label, etc.) */
  traits?: ComponentTraits;
  /** Custom validation function for node props */
  validateProps?: (props: Record<string, unknown>) => boolean | string[];
  /** Required host capabilities (e.g. 'assetProvider', 'actionRegistry') */
  capabilities?: string[];
  /** Optional renderer component mapping */
  renderer?: TRenderer;
}
```

### `ComponentFieldDefinition`

Defines inspector input controls for component props without writing custom React UI:

```typescript
export interface ComponentFieldDefinition {
  name: string;
  label: string;
  type: 'string' | 'textarea' | 'number' | 'boolean' | 'select' | 'color' | 'image' | 'action' | 'json';
  defaultValue?: unknown;
  options?: Array<{ label: string; value: unknown }>;
  description?: string;
}
```

---

## Semantic HTML Traits System

Traits represent functional and semantic HTML attributes (such as `href`, `target`, `alt`, `id`, `aria-label`, `loading`, etc.) separated from visual styling properties.

```typescript
import {
  idTrait,
  titleTrait,
  hrefTrait,
  targetTrait,
  srcTrait,
  altTrait,
  loadingTrait,
  ariaLabelTrait,
  buttonTypeTrait,
  actionTrait,
  methodTrait,
} from '@kubuild/components';

// Define traits for a custom Link Card component
const linkCardTraits = [
  idTrait(),
  hrefTrait({ defaultValue: '#' }),
  targetTrait(),
  ariaLabelTrait(),
];
```

#### Available Trait Helpers

- **Common Attributes**: `idTrait()`, `titleTrait()`, `ariaLabelTrait()`, `tagTrait()`
- **Links & Navigation**: `hrefTrait()`, `targetTrait()`, `relTrait()`
- **Media**: `srcTrait()`, `altTrait()`, `loadingTrait()`, `posterTrait()`, `controlsTrait()`, `autoplayTrait()`, `loopTrait()`, `mutedTrait()`
- **Forms**: `fieldNameTrait()`, `placeholderTrait()`, `requiredTrait()`, `disabledTrait()`, `readOnlyTrait()`, `valueTrait()`, `actionTrait()`, `methodTrait()`, `buttonTypeTrait()`, `inputTypeTrait()`
- **Tables**: `colSpanTrait()`, `rowSpanTrait()`

---

## Standard Component Catalog

KUBUILD comes equipped with 25+ production-ready component primitives:

| Category | Component Types | Description |
| :--- | :--- | :--- |
| **Layout** | `page`, `section`, `container`, `columns` | Structural containers with responsive max-width and flex/grid column arrangements. |
| **Typography** | `heading`, `text`, `paragraph`, `blockquote`, `badge`, `code-block` | Headings `<h1>`–`<h6>`, paragraphs, rich code blocks, and badges. |
| **Interactive** | `button`, `link` | Clickable buttons with variants, action dispatches, and anchor links. |
| **Media** | `image`, `video`, `icon`, `html-embed` | Responsive images with asset provider integration, YouTube/Vimeo embeds, Lucide icons, and raw HTML embeds. |
| **Form** | `form`, `input`, `textarea`, `select`, `checkbox`, `radio` | Native form inputs with validation rules and action handlers. |
| **Data & Lists** | `collection`, `list`, `list-item`, `table`, `table-row`, `table-cell` | Dynamic runtime data collections, ordered/unordered lists, and structured spreadsheet data tables. |

---

## Composite Starter Blocks (`STARTER_BLOCKS`)

Package `@kubuild/components` exports pre-composed multi-node templates for rapid page assembly:

```typescript
import { STARTER_BLOCKS } from '@kubuild/components';

// Available categories: 'layout' | 'sections' | 'ui' | 'pricing' | 'cta'
const heroBlock = STARTER_BLOCKS.find((b) => b.id === 'section-hero');
```

---

## Custom Component Registration Example

```typescript
import { ComponentRegistry, idTrait, ariaLabelTrait } from '@kubuild/components';

export function registerNotificationBanner(registry: ComponentRegistry) {
  registry.register({
    type: 'notification-banner',
    label: 'Notification Banner',
    category: 'custom',
    icon: 'bell',
    acceptsChildren: false,
    defaultProps: {
      message: 'New update available!',
      badgeText: 'New',
      type: 'info',
    },
    defaultStyles: {
      base: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '12px 16px',
        backgroundColor: '#eff6ff',
        border: '1px solid #bfdbfe',
        borderRadius: '8px',
      },
    },
    propFields: [
      { name: 'message', label: 'Message', type: 'string' },
      { name: 'badgeText', label: 'Badge Label', type: 'string' },
      {
        name: 'type',
        label: 'Tone',
        type: 'select',
        options: [
          { label: 'Info', value: 'info' },
          { label: 'Warning', value: 'warning' },
          { label: 'Success', value: 'success' },
        ],
      },
    ],
    traits: [
      idTrait(),
      ariaLabelTrait(),
    ],
  });
}
```
