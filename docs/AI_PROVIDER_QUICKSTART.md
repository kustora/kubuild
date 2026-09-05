# AI Provider Quickstart — KUBUILD

**Product:** KUBUILD
**Codename:** BUILDER-01
**Document Type:** Consumer Integration Quickstart
**Feature Focus:** Enabling AI Chat + Prompt-to-Page Generation on `KubuildEditor`
**Related Docs:** `docs/PRD_AI_PROVIDER_EMBED.md`, `docs/TASKS_AI_PROVIDER_EMBED.md` (STORA-524)
**Status:** Current (matches `packages/editor/src/config/ai-config.ts` and `packages/ai/src/server/handler.ts` as implemented)

---

## 1. Who this is for

You are a host application (e.g. Stora.page) embedding `KubuildEditor` from `@kubuild/react` and you want to turn on the in-editor AI chat panel and/or prompt-to-page generation. KUBUILD never hardcodes an AI provider — you always supply it yourself via the `ai` prop on `KubuildEditor`.

This doc covers:

1. The minimal client-side config to light up AI chat + generate.
2. **Why you almost never want to put a real provider adapter directly in that client config** for a paid provider, and the backend-proxy pattern you should use instead.

Read the security section (§4) before wiring anything up in production — it is not optional.

---

## 2. The `AiEditorConfig` shape

This is the actual current shape exported from `@kubuild/editor` (and re-exported from `@kubuild/react`), from `packages/editor/src/config/ai-config.ts`:

```typescript
import type { AiProviderAdapter } from '@kubuild/ai';

interface AiEditorConfig {
  /** Adapter provider AI, or an HTTP endpoint pointing at the host's own `createAiHandler`. */
  provider: AiProviderAdapter | { endpoint: string; headers?: Record<string, string> };
  /** Per-capability feature flags. All default to `false` when `ai` config is not provided. */
  features?: {
    chat?: boolean;
    generate?: boolean;
    enhance?: boolean;
  };
  /** Default panel mode when the editor first mounts. Default: `'hidden'`. */
  defaultPanelMode?: 'docked' | 'floating' | 'hidden';
  /** Extra host-specific system prompt prefix (branding, tone, etc). */
  systemPromptPrefix?: string;
}
```

Two things worth calling out:

- **`provider` accepts two very different shapes**: a concrete `AiProviderAdapter` instance (e.g. `new OpenAiAdapter({ apiKey })`), or a plain `{ endpoint, headers? }` object pointing at an HTTP endpoint that speaks the same protocol as `createAiHandler` (see §3). **§4 explains why the second shape is the one you want for any paid provider.**
- **Opt-in by default.** If you don't pass `ai` at all, `KubuildEditor` renders with zero AI UI and zero behavioral difference — no toolbar toggle, no chat panel, nothing. Passing `ai` with `features` all omitted/`false` behaves the same way (see `isAnyAiFeatureEnabled` in `ai-config.ts`).

---

## 3. Minimal working example

### 3.1 The wrong way (don't do this for a paid provider)

```tsx
import { KubuildEditor } from '@kubuild/react';
// `OpenAiAdapter` lives under `@kubuild/ai`'s server-facing entry points
// (`@kubuild/ai/server` or `@kubuild/ai/adapters`) — `@kubuild/react` only re-exports
// the client/react side of `@kubuild/ai`. Importing it here at all is the mistake.
import { OpenAiAdapter } from '@kubuild/ai/adapters';

// DO NOT SHIP THIS — the OpenAI key ends up in your client bundle, readable by
// anyone who opens devtools. See §4.
const adapter = new OpenAiAdapter({ apiKey: 'sk-...' });

export function Editor() {
  return (
    <KubuildEditor
      document={myDocument}
      registry={myRegistry}
      ai={{
        provider: adapter,
        features: { chat: true, generate: true },
      }}
    />
  );
}
```

### 3.2 The recommended way — proxy through your own backend

**Step 1 — run `createAiHandler` on your backend.** `@kubuild/ai`'s `createAiHandler` wraps a `KubuildAiEngine` (which itself wraps a provider adapter) into a standard Web Fetch API `Request -> Response` handler — plug-and-play for Next.js Route Handlers, SvelteKit, Remix, Astro, Bun, etc. This is where your real API key lives, server-side only.

```typescript
// app/api/ai/route.ts (Next.js App Router example)
import { KubuildAiEngine, OpenAiAdapter, createAiHandler } from '@kubuild/ai/server';

const engine = new KubuildAiEngine({
  adapter: new OpenAiAdapter({
    apiKey: process.env.OPENAI_API_KEY!, // server-only env var, never exposed to the client
    model: 'gpt-4o',
  }),
});

export const POST = createAiHandler(engine, {
  // STORA-519 — auth/rate-limit hook, runs before the request ever reaches the LLM
  // provider. Return a Response to short-circuit (401/429/etc); return nothing to
  // let the request proceed normally.
  beforeRequest: async (request) => {
    const session = await getSessionFromRequest(request); // your own auth check
    if (!session) {
      return new Response('Unauthorized', { status: 401 });
    }
    if (await isRateLimited(session.userId)) {
      return new Response('Too Many Requests', { status: 429 });
    }
    // no return value -> request proceeds to the engine/provider as normal
  },
});
```

**Step 2 — point `AiEditorConfig.provider` at that endpoint**, not at an adapter:

```tsx
import { KubuildEditor } from '@kubuild/react';

export function Editor() {
  return (
    <KubuildEditor
      document={myDocument}
      registry={myRegistry}
      ai={{
        provider: { endpoint: '/api/ai' },
        features: { chat: true, generate: true, enhance: true },
        defaultPanelMode: 'docked',
        systemPromptPrefix: 'You are the in-editor assistant for Acme Inc.\'s page builder.',
      }}
    />
  );
}
```

That's the whole client side of it. No API key, no adapter instance, nothing sensitive ships to the browser — the client only ever talks to your own `/api/ai` route, which is the only place holding the real provider credentials.

`useAiChat`/`useAiGenerator` (also re-exported from `@kubuild/react`, originally from `@kubuild/ai/react`) accept the same `{ endpoint, headers? }` shape if you want to drive AI features outside the editor's built-in chat panel — same rule applies: point them at your backend endpoint, never embed a paid adapter with a raw key client-side.

---

## 4. Security — read this before shipping

> **Do not put a paid provider's API key in client-side `AiEditorConfig`.** Any string that ends up in `AiEditorConfig.provider` as part of an `AiProviderAdapter` instance is bundled into your JavaScript and readable by any user who opens devtools or views the page source. This applies to OpenAI, Anthropic, Gemini, and any other paid/metered provider.

The recommended path, always, is:

1. Run `createAiHandler(engine, options)` on your own backend server (§3.2). Your provider's API key lives only in a server-side environment variable, never in code shipped to the browser.
2. Point the client-side `AiEditorConfig.provider` at that backend endpoint using the `{ endpoint: string; headers?: Record<string, string> }` shape — not an `AiProviderAdapter` instance.
3. Use the `beforeRequest` hook (STORA-519) on `createAiHandler` to add your own auth/rate-limiting in front of the LLM call — without it, anyone who can reach `/api/ai` can spend your provider budget.

The one case where embedding an `AiProviderAdapter` instance directly in client config is *acceptable* is a **custom/local provider with no real secret to protect** — e.g. `packages/ai/src/server/adapters/custom.ts` pointed at a local Ollama instance running on the same machine with no billing implications. Even then, prefer the endpoint-proxy shape if the editor ever runs somewhere a browser can reach the wider network.

This mirrors the same trust boundary KUBUILD already applies to `.stora` import: AI output is untrusted input that must be normalized/validated (`@kubuild/ai`'s normalizer, `@kubuild/core`'s `validateDocument`/`validateDocumentSecurity`) before it ever reaches the document — see `docs/ARCHITECTURE.md` §31 and `docs/PRD_AI_PROVIDER_EMBED.md` §3.5. Treat provider credentials with the same "never trust the client" discipline.

---

## 5. Feature flags at a glance

| Flag | Unlocks |
| :--- | :--- |
| `features.chat` | The in-editor AI Chat Panel (STORA-503/505) — free-form questions, optionally scoped to the current selection (STORA-502/506). |
| `features.generate` | Prompt-to-page generation (STORA-507/508/510) — `useAiGenerator().streamPage()` wired into the command engine, one prompt produces a full page section-by-section, batched into a single undo entry. |
| `features.enhance` | "Ask AI about this component" + Enhance (STORA-511/512/513/514) — selection-aware refactor with a before/after diff and explicit Apply/Discard. |

All three default to `false`. Turn on only what you need — e.g. a host that only wants chat can omit `generate`/`enhance` entirely.

---

## 6. Further reading

- `docs/PRD_AI_PROVIDER_EMBED.md` — full product spec for this feature area, including the document safety pipeline every AI output passes through before it can touch the document.
- `docs/TASKS_AI_PROVIDER_EMBED.md` — the full EPIC-50 through EPIC-56 task breakdown this quickstart closes out (STORA-524).
- `packages/ai/src/server/adapters/` — `OpenAiAdapter`, `AnthropicAdapter`, `GeminiAdapter`, and `CustomAdapter` (raw HTTP, e.g. for a local/self-hosted model) if you're implementing the backend route yourself rather than proxying to someone else's.
