---
"@kubuild/editor": minor
---

Editor Mode (Simple | Advance), the AI chat as an Inspector tab, and image attachments in the AI chat.

**Editor Mode**

- New `EditorConfig.mode` (`'simple' | 'advance'`, default `'advance'`) and store `editorMode` / `setEditorMode`. Simple mode hides the clipboard, code viewer, tracking, import/export, action debugger, selection badge, breadcrumbs, traits and state selector by default, opens the left sidebar on `blocks` with `['blocks', 'components']`, limits components to `SIMPLE_MODE_ALLOWED_COMPONENTS` when no component filter is set, and turns off multi-device mode. Explicit config values still win.
- New toolbar options `showModeSwitcher` (default `true`) and `showTracking` (default `true` in advance, `false` in simple).
- `resolveEditorConfig(config, activeMode?)` takes the active mode.

**AI chat in the Inspector**

- The AI chat moved from a floating window / docked column into an AI tab next to Style and Settings in the Inspector. It is reachable with nothing selected, and stays mounted across tab and selection changes so a session or in-flight run is not lost. Below `lg` an ask-AI request opens the Inspector drawer.
- The canvas selection toolbar has an Ask AI button (when an AI feature is configured) that opens the AI tab with the selection attached. It replaces the Inspector's "Ask AI about this component" card.
- `defaultPanelMode` other than `'hidden'` now opens the Inspector on the AI tab.
- `AiChatPanel` takes `showHeader` (hidden inside the tab).

**Breaking:** store `aiChatMode` / `setAiChatMode` and the `AiChatPanelMode` type are replaced by `inspectorTab` / `setInspectorTab` and `InspectorTab` (`'style' | 'traits' | 'ai'`). `toggleAiChat` now switches the AI tab; new `askAiAboutSelection()`. `shouldRenderAiChatPanel` and `isAiChatPanelActive` are removed.

**Image attachments**

- The AI chat composer has an attach-image button and paste support. Images upload through the host asset provider when picked, show as thumbnails until sent, and go to the AI as hosted URLs in Ask, Agent, Plan, Generate and Enhance. Retries, approved plans and resumed agent runs reuse the original images, and chat bubbles show attached images.
- The button only appears when the asset provider can upload. Sending is blocked while an upload is in flight, and a message takes at most 4 images.
