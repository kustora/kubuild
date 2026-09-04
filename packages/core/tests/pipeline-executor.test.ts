import { describe, expect, it, vi } from 'vitest';
import type { ActionPipeline, ActionStep } from '@kubuild/schema';
import {
  ActionCancellationError,
  ActionPipelineExecutor,
  ActionTimeoutError,
  evaluateActionCondition,
  executeActionPipeline,
} from '../src/runtime/pipeline-executor';

describe('STORA-312: Action Pipeline Execution Engine (ActionPipelineExecutor)', () => {
  describe('evaluateActionCondition', () => {
    it('returns true if condition is undefined or empty', () => {
      expect(evaluateActionCondition(undefined, {})).toBe(true);
      expect(evaluateActionCondition({ field: '', operator: 'equals', value: '123' }, {})).toBe(true);
    });

    it('evaluates equality and inequality operators correctly', () => {
      const context = {
        form: { email: 'user@example.com', role: 'admin', age: 30 },
        response: { status: 200, success: true },
      };

      expect(
        evaluateActionCondition({ field: 'form.role', operator: 'equals', value: 'admin' }, context),
      ).toBe(true);
      expect(
        evaluateActionCondition({ field: '{{form.role}}', operator: 'equals', value: 'admin' }, context),
      ).toBe(true);
      expect(
        evaluateActionCondition({ field: 'form.role', operator: 'equals', value: 'guest' }, context),
      ).toBe(false);

      expect(
        evaluateActionCondition({ field: 'form.role', operator: 'not_equals', value: 'guest' }, context),
      ).toBe(true);
      expect(
        evaluateActionCondition({ field: 'form.role', operator: 'not_equals', value: 'admin' }, context),
      ).toBe(false);
    });

    it('evaluates truthiness and falsiness operators correctly', () => {
      const context = {
        form: { agreeTerms: true, newsletter: false, emptyStr: '', nullVal: null },
      };

      expect(
        evaluateActionCondition({ field: 'form.agreeTerms', operator: 'is_truthy' }, context),
      ).toBe(true);
      expect(
        evaluateActionCondition({ field: 'form.newsletter', operator: 'is_truthy' }, context),
      ).toBe(false);
      expect(
        evaluateActionCondition({ field: 'form.emptyStr', operator: 'is_truthy' }, context),
      ).toBe(false);
      expect(
        evaluateActionCondition({ field: 'form.nullVal', operator: 'is_truthy' }, context),
      ).toBe(false);

      expect(
        evaluateActionCondition({ field: 'form.newsletter', operator: 'is_falsy' }, context),
      ).toBe(true);
      expect(
        evaluateActionCondition({ field: 'form.agreeTerms', operator: 'is_falsy' }, context),
      ).toBe(false);
    });

    it('evaluates contains and not_contains operators for string, array, and object', () => {
      const context = {
        form: { tags: ['tech', 'news'], domain: 'example.com', meta: { hasAccess: true } },
      };

      expect(
        evaluateActionCondition({ field: 'form.domain', operator: 'contains', value: 'example' }, context),
      ).toBe(true);
      expect(
        evaluateActionCondition({ field: 'form.domain', operator: 'contains', value: 'google' }, context),
      ).toBe(false);

      expect(
        evaluateActionCondition({ field: 'form.tags', operator: 'contains', value: 'tech' }, context),
      ).toBe(true);
      expect(
        evaluateActionCondition({ field: 'form.tags', operator: 'contains', value: 'finance' }, context),
      ).toBe(false);

      expect(
        evaluateActionCondition({ field: 'form.domain', operator: 'not_contains', value: 'google' }, context),
      ).toBe(true);
      expect(
        evaluateActionCondition({ field: 'form.tags', operator: 'not_contains', value: 'crypto' }, context),
      ).toBe(true);
    });

    it('evaluates numeric comparisons (gt, gte, lt, lte)', () => {
      const context = { form: { count: 10, total: 25.5 } };

      expect(evaluateActionCondition({ field: 'form.count', operator: 'gt', value: 5 }, context)).toBe(true);
      expect(evaluateActionCondition({ field: 'form.count', operator: 'gt', value: 10 }, context)).toBe(false);
      expect(evaluateActionCondition({ field: 'form.count', operator: 'gte', value: 10 }, context)).toBe(true);

      expect(evaluateActionCondition({ field: 'form.total', operator: 'lt', value: 30 }, context)).toBe(true);
      expect(evaluateActionCondition({ field: 'form.total', operator: 'lt', value: 20 }, context)).toBe(false);
      expect(evaluateActionCondition({ field: 'form.total', operator: 'lte', value: 25.5 }, context)).toBe(true);
    });

    it('evaluates regex patterns correctly', () => {
      const context = { form: { email: 'john.doe@company.org' } };

      expect(
        evaluateActionCondition({ field: 'form.email', operator: 'regex', value: '^[a-z.]+@company\\.org$' }, context),
      ).toBe(true);
      expect(
        evaluateActionCondition({ field: 'form.email', operator: 'regex', value: '@gmail\\.com$' }, context),
      ).toBe(false);
    });
  });

  describe('Sequential Execution & Context Passing', () => {
    it('executes steps in sequential order and passes response context from step 1 to step 2', async () => {
      const executionOrder: string[] = [];
      const executor = new ActionPipelineExecutor();

      executor.registerHandler('api_request', async (step) => {
        executionOrder.push(step.id);
        return {
          status: 200,
          data: { userId: 'usr_123', token: 'jwt_abc' },
        };
      });

      executor.registerHandler('show_toast', async (step) => {
        executionOrder.push(step.id);
        return {
          displayedMessage: step.payload?.message,
        };
      });

      executor.registerHandler('navigate', async (step) => {
        executionOrder.push(step.id);
        return {
          navigatedTo: step.payload?.url,
        };
      });

      const pipeline: ActionPipeline = {
        id: 'pipe_login',
        trigger: 'submit',
        steps: [
          {
            id: 'step_api',
            type: 'api_request',
            payload: {
              url: 'https://api.example.com/login',
              method: 'POST',
              body: { email: '{{form.email}}' },
              responseMapping: {
                userToken: 'response.data.token',
                currentUserId: 'response.data.userId',
              },
            },
          },
          {
            id: 'step_toast',
            type: 'show_toast',
            payload: {
              message: 'Welcome back! Your ID is {{response.data.userId}} and token is {{variables.userToken}}',
            },
          },
          {
            id: 'step_nav',
            type: 'navigate',
            payload: {
              url: 'https://app.example.com/dashboard?token={{variables.userToken}}',
            },
          },
        ],
      };

      const result = await executor.execute(pipeline, {
        context: {
          form: { email: 'alice@example.com' },
          variables: {},
        },
      });

      expect(result.success).toBe(true);
      expect(result.status).toBe('completed');
      expect(executionOrder).toEqual(['step_api', 'step_toast', 'step_nav']);
      expect(result.stepResults.length).toBe(3);

      // Verify response context was updated and passed downstream
      expect(result.stepResults[0].status).toBe('success');
      expect(result.stepResults[0].data).toEqual({
        status: 200,
        data: { userId: 'usr_123', token: 'jwt_abc' },
      });

      // Verify responseMapping updated variables
      expect(result.context.variables?.userToken).toBe('jwt_abc');
      expect(result.context.variables?.currentUserId).toBe('usr_123');

      // Verify toast received interpolated message from previous step response
      expect(result.stepResults[1].data).toEqual({
        displayedMessage: 'Welcome back! Your ID is usr_123 and token is jwt_abc',
      });

      // Verify navigate received interpolated URL
      expect(result.stepResults[2].data).toEqual({
        navigatedTo: 'https://app.example.com/dashboard?token=jwt_abc',
      });
    });

    it('skips disabled pipeline', async () => {
      const handler = vi.fn();
      const executor = new ActionPipelineExecutor();
      executor.registerHandler('show_toast', handler);

      const pipeline: ActionPipeline = {
        id: 'disabled_pipe',
        trigger: 'click',
        enabled: false,
        steps: [{ id: 's1', type: 'show_toast', payload: { message: 'hi' } }],
      };

      const result = await executor.execute(pipeline);
      expect(result.success).toBe(true);
      expect(result.stepResults.length).toBe(0);
      expect(handler).not.toHaveBeenCalled();
    });

    it('skips steps whose condition evaluates to false', async () => {
      const executor = new ActionPipelineExecutor();
      const executedSteps: string[] = [];

      executor.registerHandler('show_toast', async (step) => {
        executedSteps.push(step.id);
        return { msg: step.payload?.message };
      });

      const pipeline: ActionPipeline = {
        id: 'pipe_conditional',
        trigger: 'click',
        steps: [
          {
            id: 'step_1',
            type: 'show_toast',
            condition: { field: 'form.isAdmin', operator: 'equals', value: true },
            payload: { message: 'Admin alert' },
          },
          {
            id: 'step_2',
            type: 'show_toast',
            condition: { field: 'form.isAdmin', operator: 'equals', value: false },
            payload: { message: 'User alert' },
          },
        ],
      };

      const result = await executor.execute(pipeline, {
        context: { form: { isAdmin: false } },
      });

      expect(result.success).toBe(true);
      expect(executedSteps).toEqual(['step_2']);
      expect(result.stepResults[0].status).toBe('skipped');
      expect(result.stepResults[1].status).toBe('success');
    });
  });

  describe('Branching: onSuccess and onError', () => {
    it('executes onSuccess branch sub-steps when step succeeds', async () => {
      const executed: string[] = [];
      const executor = new ActionPipelineExecutor();

      executor.registerHandler('api_request', async (step) => {
        executed.push(step.id);
        return { success: true, orderId: 'ord_999' };
      });

      executor.registerHandler('show_toast', async (step) => {
        executed.push(step.id);
      });

      executor.registerHandler('navigate', async (step) => {
        executed.push(step.id);
        return { url: step.payload?.url };
      });

      const pipeline: ActionPipeline = {
        id: 'pipe_checkout',
        trigger: 'submit',
        steps: [
          {
            id: 'checkout_step',
            type: 'api_request',
            payload: { url: '/api/checkout' },
            onSuccess: [
              {
                id: 'success_toast',
                type: 'show_toast',
                payload: { message: 'Order {{response.orderId}} confirmed!' },
              },
              {
                id: 'success_redirect',
                type: 'navigate',
                payload: { url: '/orders/{{response.orderId}}' },
              },
            ],
            onError: [
              {
                id: 'error_toast',
                type: 'show_toast',
                payload: { message: 'Payment failed' },
              },
            ],
          },
        ],
      };

      const result = await executor.execute(pipeline);

      expect(result.success).toBe(true);
      expect(executed).toEqual(['checkout_step', 'success_toast', 'success_redirect']);
      expect(result.stepResults[0].subResults?.length).toBe(2);
      expect(result.stepResults[0].subResults?.[0].status).toBe('success');
      expect(result.stepResults[0].subResults?.[1].status).toBe('success');
      expect(result.stepResults[0].subResults?.[1].data).toEqual({
        url: '/orders/ord_999',
      });
    });

    it('triggers onError branch sub-steps when step throws an error', async () => {
      const executed: string[] = [];
      const executor = new ActionPipelineExecutor();

      executor.registerHandler('api_request', async (step) => {
        executed.push(step.id);
        throw new Error('500 Internal Server Error');
      });

      executor.registerHandler('show_toast', async (step) => {
        executed.push(step.id);
        return { msg: step.payload?.message };
      });

      executor.registerHandler('navigate', async (step) => {
        executed.push(step.id);
        return { url: step.payload?.url };
      });

      const pipeline: ActionPipeline = {
        id: 'pipe_failing_checkout',
        trigger: 'submit',
        steps: [
          {
            id: 'checkout_step',
            type: 'api_request',
            payload: { url: '/api/checkout' },
            onSuccess: [
              {
                id: 'success_toast',
                type: 'show_toast',
                payload: { message: 'Success' },
              },
            ],
            onError: [
              {
                id: 'error_toast',
                type: 'show_toast',
                payload: { message: 'Checkout error: {{error.message}}' },
              },
            ],
          },
          {
            id: 'after_step',
            type: 'navigate',
            payload: { url: '/never-reached' },
          },
        ],
      };

      const result = await executor.execute(pipeline);

      expect(result.success).toBe(false);
      expect(result.status).toBe('failed');
      expect(executed).toEqual(['checkout_step', 'error_toast']);
      expect(result.stepResults[0].status).toBe('error');
      expect(result.stepResults[0].subResults?.length).toBe(1);
      expect(result.stepResults[0].subResults?.[0].status).toBe('success');
      expect(result.stepResults[0].subResults?.[0].data).toEqual({
        msg: 'Checkout error: 500 Internal Server Error',
      });
      // Second step in pipeline sequence should not have been reached
      expect(executed).not.toContain('after_step');
    });

    it('continues to next step if continueOnError is true even after error branch runs', async () => {
      const executed: string[] = [];
      const executor = new ActionPipelineExecutor();

      executor.registerHandler('api_request', async (step) => {
        executed.push(step.id);
        throw new Error('Analytics ping failed');
      });

      executor.registerHandler('show_toast', async (step) => {
        executed.push(step.id);
        return { msg: step.payload?.message };
      });

      const pipeline: ActionPipeline = {
        id: 'pipe_non_fatal',
        trigger: 'click',
        steps: [
          {
            id: 'ping_step',
            type: 'api_request',
            continueOnError: true,
            onError: [
              {
                id: 'log_error',
                type: 'show_toast',
                payload: { message: 'Non-fatal log' },
              },
            ],
          },
          {
            id: 'main_step',
            type: 'show_toast',
            payload: { message: 'Completed' },
          },
        ],
      };

      const result = await executor.execute(pipeline);

      expect(result.success).toBe(true);
      expect(executed).toEqual(['ping_step', 'log_error', 'main_step']);
    });
  });

  describe('Timeouts & Cancellation', () => {
    it('times out an individual step when its timeout is exceeded', async () => {
      const executor = new ActionPipelineExecutor();

      executor.registerHandler('api_request', async (_step, _context, signal) => {
        return new Promise((resolve, reject) => {
          const timer = setTimeout(() => resolve({ ok: true }), 100);
          signal.addEventListener('abort', () => {
            clearTimeout(timer);
            reject(signal.reason);
          });
        });
      });

      const pipeline: ActionPipeline = {
        id: 'pipe_timeout_step',
        trigger: 'submit',
        steps: [
          {
            id: 'slow_step',
            type: 'api_request',
            timeout: 20, // 20ms timeout
          },
        ],
      };

      const result = await executor.execute(pipeline);

      expect(result.success).toBe(false);
      expect(result.status).toBe('failed');
      expect(result.stepResults[0].status).toBe('cancelled');
      expect(result.stepResults[0].error).toBeInstanceOf(ActionTimeoutError);
    });

    it('cancels remaining steps when pipeline signal is aborted externally', async () => {
      const controller = new AbortController();
      const executor = new ActionPipelineExecutor();
      const executed: string[] = [];

      executor.registerHandler('show_toast', async (step) => {
        executed.push(step.id);
        if (step.id === 'step_1') {
          controller.abort();
        }
        return { ok: true };
      });

      const pipeline: ActionPipeline = {
        id: 'pipe_abort',
        trigger: 'click',
        steps: [
          { id: 'step_1', type: 'show_toast' },
          { id: 'step_2', type: 'show_toast' },
        ],
      };

      const result = await executor.execute(pipeline, {
        signal: controller.signal,
      });

      expect(result.success).toBe(false);
      expect(result.status).toBe('cancelled');
      expect(executed).toEqual(['step_1']);
      expect(result.stepResults[1].status).toBe('cancelled');
      expect(result.stepResults[1].error).toBeInstanceOf(ActionCancellationError);
    });
  });

  describe('Built-in Step Handlers (set_state, reset_form)', () => {
    it('executes set_state to modify context state and variables', async () => {
      const pipeline: ActionPipeline = {
        id: 'pipe_state',
        trigger: 'click',
        steps: [
          {
            id: 'set_auth',
            type: 'set_state',
            payload: { key: 'isLoggedIn', value: true, scope: 'runtime' },
          },
          {
            id: 'set_theme',
            type: 'set_state',
            payload: { key: 'theme', value: 'dark', scope: 'local' },
          },
        ],
      };

      const result = await executeActionPipeline(pipeline);

      expect(result.success).toBe(true);
      expect(result.context.state?.isLoggedIn).toBe(true);
      expect(result.context.variables?.isLoggedIn).toBe(true);
      expect(result.context.state?.theme).toBe('dark');
    });

    it('executes reset_form to clear all form fields', async () => {
      const pipeline: ActionPipeline = {
        id: 'pipe_reset',
        trigger: 'click',
        steps: [{ id: 'reset_step', type: 'reset_form' }],
      };

      const result = await executeActionPipeline(pipeline, {
        context: {
          form: {
            name: 'John',
            email: 'john@example.com',
            message: 'Hello world',
          },
        },
      });

      expect(result.success).toBe(true);
      expect(result.context.form).toEqual({
        name: '',
        email: '',
        message: '',
      });
    });
  });

  describe('Lifecycle Hooks & Throw on Error', () => {
    it('triggers onStepStart and onStepComplete lifecycle callbacks', async () => {
      const startSpy = vi.fn();
      const completeSpy = vi.fn();

      const executor = new ActionPipelineExecutor();
      executor.registerHandler('custom_event', async (step) => ({ fired: step.id }));

      const pipeline: ActionPipeline = {
        id: 'pipe_lifecycle',
        trigger: 'load',
        steps: [{ id: 'evt_1', type: 'custom_event' }],
      };

      const result = await executor.execute(pipeline, {
        onStepStart: startSpy,
        onStepComplete: completeSpy,
      });

      expect(result.success).toBe(true);
      expect(startSpy).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'evt_1' }),
        expect.any(Object),
      );
      expect(completeSpy).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'evt_1' }),
        expect.objectContaining({ status: 'success' }),
        expect.any(Object),
      );
    });

    it('throws error when throwOnError is true on failure', async () => {
      const executor = new ActionPipelineExecutor({ throwOnError: true });
      executor.registerHandler('api_request', async () => {
        throw new Error('Network offline');
      });

      const pipeline: ActionPipeline = {
        id: 'failing_pipe',
        trigger: 'submit',
        steps: [{ id: 'step_fail', type: 'api_request' }],
      };

      await expect(executor.execute(pipeline)).rejects.toThrow('Network offline');
    });

    it('fails when an unknown step type has no registered handler', async () => {
      const executor = new ActionPipelineExecutor();

      const pipeline: ActionPipeline = {
        id: 'unknown_step_pipe',
        trigger: 'click',
        steps: [{ id: 'unk_1', type: 'custom_script' as any }],
      };

      const result = await executor.execute(pipeline);
      expect(result.success).toBe(false);
      expect(result.stepResults[0].status).toBe('error');
      expect((result.stepResults[0].error as Error).message).toContain(
        'No handler registered for action step type: "custom_script"',
      );
    });
  });
});
