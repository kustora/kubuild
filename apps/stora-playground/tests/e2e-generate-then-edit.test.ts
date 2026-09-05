import { describe, it, expect, beforeEach } from 'vitest';
import type { Node, PageDocument } from '@kubuild/schema';
import type { AiStreamCallbacks } from '@kubuild/ai';
import { createBlankDocument, validateDocument, type Diagnostic, type CommandResult } from '@kubuild/core';
import { createDefaultComponentRegistry } from '@kubuild/components';
import { useEditorStore, runStreamPageGeneration, type AiGenerationPlaceholderStatus } from '@kubuild/editor';

/**
 * STORA-522 (docs/TASKS_AI_PROVIDER_EMBED.md, EPIC-56) — end-to-end reproduction of Flow A
 * from docs/PRD_AI_PROVIDER_EMBED.md §3.2: blank document -> generate via prompt -> manual
 * edit on top of the generated result -> document stays valid throughout.
 *
 * Only the AI network boundary is faked (a `streamPage` function matching
 * `useAiGenerator().streamPage`'s signature, emitting canned `AiStreamEvent`-shaped
 * sections synchronously). Everything downstream is real: the real `@kubuild/editor`
 * Zustand store, the real `@kubuild/core` command engine/history manager, and the real
 * `validateDocument` structural + security validator — no mocked command engine anywhere,
 * per the ticket's explicit acceptance criteria.
 */

const registry = createDefaultComponentRegistry();

function fakeStreamPage(sections: unknown[]) {
  return async (
    _params: unknown,
    callbacks?: AiStreamCallbacks,
  ): Promise<PageDocument | null> => {
    const total = sections.length;
    sections.forEach((section, index) => {
      callbacks?.onSection?.(section as Node, index, total);
    });
    return null;
  };
}

function makeGenerationDeps(collect: {
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

describe('E2E (STORA-522): blank document -> generate -> manual edit -> stays valid', () => {
  beforeEach(() => {
    useEditorStore.getState().setDocument(createBlankDocument('AI Generate + Edit E2E'));
  });

  it('generates a full landing page from a prompt, then survives manual insert + style edits without ever going invalid', async () => {
    // 1. Start from a genuinely blank document.
    const blankDoc = useEditorStore.getState().document;
    expect(blankDoc.document.children ?? []).toHaveLength(0);
    expect(validateDocument(blankDoc).valid).toBe(true);
    expect(useEditorStore.getState().canUndo).toBe(false);

    // 2. Generate via prompt (Flow A) — the fake AI network boundary emits three
    // page -> section -> component sections, exactly like a real `streamPage()` SSE
    // session would section-by-section.
    const sections: Node[] = [
      {
        id: 'hero',
        type: 'section',
        children: [
          { id: 'hero-heading', type: 'heading', props: { level: 1, title: 'Analytics for SaaS teams' } },
          { id: 'hero-text', type: 'text', props: { text: 'Understand your users in minutes.' } },
        ],
      },
      {
        id: 'features',
        type: 'section',
        children: [{ id: 'features-text', type: 'text', props: { text: 'Real-time dashboards.' } }],
      },
      {
        id: 'cta',
        type: 'section',
        children: [{ id: 'cta-button', type: 'button', props: { label: 'Get started' } }],
      },
    ];

    const collect = { diagnostics: [] as Diagnostic[], placeholders: [] as (AiGenerationPlaceholderStatus | null)[] };
    const summary = await runStreamPageGeneration(
      fakeStreamPage(sections),
      { prompt: 'buatkan landing page untuk SaaS analytics' },
      makeGenerationDeps(collect),
    );

    expect(summary.streamErrored).toBe(false);
    expect(summary.failedSectionCount).toBe(0);
    expect(collect.diagnostics).toHaveLength(0);
    expect(summary.insertedSectionIds).toEqual(['hero', 'features', 'cta']);

    const afterGenerate = useEditorStore.getState().document;
    expect(afterGenerate.document.children?.map((n) => n.id)).toEqual(['hero', 'features', 'cta']);
    expect(validateDocument(afterGenerate).valid).toBe(true);

    // The whole generate session is one grouped undo entry (STORA-510).
    expect(useEditorStore.getState().canUndo).toBe(true);
    expect(useEditorStore.getState().canRedo).toBe(false);

    // 3. Manual edit on top of the generated result: insert a new component (simulating a
    // drag-drop/insert from the component panel) into a generated section...
    const insertResult = useEditorStore
      .getState()
      .insertComponent('button', registry, 'features', undefined);
    expect(insertResult.success).toBe(true);
    expect(insertResult.nodeId).toBeTruthy();

    const afterInsert = useEditorStore.getState().document;
    expect(validateDocument(afterInsert).valid).toBe(true);

    // ...and update a style on a node the AI generated (manual style edit through the
    // exact same `updateNodeStyle` path the Style Manager UI uses).
    const styleResult = useEditorStore
      .getState()
      .updateNodeStyle('hero-heading', { color: '#111111', fontSize: '48px' }, 'base', true);
    expect(styleResult.success).toBe(true);

    const afterStyleEdit = useEditorStore.getState().document;
    const heroHeading = afterStyleEdit.document.children
      ?.find((n) => n.id === 'hero')
      ?.children?.find((n) => n.id === 'hero-heading');
    expect(heroHeading?.styles?.base).toMatchObject({ color: '#111111', fontSize: '48px' });

    // 4. Document remains valid at every point along the way, including after manual
    // edits stacked on top of AI-generated content.
    expect(validateDocument(afterStyleEdit).valid).toBe(true);

    // Manual edits are independent undo steps stacked on top of the generated batch:
    // undo() peels them off one at a time, then a final undo() removes the whole
    // generated group in one shot, ending back at the blank document.
    expect(useEditorStore.getState().canUndo).toBe(true);

    useEditorStore.getState().undo(); // undoes the style edit
    useEditorStore.getState().undo(); // undoes the manual insert
    expect(validateDocument(useEditorStore.getState().document).valid).toBe(true);
    expect(useEditorStore.getState().document.document.children?.map((n) => n.id)).toEqual([
      'hero',
      'features',
      'cta',
    ]);

    useEditorStore.getState().undo(); // undoes the entire generated batch in one step
    expect(useEditorStore.getState().document).toEqual(blankDoc);
    expect(useEditorStore.getState().canUndo).toBe(false);
    expect(validateDocument(useEditorStore.getState().document).valid).toBe(true);
  });

  it('a section that fails validation does not block the rest, and the document stays valid even with partial generation', async () => {
    const sections = [
      { id: 'ok-hero', type: 'section', children: [{ id: 'ok-heading', type: 'heading', props: { level: 1, title: 'Hi' } }] },
      // Deliberately oversized relative to the security limit below.
      {
        id: 'too-big',
        type: 'section',
        children: [
          { id: 'big-1', type: 'text', props: { text: 'a' } },
          { id: 'big-2', type: 'text', props: { text: 'b' } },
        ],
      },
      { id: 'ok-cta', type: 'section', children: [{ id: 'ok-button', type: 'button', props: { label: 'Go' } }] },
    ];

    const collect = { diagnostics: [] as Diagnostic[], placeholders: [] as (AiGenerationPlaceholderStatus | null)[] };
    const deps = { ...makeGenerationDeps(collect), securityLimits: { maxNodeCount: 2 } };
    const summary = await runStreamPageGeneration(
      fakeStreamPage(sections),
      { prompt: 'buatkan landing page' },
      deps,
    );

    expect(summary.insertedSectionIds).toEqual(['ok-hero', 'ok-cta']);
    expect(summary.failedSectionCount).toBe(1);
    expect(collect.diagnostics[0]?.code).toBe('AI_SECTION_REJECTED');

    const finalDoc = useEditorStore.getState().document;
    expect(validateDocument(finalDoc).valid).toBe(true);

    // Manual edit still works cleanly on top of a partially-generated result.
    const insertResult = useEditorStore.getState().insertComponent('text', registry, 'ok-hero');
    expect(insertResult.success).toBe(true);
    expect(validateDocument(useEditorStore.getState().document).valid).toBe(true);
  });
});
