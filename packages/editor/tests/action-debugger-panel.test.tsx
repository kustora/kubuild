import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { ActionDebuggerPanel } from '../src/action-debugger-panel';
import { useEditorStore } from '../src/store';

import { createBlankDocument } from '@kubuild/core';

describe('Live Form Testing & Action Debugger in Preview Mode (STORA-345)', () => {
  beforeEach(() => {
    useEditorStore.getState().setDocument(createBlankDocument('Test'));
    useEditorStore.getState().clearActionLogs();
    useEditorStore.getState().setLiveFormState(null);
  });

  it('renders live form state with valid status and values', () => {
    const state = {
      formId: 'contact-form',
      values: {
        email: 'dev@kustora.com',
        subscribe: true,
      },
      errors: {},
      touched: { email: true },
      isSubmitting: false,
      isValid: true,
      dirty: true,
    };

    const html = renderToString(<ActionDebuggerPanel formState={state} />);

    expect(html).toContain('LIVE DEBUGGER');
    expect(html).toContain('Form State');
    expect(html).toContain('Action Logs');
    expect(html).toContain('Valid / Ready');
    expect(html).toContain('dev@kustora.com');
    expect(html).toContain('No validation errors');
  });

  it('renders live form state with validation errors and submitting state', () => {
    const state = {
      formId: 'signup-form',
      values: {
        email: 'invalid-email',
      },
      errors: {
        email: 'Must be a valid email format',
        terms: 'Must accept terms',
      },
      touched: { email: true, terms: true },
      isSubmitting: true,
      isValid: false,
      dirty: true,
    };

    const html = renderToString(<ActionDebuggerPanel formState={state} />);

    expect(html).toContain('Submitting...');
    expect(html).toContain('Validation Errors (2)');
    expect(html).toContain('Must be a valid email format');
    expect(html).toContain('Must accept terms');
  });

  it('renders action execution logs correctly', () => {
    useEditorStore.getState().addActionLog({
      actionType: 'api_request',
      trigger: 'submit',
      nodeId: 'submit-btn',
      status: 'success',
      payload: { url: 'https://api.example.com/v1/auth', method: 'POST' },
      output: { token: 'jwt-12345' },
    });

    useEditorStore.getState().addActionLog({
      actionType: 'show_toast',
      trigger: 'click',
      nodeId: 'toast-trigger',
      status: 'error',
      error: 'Network timeout',
    });

    const logs = useEditorStore.getState().actionLogs;
    expect(logs).toHaveLength(2);
    expect(logs[0].actionType).toBe('show_toast');
    expect(logs[0].status).toBe('error');
    expect(logs[0].error).toBe('Network timeout');
    expect(logs[1].actionType).toBe('api_request');
    expect(logs[1].status).toBe('success');

    // Test clearActionLogs
    useEditorStore.getState().clearActionLogs();
    expect(useEditorStore.getState().actionLogs).toHaveLength(0);
  });

  it('manages preview mode and debugger visibility in store', () => {
    const store = useEditorStore.getState();
    expect(store.previewMode).toBe(false);
    expect(store.actionDebuggerOpen).toBe(false);

    store.togglePreviewMode();
    expect(useEditorStore.getState().previewMode).toBe(true);

    store.toggleActionDebugger();
    expect(useEditorStore.getState().actionDebuggerOpen).toBe(true);

    store.setActionDebuggerOpen(false);
    expect(useEditorStore.getState().actionDebuggerOpen).toBe(false);
  });
});
