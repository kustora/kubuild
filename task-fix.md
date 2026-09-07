# PRD: Fix Interactive Components (Modal / Drawer / Collapsible)

## Background
Modal/drawer/collapsible node types were added across `packages/components`,
`packages/renderer`, and partially `packages/schema`, but end-to-end wiring
through the editor UI is broken. Node-type schema validation is NOT the
problem (`NodeSchema.type` is a free-form `z.string()`). The real gaps are in
how the editor's action-authoring UI targets modals, and in two dead action
paths. See investigation report (2026-09-06) for full file:line citations.

## Problem Statement
Building a page purely through the editor UI — drop a Modal, drop a Button,
wire an "Open Modal" action, click preview — does nothing. The generated
action opens a `modalManager` key that nothing listens to, because the
editor targets modals by structural **Node ID** while the renderer keys
open/closed state off the modal's own **`modalId` prop**.

## Goals
1. Wiring a button to open/close/toggle a modal, drawer, or collapsible via
   the editor UI (Action Builder and Inspector "Action" field) must actually
   work in preview/runtime.
2. `toggle_modal` must be a fully valid, schema-compliant, UI-selectable
   action type (or explicitly removed from the runtime runner set if out of
   scope for this milestone).
3. No regression to the already-fixed editor-mode visibility behavior
   (modal/drawer/collapsible must stay visible/selectable while building).

## Non-Goals
- Node-type schema changes (already permissive by design; not touched).
- New visual/UX design for modal/drawer/collapsible chrome.

## Root Causes (ranked by priority)

### P0 — Wrong target identifier in editor action UI — FIXED
`collectDocumentModals()` (`packages/editor/src/utils/document-scanner.ts:25-35`)
returned each modal-like node's structural `node.id`, not its `modalId` prop,
and its predicate only matched `type === 'modal' | 'dialog'` (never
`'drawer'`/`'collapsible'`). Consumers:
- `packages/editor/src/components/action-builder/action-step-form.tsx`
  (`ModalStepForm`, lines ~850-900) wrote `modalNodeId`/`modalId` = node id.
- `packages/editor/src/components/panels/action-prop-control.tsx`
  (lines ~228, ~484-510) same issue.

At runtime, `openModalRunner`/`closeModalRunner`
(`packages/renderer/src/action-runners/ui-feedback.ts`) call
`modalManager.openModal(<node id>)`, but the modal node's own `isModalOpen`
(`packages/renderer/src/renderer.tsx:190-197`) is keyed off `props.modalId`.
These strings essentially never matched by default.

**Status: fixed** — `collectDocumentModals()` now matches `modal` /
`drawer` / `collapsible` / any node carrying a `modalId` prop, and returns
`n.props?.modalId ?? n.id`. Covered by `packages/editor/tests/document-scanner.test.ts`.

### P1 — Legacy `props.action` path for open_modal/close_modal is dead — NOT FIXED (flagged)
`ActionPropControl` (`packages/editor/src/components/panels/action-prop-control.tsx:63-77`)
offers "Open Modal Dialog"/"Close Modal Dialog" as the 2nd/3rd option in a
Button's simple Inspector "Action" field. This dispatches via
`dispatchAction()` (`packages/renderer/src/render-context.tsx:268-355`),
which requires `context.actionRegistry.get('open_modal')`. No code under
`packages/editor/src` ever registers such a handler on any `ActionRegistry`
— the action silently no-ops with an `UNKNOWN_ACTION` diagnostic. This is a
pre-existing, cross-cutting gap affecting *every* action type through this
legacy field, not modal-specific — out of scope for the interactive-components
fix, left as a separate follow-up (see T2 below).

### P2 — `toggle_modal` phantom action type — RESOLVED (clarified, not added)
- Missing from `ActionStepTypeSchema` / `StepPayloadSchemas`
  (`packages/schema/src/actions.ts:24-34, 218-228`).
- Not exposed in `STEP_TYPE_OPTIONS` (Action Builder) or `ACTION_TYPES`
  (Inspector) dropdowns, despite being a registered runtime action-runner
  (`packages/renderer/src/action-runners/ui-feedback.ts:111-129`) and
  referenced (misleadingly) in `collapsibleDefinition`'s own prop description.

**Status: resolved via option (b)-adjacent path** — rather than adding a
whole new schema-level step type, the existing `open_modal` step's
`payload.toggle: boolean` field (already schema-valid, already used by the
Navbar block's mobile-drawer pattern) is the real supported way to toggle.
Added a "Toggle instead of always opening" checkbox to `ModalStepForm`
(`packages/editor/src/components/action-builder/action-step-form.tsx`) so
it's authorable in the UI, and corrected `collapsibleDefinition`'s prop
description (`packages/components/src/definitions/interactive/collapsible.ts`)
to stop referencing the non-existent `toggle_modal` step type. The runtime
`toggle_modal` runner key in `createDefaultActionRunners()` was left as-is
(harmless, usable by host apps that call runners directly outside the
schema-validated pipeline).

### P3 — Dead `context.modalManager` extension point — NOT FIXED (flagged, benign)
`RenderContext` (`packages/core/src/types/interfaces.ts:80-85`) has no
`modalManager` field; the cast in `renderer.tsx:191-192` and
`interactive-renderers.tsx:24-26` always falls back to the shared singleton.
Not currently causing failures (both action runners and renderer resolve to
the same singleton), but misleading and worth either wiring properly or
removing. Left alone — no observed breakage, low priority.

## Acceptance Criteria
- [x] Selecting a modal/drawer/collapsible node in the Action Builder's
      "Open Modal Dialog" / "Close Modal Dialog" step, or in a Button's
      Inspector "Action" field, now resolves the correct `modalId` target.
      (Preview-mode click-through for the *legacy* Inspector field still
      won't fire — see P1/T2.)
- [x] `collectDocumentModals()` lists drawer and collapsible nodes too, and
      returns their `modalId` prop value (falling back to `node.id` only
      when no `modalId` prop is set — matching
      `interactive-renderers.tsx:22`'s own resolution order).
- [ ] Legacy `props.action` open_modal/close_modal either works end-to-end
      (registry wired) or is removed from the Inspector's action-type list —
      still open, see T2.
- [x] `toggle_modal` semantics clarified and made UI-authorable via
      `open_modal` + `toggle` checkbox; schema/UI/runtime now consistent
      (no phantom step type referenced anywhere).
- [x] `pnpm --filter @kubuild/renderer test`, `pnpm --filter @kubuild/components test`,
      and `pnpm --filter @kubuild/editor test` all green.
- [x] New tests added: `packages/editor/tests/document-scanner.test.ts`
      (modalId-vs-nodeId resolution), plus editor-mode visibility and
      `defaultOpen` fallback cases in
      `packages/renderer/tests/interactive-components.test.tsx`.

## Risks
- Changing `collectDocumentModals()`'s return shape only affects the two
  known consumers (`ModalStepForm`, `ActionPropControl`'s modal select) —
  both just use `.id`/`.label`, confirmed via grep, no other call sites.
- If real documents already exist with `payload.modalNodeId` set to a stale
  node id (from the previously-broken UI), those existing actions will not
  auto-heal — re-selecting the target in the Action Builder is required.
  No migration was written for this; flagging in case existing `.stora`
  fixtures/templates need a one-time data fix.

---

# Task Breakdown

## T1 — Fix modal targeting in editor UI (P0) — DONE
- [x] Updated `collectDocumentModals()` in
      `packages/editor/src/utils/document-scanner.ts` to match
      `modal` / `drawer` / `collapsible` / any `modalId`-bearing node, and
      to return `n.props?.modalId ?? n.id`.
- [x] Verified the two consumers (`ModalStepForm`, `ActionPropControl`)
      need no changes — they already just consume `.id`/`.label`.
- [x] Added `packages/editor/tests/document-scanner.test.ts`.

## T2 — Wire or remove legacy open_modal/close_modal action path (P1) — OPEN
- [ ] Decide: register `open_modal`/`close_modal` onto an `ActionRegistry`
      used by the editor's `context.actionRegistry` (calling into the same
      `modalManager` singleton), OR remove these two options from
      `ACTION_TYPES` in `action-prop-control.tsx` and steer users to the
      Action Builder (`node.actions`) pipeline exclusively.
- [ ] If wiring: add the registration wherever the editor constructs its
      `RenderContext` for canvas preview (`packages/editor/src/components/canvas/canvas.tsx`).
- [ ] Add a test exercising the legacy `props.action` path end-to-end.
- Note: this gap is sitewide (every action type through the Inspector's
  simple "Action" field is affected, not just modals) — scope/decision
  needed before implementing.

## T3 — End-to-end action test coverage — PARTIALLY DONE
- [x] Added editor-mode visibility + `defaultOpen` fallback tests in
      `packages/renderer/tests/interactive-components.test.tsx`.
- [ ] Still open: a test that builds an `ActionPipeline` the same way the
      editor UI would (post-T1 fix), runs it through
      `executeNodeActions`/`dispatchAction`, and asserts the target's
      rendered visibility changes — not just direct `modalManager` calls.

## T4 — Resolve `toggle_modal` schema/UI gap (P2) — DONE (clarify-not-add)
- [x] Chose option (b)-adjacent: kept `open_modal` + `payload.toggle` as
      the one supported toggle mechanism; added the UI checkbox for it;
      fixed the misleading `collapsibleDefinition` description.
- [x] Left the runtime `toggle_modal` action-runner registration in place
      (harmless, host-callable outside the schema pipeline).

## T5 — Clean up dead `context.modalManager` extension point (P3, optional) — OPEN
- [ ] Either add `modalManager?: ModalManager` to `RenderContext` in
      `packages/core/src/types/interfaces.ts` and document how a host app
      injects a custom instance, or remove the unsafe casts in
      `renderer.tsx`/`interactive-renderers.tsx`/`action-dispatcher.ts` and
      rely solely on the singleton.

## T6 — Regression safety — DONE
- [x] `pnpm --filter @kubuild/renderer test` — 263/263 passing.
- [x] `pnpm --filter @kubuild/components test` — 271/271 passing.
- [x] `pnpm --filter @kubuild/editor test` — 387/387 passing.
- [x] Confirmed editor-mode visibility behavior (fixed earlier in this
      effort) is untouched: modal/drawer/collapsible remain
      visible/selectable on canvas while `mode === 'editor'`.
