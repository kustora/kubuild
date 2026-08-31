import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { ActionPipelineExecutor } from '@kubuild/core';
import type { Node } from '@kubuild/schema';
import { createDefaultComponentRegistry } from '@kubuild/components';
import {
  ComponentErrorBoundary,
  FormRuntimeProvider,
  toastManager,
  executeNodeActions,
  registerDefaultActionRunners,
} from '../src/index';

describe('STORA-325: Error Boundary & Safe Execution Handler', () => {
  const registry = createDefaultComponentRegistry();

  beforeEach(() => {
    toastManager.clearToasts();
    vi.restoreAllMocks();
  });

  describe('API Offline & Network Errors', () => {
    it('handles offline network rejection (TypeError: Failed to fetch) without crashing', async () => {
      const onDiagnosticMock = vi.fn();
      const mockOfflineFetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));

      const executor = new ActionPipelineExecutor();
      registerDefaultActionRunners(executor, {
        apiRequest: { fetchFn: mockOfflineFetch as unknown as typeof fetch },
      });

      const node: Node = {
        id: 'submit_btn',
        type: 'button',
        actions: [
          {
            id: 'offline_pipeline',
            trigger: 'click',
            steps: [
              {
                id: 'api_step',
                type: 'api_request',
                payload: {
                  url: 'https://offline.api.example.com/data',
                  method: 'POST',
                },
              },
            ],
          },
        ],
      };

      const outcome = await executeNodeActions({
        node,
        trigger: 'click',
        executor,
        onDiagnostic: onDiagnosticMock,
      });

      // Verification: Zero unhandled crash, graceful failure outcome
      expect(outcome.executed).toBe(true);
      expect(outcome.success).toBe(false);
      expect(onDiagnosticMock).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'ACTION_EXECUTION_ERROR',
          actionType: 'api_request',
          nodeId: 'submit_btn',
          message: expect.stringContaining('Failed to fetch'),
        }),
      );
    });

    it('handles HTTP 500 internal server error with HTML error page body', async () => {
      const onDiagnosticMock = vi.fn();
      const mock500Fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        headers: new Headers({ 'content-type': 'text/html' }),
        text: async () => '<html><body>500 Internal Server Error</body></html>',
      });

      const executor = new ActionPipelineExecutor();
      registerDefaultActionRunners(executor, {
        apiRequest: { fetchFn: mock500Fetch as unknown as typeof fetch },
      });

      const formNode: Node = {
        id: 'user_form',
        type: 'form',
        actions: [
          {
            id: 'submit_500_pipeline',
            trigger: 'submit',
            steps: [
              {
                id: 'api_500',
                type: 'api_request',
                payload: {
                  url: 'https://api.example.com/checkout',
                  method: 'POST',
                  body: { amount: 100 },
                },
              },
            ],
          },
        ],
      };

      const outcome = await executeNodeActions({
        node: formNode,
        trigger: 'submit',
        executor,
        onDiagnostic: onDiagnosticMock,
      });

      expect(outcome.success).toBe(false);
      expect(onDiagnosticMock).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'ACTION_EXECUTION_ERROR',
          message: expect.stringContaining('500'),
        }),
      );
    });

    it('branches to onError steps when an API request fails', async () => {
      const mock503Fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
        headers: new Headers({ 'content-type': 'application/json' }),
        text: async () => JSON.stringify({ message: 'Service temporarily overloaded' }),
      });

      const executor = new ActionPipelineExecutor();
      registerDefaultActionRunners(executor, {
        apiRequest: { fetchFn: mock503Fetch as unknown as typeof fetch },
      });

      const pipelineNode: Node = {
        id: 'retry_btn',
        type: 'button',
        actions: [
          {
            id: 'branching_pipeline',
            trigger: 'click',
            steps: [
              {
                id: 'api_fail_step',
                type: 'api_request',
                continueOnError: true,
                payload: {
                  url: 'https://api.example.com/data',
                  method: 'GET',
                },
                onError: [
                  {
                    id: 'fallback_toast',
                    type: 'show_toast',
                    payload: {
                      message: 'Service busy, please try again later!',
                      type: 'warning',
                    },
                  },
                ],
              },
            ],
          },
        ],
      };

      const outcome = await executeNodeActions({
        node: pipelineNode,
        trigger: 'click',
        executor,
      });

      expect(outcome.success).toBe(true);
      expect(toastManager.getToasts()).toHaveLength(1);
      expect(toastManager.getToasts()[0].message).toBe('Service busy, please try again later!');
      expect(toastManager.getToasts()[0].type).toBe('warning');
    });
  });

  describe('ComponentErrorBoundary Safe Rendering', () => {
    it('catches render exceptions in runtime mode and renders safe hidden placeholder', () => {
      const onDiagnosticMock = vi.fn();
      const onErrorMock = vi.fn();

      const boundary = new ComponentErrorBoundary({
        nodeId: 'broken_node',
        componentType: 'custom_widget',
        mode: 'runtime',
        onError: onErrorMock,
        onDiagnostic: onDiagnosticMock,
        children: <div>Safe Child</div>,
      });

      const testError = new Error('Explosive runtime render error');
      boundary.state = ComponentErrorBoundary.getDerivedStateFromError(testError);
      boundary.componentDidCatch(testError, { componentStack: '' });

      const rendered = boundary.render();
      const html = renderToString(rendered as React.ReactElement);

      expect(onErrorMock).toHaveBeenCalledWith(testError, expect.any(Object));
      expect(onDiagnosticMock).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'ACTION_EXECUTION_ERROR',
          actionType: 'render',
          nodeId: 'broken_node',
          message: expect.stringContaining('Explosive runtime render error'),
        }),
      );

      // In runtime mode: renders hidden placeholder with data-kubuild-error
      expect(html).toContain('data-kubuild-node="broken_node"');
      expect(html).toContain('data-kubuild-error="custom_widget"');
      expect(html).toContain('style="display:none"');
    });

    it('catches render exceptions in editor mode and renders inline diagnostic alert', () => {
      const boundary = new ComponentErrorBoundary({
        nodeId: 'editor_broken_node',
        componentType: 'complex_chart',
        mode: 'editor',
        children: <div>Safe Child</div>,
      });

      const testError = new Error('Visual editor syntax crash');
      boundary.state = ComponentErrorBoundary.getDerivedStateFromError(testError);

      const rendered = boundary.render();
      const html = renderToString(rendered as React.ReactElement);

      expect(html).toContain('Component Render Error:');
      expect(html).toContain('complex_chart');
      expect(html).toContain('Visual editor syntax crash');
      expect(html).toContain('editor_broken_node');
    });
  });
});
