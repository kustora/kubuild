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
  partitionFilesBySize,
  type FormRuntimeContextValue,
} from '../src/index';

/**
 * STORA-531: switch, file-upload, radio-group, radio-item and button-submit render real
 * controls integrated with the form runtime.
 */
const registry = createDefaultComponentRegistry();
const doc: PageDocument = createBlankDocument('Extended form');

function renderInForm(
  nodes: Node[],
  mode: 'editor' | 'runtime' = 'runtime',
): { html: string; form: FormRuntimeContextValue } {
  let form!: FormRuntimeContextValue;
  const Capture = () => {
    form = useFormRuntime()!;
    return null;
  };
  const html = renderToString(
    <FormRuntimeProvider formId="f">
      <Capture />
      {nodes.map((node) => (
        <NodeRenderer key={node.id} node={node} document={doc} registry={registry} mode={mode} />
      ))}
    </FormRuntimeProvider>,
  );
  return { html, form };
}

describe('STORA-531: switch', () => {
  const switchNode = (props: Record<string, unknown>): Node => ({
    id: 'sw',
    type: 'switch',
    props: { name: 'terms', label: 'Accept terms', value: 'yes', ...props },
    children: [],
  });

  it('renders an accessible switch bound to the field name', () => {
    const { html, form } = renderInForm([switchNode({ defaultChecked: true })]);
    expect(html).toContain('role="switch"');
    expect(html).toContain('data-field="terms"');
    expect(html).toContain('Accept terms');
    expect(html).toContain('data-state="on"');
    expect(form.getFieldBinding('terms')).toBeDefined();
  });

  it('registers `value` when on and false when off; required blocks submit while off', async () => {
    const on = renderInForm([switchNode({ defaultChecked: true, required: true })]);
    expect(await on.form.handleFormSubmit()).toBe(true);

    const off = renderInForm([switchNode({ defaultChecked: false, required: true })]);
    expect(off.form.validateForm()).toHaveProperty('terms');
    expect(await off.form.handleFormSubmit()).toBe(false);
  });
});

describe('STORA-531: radio-group / radio-item', () => {
  const group = (
    props: Record<string, unknown>,
    childType: 'radio' | 'radio-item' = 'radio-item',
  ): Node => ({
    id: 'rg',
    type: 'radio-group',
    props: { name: 'plan', required: true, ...props },
    children: [
      {
        id: 'r1',
        type: childType,
        props: { name: 'stale_name', label: 'Basic', value: 'basic' },
        children: [],
      },
      {
        id: 'r2',
        type: childType,
        props: { name: 'stale_name', label: 'Pro', value: 'pro' },
        children: [],
      },
    ],
  });

  it.each(['radio', 'radio-item'] as const)(
    '%s children use the group name and default selection',
    async (childType) => {
      const { html, form } = renderInForm([group({ defaultSelected: 'pro' }, childType)]);
      expect(html).toContain('role="radiogroup"');
      expect(html).not.toContain('stale_name');
      expect(html.match(/name="plan"/g)?.length).toBe(2);
      expect(form.getFieldBinding('plan')?.required).toBe(true);
      expect(form.getFieldBinding('stale_name')).toBeUndefined();
      expect(await form.handleFormSubmit()).toBe(true);
    },
  );

  it('required group without a selection fails validation', async () => {
    const { form } = renderInForm([group({ defaultSelected: '' })]);
    expect(await form.handleFormSubmit()).toBe(false);
  });

  it('horizontal orientation lays options out in a row', () => {
    const { html } = renderInForm([group({ orientation: 'horizontal' })]);
    expect(html).toContain('flex-direction:row');
  });
});

describe('STORA-531: file-upload', () => {
  const upload = (props: Record<string, unknown>): Node => ({
    id: 'fu',
    type: 'file-upload',
    props: { name: 'cv', label: 'Upload CV', accept: '.pdf', maxFileSize: 2, ...props },
    children: [],
  });

  it('renders a file input with accept/multiple bound to the form', () => {
    const { html, form } = renderInForm([upload({ multiple: true, helperText: 'PDF only' })]);
    expect(html).toContain('type="file"');
    expect(html).toContain('accept=".pdf"');
    expect(html).toContain('multiple');
    expect(html).toContain('PDF only');
    expect(form.getFieldBinding('cv')).toBeDefined();
  });

  it('required upload blocks submit while empty', async () => {
    const { form } = renderInForm([upload({ required: true })]);
    expect(await form.handleFormSubmit()).toBe(false);
  });

  it('does not open the OS picker from the editor canvas', () => {
    const { html } = renderInForm([upload({})], 'editor');
    expect(html).toContain('pointer-events:none');
  });

  it('partitionFilesBySize enforces the MB limit per file', () => {
    const files = [{ size: 1024 * 1024 }, { size: 3 * 1024 * 1024 }];
    const { accepted, rejected } = partitionFilesBySize(files, 2);
    expect(accepted).toEqual([files[0]]);
    expect(rejected).toEqual([files[1]]);
    expect(partitionFilesBySize(files, undefined).rejected).toEqual([]);
  });
});

describe('STORA-531: button-submit', () => {
  const button = (props: Record<string, unknown>): Node => ({
    id: 'bs',
    type: 'button-submit',
    props: {
      label: 'Send',
      loadingText: 'Sending…',
      showSpinner: true,
      autoDisableOnSubmit: true,
      ...props,
    },
    children: [],
  });

  function renderWithSubmitting(node: Node, isSubmitting: boolean): string {
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
      <FormRuntimeContext.Provider value={{ ...base, isSubmitting }}>
        <NodeRenderer node={node} document={doc} registry={registry} mode="runtime" />
      </FormRuntimeContext.Provider>,
    );
  }

  it('idle: shows the label as a submit button', () => {
    const html = renderWithSubmitting(button({}), false);
    expect(html).toContain('type="submit"');
    expect(html).toContain('Send');
    expect(html).not.toContain('Sending…');
    expect(html).not.toContain('disabled');
    expect(html).toContain('data-state="idle"');
  });

  it('submitting: shows loadingText + spinner and auto-disables', () => {
    const html = renderWithSubmitting(button({}), true);
    expect(html).toContain('Sending…');
    expect(html).toContain('data-kubuild-spinner');
    expect(html).toContain('disabled=""');
    expect(html).toContain('aria-busy="true"');
  });

  it('submitting with showSpinner=false and autoDisableOnSubmit=false', () => {
    const html = renderWithSubmitting(
      button({ showSpinner: false, autoDisableOnSubmit: false }),
      true,
    );
    expect(html).toContain('Sending…');
    expect(html).not.toContain('data-kubuild-spinner');
    expect(html).not.toContain('disabled=""');
  });

  it('renders as a plain button in the editor', () => {
    const { html } = renderInForm([button({})], 'editor');
    expect(html).toContain('type="button"');
  });
});
