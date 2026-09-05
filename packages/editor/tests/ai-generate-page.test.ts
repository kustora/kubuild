import { describe, it, expect, beforeEach } from 'vitest';
import type { Node, PageDocument } from '@kubuild/schema';
import type { AiStreamCallbacks } from '@kubuild/ai';
import {
  createBlankDocument,
  validateDocument,
  updateProps,
  type Diagnostic,
  type CommandResult,
} from '@kubuild/core';
import { useEditorStore } from '../src/store';
import {
  runStreamPageGeneration,
  shouldShowAiGenerationPlaceholder,
  type AiGenerationPlaceholderStatus,
} from '../src/ai/generate-page';

/**
 * A fake `streamPage` matching `useAiGenerator().streamPage`'s signature: it invokes the
 * given callbacks synchronously (in arrival order) and resolves, exactly like the real
 * hook would once its network/SSE layer delivers events. Only the AI network boundary is
 * faked here — every section that "arrives" still goes through the real
 * `@kubuild/ai` normalizer/validator and the real `@kubuild/core` command engine below.
 */
function fakeStreamPage(sections: unknown[], options?: { emitError?: boolean }) {
  return async (
    _params: unknown,
    callbacks?: AiStreamCallbacks,
  ): Promise<PageDocument | null> => {
    const total = sections.length;
    sections.forEach((section, index) => {
      callbacks?.onSection?.(section as Node, index, total);
    });
    if (options?.emitError) {
      callbacks?.onError?.(new Error('simulated provider failure'));
    }
    return null;
  };
}

function makeDeps(collect: {
  diagnostics: Diagnostic[];
  placeholders: (AiGenerationPlaceholderStatus | null)[];
}) {
  return {
    dispatch: (executor: (doc: PageDocument) => CommandResult) =>
      useEditorStore.getState().dispatch(executor),
    getDocument: () => useEditorStore.getState().document,
    beginHistoryTransaction: () => useEditorStore.getState().beginHistoryTransaction(),
    endHistoryTransaction: () => useEditorStore.getState().endHistoryTransaction(),
    onDiagnostic: (d: Diagnostic) => collect.diagnostics.push(d),
    onPlaceholderChange: (s: AiGenerationPlaceholderStatus | null) => collect.placeholders.push(s),
  };
}

describe('runStreamPageGeneration (EPIC-52: STORA-507/508/509/510)', () => {
  beforeEach(() => {
    useEditorStore.getState().setDocument(createBlankDocument('AI Generate Test'));
  });

  describe('STORA-507: streamPage -> insertNode wiring', () => {
    it('dispatches every section event as insertNode, in arrival order, into a validated document', async () => {
      const sections: Node[] = [
        {
          id: 'hero-1',
          type: 'section',
          children: [{ id: 'heading-1', type: 'heading', props: { level: 1, title: 'Welcome' } }],
        },
        {
          id: 'features-1',
          type: 'section',
          children: [{ id: 'text-1', type: 'text', props: { text: 'Features' } }],
        },
        {
          id: 'cta-1',
          type: 'section',
          children: [{ id: 'button-1', type: 'button', props: { label: 'Get started' } }],
        },
      ];

      const collect = { diagnostics: [] as Diagnostic[], placeholders: [] as (AiGenerationPlaceholderStatus | null)[] };
      const summary = await runStreamPageGeneration(
        fakeStreamPage(sections),
        { prompt: 'buatkan landing page' },
        makeDeps(collect),
      );

      expect(summary.insertedSectionIds).toEqual(['hero-1', 'features-1', 'cta-1']);
      expect(summary.failedSectionCount).toBe(0);
      expect(collect.diagnostics).toHaveLength(0);

      const finalDoc = useEditorStore.getState().document;
      expect(finalDoc.document.children?.map((n) => n.id)).toEqual([
        'hero-1',
        'features-1',
        'cta-1',
      ]);

      // Page -> section -> child components, and the whole thing validates.
      const validation = validateDocument(finalDoc);
      expect(validation.valid).toBe(true);
    });

    it('does not stop later sections when an earlier one fails validation (partial success)', async () => {
      const sections = [
        { id: 'ok-1', type: 'section', children: [] },
        // Fails security validation deliberately (see securityLimits below).
        {
          id: 'too-big',
          type: 'section',
          children: [
            { id: 'too-big-child-1', type: 'text', props: { text: 'a' } },
            { id: 'too-big-child-2', type: 'text', props: { text: 'b' } },
          ],
        },
        { id: 'ok-2', type: 'section', children: [] },
      ];

      const collect = { diagnostics: [] as Diagnostic[], placeholders: [] as (AiGenerationPlaceholderStatus | null)[] };
      const deps = { ...makeDeps(collect), securityLimits: { maxNodeCount: 2 } };
      const summary = await runStreamPageGeneration(
        fakeStreamPage(sections),
        { prompt: 'buatkan landing page' },
        deps,
      );

      expect(summary.insertedSectionIds).toEqual(['ok-1', 'ok-2']);
      expect(summary.failedSectionCount).toBe(1);
      expect(collect.diagnostics).toHaveLength(1);
      expect(collect.diagnostics[0].code).toBe('AI_SECTION_REJECTED');

      const finalDoc = useEditorStore.getState().document;
      expect(finalDoc.document.children?.map((n) => n.id)).toEqual(['ok-1', 'ok-2']);
      expect(validateDocument(finalDoc).valid).toBe(true);
    });

    it('an error stream event never leaves the document in a partially-invalid state', async () => {
      const sections = [
        { id: 'before-error-1', type: 'section', children: [] },
        { id: 'before-error-2', type: 'section', children: [] },
      ];

      const collect = { diagnostics: [] as Diagnostic[], placeholders: [] as (AiGenerationPlaceholderStatus | null)[] };
      const summary = await runStreamPageGeneration(
        fakeStreamPage(sections, { emitError: true }),
        { prompt: 'buatkan landing page' },
        makeDeps(collect),
      );

      expect(summary.streamErrored).toBe(true);
      expect(summary.insertedSectionIds).toEqual(['before-error-1', 'before-error-2']);
      expect(collect.diagnostics.some((d) => d.code === 'AI_STREAM_ERROR')).toBe(true);

      const finalDoc = useEditorStore.getState().document;
      expect(validateDocument(finalDoc).valid).toBe(true);
    });

    it('rekeys a section whose id collides with an existing document id instead of dropping it', async () => {
      // First call inserts a section literally named "section-1"...
      await runStreamPageGeneration(
        fakeStreamPage([{ id: 'section-1', type: 'section', children: [] }]),
        { prompt: 'first' },
        makeDeps({ diagnostics: [], placeholders: [] }),
      );

      // ...a second, independent generation session names its section the same id.
      const collect = { diagnostics: [] as Diagnostic[], placeholders: [] as (AiGenerationPlaceholderStatus | null)[] };
      const summary = await runStreamPageGeneration(
        fakeStreamPage([{ id: 'section-1', type: 'section', children: [] }]),
        { prompt: 'second' },
        makeDeps(collect),
      );

      expect(summary.failedSectionCount).toBe(0);
      expect(collect.diagnostics).toHaveLength(0);
      expect(summary.insertedSectionIds).toHaveLength(1);
      expect(summary.insertedSectionIds[0]).not.toBe('section-1');

      const finalDoc = useEditorStore.getState().document;
      const ids = finalDoc.document.children?.map((n) => n.id) ?? [];
      expect(new Set(ids).size).toBe(ids.length); // no duplicate ids in the document
      expect(validateDocument(finalDoc).valid).toBe(true);
    });
  });

  describe('STORA-508: progressive preview placeholder status', () => {
    it('reports active placeholder status while sections are streaming in, then clears it', async () => {
      const sections: Node[] = [
        { id: 'p-1', type: 'section', children: [] },
        { id: 'p-2', type: 'section', children: [] },
      ];

      const collect = { diagnostics: [] as Diagnostic[], placeholders: [] as (AiGenerationPlaceholderStatus | null)[] };
      await runStreamPageGeneration(fakeStreamPage(sections), { prompt: 'x' }, makeDeps(collect));

      // First update: generation starts.
      expect(collect.placeholders[0]).toEqual({ active: true, totalSections: 0, completedSections: 0 });

      // While section 1/2 is in flight, placeholder must still be active.
      const midUpdates = collect.placeholders.slice(1, -1);
      expect(midUpdates.some((s) => s?.active === true && s?.totalSections === 2)).toBe(true);

      // Last update always clears the placeholder (no leftover placeholder after completion).
      expect(collect.placeholders[collect.placeholders.length - 1]).toBeNull();
    });

    it('clears the placeholder even when the stream errors out', async () => {
      const collect = { diagnostics: [] as Diagnostic[], placeholders: [] as (AiGenerationPlaceholderStatus | null)[] };
      await runStreamPageGeneration(
        fakeStreamPage([{ id: 'p-err', type: 'section', children: [] }], { emitError: true }),
        { prompt: 'x' },
        makeDeps(collect),
      );

      expect(collect.placeholders[collect.placeholders.length - 1]).toBeNull();
    });
  });

  describe('STORA-508: shouldShowAiGenerationPlaceholder visibility rule', () => {
    it('shows the placeholder only on the active artboard, outside preview mode, while status.active is true', () => {
      const active: AiGenerationPlaceholderStatus = { active: true, totalSections: 2, completedSections: 0 };

      expect(
        shouldShowAiGenerationPlaceholder({ isActive: true, previewMode: false, aiGenerationStatus: active }),
      ).toBe(true);
    });

    it('hides the placeholder in preview mode even while a generation is active', () => {
      const active: AiGenerationPlaceholderStatus = { active: true, totalSections: 2, completedSections: 0 };

      expect(
        shouldShowAiGenerationPlaceholder({ isActive: true, previewMode: true, aiGenerationStatus: active }),
      ).toBe(false);
    });

    it('hides the placeholder on an inactive (non-selected) artboard', () => {
      const active: AiGenerationPlaceholderStatus = { active: true, totalSections: 2, completedSections: 0 };

      expect(
        shouldShowAiGenerationPlaceholder({ isActive: false, previewMode: false, aiGenerationStatus: active }),
      ).toBe(false);
    });

    it('hides the placeholder when there is no generation status at all', () => {
      expect(
        shouldShowAiGenerationPlaceholder({ isActive: true, previewMode: false, aiGenerationStatus: null }),
      ).toBe(false);
      expect(
        shouldShowAiGenerationPlaceholder({ isActive: true, previewMode: false, aiGenerationStatus: undefined }),
      ).toBe(false);
    });

    it('hides the placeholder once the status reports itself no longer active', () => {
      const done: AiGenerationPlaceholderStatus = { active: false, totalSections: 2, completedSections: 2 };

      expect(
        shouldShowAiGenerationPlaceholder({ isActive: true, previewMode: false, aiGenerationStatus: done }),
      ).toBe(false);
    });
  });

  describe('STORA-509: normalize/validate + security pipeline before dispatch', () => {
    it('auto-repairs a malformed section (missing id, flat style instead of breakpoint object) and inserts it', async () => {
      const malformed = {
        // no `id` at all
        type: 'section',
        // flat CSS instead of `{ base: {...} }`
        styles: { backgroundColor: '#000000', padding: '10px' },
        children: [{ id: 'malformed-child', type: 'text', props: { text: 'Hello' } }],
      };

      const collect = { diagnostics: [] as Diagnostic[], placeholders: [] as (AiGenerationPlaceholderStatus | null)[] };
      const summary = await runStreamPageGeneration(
        fakeStreamPage([malformed]),
        { prompt: 'x' },
        makeDeps(collect),
      );

      expect(summary.failedSectionCount).toBe(0);
      expect(collect.diagnostics).toHaveLength(0);
      expect(summary.insertedSectionIds).toHaveLength(1);

      const finalDoc = useEditorStore.getState().document;
      const inserted = finalDoc.document.children?.[0];
      expect(inserted).toBeDefined();
      expect(inserted?.id).toBeTruthy(); // auto-generated, non-empty
      expect(inserted?.type).toBe('section');
      // Flat style got wrapped into the base breakpoint, not silently dropped/corrupted.
      expect(inserted?.styles?.base).toMatchObject({ backgroundColor: '#000000', padding: '10px' });
      expect(validateDocument(finalDoc).valid).toBe(true);
    });

    it('cleanly rejects (never silently inserts) a section that fails security validation', async () => {
      const oversized = {
        id: 'oversized',
        type: 'section',
        children: [
          { id: 'c1', type: 'text', props: { text: 'a' } },
          { id: 'c2', type: 'text', props: { text: 'b' } },
          { id: 'c3', type: 'text', props: { text: 'c' } },
        ],
      };

      const collect = { diagnostics: [] as Diagnostic[], placeholders: [] as (AiGenerationPlaceholderStatus | null)[] };
      const deps = { ...makeDeps(collect), securityLimits: { maxNodeCount: 2 } };
      const summary = await runStreamPageGeneration(
        fakeStreamPage([oversized]),
        { prompt: 'x' },
        deps,
      );

      expect(summary.insertedSectionIds).toHaveLength(0);
      expect(summary.failedSectionCount).toBe(1);
      expect(collect.diagnostics).toHaveLength(1);
      expect(collect.diagnostics[0].code).toBe('AI_SECTION_REJECTED');

      const finalDoc = useEditorStore.getState().document;
      expect(finalDoc.document.children ?? []).toHaveLength(0);
      expect(validateDocument(finalDoc).valid).toBe(true);
    });
  });

  describe('STORA-510: one streamPage session groups into a single undo entry', () => {
    it('a single undo() call after a multi-section generate removes everything at once', async () => {
      const preGenerateDoc = useEditorStore.getState().document;
      expect(useEditorStore.getState().canUndo).toBe(false);

      const sections: Node[] = [
        { id: 's1', type: 'section', children: [] },
        { id: 's2', type: 'section', children: [] },
        { id: 's3', type: 'section', children: [] },
      ];
      await runStreamPageGeneration(
        fakeStreamPage(sections),
        { prompt: 'buatkan landing page' },
        makeDeps({ diagnostics: [], placeholders: [] }),
      );

      expect(useEditorStore.getState().document.document.children).toHaveLength(3);
      expect(useEditorStore.getState().canUndo).toBe(true);
      expect(useEditorStore.getState().canRedo).toBe(false);

      useEditorStore.getState().undo();

      expect(useEditorStore.getState().document).toEqual(preGenerateDoc);
      expect(useEditorStore.getState().canUndo).toBe(false);
      expect(useEditorStore.getState().canRedo).toBe(true);

      useEditorStore.getState().redo();
      expect(useEditorStore.getState().document.document.children).toHaveLength(3);
    });

    it('canUndo/canRedo stay correct for a manual edit performed after generation completes', async () => {
      await runStreamPageGeneration(
        fakeStreamPage([
          { id: 'gen-a', type: 'section', children: [] },
          { id: 'gen-b', type: 'section', children: [] },
        ]),
        { prompt: 'buatkan landing page' },
        makeDeps({ diagnostics: [], placeholders: [] }),
      );

      const afterGenerate = useEditorStore.getState().document;

      // A manual edit after generate is its own, independent undo step.
      useEditorStore
        .getState()
        .dispatch((doc) => updateProps(doc, { nodeId: 'gen-a', props: { title: 'Manually tweaked' } }));

      expect(useEditorStore.getState().canUndo).toBe(true);
      expect(useEditorStore.getState().canRedo).toBe(false);

      useEditorStore.getState().undo();
      // Undoing the manual edit alone restores the state right after generation —
      // the generated group itself is untouched by this single undo.
      expect(useEditorStore.getState().document).toEqual(afterGenerate);
      expect(useEditorStore.getState().canRedo).toBe(true);

      useEditorStore.getState().undo();
      // Second undo removes the entire generated group in one step.
      expect(useEditorStore.getState().document.document.children).toHaveLength(0);
    });
  });
});
