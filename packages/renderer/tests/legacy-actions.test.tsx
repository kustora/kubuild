import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { createBlankDocument } from '@kubuild/core';
import type { Diagnostic, RenderContext } from '@kubuild/core';
import type { Node } from '@kubuild/schema';
import { createDefaultComponentRegistry } from '@kubuild/components';
import {
  NodeRenderer,
  dispatchAction,
  createMinimalRenderContext,
  ModalManager,
  ToastManager,
  BUILTIN_LEGACY_ACTION_TYPES,
  isLegacyActionResolvable,
  getUnresolvedLegacyActionType,
} from '../src/index';

/**
 * STORA-533: legacy `props.action` bindings with a pipeline-runner equivalent work without
 * host wiring, can still be overridden by the host, and unknown types stay visible.
 */
const doc = createBlankDocument('Legacy actions');
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

function stubWindowLocation() {
  const location = { assign: vi.fn(), replace: vi.fn(), hash: '' };
  vi.stubGlobal('window', { location, open: vi.fn() });
  return location;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('STORA-533: built-in handlers for legacy action types', () => {
  it('covers navigate, open_modal, close_modal and show_toast', () => {
    for (const type of ['navigate', 'open_modal', 'close_modal', 'show_toast']) {
      expect(BUILTIN_LEGACY_ACTION_TYPES).toContain(type);
      expect(isLegacyActionResolvable(undefined, type)).toBe(true);
    }
    expect(isLegacyActionResolvable(undefined, 'launch_rocket')).toBe(false);
  });

  it('navigate runs without a host actionRegistry', async () => {
    const location = stubWindowLocation();
    const diagnostics: Diagnostic[] = [];
    const handled = dispatchAction({
      action: { type: 'navigate', payload: { url: '/docs' } },
      nodeId: 'btn',
      document: doc,
      onDiagnostic: (d) => diagnostics.push(d),
    });
    await flush();
    expect(handled).toBe(true);
    expect(location.assign).toHaveBeenCalledWith('/docs');
    expect(diagnostics).toEqual([]);
  });

  it('a host handler overrides the built-in one', async () => {
    const location = stubWindowLocation();
    const hostNavigate = vi.fn();
    const context = createMinimalRenderContext({ actions: { navigate: hostNavigate } });
    dispatchAction({
      action: { type: 'navigate', payload: { url: '/docs' } },
      nodeId: 'btn',
      document: doc,
      context,
    });
    await flush();
    expect(hostNavigate).toHaveBeenCalledWith(
      { url: '/docs' },
      expect.objectContaining({ nodeId: 'btn' }),
    );
    expect(location.assign).not.toHaveBeenCalled();
  });

  it('open_modal / close_modal drive the context modal manager', async () => {
    const modalManager = new ModalManager();
    const context = { modalManager } as unknown as RenderContext;
    dispatchAction({
      action: { type: 'open_modal', payload: { modalId: 'promo' } },
      document: doc,
      context,
    });
    await flush();
    expect(modalManager.isModalOpen('promo')).toBe(true);
    dispatchAction({
      action: { type: 'close_modal', payload: { modalId: 'promo' } },
      document: doc,
      context,
    });
    await flush();
    expect(modalManager.isModalOpen('promo')).toBe(false);
  });

  it('show_toast uses the context toast manager', async () => {
    const toastManager = new ToastManager();
    const show = vi.spyOn(toastManager, 'showToast');
    const context = { toastManager } as unknown as RenderContext;
    dispatchAction({
      action: { type: 'show_toast', payload: { message: 'Saved!' } },
      document: doc,
      context,
    });
    await flush();
    expect(show).toHaveBeenCalled();
    expect(JSON.stringify(show.mock.calls[0])).toContain('Saved!');
  });

  it('reports ACTION_EXECUTION_ERROR when a built-in runner fails', async () => {
    const diagnostics: Diagnostic[] = [];
    dispatchAction({
      action: { type: 'navigate', payload: {} },
      document: doc,
      onDiagnostic: (d) => diagnostics.push(d),
    });
    await flush();
    expect(diagnostics.map((d) => d.code)).toEqual(['ACTION_EXECUTION_ERROR']);
  });

  it('truly unknown types still emit UNKNOWN_ACTION', () => {
    const diagnostics: Diagnostic[] = [];
    const handled = dispatchAction({
      action: { type: 'launch_rocket' },
      nodeId: 'btn',
      document: doc,
      onDiagnostic: (d) => diagnostics.push(d),
    });
    expect(handled).toBe(false);
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].code).toBe('UNKNOWN_ACTION');
  });

  it('built-ins stay inert (and silent) when disabled, e.g. on the editor canvas', async () => {
    const location = stubWindowLocation();
    const diagnostics: Diagnostic[] = [];
    const handled = dispatchAction({
      action: { type: 'navigate', payload: { url: '/docs' } },
      document: doc,
      onDiagnostic: (d) => diagnostics.push(d),
      allowBuiltinHandlers: false,
    });
    await flush();
    expect(handled).toBe(false);
    expect(location.assign).not.toHaveBeenCalled();
    expect(diagnostics).toEqual([]);
  });
});

describe('STORA-533: unknown legacy actions are visible in editor mode', () => {
  const registry = createDefaultComponentRegistry();
  const button = (action: unknown): Node => ({
    id: 'btn_legacy',
    type: 'button',
    props: { label: 'Go', action },
    children: [],
  });
  const render = (node: Node, mode: 'editor' | 'runtime', context?: RenderContext) =>
    renderToString(
      <NodeRenderer node={node} document={doc} registry={registry} mode={mode} context={context} />,
    );

  it('shows an UNKNOWN_ACTION badge on the canvas for an unhandled type', () => {
    const html = render(button({ type: 'launch_rocket' }), 'editor');
    expect(html).toContain('data-kubuild-diagnostic="UNKNOWN_ACTION"');
    expect(html).toContain('launch_rocket');
  });

  it('no badge for built-in types, host-registered types, or in runtime mode', () => {
    expect(render(button({ type: 'navigate', payload: { url: '/x' } }), 'editor')).not.toContain(
      'data-kubuild-diagnostic',
    );
    const context = createMinimalRenderContext({ actions: { launch_rocket: vi.fn() } });
    expect(render(button({ type: 'launch_rocket' }), 'editor', context)).not.toContain(
      'data-kubuild-diagnostic',
    );
    expect(render(button({ type: 'launch_rocket' }), 'runtime')).not.toContain(
      'data-kubuild-diagnostic',
    );
  });

  it('getUnresolvedLegacyActionType', () => {
    expect(getUnresolvedLegacyActionType({ type: 'navigate' })).toBeNull();
    expect(getUnresolvedLegacyActionType({ type: 'mystery' })).toBe('mystery');
    expect(getUnresolvedLegacyActionType('not-a-binding')).toBe('invalid');
  });

  it('marks built-in legacy actions as resolved on the button element', () => {
    const html = render(button({ type: 'navigate', payload: { url: '/x' } }), 'runtime');
    expect(html).toContain('data-kubuild-action-resolved="true"');
  });
});
