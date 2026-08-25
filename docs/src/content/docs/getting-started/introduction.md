---
title: Introduction
description: Overview of the KUBUILD page builder engine and core philosophies.
---

**KUBUILD** (codename `BUILDER-01`) is an embeddable, backend-agnostic web page builder engine designed for modularity, safety, and cross-application portability.

Unlike traditional monolithic website builders that couple the canvas editor with database backends, hosting infrastructure, or proprietary CMS logic, KUBUILD separates concerns into composable, isolated packages:

```
@kubuild/schema  →  @kubuild/core  →  @kubuild/components  →  @kubuild/renderer  →  @kubuild/editor  →  @kubuild/react
```

## The Core Philosophy

### 1. Document as Single Source of Truth
The visual builder never directly mutates nodes or styles in memory. Instead, the document model is the immutable single source of truth. All modifications are executed via pure command dispatches, enabling flawless undo/redo, timeline tracking, and schema migrations.

### 2. Zero-Framework Core Engine
`@kubuild/core` contains zero dependencies on React, Vue, or the DOM. Document validation, schema transformations, and tree manipulation can run securely in Node.js server environments, Edge workers, CLI utilities, or web browsers.

### 3. Portable `.stora` Format
Templates and pages are packaged into portable `.stora` bundles containing the document manifest, component trees, style definitions, and sanitized media assets.

The complete lifecycle follows:
> **Create → Customize → Export → Share → Import → Customize → Publish**

## Package Structure

| Package | Responsibility |
| :--- | :--- |
| **`@kubuild/schema`** | Zod schemas and TypeScript types for `PageDocument`, `Node`, responsive style tokens, and JSON Schema exports. |
| **`@kubuild/core`** | Framework-agnostic command engine, `HistoryEngine` (undo/redo), version `migration.ts`, and cycle-detection `validator.ts`. |
| **`@kubuild/components`** | Component registry and base component definitions. |
| **`@kubuild/renderer`** | Recursive React renderer that turns `PageDocument` trees into reactive, responsive web pages. |
| **`@kubuild/editor`** | Visual drag-and-drop builder canvas with Zustand state for selection, hover, and responsive viewports. |
| **`@kubuild/react`** | Unified developer-facing library exposing `KubuildEditor`, `KubuildRenderer`, and factory helpers. |
