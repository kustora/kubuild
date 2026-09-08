import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { EditorCanvas } from '../src/components/canvas/canvas';
import { ViewportResizer } from '../src/components/canvas/viewport-resizer';
import { useEditorStore } from '../src/store';
import { assertNoDetachedArtboardReferences } from '../src/utils/export-utils';
import { createDefaultComponentRegistry } from '@kubuild/components';
import {
  createBlankDocument,
  findNodeById,
  insertNode,
  collectArtboardReferenceNodes,
} from '@kubuild/core';
import { ARTBOARD_REFERENCE_NODE_TYPE, type PageDocument } from '@kubuild/schema';

const registry = createDefaultComponentRegistry();

/** The `page` root only accepts `section` children, so overlays sit inside a section. */
function docWithModal(): PageDocument {
  const doc = createBlankDocument('Home');
  doc.document.children = [
    {
      id: 'section-1',
      type: 'section',
      props: {},
      children: [
        {
          id: 'modal-1',
          type: 'modal',
          props: { modalId: 'auth-modal', title: 'Sign in' },
          children: [{ id: 'modal-1-text', type: 'text', props: { content: 'Body' } }],
        },
      ],
    },
  ];
  return doc;
}

function docWithSection(): PageDocument {
  const doc = createBlankDocument('Home');
  doc.document.children = [{ id: 'section-1', type: 'section', props: {}, children: [] }];
  return doc;
}

function resetStore(doc: PageDocument) {
  useEditorStore.getState().setComponentArtboards([]);
  useEditorStore.getState().setDocument(doc);
}

describe('Editor store: detachNodeToArtboard', () => {
  beforeEach(() => {
    resetStore(docWithModal());
  });

  it('moves the node onto its own component artboard and leaves a stub in the page', () => {
    const result = useEditorStore.getState().detachNodeToArtboard('modal-1');

    expect(result.success).toBe(true);
    expect(result.triggerId).toBe('auth-modal');

    const state = useEditorStore.getState();
    expect(state.componentArtboards).toHaveLength(1);
    expect(state.componentArtboards[0].artboardType).toBe('component');
    // Page tree no longer holds the modal, but does hold a reference stub
    expect(findNodeById(state.document.document, 'modal-1')).toBeNull();
    const stub = findNodeById(state.document.document, result.stubNodeId!);
    expect(stub?.type).toBe(ARTBOARD_REFERENCE_NODE_TYPE);
    expect(stub?.props?.artboardId).toBe(result.artboardId);
    // ...and the modal subtree lives in the new artboard
    const artboardDoc = state.componentArtboards[0].document;
    expect(findNodeById(artboardDoc.document, 'modal-1')?.type).toBe('modal');
  });

  it('selects the stub and keeps editing the page by default', () => {
    const result = useEditorStore.getState().detachNodeToArtboard('modal-1');

    expect(useEditorStore.getState().activeArtboardId).toBeNull();
    expect(useEditorStore.getState().selectedNodeId).toBe(result.stubNodeId);
  });

  it('marks the page dirty and undoable', () => {
    useEditorStore.getState().detachNodeToArtboard('modal-1');

    expect(useEditorStore.getState().isDirty).toBe(true);
    expect(useEditorStore.getState().canUndo).toBe(true);
  });

  it('rejects unknown nodes and detaching while a component artboard is being edited', () => {
    expect(useEditorStore.getState().detachNodeToArtboard('ghost')).toMatchObject({
      success: false,
    });

    const ok = useEditorStore.getState().detachNodeToArtboard('modal-1');
    useEditorStore.getState().activateArtboard(ok.artboardId!);
    expect(useEditorStore.getState().detachNodeToArtboard('modal-1')).toMatchObject({
      success: false,
    });
  });
});

describe('Editor store: activateArtboard', () => {
  beforeEach(() => {
    resetStore(docWithModal());
  });

  it('swaps the loaded document to the artboard and back to the page', () => {
    const { artboardId } = useEditorStore.getState().detachNodeToArtboard('modal-1');
    const pageRootId = useEditorStore.getState().document.document.id;

    useEditorStore.getState().activateArtboard(artboardId!);
    expect(useEditorStore.getState().activeArtboardId).toBe(artboardId);
    // The loaded document is now the artboard's own document, holding the modal
    expect(findNodeById(useEditorStore.getState().document.document, 'modal-1')?.type).toBe('modal');

    useEditorStore.getState().activateArtboard(null);
    expect(useEditorStore.getState().activeArtboardId).toBeNull();
    expect(useEditorStore.getState().document.document.id).toBe(pageRootId);
    // Returning to the page restores the stub, not the modal
    expect(findNodeById(useEditorStore.getState().document.document, 'modal-1')).toBeNull();
  });

  it('commits edits made inside an artboard back into that artboard on switch away', () => {
    const { artboardId } = useEditorStore.getState().detachNodeToArtboard('modal-1');
    useEditorStore.getState().activateArtboard(artboardId!);

    useEditorStore.getState().updateNodeProps('modal-1', { title: 'Edited title' }, registry);
    useEditorStore.getState().activateArtboard(null);

    const stored = useEditorStore
      .getState()
      .componentArtboards.find((artboard) => artboard.id === artboardId)!;
    expect(findNodeById(stored.document.document, 'modal-1')?.props?.title).toBe('Edited title');
  });

  it('ignores unknown artboard ids and no-op switches', () => {
    const { artboardId } = useEditorStore.getState().detachNodeToArtboard('modal-1');
    useEditorStore.getState().activateArtboard(artboardId!);

    useEditorStore.getState().activateArtboard('ghost-artboard');
    expect(useEditorStore.getState().activeArtboardId).toBe(artboardId);

    useEditorStore.getState().activateArtboard(artboardId!);
    expect(useEditorStore.getState().activeArtboardId).toBe(artboardId);
  });

  it('a wholesale setDocument (host page switch) ends the artboard editing session', () => {
    const { artboardId } = useEditorStore.getState().detachNodeToArtboard('modal-1');
    useEditorStore.getState().activateArtboard(artboardId!);

    useEditorStore.getState().setDocument(createBlankDocument('Another Page'));
    expect(useEditorStore.getState().activeArtboardId).toBeNull();
    expect(useEditorStore.getState().artboardReturnDocument).toBeNull();
  });

  it('removeComponentArtboard drops it and returns to the page when it was active', () => {
    const { artboardId } = useEditorStore.getState().detachNodeToArtboard('modal-1');
    useEditorStore.getState().activateArtboard(artboardId!);

    useEditorStore.getState().removeComponentArtboard(artboardId!);
    expect(useEditorStore.getState().componentArtboards).toHaveLength(0);
    expect(useEditorStore.getState().activeArtboardId).toBeNull();
  });
});

describe('Editor store: deleting a component artboard', () => {
  beforeEach(() => {
    resetStore(docWithModal());
  });

  it('removes the artboard and the reference stub that pointed at it', () => {
    const detached = useEditorStore.getState().detachNodeToArtboard('modal-1');
    expect(findNodeById(useEditorStore.getState().document.document, detached.stubNodeId!)).not.toBeNull();

    const result = useEditorStore.getState().removeComponentArtboard(detached.artboardId!);

    expect(result).toMatchObject({ success: true, removedReferenceCount: 1 });
    expect(useEditorStore.getState().componentArtboards).toHaveLength(0);
    // No stub left behind opening an artboard that no longer exists
    expect(findNodeById(useEditorStore.getState().document.document, detached.stubNodeId!)).toBeNull();
    expect(collectArtboardReferenceNodes(useEditorStore.getState().document.document)).toEqual([]);
  });

  it('reports an unknown artboard instead of throwing', () => {
    expect(useEditorStore.getState().removeComponentArtboard('ghost')).toMatchObject({
      success: false,
    });
  });

  it('cleans the page stub even when a different artboard is being edited', () => {
    // Two detached artboards, then edit the second one and delete the first.
    const first = useEditorStore.getState().detachNodeToArtboard('modal-1');
    useEditorStore.getState().dispatch((doc) =>
      insertNode(doc, {
        parentId: 'section-1',
        node: { id: 'modal-2', type: 'modal', props: { modalId: 'second-modal' }, children: [] },
      }),
    );
    const second = useEditorStore.getState().detachNodeToArtboard('modal-2');
    useEditorStore.getState().activateArtboard(second.artboardId!);

    const result = useEditorStore.getState().removeComponentArtboard(first.artboardId!);

    expect(result).toMatchObject({ success: true, removedReferenceCount: 1 });
    // Deleting returns to the page so the stub is reachable, and only the deleted
    // artboard's stub goes away
    expect(useEditorStore.getState().activeArtboardId).toBeNull();
    const remainingRefs = collectArtboardReferenceNodes(useEditorStore.getState().document.document);
    expect(remainingRefs).toHaveLength(1);
    expect(remainingRefs[0].artboardId).toBe(second.artboardId);
    expect(useEditorStore.getState().componentArtboards.map((a) => a.id)).toEqual([
      second.artboardId,
    ]);
  });

  it('keeps the deletion undoable on the page side', () => {
    const detached = useEditorStore.getState().detachNodeToArtboard('modal-1');
    useEditorStore.getState().removeComponentArtboard(detached.artboardId!);
    expect(collectArtboardReferenceNodes(useEditorStore.getState().document.document)).toEqual([]);

    useEditorStore.getState().undo();

    // The stub comes back (the artboard itself does not — documented Phase 1 limitation)
    expect(collectArtboardReferenceNodes(useEditorStore.getState().document.document)).toHaveLength(1);
  });
});

describe('Editor store: document ownership while editing an artboard', () => {
  beforeEach(() => {
    resetStore(docWithModal());
  });

  it('does not hand artboard edits to the host onChange (which saves the page)', () => {
    const seen: string[] = [];
    useEditorStore.getState().setOnChangeHandler((doc) => {
      seen.push(doc.document.id);
    });

    const { artboardId } = useEditorStore.getState().detachNodeToArtboard('modal-1');
    // The page-side change is the host's business...
    expect(seen.length).toBe(1);

    useEditorStore.getState().activateArtboard(artboardId!);
    useEditorStore.getState().updateNodeProps('modal-1', { title: 'Edited' }, registry);

    // ...but edits inside the component artboard must not be reported as page changes,
    // or the host would save the artboard's document over the page it was detached from.
    expect(seen.length).toBe(1);

    useEditorStore.getState().setOnChangeHandler(null);
  });

  it('writes artboard edits straight back into componentArtboards', () => {
    const { artboardId } = useEditorStore.getState().detachNodeToArtboard('modal-1');
    useEditorStore.getState().activateArtboard(artboardId!);
    useEditorStore.getState().updateNodeProps('modal-1', { title: 'Live edit' }, registry);

    // Visible immediately, without waiting for a switch away from the artboard
    const stored = useEditorStore
      .getState()
      .componentArtboards.find((artboard) => artboard.id === artboardId)!;
    expect(findNodeById(stored.document.document, 'modal-1')?.props?.title).toBe('Live edit');
  });
});

describe('Editor store: inserting an overlay component', () => {
  beforeEach(() => {
    resetStore(docWithSection());
  });

  it('gives a modal its own artboard plus a pre-wired trigger button', () => {
    const result = useEditorStore.getState().insertComponent('modal', registry, 'section-1');

    expect(result.success).toBe(true);
    const state = useEditorStore.getState();

    // The modal itself is not inline in the page
    expect(state.componentArtboards).toHaveLength(1);
    expect(state.componentArtboards[0].artboardType).toBe('component');

    // A trigger button was inserted instead, wired to the artboard's trigger id
    const trigger = findNodeById(state.document.document, result.nodeId!);
    expect(trigger?.type).toBe('button');
    const triggerId = state.componentArtboards[0].triggerId;
    expect(trigger?.props?.modalId).toBe(triggerId);
    expect(trigger?.actions?.[0].steps[0].type).toBe('open_modal');
    expect(trigger?.actions?.[0].steps[0].payload).toMatchObject({ modalId: triggerId, toggle: true });

    // Plus a reference stub so the page shows what it opens
    const section = findNodeById(state.document.document, 'section-1');
    const stubs = (section?.children ?? []).filter(
      (child) => child.type === ARTBOARD_REFERENCE_NODE_TYPE,
    );
    expect(stubs).toHaveLength(1);
  });

  it('leaves non-overlay components inline as before', () => {
    const result = useEditorStore.getState().insertComponent('heading', registry, 'section-1');

    expect(result.success).toBe(true);
    expect(useEditorStore.getState().componentArtboards).toHaveLength(0);
    expect(findNodeById(useEditorStore.getState().document.document, result.nodeId!)?.type).toBe(
      'heading',
    );
  });
});

// `renderToString` makes zustand serve its *initial* snapshot, so these assert through the
// same prop-override path the existing `document`/`aiGenerationStatus` canvas tests use.
describe('Canvas rendering of artboards', () => {
  beforeEach(() => {
    resetStore(docWithModal());
  });

  it('renders a component artboard as its own surface, badged COMPONENT', () => {
    const detached = useEditorStore.getState().detachNodeToArtboard('modal-1', {
      name: 'Sign in modal',
    });
    expect(detached.success).toBe(true);
    const { document, componentArtboards } = useEditorStore.getState();

    const html = renderToString(
      <EditorCanvas
        registry={registry}
        viewport="desktop"
        document={document}
        componentArtboards={componentArtboards}
        activeArtboardId={null}
      />,
    );

    expect(html).toContain('data-artboard-type="component"');
    expect(html).toContain('COMPONENT');
    expect(html).toContain('Sign in modal');
    // The page surface is still there and still labelled PAGE
    expect(html).toContain('data-artboard-type="page"');
  });

  it('labels plain page artboards PAGE and shows no component surfaces', () => {
    const doc = createBlankDocument('Home');

    const html = renderToString(
      <EditorCanvas registry={registry} viewport="desktop" document={doc} componentArtboards={[]} />,
    );

    expect(html).toContain('data-artboard-type="page"');
    expect(html).not.toContain('data-artboard-type="component"');
  });
});

describe('Canvas delete-artboard control', () => {
  beforeEach(() => {
    resetStore(docWithModal());
  });

  it('offers delete on a component artboard', () => {
    useEditorStore.getState().detachNodeToArtboard('modal-1', { name: 'Sign in modal' });
    const { document, componentArtboards } = useEditorStore.getState();

    const html = renderToString(
      <EditorCanvas
        registry={registry}
        viewport="desktop"
        document={document}
        componentArtboards={componentArtboards}
        activeArtboardId={null}
      />,
    );

    expect(html).toContain('data-testid="artboard-delete"');
    // Two-step: the confirm button only appears after the trash is clicked
    expect(html).not.toContain('data-testid="artboard-delete-confirm"');
  });

  it('does not offer delete for a lone page artboard', () => {
    const doc = createBlankDocument('Only page');

    const html = renderToString(
      <EditorCanvas registry={registry} viewport="desktop" document={doc} componentArtboards={[]} />,
    );

    expect(html).not.toContain('data-testid="artboard-delete"');
  });

  it('offers delete for page artboards once the host owns more than one', () => {
    const pages = [
      { id: 'page-home', name: 'Home', slug: '/', document: createBlankDocument('Home') },
      { id: 'page-about', name: 'About', slug: '/about', document: createBlankDocument('About') },
    ];

    const html = renderToString(
      <EditorCanvas
        registry={registry}
        viewport="desktop"
        pages={pages}
        activePageId="page-home"
        onPagesChange={() => {}}
        componentArtboards={[]}
      />,
    );

    expect(html).toContain('data-testid="artboard-delete"');
  });

  // The canvas withholds `onDelete` in preview mode; this asserts the resizer's own
  // contract, since `previewMode` lives in the store and `renderToString` serves zustand's
  // initial snapshot rather than mutations.
  it('renders no delete control when the artboard is given no onDelete handler', () => {
    const withHandler = renderToString(
      <ViewportResizer width={1200} onWidthChange={() => {}} title="Frame" onDelete={() => {}}>
        <div />
      </ViewportResizer>,
    );
    const withoutHandler = renderToString(
      <ViewportResizer width={1200} onWidthChange={() => {}} title="Frame">
        <div />
      </ViewportResizer>,
    );

    expect(withHandler).toContain('data-testid="artboard-delete"');
    expect(withoutHandler).not.toContain('data-testid="artboard-delete"');
  });
});

describe('Export guard', () => {
  it('blocks exporting a page that references a detached artboard', () => {
    resetStore(docWithModal());
    useEditorStore.getState().detachNodeToArtboard('modal-1');
    const doc = useEditorStore.getState().document;

    expect(() => assertNoDetachedArtboardReferences(doc)).toThrow(/Export blocked/);
  });

  it('allows exporting a page with no detached references', () => {
    expect(() => assertNoDetachedArtboardReferences(createBlankDocument('Clean'))).not.toThrow();
  });
});
