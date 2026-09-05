import type { Node, PageDocument } from '@kubuild/schema';
import type { AiGeneratePageRequest, AiStreamCallbacks } from '@kubuild/ai';
import { normalizeAndValidateSectionNode } from '@kubuild/ai';
import {
  insertNode,
  collectNodeIdSet,
  cloneTreeWithNewIds,
  type CommandResult,
  type DocumentSecurityLimits,
  type Diagnostic,
} from '@kubuild/core';

/**
 * Progressive-preview status for one `streamPage` session (STORA-508). A canvas/chat
 * panel subscribes to this via `StreamPageGenerationDeps.onPlaceholderChange` to show a
 * loading placeholder for the section currently being generated, and to hide it the
 * instant the real section lands (the real section is rendered by the normal
 * store -> `KubuildRenderer` path, not a separate preview tree).
 */
export interface AiGenerationPlaceholderStatus {
  /** True while more sections are still expected in this streaming session. */
  active: boolean;
  totalSections: number;
  completedSections: number;
  currentLabel?: string;
}

export interface StreamPageGenerationDeps {
  /** The editor store's `dispatch` — the only sanctioned document mutation path. */
  dispatch: (executor: (doc: PageDocument) => CommandResult) => void;
  /** Reads the live document (called fresh on every section so ids stay collision-free). */
  getDocument: () => PageDocument;
  /** Groups every section inserted during the session into one undo entry (STORA-510). */
  beginHistoryTransaction: () => void;
  endHistoryTransaction: () => void;
  /** Reused non-fatal reporting channel — same `onDiagnostic` prop used elsewhere in the editor. */
  onDiagnostic?: (diagnostic: Diagnostic) => void;
  /** STORA-508 progressive-preview hook. */
  onPlaceholderChange?: (status: AiGenerationPlaceholderStatus | null) => void;
  /** Same security limits `.stora` import uses; omit to use `@kubuild/core`'s defaults. */
  securityLimits?: DocumentSecurityLimits;
  /** Insertion target for generated sections. Defaults to the document's root page node. */
  parentId?: string;
}

/**
 * Pure visibility rule for the STORA-508 canvas placeholder — kept as a standalone
 * function (rather than inlined JSX conditionals) so it's trivially unit-testable
 * without needing to render the canvas: the placeholder only ever shows on the active
 * artboard, never in preview mode, and only while a generation session reports itself
 * as still active.
 */
export function shouldShowAiGenerationPlaceholder(params: {
  isActive: boolean;
  previewMode: boolean;
  aiGenerationStatus: AiGenerationPlaceholderStatus | null | undefined;
}): boolean {
  return params.isActive && !params.previewMode && !!params.aiGenerationStatus?.active;
}

export interface StreamPageGenerationSummary {
  insertedSectionIds: string[];
  failedSectionCount: number;
  totalSections: number;
  /** Whether the stream itself emitted an `error` event (network/provider/parse failure). */
  streamErrored: boolean;
}

type StreamPageFn = (
  params: AiGeneratePageRequest,
  callbacks?: AiStreamCallbacks,
) => Promise<PageDocument | null>;

/**
 * STORA-507/509/510 — wires `useAiGenerator().streamPage()` into the editor's command
 * engine and history.
 *
 * Every `section` event is independently re-run through `@kubuild/ai`'s
 * `normalizeAndValidateSectionNode` — the same normalize -> Zod schema validate ->
 * `validateDocumentSecurity` pipeline used for `.stora` import (docs/ARCHITECTURE.md
 * §31/§40) — before ever being dispatched as `insertNode`. This is defense-in-depth:
 * it re-validates regardless of whether the configured provider already went through
 * `KubuildAiEngine` server-side (a host's custom HTTP endpoint may not have).
 *
 * - **Partial success (STORA-507)**: a section that fails validation, or that fails to
 *   insert (e.g. an id collision `insertNode` rejects), is reported via `onDiagnostic`
 *   and skipped — it never blocks subsequent sections. Because validation always runs
 *   strictly before dispatch, every section that *is* inserted is independently valid,
 *   so the document is never left in a partially-invalid state, including when the
 *   stream later emits an `error` event.
 * - **Progressive preview (STORA-508)**: `onPlaceholderChange` fires as each section
 *   starts/finishes generating so a canvas placeholder can be shown/hidden; the real
 *   section renders through the exact same store/renderer path as any manual edit.
 * - **Batched history (STORA-510)**: the whole session is wrapped in one history
 *   transaction, so a single `undo()` reverts every section this call inserted.
 */
export async function runStreamPageGeneration(
  streamPage: StreamPageFn,
  params: AiGeneratePageRequest,
  deps: StreamPageGenerationDeps,
): Promise<StreamPageGenerationSummary> {
  const insertedSectionIds: string[] = [];
  let failedSectionCount = 0;
  let totalSections = 0;
  let completedSections = 0;
  let streamErrored = false;

  const reportRejection = (nodeId: string | undefined, message: string, error: unknown) => {
    failedSectionCount += 1;
    deps.onDiagnostic?.({
      code: 'AI_SECTION_REJECTED',
      nodeId,
      message,
      error,
    });
  };

  deps.beginHistoryTransaction();
  deps.onPlaceholderChange?.({ active: true, totalSections: 0, completedSections: 0 });

  try {
    await streamPage(params, {
      onSection: (section, index, total) => {
        totalSections = total;
        deps.onPlaceholderChange?.({
          active: true,
          totalSections: total,
          completedSections,
          currentLabel: `Generating section ${index + 1}/${total}`,
        });

        let validated: Node;
        try {
          validated = normalizeAndValidateSectionNode(section, deps.securityLimits);
        } catch (err) {
          const rawId =
            section && typeof section === 'object' && typeof (section as Node).id === 'string'
              ? (section as Node).id
              : undefined;
          reportRejection(rawId, err instanceof Error ? err.message : String(err), err);
          completedSections += 1;
          deps.onPlaceholderChange?.({
            active: index + 1 < total,
            totalSections: total,
            completedSections,
          });
          return;
        }

        try {
          const currentDoc = deps.getDocument();
          const rootId = deps.parentId ?? currentDoc.document.id;
          const existingIds = collectNodeIdSet(currentDoc.document);
          const incomingIds = collectNodeIdSet(validated);

          let nodeToInsert = validated;
          for (const id of incomingIds) {
            if (existingIds.has(id)) {
              // A validated section can still collide with live document ids (e.g.
              // repeated generic fallback ids like "container-1" across sections) —
              // rekey the whole subtree rather than reject an otherwise-valid section.
              nodeToInsert = cloneTreeWithNewIds(validated, undefined, existingIds).clonedNode;
              break;
            }
          }

          deps.dispatch((doc) => insertNode(doc, { parentId: rootId, node: nodeToInsert }));
          insertedSectionIds.push(nodeToInsert.id);
        } catch (err) {
          reportRejection(validated.id, err instanceof Error ? err.message : String(err), err);
        }

        completedSections += 1;
        deps.onPlaceholderChange?.({
          active: index + 1 < total,
          totalSections: total,
          completedSections,
        });
      },
      onError: (err) => {
        streamErrored = true;
        deps.onDiagnostic?.({
          code: 'AI_STREAM_ERROR',
          message: err.message,
          error: err,
        });
      },
    });
  } finally {
    deps.endHistoryTransaction();
    deps.onPlaceholderChange?.(null);
  }

  return {
    insertedSectionIds,
    failedSectionCount,
    totalSections,
    streamErrored,
  };
}
