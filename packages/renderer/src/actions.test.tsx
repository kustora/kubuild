import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { createBlankDocument } from '@kubuild/core';
import type { ActionHandler, ActionDiagnostic } from '@kubuild/core';
import {
  NodeRenderer,
  createMinimalRenderContext,
  createRenderContext,
  dispatchAction,
  resolveActionPayload,
} from './index';
import { createDefaultComponentRegistry } from '@kubuild/components';

describe('STORA-032: Safe Runtime Action Dispatching', () => {
  const registry = createDefaultComponentRegistry();

  function triggerNodeClick(element: React.ReactElement): void {
    // NodeRenderer returns <ComponentErrorBoundary>{renderedContent}</ComponentErrorBoundary>
    const inner = (element.props as { children?: React.ReactElement }).children || element;
    const props = (inner as React.ReactElement).props as { onClick?: (e: React.MouseEvent) => void };
    props?.onClick?.({ stopPropagation: () => {} } as unknown as React.MouseEvent);
  }

  describe('Acceptance Criteria 1: Registered navigate action called with resolved payload', () => {
    it('dispatches action when button is clicked with resolved variables in payload', () => {
      const doc = createBlankDocument('Action Test');
      const targetNode = {
        id: 'btn-nav',
        type: 'button',
        props: {
          label: 'Go to Profile',
          action: {
            type: 'navigate',
            payload: {
              url: '/users/{{ user.id }}/profile',
              tab: 'settings',
              token: { type: 'variable', key: 'auth.token' },
            },
          },
        },
      };
      doc.document.children = [targetNode];

      const navigateHandler = vi.fn<ActionHandler>();

      const context = createMinimalRenderContext({
        variables: {
          'user.id': '42',
          'auth.token': 'tok_xyz123',
        },
        actions: {
          navigate: navigateHandler,
        },
      });

      const element = NodeRenderer({
        node: targetNode,
        document: doc,
        registry,
        context,
      });

      triggerNodeClick(element);

      expect(navigateHandler).toHaveBeenCalledTimes(1);
      expect(navigateHandler).toHaveBeenCalledWith(
        {
          url: '/users/42/profile',
          tab: 'settings',
          token: 'tok_xyz123',
        },
        expect.objectContaining({
          nodeId: 'btn-nav',
          document: doc,
          variables: expect.objectContaining({
            'user.id': '42',
            'auth.token': 'tok_xyz123',
          }),
        }),
      );
    });

    it('recursively resolves nested action payload structures', () => {
      const context = createRenderContext({
        variables: { domain: 'kubuild.dev', theme: 'dark' },
      });

      const rawPayload = {
        meta: {
          site: 'https://{{ domain }}',
          preferences: [{ key: 'theme', value: { type: 'variable', key: 'theme' } }],
        },
      };

      const resolved = resolveActionPayload(context, rawPayload);

      expect(resolved).toEqual({
        meta: {
          site: 'https://kubuild.dev',
          preferences: [{ key: 'theme', value: 'dark' }],
        },
      });
      // Ensure input was not mutated
      expect(rawPayload.meta.site).toBe('https://{{ domain }}');
    });
  });

  describe('Acceptance Criteria 2: Unknown action is not executed and sends diagnostic', () => {
    it('does not execute unknown action and sends UNKNOWN_ACTION diagnostic to callback', () => {
      const doc = createBlankDocument('Diagnostic Test');
      const targetNode = {
        id: 'btn-unknown',
        type: 'button',
        props: {
          label: 'Do Mystery Action',
          action: {
            type: 'unknown.action.type',
            payload: { reason: 'testing' },
          },
        },
      };
      doc.document.children = [targetNode];

      const diagnostics: ActionDiagnostic[] = [];
      const onDiagnostic = vi.fn((diag: ActionDiagnostic) => {
        diagnostics.push(diag);
      });

      const context = createMinimalRenderContext({
        actions: {},
        onDiagnostic,
      });

      const element = NodeRenderer({
        node: targetNode,
        document: doc,
        registry,
        context,
        onDiagnostic,
      });

      triggerNodeClick(element);

      expect(onDiagnostic).toHaveBeenCalled();
      expect(diagnostics.some((d) => d.code === 'UNKNOWN_ACTION' && d.actionType === 'unknown.action.type')).toBe(
        true,
      );
    });

    it('emits INVALID_ACTION_PAYLOAD diagnostic when action structure is invalid', () => {
      const doc = createBlankDocument('Invalid Action Test');
      const diagnostics: ActionDiagnostic[] = [];
      const onDiagnostic = (d: ActionDiagnostic) => diagnostics.push(d);

      const success = dispatchAction({
        action: { invalid: true },
        nodeId: 'bad-node',
        document: doc,
        onDiagnostic,
      });

      expect(success).toBe(false);
      expect(diagnostics[0]?.code).toBe('INVALID_ACTION_PAYLOAD');
    });
  });

  describe('Acceptance Criteria 3: Disabled buttons and absolute security (no eval/Function/script injection)', () => {
    it('does not dispatch actions when button is disabled', () => {
      const doc = createBlankDocument('Disabled Button Test');
      const targetNode = {
        id: 'btn-disabled',
        type: 'button',
        props: {
          label: 'Disabled Button',
          disabled: true,
          action: { type: 'submit' },
        },
      };
      doc.document.children = [targetNode];

      const submitHandler = vi.fn<ActionHandler>();
      const context = createMinimalRenderContext({
        actions: { submit: submitHandler },
      });

      const element = NodeRenderer({
        node: targetNode,
        document: doc,
        registry,
        context,
      });

      triggerNodeClick(element);

      expect(submitHandler).not.toHaveBeenCalled();
    });

    it('never evaluates malicious javascript strings or functions from document props', () => {
      let evalExecuted = false;
      // @ts-expect-error test malicious function attack surface
      globalThis.__maliciousProbe = () => {
        evalExecuted = true;
      };

      const doc = createBlankDocument('Security Attack Test');
      const targetNode = {
        id: 'btn-attack',
        type: 'button',
        props: {
          label: 'Click Attack',
          action: {
            type: 'javascript:alert(1)',
            payload: {
              payloadCode: 'eval("__maliciousProbe()")',
              func: 'new Function("return 1+1")()',
              script: '<script>window.__maliciousProbe()</script>',
            },
          },
        },
      };
      doc.document.children = [targetNode];

      const diagnostics: ActionDiagnostic[] = [];
      const context = createMinimalRenderContext({
        actions: {},
        onDiagnostic: (d) => diagnostics.push(d),
      });

      const element = NodeRenderer({
        node: targetNode,
        document: doc,
        registry,
        context,
      });

      triggerNodeClick(element);

      expect(evalExecuted).toBe(false);
      expect(diagnostics.some((d) => d.code === 'UNKNOWN_ACTION')).toBe(true);

      // Clean up global probe
      // @ts-expect-error clean test global
      delete globalThis.__maliciousProbe;
    });
  });
});
