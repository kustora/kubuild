# @kubuild/ai

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
  - @kubuild/components@0.6.0
  - @kubuild/core@0.6.0
  - @kubuild/schema@0.6.0

## 0.5.0

### Minor Changes

- feat: add page planning functionality to AI client and chat panel

  - Implemented `planPage` method in `KubuildAiClient` to allow users to plan website structure before generation.
  - Enhanced `useAiGenerator` hook to include `planPage` functionality for planning page structure.
  - Updated `KubuildAiEngine` to handle planning requests and generate structured page plans based on user input.
  - Modified `processAiRequest` to support planning mode, validating prompts and returning generated plans.
  - Expanded `AiGenerationMode` type to include 'plan' mode.
  - Added new interfaces `PagePlan` and `AiPlanPageRequest` to define the structure of page plans and requests.
  - Integrated planning features into the `AiChatPanel`, allowing users to select planning mode and approve generated plans.
  - Added tests for the new planning functionality in `engine.test.ts` and `ai-chat-panel.test.tsx`.

### Patch Changes

- Updated dependencies []:
  - @kubuild/components@0.5.0
  - @kubuild/core@0.5.0
  - @kubuild/schema@0.5.0

## 0.4.0

### Minor Changes

- Add agent mode: tool-calling AI that edits only the nodes it needs to (STORA-530).

  **`@kubuild/ai`**
  - `AiProviderAdapter` now supports tool calling: `tools`/`toolChoice` on `AiProviderGenerateParams`, `toolCalls`/`stopReason` on `AiProviderGenerateResult`, and a `supportsTools` capability flag. `AiChatMessage.content` widens from `string` to `string | AiContentBlock[]` so a conversation can carry `tool_use`/`tool_result` blocks — existing string call sites are unaffected, and `getMessageText()` is exported for anything that needs to flatten a message back to text.
  - `OpenAiAdapter` implements tool calling in both `generate()` and `generateStream()` (fragmented `tool_calls` argument deltas are accumulated per index).
  - New `KubuildAiAgent`: a multi-step loop that reads the page through tools and returns a list of surgical `AgentOp`s instead of a regenerated document. Guarded by `maxSteps`, a per-step tool-call cap, and abort signals.
  - New document tool set (`createDocumentTools`): `get_page_outline`, `read_node`, `find_nodes`, `list_component_types`, `update_node_props`, `update_node_styles`, `insert_component`, `insert_section`, `move_node`, `duplicate_node`, `delete_node`, `replace_node`. Every write validates node ids, component types and nesting rules against the snapshot, and re-runs `validateDocumentSecurity` before its op is accepted; failures come back to the model as `tool_result` errors so it self-corrects.
  - New `summarizeDocument`/`buildSelectionContext`/`buildAgentSystemPrompt`: the agent is grounded in a compact page outline plus the full selected node, its ancestors and its siblings — previously only a depth-1 section summary and a bare `selectedNodeId` were sent.
  - `createAiHandler(engine, { agent })` serves `mode: 'agent'` over both JSON and SSE; new `agent-step`/`tool-call`/`tool-result`/`agent-complete` stream events, plus `KubuildAiClient.runAgent()` and the `useAiAgent()` React hook.

  **`@kubuild/editor`**
  - New `applyAgentOps`: replays an agent run through the same store actions manual editing uses, batched into one history transaction — a whole agent turn is a single undo.
  - The AI panel gains an Agent action with a live tool-call timeline, an op-by-op review with Apply/Discard, and an opt-in auto-apply that never covers destructive ops.
  - New `AiEditorConfig.features.agent` flag (defaults to `false`, like every other AI feature).
  - New `insertNodeTree` store action for inserting an already-built subtree; `duplicateComponent` accepts an optional destination parent/index.

### Patch Changes

- Updated dependencies []:
  - @kubuild/components@0.4.0
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
  - @kubuild/components@0.3.1
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
  - @kubuild/components@0.3.0
  - @kubuild/core@0.3.0
  - @kubuild/schema@0.3.0

## Unreleased

### Minor Changes

- **Token-level chat streaming (STORA-515)**: `KubuildAiEngine` gains `chatStream()`, an
  `AsyncIterable<AiStreamEvent>` generator that emits `chat-chunk` events as partial text
  arrives and a terminal `chat-complete` event with the fully assembled assistant
  message — the same transport `streamPage()` already used, extended with two new
  `AiStreamEvent` variants (`chat-chunk`, `chat-complete`) and two new `AiStreamCallbacks`
  members (`onChatChunk`, `onChatComplete`). `chat()` itself is unchanged and remains a
  single request/response call.
  - `AiProviderAdapter` gains an **optional** `generateStream()` method. `OpenAiAdapter`,
    `AnthropicAdapter`, and `GeminiAdapter` now implement it (their providers' native
    `stream: true` / SSE APIs). `CustomHttpAdapter` intentionally does not implement it —
    `chatStream()` detects this and transparently falls back to a single non-streaming
    `generate()` call, emitting the whole response as one `chat-chunk` so callers never
    have to special-case adapter capability.
  - `KubuildAiClient` gains `chatStream()`, parsing the new SSE event types with the same
    `consumeSse` transport `streamPage()` uses (refactored out of `streamPage` rather than
    duplicated).
  - `createAiHandler` now recognizes `{ mode: 'chat', stream: true }` requests and pipes
    `engine.chatStream()` over `text/event-stream`, alongside the existing full-page
    streaming path.

- **`useAiChat` streaming (STORA-516)**: `sendMessage()` now streams by default — it
  appends a placeholder assistant message immediately and updates its `content`
  incrementally as chunks arrive, so a chat bubble bound to `messages` updates live
  without any change to how a consumer renders the list. Pass `{ stream: false }` to
  `sendMessage(content, options)` to opt back into the old single-shot request/response
  behavior. `cancel()` continues to abort the in-flight request via `AbortController` —
  for a streaming call this also aborts the underlying `fetch`/`ReadableStream` read, not
  just local UI state.
  - New (additive, non-breaking) surface: `isStreaming` in the hook's return value,
    `onChunk` in `UseAiChatOptions`, `stream` in `SendMessageOptions`. Every previously
    existing field/signature (`messages`, `sendMessage`, `isLoading`, `error`, `cancel`,
    `clearMessages`, `setMessages`) is unchanged.
  - **Consumer note**: `packages/editor/src/components/ai-chat/ai-chat-panel.tsx` calls
    `useAiChat({ endpoint, headers, initialMessages })` and only destructures
    `{ messages, sendMessage, isLoading, error, cancel }` — it needs no code changes to
    keep working, and gets live-updating assistant bubbles for free since it already
    renders straight from `messages`. Hosts running a custom (non-`createAiHandler`)
    backend for chat mode should either upgrade it to handle `{ stream: true }` chat
    requests, or pass `{ stream: false }` explicitly from call sites they don't want to
    upgrade yet.

### Patch Changes

- **Removed `AiChatResponse.suggestedAction` (STORA-517)**: this field was defined in the
  public type but never populated by `KubuildAiEngine.chat()`/`chatStream()`, and a
  repo-wide grep across `packages/editor`, `packages/react`, and `apps/stora-playground`
  found no consumer reading it. Decision: remove rather than implement, to avoid hosts
  building against a field that was always `undefined`. If a future ticket wants
  chat-driven document actions (e.g. "insert this section"), it should be reintroduced
  deliberately with an implementation behind it, not resurrected as a dead placeholder.
  **Breaking for anyone reading `response.message.suggestedAction`** — there were no such
  readers in this repo at the time of removal.

- **Debug logging cleanup (STORA-518)**: every raw `console.log`/`console.warn`/
  `console.error` in `packages/ai/src/server/engine.ts` (`generatePage`, `generateSection`,
  `streamPage`) now goes through the existing `this.log(level, message, meta)` helper, so
  default behavior (no `debug`/`logger` configured) is completely silent. `debug: true` or
  a custom `logger` surfaces the same information as before, now consistently leveled
  (`info` for lifecycle/progress, `debug` for verbose raw-response dumps, `warn`/`error`
  for failures).
