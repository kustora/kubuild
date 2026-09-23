# @kubuild/core

## 0.7.0

### Minor Changes

- [#53](https://github.com/kustora/kubuild/pull/53) [`97bc7c9`](https://github.com/kustora/kubuild/commit/97bc7c90f1a7a2729dce857a042e5e1fcd395655) Thanks [@riziqalbab](https://github.com/riziqalbab)! - **BREAKING (tracking): secrets no longer live in the document.** Tracking is now backend/tech-agnostic: the document keeps only public IDs, flags and an opaque `credentialId`; the host owns every secret and delivers server-side events through a relay.

  - **schema**: removed `capiAccessToken`, `serverRelayUrl` (meta/google/gtm/tiktok), `measurementProtocolSecret`, TikTok `accessToken`, and custom `endpointUrl`/`headers` from the tracking provider schemas (old documents still parse; the fields are stripped). `PixelCredentialOption` is metadata-only (`id, name, provider, pixelId?, measurementId?, containerId?, hasSecret?, isActive?`). New: `TrackingProviderSecrets` (+ per-provider secret schemas), `LEGACY_TRACKING_SECRET_KEYS`, versioned relay protocol `TrackingRelayRequestSchema` / `TrackingRelayResponseSchema` (v1) with JSON Schema exports (`getTrackingRelayRequestJsonSchema`, `getTrackingRelayResponseJsonSchema`, `getTrackingProviderSecretsJsonSchema`) so PHP/Go/… backends can implement a relay. `track_event` `provider` now accepts `'gtm'` (dataLayer push). `CURRENT_SCHEMA_VERSION` is now `1.1.0`; the page JSON Schema describes `tracking` and lists `track_event`.
  - **core**: `dispatchServerTracking(event, config, options)` gets secrets only via `options.resolveSecrets: TrackingSecretResolver` (keyed by the config's `credentialId`); a missing secret skips that provider with a `reason` instead of throwing. The `send*` helpers now take a `secrets` argument. New `createTrackingRelayHandler({ getConfig, resolveSecrets, allowedOrigins?, fetchFn? })` — a Web-standard `Request`/`Response` relay that validates the body, loads the trusted config from the host and takes client IP/UA from headers. New migration `1.0.0 -> 1.1.0` strips secrets and reports a `TRACKING_SECRET_REMOVED` warning (`MigrationDiagnostic.warnings`); `.stora` import/export and the migration of current-version docs strip them defensively (`sanitizeDocumentTracking`, `stripDocumentTrackingSecretsInPlace`). `RenderContext.tracking` (`RuntimeTrackingOptions`: `relayUrl`, `documentId`, `relayHeaders`, `credentials`, `fetchFn`, `onLog`) is host config.
  - **renderer**: the browser never calls `dispatchServerTracking`. Server delivery only POSTs a v1 relay request to `context.tracking.relayUrl`; without it, the server part is skipped with a `TRACKING_RELAY_NOT_CONFIGURED` diagnostic/log and the client pixel still fires. `serverRelayUrl` in step payloads/documents is ignored. `'gtm'` pushes to `window.dataLayer`.
  - **editor**: credential pickers select by `credentialId` from metadata-only `trackingCredentials`. New `onSaveTrackingSecret?: ({ provider, secrets, name? }) => Promise<{ credentialId }>` prop on `KubuildEditor`; without it, secret inputs are disabled with an explanation. Relay/endpoint URL inputs are gone (relay shown read-only from `context.tracking.relayUrl`). `updateDocumentTracking` and JSON export strip secrets.

  **Migration**: run documents through `migrateDocument` (or import them) — secrets are removed and a warning lists the removed paths. Store each secret in your backend, give the editor `trackingCredentials` + `onSaveTrackingSecret`, set `credentialId` on the provider, pass `context={{ tracking: { relayUrl, documentId } }}` to the renderer and mount `createTrackingRelayHandler` (or your own relay implementing the v1 JSON Schema).

- [#53](https://github.com/kustora/kubuild/pull/53) [`125a60a`](https://github.com/kustora/kubuild/commit/125a60aea85d0d9fc4418a8db2bd2cceb1077e50) Thanks [@riziqalbab](https://github.com/riziqalbab)! - - `@kubuild/schema`: add `toggle_modal` to `ActionStepTypeSchema`, with a `ToggleModalStepPayloadSchema` in `StepPayloadSchemas` (`modalId` / `modalNodeId` / `targetNodeId` / `nodeId`, one required) and in the exported JSON Schemas. The renderer already shipped a `toggle_modal` runner, but documents using it failed schema validation.
  - `@kubuild/core`: `validateDocument` now honours `checkAssetReferences`, `checkVariableBindings` and `checkActionBindings` (all default `true`, so existing behaviour is unchanged). New `knownAssetIds` option checks that asset references resolve: an unknown `assetId` is an `INVALID_ASSET_REFERENCE` error, or an `UNRESOLVED_ASSET_REFERENCE` warning when the reference has a `fallbackUrl`.
  - `@kubuild/editor`: action builder summarises `toggle_modal` steps.
  - Remove `eslint-disable` comments for the unregistered `react-hooks/exhaustive-deps` rule, which made `lint` fail.

### Patch Changes

- Updated dependencies [[`97bc7c9`](https://github.com/kustora/kubuild/commit/97bc7c90f1a7a2729dce857a042e5e1fcd395655), [`125a60a`](https://github.com/kustora/kubuild/commit/125a60aea85d0d9fc4418a8db2bd2cceb1077e50)]:
  - @kubuild/schema@0.7.0

## 0.6.0

### Minor Changes

- • Tracking Schemas & Config: Introduced tracking.ts and tracking.ts supporting standard and custom events across providers (Meta Pixel, GA4,
  TikTok Events API, Custom Webhooks).
  • Server Tracking Relay: Server-side tracking runtime in server-tracking.ts featuring Event ID deduplication, SHA-256 user data hashing, Meta
  Conversions API (CAPI), and GA4 Measurement Protocol.
  • Action Step Runner: Added a dedicated track_event action runner in tracking.ts with runtime variable interpolation.
  • Editor UI: Added the tracking-settings-modal.tsx in the toolbar and refactored the NodePixelEventSection in inspector-panel.tsx for
  streamlined pixel configuration.

  #### 2. Asset Management Integration (AssetProvider)

  • Integrated AssetProvider into inspector-panel.tsx, traits-panel.tsx, and background image controls for direct uploads.
  • Introduced AssetManagerModal and asset gallery browsing for media source controls.

  #### 3. AI Chat Panel & State Enhancements

  • Added isAiRunning state and setter in store.ts to centrally manage AI execution status.
  • Added visual loading indicators and improved page plan handling in ai-chat-panel.tsx.
  ──────

  ### 📦 Version 0.5.0

  • AI Page Planning (planPage): Users can generate and approve a structured page outline before triggering full-page AI document generation.
  • Background Image Decoration: Visual background image controls and property normalization in the style manager.
  • Child Policy Validation: Enhanced validation rules for parent-child component relationships with warnings and updated layout component
  definitions.
  ──────

  ### 📦 Version 0.4.0

  • AI Agent Mode (Tool-Calling Agent):
  • Multi-step AI agent using document tools (createDocumentTools) to inspect outline, locate nodes, and perform surgical edits (AgentOps)
  without full-page regeneration.
  • Safe transaction batching via store.ts (an entire agent turn is undone in a single undo step).
  • Live tool-call timeline with op-by-op review (Apply / Discard).
  • Internationalization (i18n): Added localization support for English (en) and Indonesian (id).
  ──────

  ### 📦 Version 0.3.1

  • Pinch-to-zoom & Two-Finger Pan: Multi-touch canvas navigation gestures for mobile and tablet devices.
  • Mobile Floating Action Pill: Bottom action bar offering Move Up, Move Down, Quick Edit, and Delete actions on touch screens.
  • Touch Optimizations: Bounding-box recomputation throttling, coarse-pointer hover state disabling, and auto-closing drawers upon element
  insertion.
  ──────

  ### 📦 Version 0.3.0

  • Initial @kubuild/ai Release: Multi-provider adapter layer (OpenAI, Anthropic, Gemini, Ollama) and Server-Sent Events (SSE) token streaming.
  • Interactive Components: Added native support for modal, drawer, and collapsible.
  • Canvas Multi-Artboards: Free positioning, dragging, and deletion of component artboards on the canvas.
  • Dimension Controls: Added object-fit and object-position controls in the inspector.
  • Responsive Navbar: Mobile hamburger menu and dropdown support.

### Patch Changes

- Updated dependencies []:
  - @kubuild/schema@0.6.0

## 0.5.0

### Patch Changes

- Updated dependencies []:
  - @kubuild/schema@0.5.0

## 0.4.0

### Patch Changes

- Updated dependencies []:
  - @kubuild/schema@0.4.0

## 0.3.1

### Patch Changes

- [`7ca7b20`](https://github.com/kustora/kubuild/commit/7ca7b2093ec9c739bb683c571491436e4574a019) Thanks [@riziqalbab](https://github.com/riziqalbab)! - - **Pinch-to-zoom & Two-finger Pan**: Implemented natural multi-touch gestures on the editor canvas for mobile and tablet devices.
  - **Mobile Floating Action Pill**: Added a compact bottom action bar when an element is selected on mobile screens, providing quick access to Move Up, Move Down, Quick Edit, and Delete.
  - **Move Up / Down Hierarchy Controls**: Added `moveComponentUp` and `moveComponentDown` in the editor store and floating action badges to allow effortless reordering without dragging.
  - **Smart Component Insertion**: Intelligently inserts new components as siblings after the active leaf node if the selected element cannot accept children.

  - **Auto-close Mobile Drawers**: Automatically dismisses the mobile component/block sidebar when an item is added to the canvas (`onItemInserted`).
  - **Touch & Small Screen Optimization**:
    - Disabled resource-heavy radial grid canvas background and snapping indicators on small touch screens.
    - Disabled hover states for coarse pointer devices to avoid sticky selection states.
    - Throttled bounding-box recomputation during window resize and canvas scroll using `requestAnimationFrame`.
    - Configured proper CSS `touch-action` styles to prevent native browser gesture collisions.
- Updated dependencies [[`7ca7b20`](https://github.com/kustora/kubuild/commit/7ca7b2093ec9c739bb683c571491436e4574a019)]:
  - @kubuild/schema@0.3.1

## 0.3.0

### Minor Changes

- # v0.3.0 Minor Release

  ### @kubuild/ai
  - **Initial release on npm registry**
  - Multi-provider AI adapter layer supporting OpenAI, Anthropic, Gemini, and Ollama
  - Token-level streaming with Server-Sent Events (SSE) for real-time page generation
  - In-editor AI generation engine supporting full-page generation and section refactoring
  - Selection-aware context generation for Ask & Enhance workflow
  - Security guardrails: authentication hooks, rate-limiting, and chat history persistence

  ### @kubuild/components
  - Modularized architecture with subpath exports: `@kubuild/components/definitions`, `@kubuild/components/traits`, and `@kubuild/components/blocks`
  - Added interactive components: `modal`, `drawer`, and `collapsible`
  - Enhanced `Navbar` component with responsive mobile support, hamburger menu, and expandable dropdowns
  - Added Navbar starter blocks and metadata

  ### @kubuild/core
  - Reorganized codebase into modular domain directories
  - Added canvas artboards support with multi-artboard free positioning and coordinate calculations
  - Integrated AI prompt-to-page generation command pipelines
  - Enhanced state store and runtime variable handling

  ### @kubuild/editor
  - Built-in floating AI Chat Panel with draggable header, prompt-to-page generation, and chat history
  - Selection-aware AI Ask & Enhance workflow
  - Visual `ActionPropControl` replacing plain JSON textareas for action configuration
  - Canvas Artboards support: free positioning, drag manipulation, and artboard deletion with confirmation
  - Dimension Sector Controls: added `object-fit` and `object-position` controls
  - Responsive settings with viewport manager and custom viewport presets
  - Component filtering and customization options in left sidebar

  ### @kubuild/renderer
  - Full runtime and editor support for interactive components (`modal`, `drawer`, `collapsible`)
  - `ArtboardPortalHost` for rendering component artboards on isolated surfaces and overlays
  - Mobile navigation menu handling and safe modal state execution

  ### @kubuild/schema
  - Added schemas for artboards and canvas positioning
  - Added responsive settings and viewport schemas
  - Added action schemas and interactive component validation

  ### @kubuild/react
  - Re-exported AI modules and integrated with latest `@kubuild/ai` and `@kubuild/editor`

### Patch Changes

- Updated dependencies []:
  - @kubuild/schema@0.3.0

## 0.2.0

### Minor Changes

- Minor release (v0.2.0):
  - **Action & Form System**: Comprehensive action pipeline with trigger events, validation rules, step forms, branch conditions, and API request handling.
  - **Action Builder & Debugger**: Visual Action Builder modal, Action Branch Editor, Action Debugger panel, and Form Validation Rules panel.
  - **Variable System & Autocomplete**: Autocomplete inputs, textareas, and variable picker supporting runtime data binding and catalog expressions.
  - **Form Templates**: Ready-to-use starter templates (Contact Us, Newsletter, Lead Generation) with predefined traits and validation.
  - **Execution & Runtime Engines**: `ActionPipelineExecutor`, `RuntimeStateStore`, `validationEngine`, template interpolation, and built-in runners (toasts, modals, navigation, fetch).
  - **Mobile Responsive Layout**: Mobile-friendly toolbar, bottom navigation bar, and pointer/touch event support for modals and canvas tools.
  - **Architecture Refactoring**: Reorganized component directories across packages for better modularity and maintainability.

### Patch Changes

- Updated dependencies []:
  - @kubuild/schema@0.2.0

## 0.1.0

### Minor Changes

- Release KUBUILD version 0.1.0:
  - **@kubuild/schema**: Zod schemas and TypeScript types for `.stora` document format, JSON Schema generation, responsive styles, motion, and typography definitions.
  - **@kubuild/core**: Document utilities, command bus, undo/redo history, schema validation, and fflate compression.
  - **@kubuild/components**: Component registry and predefined block templates (Navbar, Hero, Features, Pricing, Testimonials, CTA, Footer, etc.).
  - **@kubuild/renderer**: Pure recursive React renderer, responsive style generation, motion keyframes injection, and HTML/CSS/Tailwind code generator.
  - **@kubuild/editor**: Visual builder interface with blocks panel, breadcrumbs, code highlighter & export modal, layers, style manager accordion, motion sector controls, and floating badges.
  - **@kubuild/react**: Unified React entrypoint for KUBUILD.

### Patch Changes

- Updated dependencies []:
  - @kubuild/schema@0.1.0

## 1.0.0

### Major Changes

- [`e5d5e55`](https://github.com/kustora/kubuild/commit/e5d5e55180e2673a78aba70e666e5e119e2b2d29) Thanks [@riziqalbab](https://github.com/riziqalbab)! - Initial release of the Kubuild monorepo. This release includes the following packages:
  - `@kubuild/components`: A collection of reusable UI components for building applications.
  - `@kubuild/core`: The core library that provides essential functionality and utilities for building applications.
  - `@kubuild/editor`: A powerful editor for creating and editing content within applications.
  - `@kubuild/react`: A set of React components and hooks for building applications with React.
  - `@kubuild/renderer`: A rendering engine that enables the rendering of content and components within applications.
  - `@kubuild/schema`: A schema definition library for defining and validating data structures

### Patch Changes

- Updated dependencies [[`e5d5e55`](https://github.com/kustora/kubuild/commit/e5d5e55180e2673a78aba70e666e5e119e2b2d29)]:
  - @kubuild/schema@1.0.0
