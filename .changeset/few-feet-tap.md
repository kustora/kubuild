---
'@kubuild/ai': minor
'@kubuild/editor': minor
---

feat: add page planning functionality to AI client and chat panel

- Implemented `planPage` method in `KubuildAiClient` to allow users to plan website structure before generation.
- Enhanced `useAiGenerator` hook to include `planPage` functionality for planning page structure.
- Updated `KubuildAiEngine` to handle planning requests and generate structured page plans based on user input.
- Modified `processAiRequest` to support planning mode, validating prompts and returning generated plans.
- Expanded `AiGenerationMode` type to include 'plan' mode.
- Added new interfaces `PagePlan` and `AiPlanPageRequest` to define the structure of page plans and requests.
- Integrated planning features into the `AiChatPanel`, allowing users to select planning mode and approve generated plans.
- Added tests for the new planning functionality in `engine.test.ts` and `ai-chat-panel.test.tsx`.
