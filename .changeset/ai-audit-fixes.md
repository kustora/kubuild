---
'@kubuild/ai': minor
'@kubuild/editor': minor
---

AI docs-audit fixes.

- `@kubuild/ai`: `generatePage()` now honours `plan` (generates each planned section, like `streamPage()`) and `sectionCount` (same phrasing as the planner). `createAiHandler` only streams `full-page`/`chat`/`agent`; `stream: true` for `plan`/`section`/`refactor` now returns the normal JSON response instead of running a full-page stream.
- `@kubuild/ai`: new `instructions` request field (chat, agent, full-page, section, refactor, plan) appended after the built-in system prompt — never replacing it. `createAiHandler` accepts `allowClientInstructions` (default `true`) and `maxClientInstructionsLength` (default 4000); `systemPrompt` in the request body is accepted as a deprecated alias. `useAiChat` `sendMessage({ instructions })` and `useAiAgent` `run({ instructions })` forward it.
- `@kubuild/ai`: `planPage` marks a fallback plan with `usedFallback: true` (on the response and on the plan) plus a `PLAN_FALLBACK` warning; a provider failure is now a `PLAN_ERROR` instead of a silent fallback. `useAiGenerator().planPage` resolves `null` on failure like the other hook methods instead of throwing.
- `@kubuild/ai`: agent op summaries, tool-failure summaries and agent fallback summaries are now English.
- `@kubuild/editor`: the AI chat panel shows visible Generate and Enhance buttons (gated by `features.generate` / `features.enhance`), sends `systemPromptPrefix` as `instructions` on every request, shows a notice when a plan is a fallback, and routes its copy through the editor i18n (`aiChat` namespace, English + Indonesian).
- `@kubuild/editor`: while `isAiRunning` is true, undo/redo are disabled (toolbar and keyboard), a second concurrent AI request cannot start, and the toolbar's AI Chat button shows a spinner.
