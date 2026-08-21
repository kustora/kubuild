# KUBUILD (BUILDER-01)

<div align="center">

**Open, portable, and backend-agnostic web page builder engine.**

[![CI Quality Gate](https://github.com/kustora/kubuild/actions/workflows/ci.yml/badge.svg)](https://github.com/kustora/kubuild/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue)](https://www.typescriptlang.org/)
[![Turborepo](https://img.shields.io/badge/Turborepo-enabled-purple)](https://turbo.build/repo)
[![pnpm](https://img.shields.io/badge/pnpm-9.15-orange)](https://pnpm.io/)

*Build once, render anywhere, export/import without losing editability.*

</div>

---

## 📖 Overview

**KUBUILD** is an embeddable, modular visual page builder library designed for creating, editing, previewing, and distributing portable web documents (`.stora` format).

Unlike traditional page builders tied to proprietary CMS backends or databases, `kubuild` separates document models, rendering engines, and visual editing interfaces into distinct, loosely-coupled packages.

### Core Lifecycle

```
Create ➔ Customize ➔ Export ➔ Share ➔ Import ➔ Customize ➔ Publish
```

---

## 🏗️ Architecture & Packages

KUBUILD is organized as a high-performance **pnpm monorepo** managed with **Turborepo**:

```
kubuild/
├── apps/
│   └── stora-playground/      # Reference React playground & visual builder application
│
└── packages/
    ├── schema/                # @kubuild/schema: Zod schemas & TypeScript definitions
    ├── core/                  # @kubuild/core: Framework-agnostic pure TS engine & commands
    ├── components/            # @kubuild/components: Component definitions & registry
    ├── renderer/              # @kubuild/renderer: Pure recursive React renderer
    ├── editor/                # @kubuild/editor: Visual canvas, inspector, & Zustand store
    └── react/                 # @kubuild/react: Unified React integration entrypoint
```

### Dependency Direction

Dependency flow strictly points inward toward `@kubuild/core` and `@kubuild/schema`. Core contains **zero UI/DOM dependencies** and no framework lock-in.

```
                   @kubuild/core
                         ▲
                         │
              ┌──────────┴──────────┐
              │                     │
       @kubuild/schema       @kubuild/renderer
              ▲                     │
              │              @kubuild/editor
              │                     │
              └──────────────@kubuild/react
                                    ▲
                                    │
                            Consumer / Apps
```

---

## 🚀 Quick Start

### Prerequisites
- **Node.js**: `v20.x` or later
- **pnpm**: `v9.x` (`corepack enable pnpm` or `npm i -g pnpm`)

### 1. Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/kustora/kubuild.git
cd kubuild
pnpm install
```

### 2. Build Packages

Build all packages (`dist/` with ESM, CJS, and `.d.ts` declarations):

```bash
pnpm run build
```

### 3. Run Reference Playground

Start the local interactive visual playground at `http://localhost:3000`:

```bash
pnpm run dev
```

### 4. Run Tests & Validation

```bash
# Run unit tests across all workspace packages
pnpm run test

# Run strict TypeScript typechecks
pnpm run typecheck

# Run ESLint & architectural boundary validation
pnpm run lint
```

---

## 💻 Consumer Usage Example

You can embed KUBUILD into any React application using `@kubuild/react`:

```tsx
import React from 'react';
import { KubuildEditor, KubuildRenderer, createBlankDocument } from '@kubuild/react';

// Create a new blank document
const myDocument = createBlankDocument('My Awesome Landing Page');

export function BuilderApp() {
  return (
    <div style={{ height: '100vh', width: '100%' }}>
      {/* Visual Editor */}
      <KubuildEditor 
        initialDocument={myDocument} 
        onChange={(updatedDoc) => console.log('Document changed:', updatedDoc)} 
      />
    </div>
  );
}

export function ProductionPage({ document }) {
  return (
    {/* Runtime Renderer without editor chrome */}
    <KubuildRenderer document={document} />
  );
}
```

---

## 📚 Documentation

Detailed specifications and architectural guides are available in `/docs`:

- **[PRD (Product Requirements Document)](file:///Users/riziq/Code/some_projects/kustora/KUBUILD%20%7C%20BUILDER-01/docs/PRD.md)**: Product vision, user personas, runtime variables, and `.stora` package format.
- **[Architecture Document](file:///Users/riziq/Code/some_projects/kustora/KUBUILD%20%7C%20BUILDER-01/docs/ARCHITECTURE.md)**: Monorepo conventions, dependency graphs, styling policy, and command system.
- **[TODO & Roadmap](file:///Users/riziq/Code/some_projects/kustora/KUBUILD%20%7C%20BUILDER-01/docs/todo.md)**: MVP breakdown across phases 0 to 9 (`STORA-###` tasks).

---

## 📄 License

MIT License © 2026 KUBUILD Team.
