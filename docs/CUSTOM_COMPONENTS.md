# Custom Component Extension Guide

This is a practical how-to for hosts (consumer applications) that want to register their own component types with `kubuild` — e.g. a `custom.product-card` — without patching `@kubuild/core` or `@kubuild/components` source. For the broader architectural rationale, see `docs/ARCHITECTURE.md` §11 (Component Registry) and §32 (Plugin and Extension Architecture).

## 1. Shape a `ComponentDefinition`

A component definition is a plain object — no base class, no core source changes:

```ts
import { ComponentDefinition } from '@kubuild/components';

const productCardDefinition: ComponentDefinition = {
  type: 'custom.product-card',
  label: 'Product Card',
  category: 'custom',
  acceptsChildren: false,
  capabilities: ['dataProvider'],
  propFields: [
    { name: 'title', label: 'Title', type: 'string' },
    { name: 'price', label: 'Price', type: 'number' },
  ],
  validateProps: (props) =>
    typeof props.title === 'string' && props.title.length > 0
      ? true
      : ['Product card requires a "title".'],
};
```

- `category: 'custom'` marks it as host-provided (used by `extractComponentRequirements`, see §3).
- `propFields` is the inspector-metadata contract — a host editor UI can render property controls generically from this without special-casing your type.
- `validateProps` is the prop-schema contract — return `true`, `false`, or a `string[]` of error messages.
- `capabilities` declares which host-provided runtime contracts (see `@kubuild/core`'s `AssetProvider`/`ActionRegistry`/`RuntimeContext` from STORA-015) this component needs to fully function. Names are free-form strings agreed between the host and its own component code — `kubuild` itself never reads them at runtime, only surfaces them for compatibility checks (§3).

## 2. Register it

```ts
import { createDefaultComponentRegistry } from '@kubuild/components';

const registry = createDefaultComponentRegistry();
registry.register(productCardDefinition);
```

`register()` throws if the type is already registered, unless you explicitly pass `allowOverride: true` as the second argument — this prevents a plugin from silently clobbering another plugin's (or a core) component by accident.

## 3. Validate documents that use it

Both of `@kubuild/core`'s `validateDocument()` and `@kubuild/components`' `ComponentRegistry.validateNode()` accept an injected registry, so a document referencing your custom type validates correctly once you supply a registry that has it registered — and fails with `UNKNOWN_COMPONENT_TYPE` (under `strictComponentTypes: true`) if you don't:

```ts
import { validateDocument } from '@kubuild/core';

validateDocument(doc, { componentRegistry: registry, strictComponentTypes: true });
```

This is exactly what an importer should do per `docs/ARCHITECTURE.md` §29/§31: a `.stora` package is untrusted input, and a host must never assume a document only uses component types it recognizes.

## 4. Feed export/import manifest requirements

`extractComponentRequirements()` walks a document tree and returns the custom component types and capabilities it depends on, in the exact shape `@kubuild/schema`'s `ManifestSchema` expects:

```ts
import { extractComponentRequirements } from '@kubuild/components';

const { requiredComponents, requiredCapabilities } = extractComponentRequirements(doc.document, registry);
// requiredComponents: ['custom.product-card']
// requiredCapabilities: ['dataProvider', ...any core components' capabilities used, e.g. 'actionRegistry']

const manifest = ManifestSchema.parse({ requiredComponents, requiredCapabilities, /* ...other manifest fields */ });
```

Built-in component types (page, section, heading, etc.) are never listed in `requiredComponents` — they ship with `kubuild` and are always available to any host. Only `category: 'custom'` types are considered a real compatibility requirement. When importing a `.stora` package, a host checks `manifest.requiredComponents` against its own registry (`registry.has(type)` for each) before accepting the document — matching the "Check Compatibility" step in `docs/ARCHITECTURE.md` §29.
