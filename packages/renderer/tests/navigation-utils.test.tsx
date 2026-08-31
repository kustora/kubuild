import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ActionPipeline, ActionStep } from '@kubuild/schema';
import { ActionPipelineExecutor } from '@kubuild/core';
import {
  navigateRunner,
  copyClipboardRunner,
  resetFormRunner,
  copyToClipboard,
  toastManager,
  registerDefaultActionRunners,
} from '../src/index';

describe('STORA-323: Built-in Action Runners: Navigation & Utilities (navigate, copy_clipboard, reset_form)', () => {
  const originalWindow = globalThis.window;
  const originalDocument = globalThis.document;
  const originalNavigator = globalThis.navigator;

  beforeEach(() => {
    toastManager.clearToasts();
    vi.restoreAllMocks();

    const mockLocation = {
      assign: vi.fn(),
      replace: vi.fn(),
      href: '',
      hash: '',
    };

    const mockWindow: any = {
      location: mockLocation,
      open: vi.fn(),
    };

    const mockElements = new Map<string, any>();

    const mockDocument: any = {
      body: {
        appendChild: vi.fn(),
        removeChild: vi.fn(),
      },
      createElement: vi.fn((tag: string) => {
        const el: any = {
          tagName: tag.toUpperCase(),
          style: {},
          setAttribute: vi.fn(),
          focus: vi.fn(),
          select: vi.fn(),
          scrollIntoView: vi.fn(),
          reset: vi.fn(),
        };
        return el;
      }),
      getElementById: vi.fn((id: string) => mockElements.get(id) || null),
      querySelector: vi.fn((selector: string) => {
        if (selector.startsWith('#')) {
          return mockElements.get(selector.slice(1)) || null;
        }
        return null;
      }),
      execCommand: vi.fn().mockReturnValue(true),
      _mockElements: mockElements,
    };

    const mockClipboard = {
      writeText: vi.fn().mockResolvedValue(undefined),
    };

    const mockNavigator: any = {
      clipboard: mockClipboard,
    };

    globalThis.window = mockWindow;
    globalThis.document = mockDocument;
    globalThis.navigator = mockNavigator;
  });

  afterEach(() => {
    globalThis.window = originalWindow;
    globalThis.document = originalDocument;
    globalThis.navigator = originalNavigator;
  });

  describe('copyToClipboard helper', () => {
    it('uses navigator.clipboard.writeText when available', async () => {
      const writeTextMock = vi.fn().mockResolvedValue(undefined);
      globalThis.navigator = {
        clipboard: { writeText: writeTextMock },
      } as any;

      const success = await copyToClipboard('Hello World');

      expect(success).toBe(true);
      expect(writeTextMock).toHaveBeenCalledWith('Hello World');
    });

    it('falls back to document.execCommand when navigator.clipboard fails', async () => {
      globalThis.navigator = {
        clipboard: {
          writeText: vi.fn().mockRejectedValue(new Error('Permission denied')),
        },
      } as any;

      const execCommandMock = vi.fn().mockReturnValue(true);
      globalThis.document.execCommand = execCommandMock;

      const success = await copyToClipboard('Fallback text');

      expect(success).toBe(true);
      expect(execCommandMock).toHaveBeenCalledWith('copy');
    });

    it('uses custom copyFn when provided in options', async () => {
      const customCopy = vi.fn().mockResolvedValue(undefined);
      const success = await copyToClipboard('Custom copy', { copyFn: customCopy });

      expect(success).toBe(true);
      expect(customCopy).toHaveBeenCalledWith('Custom copy');
    });
  });

  describe('navigateRunner', () => {
    it('executes external URL navigation in current window', () => {
      const assignMock = vi.fn();
      globalThis.window.location.assign = assignMock;

      const step: ActionStep = {
        id: 'step_nav',
        type: 'navigate',
        payload: {
          url: 'https://kustora.dev/docs',
          target: '_self',
        },
      };

      const result = navigateRunner(step, {});

      expect(result).toMatchObject({
        url: 'https://kustora.dev/docs',
        target: '_self',
        navigated: true,
        isAnchor: false,
      });
      expect(assignMock).toHaveBeenCalledWith('https://kustora.dev/docs');
    });

    it('executes URL replacement with replace: true', () => {
      const replaceMock = vi.fn();
      globalThis.window.location.replace = replaceMock;

      const step: ActionStep = {
        id: 'step_nav_replace',
        type: 'navigate',
        payload: {
          url: '/dashboard',
          replace: true,
        },
      };

      const result = navigateRunner(step, {});

      expect(result.replace).toBe(true);
      expect(replaceMock).toHaveBeenCalledWith('/dashboard');
    });

    it('opens new tab when target is _blank', () => {
      const openMock = vi.fn();
      globalThis.window.open = openMock;

      const step: ActionStep = {
        id: 'step_nav_blank',
        type: 'navigate',
        payload: {
          url: 'https://github.com/kustora/kubuild',
          target: '_blank',
        },
      };

      const result = navigateRunner(step, {});

      expect(result.target).toBe('_blank');
      expect(openMock).toHaveBeenCalledWith(
        'https://github.com/kustora/kubuild',
        '_blank',
        'noopener,noreferrer',
      );
    });

    it('handles smooth scroll anchor navigation (#id)', () => {
      const scrollIntoViewMock = vi.fn();
      const mockElement = {
        id: 'pricing',
        scrollIntoView: scrollIntoViewMock,
      };
      (globalThis.document as any)._mockElements.set('pricing', mockElement);

      const step: ActionStep = {
        id: 'step_nav_anchor',
        type: 'navigate',
        payload: {
          url: '#pricing',
          behavior: 'smooth',
        },
      };

      const result = navigateRunner(step, {});

      expect(result.isAnchor).toBe(true);
      expect(scrollIntoViewMock).toHaveBeenCalledWith({
        behavior: 'smooth',
        block: 'start',
      });
      expect(globalThis.window.location.hash).toBe('#pricing');
    });

    it('delegates to context.onNavigate / context.navigateFn when provided for SPA router integration', () => {
      const onNavigateMock = vi.fn();

      const step: ActionStep = {
        id: 'step_spa_nav',
        type: 'navigate',
        payload: {
          url: '/products/123',
          scroll: true,
        },
      };

      const result = navigateRunner(step, {
        onNavigate: onNavigateMock,
      });

      expect(result.navigated).toBe(true);
      expect(onNavigateMock).toHaveBeenCalledWith(
        '/products/123',
        expect.objectContaining({ target: '_self' }),
      );
    });

    it('throws error when navigation URL is empty or unsafe', () => {
      expect(() =>
        navigateRunner({ id: 'step_empty', type: 'navigate', payload: { url: '' } }, {}),
      ).toThrow('Navigation URL cannot be empty');

      expect(() =>
        navigateRunner(
          { id: 'step_unsafe', type: 'navigate', payload: { url: 'javascript:alert(1)' } },
          {},
        ),
      ).toThrow('Disallowed or unsafe protocol');
    });
  });

  describe('copyClipboardRunner', () => {
    it('copies text and triggers success toast when notify is true', async () => {
      const writeTextMock = vi.fn().mockResolvedValue(undefined);
      globalThis.navigator.clipboard.writeText = writeTextMock;

      const step: ActionStep = {
        id: 'step_copy',
        type: 'copy_clipboard',
        payload: {
          text: 'Promo Code: SUMMER2026',
          notify: true,
          toastMessage: 'Promo code copied!',
        },
      };

      const result = await copyClipboardRunner(step, {});

      expect(result.copied).toBe(true);
      expect(result.text).toBe('Promo Code: SUMMER2026');
      expect(writeTextMock).toHaveBeenCalledWith('Promo Code: SUMMER2026');

      expect(toastManager.getToasts()).toHaveLength(1);
      expect(toastManager.getToasts()[0].message).toBe('Promo code copied!');
      expect(toastManager.getToasts()[0].type).toBe('success');
    });

    it('serializes objects/variables passed as value', async () => {
      const writeTextMock = vi.fn().mockResolvedValue(undefined);
      globalThis.navigator.clipboard.writeText = writeTextMock;

      const step: ActionStep = {
        id: 'step_copy_json',
        type: 'copy_clipboard',
        payload: {
          value: { token: 'jwt_secret', id: 42 },
          notify: false,
        },
      };

      const result = await copyClipboardRunner(step, {});

      expect(result.text).toBe(JSON.stringify({ token: 'jwt_secret', id: 42 }));
      expect(toastManager.getToasts()).toHaveLength(0);
    });
  });

  describe('resetFormRunner', () => {
    it('invokes context.resetForm callback and clears context.form state', () => {
      const resetFormMock = vi.fn();
      const contextForm = {
        username: 'john_doe',
        email: 'john@example.com',
      };

      const step: ActionStep = {
        id: 'step_reset',
        type: 'reset_form',
        payload: { formId: 'contact_form' },
      };

      const result = resetFormRunner(step, {
        formId: 'contact_form',
        form: contextForm,
        resetForm: resetFormMock,
      });

      expect(result.reset).toBe(true);
      expect(resetFormMock).toHaveBeenCalledTimes(1);
      expect(contextForm.username).toBe('');
      expect(contextForm.email).toBe('');
    });

    it('resets DOM form element when present in DOM', () => {
      const resetMock = vi.fn();
      const mockForm = {
        id: 'my_target_form',
        reset: resetMock,
      };
      (globalThis.document as any)._mockElements.set('my_target_form', mockForm);

      const step: ActionStep = {
        id: 'step_reset_dom',
        type: 'reset_form',
        payload: { formId: 'my_target_form' },
      };

      resetFormRunner(step, {});

      expect(resetMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('ActionPipelineExecutor Integration with Navigation & Utilities', () => {
    it('runs multi-step pipeline: API auth -> Copy token -> Toast -> Navigate -> Reset form', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'content-type': 'application/json' }),
        text: async () =>
          JSON.stringify({
            accessToken: 'tok_live_998877',
            redirectUrl: '/dashboard/home',
          }),
      });

      const writeTextMock = vi.fn().mockResolvedValue(undefined);
      globalThis.navigator.clipboard.writeText = writeTextMock;

      const onNavigateMock = vi.fn();
      const resetFormMock = vi.fn();

      const executor = new ActionPipelineExecutor();
      registerDefaultActionRunners(executor, {
        apiRequest: { fetchFn: mockFetch as unknown as typeof fetch },
      });

      const pipeline: ActionPipeline = {
        id: 'auth_workflow_pipeline',
        trigger: 'submit',
        steps: [
          // 1. API authentication
          {
            id: 'step_api',
            type: 'api_request',
            payload: {
              url: 'https://api.example.com/login',
              method: 'POST',
              body: { email: '{{form.email}}' },
              responseMapping: {
                token: 'response.data.accessToken',
                targetRoute: 'response.data.redirectUrl',
              },
            },
          },
          // 2. Copy access token to clipboard
          {
            id: 'step_copy',
            type: 'copy_clipboard',
            payload: {
              text: '{{variables.token}}',
              notify: true,
              toastMessage: 'Access token copied to clipboard!',
            },
          },
          // 3. Navigate to target dashboard
          {
            id: 'step_navigate',
            type: 'navigate',
            payload: {
              url: '{{variables.targetRoute}}',
              replace: true,
            },
          },
          // 4. Reset form inputs
          {
            id: 'step_reset',
            type: 'reset_form',
          },
        ],
      };

      const result = await executor.execute(pipeline, {
        context: {
          form: { email: 'agent@kubuild.dev' },
          onNavigate: onNavigateMock,
          resetForm: resetFormMock,
        },
      });

      expect(result.success).toBe(true);
      expect(result.stepResults).toHaveLength(4);

      // Verify token copied
      expect(writeTextMock).toHaveBeenCalledWith('tok_live_998877');

      // Verify toast
      expect(toastManager.getToasts()).toHaveLength(1);
      expect(toastManager.getToasts()[0].message).toBe('Access token copied to clipboard!');

      // Verify SPA navigation
      expect(onNavigateMock).toHaveBeenCalledWith('/dashboard/home', expect.objectContaining({ replace: true }));

      // Verify form reset
      expect(resetFormMock).toHaveBeenCalledTimes(1);
    });
  });
});

