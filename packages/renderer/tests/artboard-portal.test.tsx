import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { KubuildRenderer } from '../src/renderer';
import {
  ArtboardPortalHost,
  getArtboardContentNode,
  selectOpenComponentArtboards,
} from '../src/artboard-portal-host';
import { createRenderContext } from '../src/render-context';
import { PreviewViewportAdapter } from '../src/preview-adapter';
import { ModalManager, modalManager as modalManagerSingleton } from '../src/action-runners';
import { createDefaultComponentRegistry, STARTER_BLOCKS } from '@kubuild/components';
import { createBlankDocument, createComponentArtboard, createPageArtboard } from '@kubuild/core';
import { ARTBOARD_REFERENCE_NODE_TYPE, type Artboard, type Node } from '@kubuild/schema';

const registry = createDefaultComponentRegistry();

function modalNode(id = 'modal-1', modalId = 'auth-modal'): Node {
  return {
    id,
    type: 'modal',
    props: { modalId, title: 'Welcome Back' },
    styles: {},
    children: [{ id: `${id}-text`, type: 'text', props: { content: 'Please sign in' } }],
  };
}

function componentArtboard(triggerId = 'auth-modal'): Artboard {
  return createComponentArtboard(modalNode('modal-1', triggerId), { id: 'ab-modal' });
}

describe('getArtboardContentNode', () => {
  it('returns the detached subtree stored under the synthetic page root', () => {
    const artboard = componentArtboard();
    const content = getArtboardContentNode(artboard);

    expect(content?.id).toBe('modal-1');
    expect(content?.type).toBe('modal');
  });

  it('returns undefined for an artboard with no content', () => {
    const empty = createPageArtboard('Empty', { id: 'ab-empty' });
    expect(getArtboardContentNode(empty)).toBeUndefined();
  });
});

describe('selectOpenComponentArtboards', () => {
  it('selects only component artboards whose trigger is open', () => {
    const artboards = [componentArtboard('auth-modal'), createPageArtboard('Home', { id: 'ab-home' })];

    expect(selectOpenComponentArtboards(artboards, {})).toEqual([]);
    expect(selectOpenComponentArtboards(artboards, { 'auth-modal': false })).toEqual([]);
    expect(selectOpenComponentArtboards(artboards, { 'auth-modal': true }).map((a) => a.id)).toEqual([
      'ab-modal',
    ]);
  });

  it('never selects page artboards, even if a trigger id collides', () => {
    const page = { ...createPageArtboard('Home', { id: 'ab-home' }), triggerId: 'auth-modal' };
    expect(selectOpenComponentArtboards([page], { 'auth-modal': true })).toEqual([]);
  });

  it('skips component artboards with no trigger id or no content', () => {
    const noTrigger: Artboard = { ...componentArtboard(), triggerId: undefined };
    const noContent: Artboard = {
      ...componentArtboard(),
      document: {
        ...componentArtboard().document,
        document: { ...componentArtboard().document.document, children: [] },
      },
    };

    expect(selectOpenComponentArtboards([noTrigger], { 'auth-modal': true })).toEqual([]);
    expect(selectOpenComponentArtboards([noContent], { 'auth-modal': true })).toEqual([]);
  });

  it('selects several open artboards at once', () => {
    const first = createComponentArtboard(modalNode('m1', 't1'), { id: 'ab-1' });
    const second = createComponentArtboard(modalNode('m2', 't2'), { id: 'ab-2' });

    const open = selectOpenComponentArtboards([first, second], { t1: true, t2: true });
    expect(open.map((a) => a.id)).toEqual(['ab-1', 'ab-2']);
  });
});

describe('ArtboardPortalHost', () => {
  it('renders nothing in editor mode — the artboard is shown as its own canvas surface instead', () => {
    const manager = new ModalManager();
    manager.openModal('auth-modal');

    const html = renderToString(
      <ArtboardPortalHost
        artboards={[componentArtboard()]}
        registry={registry}
        mode="editor"
        modalManager={manager}
      />,
    );

    expect(html).toBe('');
  });

  it('renders nothing at runtime while every trigger is closed', () => {
    const manager = new ModalManager();
    manager.closeModal('auth-modal');

    const html = renderToString(
      <ArtboardPortalHost
        artboards={[componentArtboard()]}
        registry={registry}
        mode="runtime"
        modalManager={manager}
      />,
    );

    expect(html).toBe('');
  });

  it('renders nothing when there is no portal container to mount into', () => {
    const manager = new ModalManager();
    manager.openModal('auth-modal');

    const html = renderToString(
      <ArtboardPortalHost
        artboards={[componentArtboard()]}
        registry={registry}
        mode="runtime"
        modalManager={manager}
        container={null}
      />,
    );

    expect(html).toBe('');
  });

  it('reads component artboards from the render context when none are passed', () => {
    const manager = new ModalManager();
    manager.openModal('auth-modal');
    const context = createRenderContext({ componentArtboards: [componentArtboard()] });

    // container:null keeps this SSR-safe; the assertion is that context artboards are picked up
    // and reach the container guard rather than being dropped as an empty candidate list.
    expect(selectOpenComponentArtboards(context.componentArtboards ?? [], manager.getState())).toHaveLength(1);
    expect(
      renderToString(
        <ArtboardPortalHost registry={registry} mode="runtime" context={context} modalManager={manager} container={null} />,
      ),
    ).toBe('');
  });
});

describe('createRenderContext artboard resolution', () => {
  it('derives resolveArtboard from componentArtboards', () => {
    const artboard = componentArtboard('auth-modal');
    const context = createRenderContext({ componentArtboards: [artboard] });

    expect(context.resolveArtboard?.('auth-modal')?.id).toBe('ab-modal');
    expect(context.resolveArtboard?.('missing')).toBeUndefined();
  });

  it('prefers an explicitly supplied resolver', () => {
    const artboard = componentArtboard('auth-modal');
    const context = createRenderContext({
      componentArtboards: [artboard],
      resolveArtboard: () => undefined,
    });

    expect(context.resolveArtboard?.('auth-modal')).toBeUndefined();
  });

  it('leaves artboard fields off the context when unused', () => {
    const context = createRenderContext({ variables: { a: 1 } });

    expect(context.resolveArtboard).toBeUndefined();
    expect(context.componentArtboards).toBeUndefined();
  });
});

describe('PreviewViewportAdapter overlay host', () => {
  function pageWithTrigger() {
    const doc = createBlankDocument('Preview page');
    doc.document.children = [
      {
        id: 'trigger-1',
        type: 'button',
        props: { label: 'Click Me', modalId: 'auth-modal' },
        actions: [
          {
            id: 'p1',
            trigger: 'click',
            label: 'Open',
            enabled: true,
            steps: [{ id: 's1', type: 'open_modal', label: 'Open', payload: { modalId: 'auth-modal' } }],
          },
        ],
      },
    ];
    return doc;
  }

  it('mounts a containing-block overlay host when component artboards are supplied', () => {
    const html = renderToString(
      <PreviewViewportAdapter
        document={pageWithTrigger()}
        registry={registry}
        componentArtboards={[componentArtboard()]}
      />,
    );

    expect(html).toContain('data-kubuild-preview-overlay-host');
    // The transform is what scopes the overlay's `position: fixed` to the device frame
    expect(html).toContain('translate3d(0, 0, 0)');
    // Empty host must not swallow clicks meant for the page
    expect(html).toContain('pointer-events:none');
    expect(html).toContain('Click Me');
  });

  it('mounts no overlay host when there are no component artboards', () => {
    const html = renderToString(
      <PreviewViewportAdapter document={pageWithTrigger()} registry={registry} />,
    );

    expect(html).not.toContain('data-kubuild-preview-overlay-host');
  });

  it('falls back to component artboards carried on the render context', () => {
    const context = createRenderContext({ componentArtboards: [componentArtboard()] });

    const html = renderToString(
      <PreviewViewportAdapter document={pageWithTrigger()} registry={registry} context={context} />,
    );

    expect(html).toContain('data-kubuild-preview-overlay-host');
  });
});

describe('isolated component surface rendering', () => {
  function modalDoc() {
    const doc = createBlankDocument('Modal surface');
    doc.document.children = [modalNode('modal-1', 'auth-modal')];
    return doc;
  }

  it('drops the backdrop when a modal is authored alone on a component artboard', () => {
    const context = createRenderContext({ artboardSurface: 'component' });

    const html = renderToString(
      <KubuildRenderer document={modalDoc()} registry={registry} mode="editor" context={context} />,
    );

    expect(html).toContain('data-kubuild-isolated="true"');
    // No dark full-bleed backdrop painting over the surface being edited
    expect(html).not.toContain('rgba(15, 23, 42, 0.65)');
    expect(html).not.toContain('backdrop-filter:blur(4px)');
    // The overlay element itself is in flow, not pinned over the artboard
    const overlayStyle = /data-kubuild-overlay="auth-modal"[^>]*style="([^"]*)"/.exec(html)?.[1] ?? '';
    expect(overlayStyle).toContain('position:relative');
    expect(overlayStyle).not.toContain('position:absolute');
    expect(overlayStyle).not.toContain('z-index');
    // The dialog content is still there and still editable
    expect(html).toContain('Please sign in');
  });

  it('keeps the backdrop on a page surface in editor mode', () => {
    const html = renderToString(
      <KubuildRenderer document={modalDoc()} registry={registry} mode="editor" />,
    );

    expect(html).not.toContain('data-kubuild-isolated');
    expect(html).toContain('rgba(15, 23, 42, 0.65)');
    const overlayStyle = /data-kubuild-overlay="auth-modal"[^>]*style="([^"]*)"/.exec(html)?.[1] ?? '';
    expect(overlayStyle).toContain('position:absolute');
  });

  it('keeps the real overlay at runtime even when a component surface is declared', () => {
    const manager = new ModalManager();
    const context = createRenderContext({ artboardSurface: 'component' });
    const doc = modalDoc();

    // Runtime rendering is what a published page does; isolation is an editor-only affordance.
    manager.openModal('auth-modal');
    const html = renderToString(
      <KubuildRenderer document={doc} registry={registry} mode="runtime" context={context} />,
    );

    expect(html).not.toContain('data-kubuild-isolated');
  });

  it('sizes a drawer to its content instead of a viewport-sized overlay when isolated', () => {
    const doc = createBlankDocument('Drawer surface');
    doc.document.children = [
      {
        id: 'drawer-1',
        type: 'drawer',
        props: { modalId: 'nav-drawer', title: 'Menu', placement: 'right' },
        children: [{ id: 'drawer-1-text', type: 'text', props: { content: 'Drawer body' } }],
      },
    ];
    const context = createRenderContext({ artboardSurface: 'component' });

    const html = renderToString(
      <KubuildRenderer document={doc} registry={registry} mode="editor" context={context} />,
    );

    expect(html).toContain('data-kubuild-isolated="true"');
    expect(html).not.toContain('rgba(15, 23, 42, 0.5)');
    expect(html).toContain('min-height:240px');
    expect(html).toContain('Drawer body');
  });
});

describe('Navbar block mobile menu visibility', () => {
  function navbarDoc() {
    const tree = STARTER_BLOCKS.find((block) => block.id === 'navbar')!.createNodeTree();
    const doc = createBlankDocument('Navbar');
    doc.document.children = [tree as never];
    return doc;
  }

  function menuDisplay(html: string): string {
    const tag = /<div[^>]*data-kubuild-collapsible="mobile-nav-drawer"[^>]*>/.exec(html)?.[0];
    if (!tag) return '(absent)';
    return /display:([^;"]*)/.exec(tag)?.[1] ?? '(unset)';
  }

  it('stays visible while editing at the mobile breakpoint, so its links are reachable', () => {
    // Explicitly closed: editing visibility must not depend on the menu having been opened.
    modalManagerSingleton.closeModal('mobile-nav-drawer');

    const html = renderToString(
      <KubuildRenderer document={navbarDoc()} registry={registry} mode="editor" viewport="mobile" />,
    );

    expect(menuDisplay(html)).toBe('flex');
  });

  it('is hidden while editing at desktop, where the desktop nav is shown instead', () => {
    const html = renderToString(
      <KubuildRenderer document={navbarDoc()} registry={registry} mode="editor" viewport="desktop" />,
    );

    expect(menuDisplay(html)).toBe('none');
  });

  it('is closed by default at runtime and opens when its trigger fires', () => {
    const doc = navbarDoc();

    modalManagerSingleton.closeModal('mobile-nav-drawer');
    expect(
      menuDisplay(
        renderToString(
          <KubuildRenderer document={doc} registry={registry} mode="runtime" viewport="mobile" />,
        ),
      ),
    ).toBe('none');

    modalManagerSingleton.openModal('mobile-nav-drawer');
    expect(
      menuDisplay(
        renderToString(
          <KubuildRenderer document={doc} registry={registry} mode="runtime" viewport="mobile" />,
        ),
      ),
    ).toBe('flex');

    // The hamburger only exists on mobile, so an open menu must not leak onto desktop
    expect(
      menuDisplay(
        renderToString(
          <KubuildRenderer document={doc} registry={registry} mode="runtime" viewport="desktop" />,
        ),
      ),
    ).toBe('none');

    modalManagerSingleton.closeModal('mobile-nav-drawer');
  });
});

describe('artboard-reference stub rendering', () => {
  const stub: Node = {
    id: 'artboard_ref_1',
    type: ARTBOARD_REFERENCE_NODE_TYPE,
    props: { artboardId: 'ab-modal', triggerId: 'auth-modal', label: 'Sign in modal' },
    styles: {},
    children: [],
  };

  it('renders a selectable chip in editor mode', () => {
    const doc = createBlankDocument('Stub Test');
    doc.document.children = [stub];

    const html = renderToString(<KubuildRenderer document={doc} registry={registry} mode="editor" />);

    expect(html).toContain('data-kubuild-artboard-reference="ab-modal"');
    expect(html).toContain('Opens: Sign in modal');
    expect(html).toContain('data-kubuild-node="artboard_ref_1"');
  });

  it('renders nothing in runtime mode — the portal host owns the real content', () => {
    const doc = createBlankDocument('Stub Test');
    doc.document.children = [stub];

    const html = renderToString(<KubuildRenderer document={doc} registry={registry} mode="runtime" />);

    expect(html).not.toContain('data-kubuild-artboard-reference');
    expect(html).not.toContain('Opens:');
  });

  it('falls back to the artboard id when no label was stored', () => {
    const doc = createBlankDocument('Stub Test');
    doc.document.children = [{ ...stub, props: { artboardId: 'ab-modal' } }];

    const html = renderToString(<KubuildRenderer document={doc} registry={registry} mode="editor" />);
    expect(html).toContain('Opens: ab-modal');
  });
});
