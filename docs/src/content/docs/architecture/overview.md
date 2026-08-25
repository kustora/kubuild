---
title: Architectural Overview
description: High-level system architecture, package boundaries, and strict unidirectional data flow.
---

KUBUILD is designed with a strict unidirectional dependency graph and clean separation of concerns.

## Dependency Graph

The dependency hierarchy points strictly inward toward `@kubuild/schema` and `@kubuild/core`:

```
@kubuild/schema
       ▲
       │
@kubuild/core
       ▲
       │
@kubuild/components
       ▲
       │
@kubuild/renderer
       ▲
       │
@kubuild/editor
       ▲
       │
@kubuild/react
       ▲
       │
apps / consumers
```

### Architectural Invariants

1. **Pure TypeScript Engine**:
   `@kubuild/core` has strict linting rules blocking imports from `react`, `react-dom`, `@kubuild/renderer`, and `@kubuild/editor`. It executes identically in browser, Node, and worker environments.

2. **Immutable Document State**:
   The `PageDocument` tree is immutable. The visual builder UI does not mutate tree nodes; every action creates a new immutable document state via the Command Engine.

3. **Portable Styling Engine**:
   Styling properties are stored as semantic tokens and layout metrics (`padding`, `fontSize`, `backgroundColor`, responsive overrides), not framework-bound class strings.

4. **Untrusted Input Security**:
   Imported `.stora` packages and templates are treated as untrusted data. They pass strict Zod validation, cycle-detection graph checks, schema migrations, and asset sanitization before being mounted to the canvas.
