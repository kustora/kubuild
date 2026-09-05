import type { AiChatRequest } from '@kubuild/ai';
import type { EditorState } from '../store/store';

export type AiChatContext = Pick<AiChatRequest, 'selectedNodeId' | 'currentDocument'>;

/**
 * Builds the AI request context (STORA-502) that a future in-editor chat/generate panel
 * spreads into `AiChatRequest`/`AiGenerateSectionRequest` calls to `useAiChat`/`useAiGenerator`.
 *
 * Pure read of `EditorState` — no separate copy of store logic, no document mutation.
 *
 * Important: the editor store also holds `variableCatalog`, host-declared bindable
 * variables plus editor/preview-only sample values (STORA-053) that are never written to
 * the document (see `EditorState.variableCatalog`, `buildSampleVariablesFromCatalog`).
 * This helper only reads `state.document` and `state.selectedNodeId` — it never touches
 * `variableCatalog` — so the snapshot sent to the AI provider can never leak preview-only
 * sample data.
 */
export function buildAiChatContext(
  state: Pick<EditorState, 'document' | 'selectedNodeId'>,
): AiChatContext {
  return {
    currentDocument: state.document,
    selectedNodeId: state.selectedNodeId ?? undefined,
  };
}

/**
 * Applies the AI Chat Panel's "dismiss context for this message only" behavior (STORA-506)
 * to an already-built `AiChatContext`. When the user dismisses the active-context chip
 * before sending, `selectedNodeId` must be stripped from *that* request even though the
 * canvas selection itself is untouched and will resume being sent on the next message.
 */
export function resolveChatSendContext(
  context: AiChatContext,
  contextDismissed: boolean,
): AiChatContext {
  return {
    currentDocument: context.currentDocument,
    selectedNodeId: contextDismissed ? undefined : context.selectedNodeId,
  };
}
