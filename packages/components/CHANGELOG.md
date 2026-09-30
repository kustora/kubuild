# @kubuild/components

## 0.10.0

### Patch Changes

- Updated dependencies []:
  - @kubuild/core@0.10.0
  - @kubuild/schema@0.10.0

## 0.9.0

### Minor Changes

- • Host Form Submit Hook (RenderContext.onFormSubmit):
  • Added an optional asynchronous onFormSubmit(submission, helpers) hook to RenderContext (STORA-558).
  • Enables host applications to intercept form submissions and handle them programmatically (e.g., custom backend workflows, CRM webhooks, multi-step funnel
  checkouts) once client-side validation passes.
  • Exposes setErrors(errors) and reset() helpers directly within the host submission handler.
  • Added supporting TypeScript interfaces (FormSubmission, FormSubmitHelpers) in @kubuild/core.

  ──────

  ### 🐛 Bug Fixes

  #### @kubuild/renderer

  • Form Field Validation Error Rendering (aria-errormessage):
  • Fixed a bug where input, textarea, and select components attached aria-errormessage="<id>-error", but never rendered the corresponding error container element
  into the DOM.
  • Schema validation errors and messages set via setErrors() are now visibly rendered directly beneath the target field with proper semantic accessibility
  attributes (role="alert").

  ──────

### Patch Changes

- Updated dependencies []:
  - @kubuild/core@0.9.0
  - @kubuild/schema@0.9.0

## 0.8.2

### Patch Changes

- Fix published type declarations for consumers using `moduleResolution: node16`/`nodenext`. Declarations previously re-exported relative modules without file extensions (e.g. `export * from './document'`), which NodeNext cannot resolve in `"type": "module"` packages, so the main entry exposed no types. Relative imports now carry `.js` extensions, and each package also ships CommonJS `.d.cts` declarations wired to the `require` export condition.
- Updated dependencies [`1c89a90`]:
  - @kubuild/core@0.8.2
  - @kubuild/schema@0.8.2

## 0.8.1

### Patch Changes

- Inline text editing stability, valid accordion markup, and React 19.3 toolchain:

  - **@kubuild/renderer**:
    - Inline text editing: fixed caret jumping to start and typed text appearing reversed. React 19 compares `dangerouslySetInnerHTML` by object identity, so a new `{ __html }` object on each render rewrote `innerHTML` while typing. The object is now memoized, and the DOM is overwritten during focus only when `value` changes from outside (e.g. undo/redo).

  - **@kubuild/editor**:
    - History: one inline text edit session (typing until blur) is now grouped into a single undo/redo transaction.
    - Canvas: text nodes inside `contenteditable` are now treated as editable targets, so they no longer trigger marquee, pan, drag, or keyboard shortcuts while typing.
    - Selection: `selectNode` does nothing when the node is already the only selected node, which avoids extra re-renders.
    - Spacing sliders: hidden for `text`, `heading`, and `paragraph` nodes.
    - Markup: moved the reset button in `StyleManagerAccordion` and `NodePixelEventSection` out of the header toggle button. Nested `<button>` elements are invalid HTML and caused hydration errors.

  - **@kubuild/react** & **@kubuild/ai**:
    - Dev dependencies upgraded to React 19.3 (`react`, `react-dom`, `@types/react`, `@types/react-dom`, `react-test-renderer`). Peer range stays `>=18.0.0`, so hosts on React 18 are still supported.

  Notes:

  - The editor, renderer and playground also got the React 19.3 devDeps bump. Only the React and AI entries mention it, to keep the text short.
  - @kubuild/react and @kubuild/ai only had devDeps changes. If you don't want a release for them, remove those two packages from the frontmatter.

- Updated dependencies []:
  - @kubuild/core@0.8.1
  - @kubuild/schema@0.8.1

## 0.8.0

### Minor Changes

- Host Integration API, conversion components, responsive runtime CSS, and document theming:

  - **@kubuild/editor**:
    - Host Integration API: `KubuildEditor` forwards imperative `EditorHandle` ref (`getDocument`, `replaceDocument`, `insertBlock`, `applyTemplate`, `undo`, `redo`, `isDirty`, `save`).
    - Save controller: added `onSave`, `onDirtyChange`, `autosave`, `warnOnUnsavedChanges`, Save status indicator button, and `Cmd/Ctrl+S` shortcut.
    - Host blocks & templates: supports custom host blocks (`blocks`, `blocksMode`), template picker (`templates`, `onApplyTemplate`, `TemplatePicker`, `TemplatePickerDialog`), and template requirement validation.
    - Diagnostics: emits error diagnostic when `replaceDocument` rejects invalid document data.
    - UI Polish: increased default inspector width to 300px and improved layout & styling of color gradient picker controls.

  - **@kubuild/renderer**:
    - Responsive CSS: emits scoped `@media` rules in runtime mode using shared `BREAKPOINTS`.
    - Conversion renderers: added support for Accordion, Carousel, Countdown (with `expire` trigger handling), Divider, Rating, and Tabs.
    - Extended form components: added renderers for Switch, FileUpload, RadioGroup, RadioItem, and ButtonSubmit.
    - Form submission: automatically forwards form values when `api_request` action omits explicit body payload.
    - Action handlers: added built-in compatibility handlers for legacy action types.

  - **@kubuild/components**:
    - Conversion components: registered definitions for `accordion`, `carousel`, `countdown`, `divider`, `rating`, and `tabs`.
    - Sales starter blocks: added pre-built templates for pricing, testimonials, features, and guarantees.
    - Canonical props: added canonical text prop helpers and validation.

  - **@kubuild/schema**:
    - Breakpoints: added shared `BREAKPOINTS` constant (`desktop`, `tablet`, `mobile`).
    - Action trigger: added `expire` action trigger for time-bound components.
    - Theming: added `DocumentTheme` and document-level theming schema.
    - Canonical text props: standardized text props across typography and component schemas.
    - Types: lightweight standalone schema validators and direct TypeScript types.

  - **@kubuild/core**:
    - Template cloning: preserves all node fields and metadata when cloning templates.
    - Theme & canonical props: integrated theme resolution and canonical text props into command tree and migrations.
    - Built-in components: canonical derivation of `CORE_BUILTIN_COMPONENTS`.

  - **@kubuild/react** & **@kubuild/ai**:
    - Version bump aligned with monorepo fixed version group.

### Patch Changes

- Updated dependencies []:
  - @kubuild/schema@0.8.0
  - @kubuild/core@0.8.0

## 0.7.0

### Patch Changes

- Updated dependencies [[`97bc7c9`](https://github.com/kustora/kubuild/commit/97bc7c90f1a7a2729dce857a042e5e1fcd395655), [`125a60a`](https://github.com/kustora/kubuild/commit/125a60aea85d0d9fc4418a8db2bd2cceb1077e50)]:
  - @kubuild/schema@0.7.0
  - @kubuild/core@0.7.0

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
  - @kubuild/core@0.6.0
  - @kubuild/schema@0.6.0

## 0.5.0

### Patch Changes

- Updated dependencies []:
  - @kubuild/core@0.5.0
  - @kubuild/schema@0.5.0

## 0.4.0

### Patch Changes

- Updated dependencies []:
  - @kubuild/core@0.4.0
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
  - @kubuild/core@0.3.1
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
  - @kubuild/core@0.3.0
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
  - @kubuild/core@0.2.0
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
  - @kubuild/core@0.1.0
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
  - @kubuild/core@1.0.0
  - @kubuild/schema@1.0.0
