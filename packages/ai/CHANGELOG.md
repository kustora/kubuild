# @kubuild/ai

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
