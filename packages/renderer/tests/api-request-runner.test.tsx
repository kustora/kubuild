import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import type { ActionPipeline, ActionStep } from '@kubuild/schema';
import {
  ActionCancellationError,
  ActionPipelineExecutor,
  ActionTimeoutError,
} from '@kubuild/core';
import {
  apiRequestRunner,
  createApiRequestHandler,
  buildApiUrl,
  prepareRequestBody,
  ApiRequestError,
  registerDefaultActionRunners,
  FormRuntimeProvider,
  useFormRuntime,
  type FormRuntimeContextValue,
} from '../src/index';

describe('STORA-321: Built-in Action Runner: api_request', () => {
  describe('buildApiUrl & URL Security', () => {
    it('builds absolute and relative URLs with query parameters correctly', () => {
      const url = buildApiUrl('https://api.example.com/v1/users', {
        page: 2,
        limit: 20,
        filter: 'active status',
      });

      expect(url).toBe(
        'https://api.example.com/v1/users?page=2&limit=20&filter=active+status',
      );
    });

    it('merges query parameters with existing query parameters on URL', () => {
      const url = buildApiUrl('https://api.example.com/search?sort=desc', {
        q: 'kubuild',
        tags: ['web', 'react'],
      });

      expect(url).toBe(
        'https://api.example.com/search?sort=desc&q=kubuild&tags=web&tags=react',
      );
    });

    it('prepends baseUrl when provided for relative URLs', () => {
      const url = buildApiUrl('/api/submit', { formId: 'f1' }, 'https://backend.kustora.dev');
      expect(url).toBe('https://backend.kustora.dev/api/submit?formId=f1');
    });

    it('throws ApiRequestError when URL contains dangerous protocol or script injection', () => {
      expect(() => buildApiUrl('javascript:alert(1)')).toThrow(ApiRequestError);
      expect(() => buildApiUrl('vbscript:msgbox(1)')).toThrow(ApiRequestError);
      expect(() => buildApiUrl('data:text/html;base64,PHNjcmlwdD4=')).toThrow(ApiRequestError);
      expect(() => buildApiUrl('')).toThrow(ApiRequestError);
    });
  });

  describe('prepareRequestBody', () => {
    it('omits body for GET and HEAD requests', () => {
      const getReq = prepareRequestBody('GET', { search: 'test' });
      expect(getReq.body).toBeUndefined();

      const headReq = prepareRequestBody('HEAD', { search: 'test' });
      expect(headReq.body).toBeUndefined();
    });

    it('serializes JSON object and sets application/json header', () => {
      const { body, headers } = prepareRequestBody('POST', { name: 'John Doe', age: 30 });
      expect(body).toBe(JSON.stringify({ name: 'John Doe', age: 30 }));
      expect(headers['Content-Type']).toBe('application/json');
    });

    it('preserves custom JSON headers without duplication', () => {
      const { body, headers } = prepareRequestBody(
        'POST',
        { foo: 'bar' },
        'json',
        { 'content-type': 'application/json; charset=utf-8', 'X-Custom-Header': 'val' },
      );
      expect(body).toBe(JSON.stringify({ foo: 'bar' }));
      expect(headers['content-type']).toBe('application/json; charset=utf-8');
      expect(headers['X-Custom-Header']).toBe('val');
    });

    it('serializes FormData and removes manual multipart/form-data content-type', () => {
      const { body, headers } = prepareRequestBody(
        'POST',
        { title: 'My Document', tags: ['a', 'b'] },
        'form-data',
        { 'Content-Type': 'multipart/form-data' },
      );

      expect(body).toBeInstanceOf(FormData);
      const formData = body as FormData;
      expect(formData.get('title')).toBe('My Document');
      expect(headers['Content-Type']).toBeUndefined();
    });

    it('serializes URL-encoded form data and sets application/x-www-form-urlencoded', () => {
      const { body, headers } = prepareRequestBody(
        'POST',
        { grant_type: 'password', username: 'john@example.com' },
        'urlencoded',
      );

      expect(body).toBeInstanceOf(URLSearchParams);
      expect((body as URLSearchParams).toString()).toBe(
        'grant_type=password&username=john%40example.com',
      );
      expect(headers['Content-Type']).toContain('application/x-www-form-urlencoded');
    });

    it('serializes raw text body and sets text/plain', () => {
      const { body, headers } = prepareRequestBody('POST', 'Raw content text', 'raw');
      expect(body).toBe('Raw content text');
      expect(headers['Content-Type']).toContain('text/plain');
    });
  });

  describe('HTTP Method Executions & Response Parsing', () => {
    it('executes successful GET request with query params and returns ApiRequestResponse', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers({
          'content-type': 'application/json',
          'x-request-id': 'req-12345',
        }),
        text: async () => JSON.stringify({ users: [{ id: 1, name: 'Alice' }] }),
      });

      const runner = createApiRequestHandler({ fetchFn: mockFetch as unknown as typeof fetch });

      const step: ActionStep = {
        id: 'step_fetch_users',
        type: 'api_request',
        payload: {
          url: 'https://api.example.com/v1/users',
          method: 'GET',
          queryParams: { role: 'admin', active: true },
          headers: { Authorization: 'Bearer test_token' },
        },
      };

      const result = await runner(step, {});

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [calledUrl, calledInit] = mockFetch.mock.calls[0];
      expect(calledUrl).toBe('https://api.example.com/v1/users?role=admin&active=true');
      expect(calledInit.method).toBe('GET');
      expect(calledInit.headers.Authorization).toBe('Bearer test_token');
      expect(calledInit.body).toBeUndefined();

      expect(result.ok).toBe(true);
      expect(result.status).toBe(200);
      expect(result.headers['x-request-id']).toBe('req-12345');
      expect(result.data).toEqual({ users: [{ id: 1, name: 'Alice' }] });
      expect(result.body).toEqual({ users: [{ id: 1, name: 'Alice' }] });
    });

    it('executes successful POST request with JSON payload', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        statusText: 'Created',
        headers: new Headers({ 'content-type': 'application/json' }),
        text: async () => JSON.stringify({ id: 'doc_999', created: true }),
      });

      const runner = createApiRequestHandler({ fetchFn: mockFetch as unknown as typeof fetch });

      const step: ActionStep = {
        id: 'step_create_doc',
        type: 'api_request',
        payload: {
          url: 'https://api.example.com/docs',
          method: 'POST',
          body: { title: 'New Document', author: 'John' },
        },
      };

      const result = await runner(step, {});

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [, calledInit] = mockFetch.mock.calls[0];
      expect(calledInit.method).toBe('POST');
      expect(calledInit.headers['Content-Type']).toBe('application/json');
      expect(calledInit.body).toBe(JSON.stringify({ title: 'New Document', author: 'John' }));

      expect(result.status).toBe(201);
      expect(result.data).toEqual({ id: 'doc_999', created: true });
    });

    it('executes PUT request with URL-encoded payload', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'content-type': 'application/json' }),
        text: async () => JSON.stringify({ updated: true }),
      });

      const runner = createApiRequestHandler({ fetchFn: mockFetch as unknown as typeof fetch });

      const step: ActionStep = {
        id: 'step_update_profile',
        type: 'api_request',
        payload: {
          url: 'https://api.example.com/profile',
          method: 'PUT',
          bodyFormat: 'urlencoded',
          body: { nickname: 'Johnny', status: 'away' },
        },
      };

      const result = await runner(step, {});

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [, calledInit] = mockFetch.mock.calls[0];
      expect(calledInit.method).toBe('PUT');
      expect(calledInit.headers['Content-Type']).toContain('application/x-www-form-urlencoded');
      expect(calledInit.body).toBeInstanceOf(URLSearchParams);

      expect(result.status).toBe(200);
      expect(result.data).toEqual({ updated: true });
    });

    it('executes DELETE request', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 204,
        statusText: 'No Content',
        headers: new Headers(),
        text: async () => '',
      });

      const runner = createApiRequestHandler({ fetchFn: mockFetch as unknown as typeof fetch });

      const step: ActionStep = {
        id: 'step_delete_user',
        type: 'api_request',
        payload: {
          url: 'https://api.example.com/users/42',
          method: 'DELETE',
        },
      };

      const result = await runner(step, {});

      expect(result.status).toBe(204);
      expect(result.data).toBeNull();
    });

    it('parses plain text response gracefully when not JSON', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'content-type': 'text/plain' }),
        text: async () => 'pong',
      });

      const runner = createApiRequestHandler({ fetchFn: mockFetch as unknown as typeof fetch });

      const step: ActionStep = {
        id: 'step_ping',
        type: 'api_request',
        payload: { url: 'https://api.example.com/ping' },
      };

      const result = await runner(step, {});
      expect(result.data).toBe('pong');
    });
  });

  describe('Error Handling & HTTP Failure Statuses', () => {
    it('throws ApiRequestError with response details when server returns 400 Bad Request', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        headers: new Headers({ 'content-type': 'application/json' }),
        text: async () =>
          JSON.stringify({ message: 'Invalid email address', errorCode: 'INVALID_EMAIL' }),
      });

      const runner = createApiRequestHandler({ fetchFn: mockFetch as unknown as typeof fetch });

      const step: ActionStep = {
        id: 'step_submit',
        type: 'api_request',
        payload: {
          url: 'https://api.example.com/submit',
          method: 'POST',
          body: { email: 'bad-email' },
        },
      };

      await expect(runner(step, {})).rejects.toThrow(ApiRequestError);

      try {
        await runner(step, {});
      } catch (err) {
        expect(err).toBeInstanceOf(ApiRequestError);
        const apiErr = err as ApiRequestError;
        expect(apiErr.status).toBe(400);
        expect(apiErr.statusText).toBe('Bad Request');
        expect(apiErr.data).toEqual({
          message: 'Invalid email address',
          errorCode: 'INVALID_EMAIL',
        });
        expect(apiErr.message).toContain('Invalid email address');
      }
    });

    it('throws ApiRequestError on 500 Internal Server Error', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        headers: new Headers({ 'content-type': 'text/plain' }),
        text: async () => 'Database crash',
      });

      const runner = createApiRequestHandler({ fetchFn: mockFetch as unknown as typeof fetch });

      const step: ActionStep = {
        id: 'step_server_error',
        type: 'api_request',
        payload: { url: 'https://api.example.com/crash' },
      };

      try {
        await runner(step, {});
        expect.unreachable('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(ApiRequestError);
        const apiErr = err as ApiRequestError;
        expect(apiErr.status).toBe(500);
        expect(apiErr.data).toBe('Database crash');
      }
    });

    it('throws ApiRequestError with isNetworkError when fetch rejects', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch (offline)'));

      const runner = createApiRequestHandler({ fetchFn: mockFetch as unknown as typeof fetch });

      const step: ActionStep = {
        id: 'step_offline',
        type: 'api_request',
        payload: { url: 'https://api.example.com/offline' },
      };

      try {
        await runner(step, {});
        expect.unreachable('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(ApiRequestError);
        const apiErr = err as ApiRequestError;
        expect(apiErr.isNetworkError).toBe(true);
        expect(apiErr.message).toContain('Failed to fetch (offline)');
      }
    });
  });

  describe('Timeouts & Cancellation', () => {
    it('aborts and throws ActionTimeoutError when request exceeds timeout', async () => {
      const mockFetch = vi.fn().mockImplementation((_url, init) => {
        return new Promise((_resolve, reject) => {
          if (init.signal) {
            init.signal.addEventListener('abort', () => {
              const abortErr = new Error('The operation was aborted');
              abortErr.name = 'AbortError';
              reject(abortErr);
            });
          }
        });
      });

      const runner = createApiRequestHandler({ fetchFn: mockFetch as unknown as typeof fetch });

      const step: ActionStep = {
        id: 'step_slow',
        type: 'api_request',
        payload: {
          url: 'https://api.example.com/slow',
          timeout: 50,
        },
      };

      await expect(runner(step, {})).rejects.toThrow(ActionTimeoutError);
    });

    it('aborts and throws ActionCancellationError when parent signal is aborted', async () => {
      const parentController = new AbortController();

      const mockFetch = vi.fn().mockImplementation((_url, init) => {
        return new Promise((_resolve, reject) => {
          if (init.signal) {
            init.signal.addEventListener('abort', () => {
              const abortErr = new Error('The operation was aborted');
              abortErr.name = 'AbortError';
              reject(abortErr);
            });
          }
        });
      });

      const runner = createApiRequestHandler({ fetchFn: mockFetch as unknown as typeof fetch });

      const step: ActionStep = {
        id: 'step_cancelled',
        type: 'api_request',
        payload: { url: 'https://api.example.com/endpoint' },
      };

      const runPromise = runner(step, {}, parentController.signal);
      parentController.abort(new ActionCancellationError('User navigated away'));

      await expect(runPromise).rejects.toThrow(ActionCancellationError);
    });
  });

  describe('Integration with ActionPipelineExecutor & Form Context', () => {
    it('executes API request in ActionPipelineExecutor, maps response to variables, and executes onSuccess branch', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'content-type': 'application/json' }),
        text: async () =>
          JSON.stringify({
            token: 'jwt_abc123',
            user: { id: 'usr_555', email: 'alice@example.com' },
          }),
      });

      const executor = new ActionPipelineExecutor();
      registerDefaultActionRunners(executor, {
        apiRequest: { fetchFn: mockFetch as unknown as typeof fetch },
      });

      const recordedBranchSteps: string[] = [];
      executor.registerHandler('branch_step', (step, context) => {
        recordedBranchSteps.push(`${step.id}:${context.variables?.userEmail}`);
        return { done: true };
      });

      const pipeline: ActionPipeline = {
        id: 'pipeline_login',
        trigger: 'submit',
        steps: [
          {
            id: 'step_api_login',
            type: 'api_request',
            payload: {
              url: 'https://api.example.com/auth/login',
              method: 'POST',
              body: {
                email: '{{form.email}}',
                password: '{{form.password}}',
              },
              responseMapping: {
                authToken: 'response.data.token',
                userEmail: 'response.data.user.email',
              },
            },
            onSuccess: [
              {
                id: 'step_on_success_branch',
                type: 'branch_step',
              },
            ],
          },
        ],
      };

      const result = await executor.execute(pipeline, {
        context: {
          form: { email: 'alice@example.com', password: 'SecretPassword' },
          variables: {},
        },
      });

      expect(result.success).toBe(true);
      expect(result.context.variables?.authToken).toBe('jwt_abc123');
      expect(result.context.variables?.userEmail).toBe('alice@example.com');
      expect(recordedBranchSteps).toEqual(['step_on_success_branch:alice@example.com']);
    });

    it('triggers onError branch when API request fails in ActionPipelineExecutor', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        headers: new Headers({ 'content-type': 'application/json' }),
        text: async () => JSON.stringify({ message: 'Invalid credentials' }),
      });

      const executor = new ActionPipelineExecutor();
      registerDefaultActionRunners(executor, {
        apiRequest: { fetchFn: mockFetch as unknown as typeof fetch },
      });

      const recordedErrors: string[] = [];
      executor.registerHandler('handle_error_step', (step, context) => {
        const err = context.error as ApiRequestError;
        recordedErrors.push(`${step.id}:${err.status}:${err.message}`);
        return { handled: true };
      });

      const pipeline: ActionPipeline = {
        id: 'pipeline_login_fail',
        trigger: 'submit',
        steps: [
          {
            id: 'step_api_login',
            type: 'api_request',
            payload: {
              url: 'https://api.example.com/auth/login',
              method: 'POST',
              body: { email: 'wrong@example.com', password: 'bad' },
            },
            onError: [
              {
                id: 'step_on_error_branch',
                type: 'handle_error_step',
              },
            ],
          },
        ],
      };

      const result = await executor.execute(pipeline, {
        context: { form: {} },
      });

      expect(result.success).toBe(false);
      expect(recordedErrors).toHaveLength(1);
      expect(recordedErrors[0]).toContain('401');
      expect(recordedErrors[0]).toContain('Invalid credentials');
    });

    it('integrates with FormRuntimeProvider on submit action pipeline', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'content-type': 'application/json' }),
        text: async () => JSON.stringify({ success: true, orderId: 'ORD-777' }),
      });

      // Override global fetch for test
      const originalFetch = globalThis.fetch;
      globalThis.fetch = mockFetch as unknown as typeof fetch;

      try {
        const submitPipeline: ActionPipeline = {
          id: 'submit_checkout',
          trigger: 'submit',
          steps: [
            {
              id: 'step_submit_api',
              type: 'api_request',
              payload: {
                url: 'https://api.example.com/checkout',
                method: 'POST',
                body: {
                  customer: '{{form.customerName}}',
                  item: '{{form.item}}',
                },
              },
            },
          ],
        };

        const onSuccessMock = vi.fn();
        let capturedContext!: FormRuntimeContextValue;

        const TestForm = () => {
          capturedContext = useFormRuntime()!;
          return <div>Form Body</div>;
        };

        renderToString(
          <FormRuntimeProvider
            formId="checkout_form"
            initialValues={{ customerName: 'Bruce Wayne', item: 'Batmobile' }}
            actions={[submitPipeline]}
            onSuccess={onSuccessMock}
          >
            <TestForm />
          </FormRuntimeProvider>,
        );

        const submitResult = await capturedContext.handleFormSubmit();

        expect(submitResult).toBe(true);
        expect(mockFetch).toHaveBeenCalledTimes(1);
        const [calledUrl, calledInit] = mockFetch.mock.calls[0];
        expect(calledUrl).toBe('https://api.example.com/checkout');
        expect(calledInit.body).toBe(
          JSON.stringify({ customer: 'Bruce Wayne', item: 'Batmobile' }),
        );
        expect(onSuccessMock).toHaveBeenCalledTimes(1);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });
});
