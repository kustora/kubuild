# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**KUBUILD** (codename BUILDER-01) is an embeddable, backend-agnostic web page builder engine: document model, renderer, and visual editor as separate packages, exportable/importable as a portable `.stora` package. `Stora.page` is planned as a consumer of this library but must never be depended on by it.

Core lifecycle: `Create → Customize → Export → Share → Import → Customize → Publish`.

## Commands

pnpm + Turborepo monorepo. Run from repo root.

```bash
pnpm install            # install all workspace deps
pnpm run build           # turbo run build (all packages, respects dependency graph)
pnpm run dev              # turbo run dev (watch mode / playground on :3000)
pnpm run test              # turbo run test (vitest, all packages)
pnpm run typecheck          # turbo run typecheck (tsc --noEmit, all packages)
pnpm run lint                # turbo run lint (eslint, all packages)
pnpm run format / format:check  # prettier over the whole repo
```

Per-package (run inside `packages/<name>` or via `pnpm --filter @kubuild/<name> <script>`):

```bash
pnpm --filter @kubuild/core test              # run one package's vitest suite
pnpm --filter @kubuild/core test -- -t "name"  # run a single test by name (vitest passthrough)
pnpm --filter @kubuild/core build              # tsup build + tsc --emitDeclarationOnly
```

`test` depends on `build` in `turbo.json`, and `typecheck`/`build` depend on `^build` (upstream workspace packages built first) — so after editing a package that others depend on (e.g. `schema` or `core`), rebuild it before running tests/typecheck in dependents, or just run the root `pnpm run test`/`typecheck` and let Turbo order it.

Vite playground app (`apps/stora-playground`) has its own `dev`/`build`/`preview`/`typecheck`/`lint`, no `test` script.

## Architecture

Dependency direction is one-way, inward toward `@kubuild/core` and `@kubuild/schema`. This is enforced both by `pnpm-workspace.yaml` package boundaries and by an ESLint `no-restricted-imports` rule scoped to `packages/core/**` (see `eslint.config.mjs`) that blocks `react`, `react-dom`, `@kubuild/renderer`, `@kubuild/editor`, and `@kubuild/react` imports inside core. **`@kubuild/core` must stay pure TypeScript with zero framework/DOM dependencies** — this is the one architectural rule most likely to be violated by accident, so check it before adding any import to `packages/core/src`.

```
@kubuild/schema  →  @kubuild/core  →  @kubuild/components  →  @kubuild/renderer  →  @kubuild/editor  →  @kubuild/react  →  apps/stora-playground
```

Package responsibilities:

- **`packages/schema`** — Zod schemas + inferred TS types for the portable document format (`PageDocumentSchema`, `NodeSchema`, style/variable/action/asset binding schemas), plus JSON Schema export (`json-schema.ts`) and document fixtures for tests. `SCHEMA_NAME` is the literal `"stora.page"`; `CURRENT_SCHEMA_VERSION` tracks the current document schema version.
- **`packages/core`** — framework-agnostic engine: document/tree utilities (`document-utils.ts`, `command-tree-utils.ts`), the command engine (`commands.ts` — `INSERT_NODE`/`MOVE_NODE`/`UPDATE_PROPS`/`UPDATE_STYLE`/`DELETE_NODE`/`DUPLICATE_NODE`-style operations, each producing an immutable `CommandResult` with a `DocumentChangeEvent`), a generic undo/redo `HistoryEngine` (`history.ts`), schema `migration.ts` (versioned document migration with dry-run/diagnostic support), and `validator.ts` (structural + cycle-detection validation). All mutations flow through commands rather than direct node mutation — that's what makes undo/redo, migration, and validation composable.
- **`packages/components`** — component type `registry.ts` (registration/lookup, not hardcoded into the editor) and base `definitions.ts`.
- **`packages/renderer`** — pure recursive React renderer that turns a `PageDocument` + component registry + runtime context (variables/actions/assets) into React output. No editor chrome, no selection/DnD state.
- **`packages/editor`** — visual builder: Zustand `store.ts` for UI/editor state (selection, hover, viewport) sitting on top of `@kubuild/core` commands, plus the editor React tree. Zustand state is UI-only; the document itself remains the source of truth and is never mutated directly by the store.
- **`packages/react`** — the unified public entrypoint (`KubuildEditor`, `KubuildRenderer`, `createBlankDocument`, etc.) that consumer apps import.
- **`apps/stora-playground`** — Vite + React + Tailwind reference app exercising the full stack end-to-end.

Key invariant from `docs/ARCHITECTURE.md`: **the Document is the source of truth, never the Builder.** Builder modifies the document via commands, Renderer only reads it, Exporter serializes it, Importer produces it. Page styling is stored as a portable style-abstraction object (layout/spacing/typography/background/border/effects, with per-breakpoint `base`/`desktop`/`tablet`/`mobile` overrides), not as Tailwind classes — Tailwind is only for the Builder's own UI chrome, never for the document format.

`.stora` packages (manifest + document JSON + metadata + assets) are treated as **untrusted input** on import: schema validation, compatibility/version checks, asset sanitization, and no execution of arbitrary code from imported templates are required — see `docs/ARCHITECTURE.md` §31 before touching import/export code.

`docs/todo.md` tracks MVP work as `STORA-###` tickets grouped into phases (0–9: setup → schema/document engine → component registry → renderer → builder editor → variables/data binding → import/export → …). Check it for what phase current work belongs to.

## Docs

- `docs/PRD.md` — product vision, personas, runtime variables, `.stora` format.
- `docs/ARCHITECTURE.md` — full architecture spec (written partly in Indonesian), dependency rules, styling policy, command system, security model for imports. Some package names there (`renderer-react`, `importer`, `exporter`, `cli`) are aspirational/future and don't match the current `packages/renderer` naming — trust the actual `packages/*` directories and their `package.json` names over the doc's proposed layout.
- `docs/todo.md` — phased MVP breakdown, `STORA-###` ticket IDs.
