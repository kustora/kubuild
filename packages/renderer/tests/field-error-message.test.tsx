import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import type { Node, PageDocument } from '@kubuild/schema';
import { createBlankDocument } from '@kubuild/core';
import { createDefaultComponentRegistry } from '@kubuild/components';
import {
  NodeRenderer,
  FormRuntimeProvider,
  FormRuntimeContext,
  useFormRuntime,
  type FormRuntimeContextValue,
} from '../src/index';

const registry = createDefaultComponentRegistry();
const doc: PageDocument = createBlankDocument('Field errors');

function renderField(node: Node, state: { errors: Record<string, string>; touched: Record<string, boolean> }): string {
  let base!: FormRuntimeContextValue;
  const Capture = () => {
    base = useFormRuntime()!;
    return null;
  };
  renderToString(
    <FormRuntimeProvider formId="f">
      <Capture />
    </FormRuntimeProvider>,
  );
  return renderToString(
    <FormRuntimeContext.Provider value={{ ...base, ...state }}>
      <NodeRenderer node={node} document={doc} registry={registry} mode="runtime" />
    </FormRuntimeContext.Provider>,
  );
}

const fields: [string, Node][] = [
  ['input', { id: 'email', type: 'input', props: { name: 'email', type: 'email' } }],
  ['textarea', { id: 'address', type: 'textarea', props: { name: 'email' } }],
  ['select', { id: 'plan', type: 'select', props: { name: 'email', options: [{ label: 'A', value: 'a' }] } }],
];

describe.each(fields)('%s field error message', (_kind, node) => {
  it('shows the error the aria-errormessage points at once the field is touched', () => {
    const html = renderField(node, { errors: { email: 'Please enter a valid email.' }, touched: { email: true } });

    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain(`aria-errormessage="${node.id}-error"`);
    expect(html).toMatch(new RegExp(`<span id="${node.id}-error" role="alert"[^>]*>Please enter a valid email.</span>`));
  });

  it('shows nothing and points at nothing before the field is touched', () => {
    const html = renderField(node, { errors: { email: 'Please enter a valid email.' }, touched: {} });

    expect(html).not.toContain('aria-errormessage');
    expect(html).not.toContain('data-kubuild-field-error');
  });
});
