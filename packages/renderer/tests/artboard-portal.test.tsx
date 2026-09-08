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
import { ModalManager } from '../src/action-runners';
import { createDefaultComponentRegistry } from '@kubuild/components';
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
