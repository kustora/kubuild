import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import type { ActionPipeline, ActionStep } from '@kubuild/schema';
import { validateActionStepPayload } from '@kubuild/schema';
import {
  createApiRequestHandler,
  resolveApiRequestBody,
  FormRuntimeProvider,
  useFormRuntime,
  type FormRuntimeContextValue,
} from '../src/index';

function okFetch() {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    statusText: 'OK',
    headers: new Headers({ 'content-type': 'application/json' }),
    text: async () => JSON.stringify({ ok: true }),
  });
}

const step = (payload: Record<string, unknown>): ActionStep => ({
  id: 'step_api',
  type: 'api_request',
  payload: { url: 'https://api.example.com/leads', method: 'POST', ...payload },
});

describe('STORA-532: api_request defaults its body to the form values on submit', () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe('resolveApiRequestBody', () => {
    const form = { email: 'a@b.co', name: 'Ada' };

    it('uses context.form when body is omitted in a submit pipeline', () => {
      expect(resolveApiRequestBody({}, { trigger: 'submit', form })).toEqual(form);
    });

    it('keeps an explicit body', () => {
      expect(resolveApiRequestBody({ body: { x: 1 } }, { trigger: 'submit', form })).toEqual({ x: 1 });
    });

    it('treats body: null as "no body"', () => {
      expect(resolveApiRequestBody({ body: null }, { trigger: 'submit', form })).toBeNull();
    });

    it('does not default outside submit pipelines', () => {
      expect(resolveApiRequestBody({}, { trigger: 'click', form })).toBeUndefined();
      expect(resolveApiRequestBody({}, { form })).toBeUndefined();
    });
  });

  it('schema accepts body: null', () => {
    expect(validateActionStepPayload('api_request', { url: '/x', body: null }).success).toBe(true);
  });

  it.each([
    ['json', (body: unknown) => expect(body).toBe(JSON.stringify({ email: 'a@b.co', plan: 'pro' }))],
    [
      'urlencoded',
      (body: unknown) => expect(String(body)).toBe(new URLSearchParams({ email: 'a@b.co', plan: 'pro' }).toString()),
    ],
    [
      'form-data',
      (body: unknown) => {
        expect(body).toBeInstanceOf(FormData);
        expect((body as FormData).get('email')).toBe('a@b.co');
      },
    ],
  ])('runner sends form values with bodyFormat=%s', async (bodyFormat, assertBody) => {
    const fetchFn = okFetch();
    const runner = createApiRequestHandler({ fetchFn: fetchFn as unknown as typeof fetch });
    await runner(step({ bodyFormat }), { trigger: 'submit', form: { email: 'a@b.co', plan: 'pro' } }, new AbortController().signal);
    assertBody(fetchFn.mock.calls[0][1].body);
  });

  it('runner sends no body for explicit body: null on submit', async () => {
    const fetchFn = okFetch();
    const runner = createApiRequestHandler({ fetchFn: fetchFn as unknown as typeof fetch });
    await runner(step({ body: null }), { trigger: 'submit', form: { email: 'a@b.co' } }, new AbortController().signal);
    expect(fetchFn.mock.calls[0][1].body).toBeUndefined();
  });

  it('submitting a form whose pipeline omits body posts the form fields', async () => {
    const fetchMock = okFetch();
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const pipeline: ActionPipeline = {
      id: 'submit_lead',
      trigger: 'submit',
      steps: [step({ bodyFormat: 'json' })],
    };

    let form!: FormRuntimeContextValue;
    const Capture = () => {
      form = useFormRuntime()!;
      return null;
    };

    renderToString(
      <FormRuntimeProvider formId="lead" initialValues={{ email: 'x@y.z', name: 'Grace' }} actions={[pipeline]}>
        <Capture />
      </FormRuntimeProvider>,
    );

    await expect(form.handleFormSubmit()).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ email: 'x@y.z', name: 'Grace' });
  });
});
