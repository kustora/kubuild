import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import type { RenderContext } from '@kubuild/core';
import {
  createRenderContext,
  FormRuntimeProvider,
  RenderContextProvider,
  useFormRuntime,
  type FormRuntimeContextValue,
} from '../src/index';

function renderForm(context: RenderContext, onDiagnostic = vi.fn()) {
  let form!: FormRuntimeContextValue;
  const Capture = () => {
    form = useFormRuntime()!;
    return null;
  };
  renderToString(
    <RenderContextProvider value={context}>
      <FormRuntimeProvider
        formId="checkout_form"
        nodeId="node_form"
        initialValues={{ name: 'Ali', email: 'ali@example.com' }}
        onDiagnostic={onDiagnostic}
      >
        <Capture />
      </FormRuntimeProvider>
    </RenderContextProvider>,
  );
  return form;
}

describe('RenderContext.onFormSubmit', () => {
  it('awaits the host hook with the form id, node id and values', async () => {
    let settled = false;
    const onFormSubmit = vi.fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      settled = true;
    });
    const form = renderForm({ onFormSubmit });

    await expect(form.handleFormSubmit()).resolves.toBe(true);

    expect(settled).toBe(true);
    expect(onFormSubmit).toHaveBeenCalledWith(
      { formId: 'checkout_form', nodeId: 'node_form', values: { name: 'Ali', email: 'ali@example.com' } },
      { setErrors: expect.any(Function), resetForm: expect.any(Function) },
    );
  });

  it('fails the submit with a diagnostic when the hook throws', async () => {
    const onDiagnostic = vi.fn();
    const form = renderForm(
      {
        onFormSubmit: () => {
          throw new Error('checkout rejected');
        },
      },
      onDiagnostic,
    );

    await expect(form.handleFormSubmit()).resolves.toBe(false);
    expect(onDiagnostic).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'ACTION_EXECUTION_ERROR', nodeId: 'node_form', message: expect.stringContaining('checkout rejected') }),
    );
  });

  it('submits normally when no hook is provided', async () => {
    const form = renderForm({});
    await expect(form.handleFormSubmit()).resolves.toBe(true);
  });

  it('is kept by createRenderContext', () => {
    const onFormSubmit = vi.fn();
    expect(createRenderContext({ onFormSubmit }).onFormSubmit).toBe(onFormSubmit);
  });
});
