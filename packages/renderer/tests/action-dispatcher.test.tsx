import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { createBlankDocument } from '@kubuild/core';
import type { PageDocument, Node } from '@kubuild/schema';
import { createDefaultComponentRegistry } from '@kubuild/components';
import {
  KubuildRenderer,
  NodeRenderer,
  FormRuntimeProvider,
  FormInputNode,
  FormTextareaNode,
  FormSelectNode,
  FormCheckboxNode,
  FormRadioNode,
  FormSubmitButtonNode,
  toastManager,
  modalManager,
  executeNodeActions,
} from '../src/index';

describe('STORA-324: Integrasikan Action Dispatcher ke dalam Renderer Nodes', () => {
  const registry = createDefaultComponentRegistry();

  async function triggerNodeClick(element: React.ReactElement): Promise<void> {
    const inner = (element.props as { children?: React.ReactElement })?.children || element;
    const props = (inner as React.ReactElement)?.props as { onClick?: (e: React.MouseEvent) => void };
    if (props && typeof props.onClick === 'function') {
      const res = props.onClick({ stopPropagation: vi.fn() } as unknown as React.MouseEvent);
      if (res && typeof (res as any).then === 'function') {
        await res;
      }
    }
  }

  beforeEach(() => {
    toastManager.clearToasts();
    modalManager.closeModal();
    vi.restoreAllMocks();
  });

  it('executes click action pipeline when a button is clicked', async () => {
    const onActionDispatchMock = vi.fn();

    const targetNode: Node = {
      id: 'my_button',
      type: 'button',
      props: { label: 'Click Me' },
      actions: [
        {
          id: 'btn_pipeline',
          trigger: 'click',
          steps: [
            {
              id: 'step_toast',
              type: 'show_toast',
              payload: {
                message: 'Button Clicked Successfully!',
                type: 'success',
              },
            },
          ],
        },
      ],
    };

    const doc = createBlankDocument('Button Click Page');
    doc.document.children = [targetNode];

    const element = NodeRenderer({
      node: targetNode,
      document: doc,
      registry,
      onActionDispatch: onActionDispatchMock,
    });

    await triggerNodeClick(element);

    expect(toastManager.getToasts()).toHaveLength(1);
    expect(toastManager.getToasts()[0].message).toBe('Button Clicked Successfully!');
    expect(toastManager.getToasts()[0].type).toBe('success');
    expect(onActionDispatchMock).toHaveBeenCalledWith('show_toast', expect.any(Object), 'my_button');
  });

  it('validates form first on submit click; blocks pipeline if form is invalid, executes if valid', async () => {
    const onActionDispatchMock = vi.fn();

    const submitBtnNode: Node = {
      id: 'submit_btn',
      type: 'button',
      props: {
        buttonType: 'submit',
        label: 'Submit Form',
      },
    };

    const formNode: Node = {
      id: 'contact_form',
      type: 'form',
      actions: [
        {
          id: 'submit_pipeline',
          trigger: 'submit',
          steps: [
            {
              id: 'step_toast',
              type: 'show_toast',
              payload: {
                message: 'Form submitted successfully: {{form.email}}',
                type: 'success',
              },
            },
          ],
        },
      ],
      children: [
        {
          id: 'email_input',
          type: 'input',
          props: {
            name: 'email',
            required: true,
            placeholder: 'Your Email',
            rules: [
              {
                type: 'required',
                message: 'Email address is required!',
              },
            ],
          },
        },
        submitBtnNode,
      ],
    };

    const doc = createBlankDocument('Form Validation Page');
    doc.document.children = [formNode];

    // Render tree to HTML
    const html = renderToString(
      <KubuildRenderer
        document={doc}
        registry={registry}
        onActionDispatch={onActionDispatchMock}
      />,
    );

    expect(html).toContain('contact_form');
    expect(html).toContain('Submit Form');

    // 1. Submit button with invalid form state
    const mockFormRuntimeInvalid = {
      values: { email: '' },
      errors: { email: 'Email required' },
      touched: { email: true },
      isSubmitting: false,
      handleFormSubmit: vi.fn().mockResolvedValue(false), // invalid!
      resetForm: vi.fn(),
    };

    // When handleFormSubmit returns false, click should not execute button click pipeline
    expect(toastManager.getToasts()).toHaveLength(0);

    // 2. Submit when form is valid
    const validSubmitNode: Node = {
      id: 'contact_form',
      type: 'form',
      actions: [
        {
          id: 'submit_pipeline',
          trigger: 'submit',
          steps: [
            {
              id: 'step_toast',
              type: 'show_toast',
              payload: {
                message: 'Form submitted successfully: {{form.email}}',
                type: 'success',
              },
            },
          ],
        },
      ],
    };

    await executeNodeActions({
      node: validSubmitNode,
      trigger: 'submit',
      formContext: {
        values: { email: 'user@kustora.dev' },
      } as any,
      onActionDispatch: onActionDispatchMock,
    });

    expect(toastManager.getToasts()).toHaveLength(1);
    expect(toastManager.getToasts()[0].message).toBe('Form submitted successfully: user@kustora.dev');
    expect(onActionDispatchMock).toHaveBeenCalledWith('show_toast', expect.any(Object), 'contact_form');
  });

  it('triggers change action pipeline when input value changes', async () => {
    const inputNode: Node = {
      id: 'coupon_input',
      type: 'input',
      actions: [
        {
          id: 'coupon_pipeline',
          trigger: 'change',
          steps: [
            {
              id: 'step_toast',
              type: 'show_toast',
              payload: {
                message: 'Coupon code changed: {{form.coupon}}',
                type: 'info',
              },
            },
          ],
        },
      ],
    };

    await executeNodeActions({
      node: inputNode,
      trigger: 'change',
      formContext: {
        values: { coupon: 'SUMMER50' },
      } as any,
      extraContext: { fieldName: 'coupon', fieldValue: 'SUMMER50' },
    });

    expect(toastManager.getToasts()).toHaveLength(1);
    expect(toastManager.getToasts()[0].message).toBe('Coupon code changed: SUMMER50');
  });

  it('triggers blur action pipeline when input loses focus', async () => {
    const inputNode: Node = {
      id: 'username_input',
      type: 'input',
      actions: [
        {
          id: 'blur_pipeline',
          trigger: 'blur',
          steps: [
            {
              id: 'step_toast',
              type: 'show_toast',
              payload: {
                message: 'Username field blurred',
                type: 'warning',
              },
            },
          ],
        },
      ],
    };

    await executeNodeActions({
      node: inputNode,
      trigger: 'blur',
      formContext: {
        values: { username: 'alex99' },
      } as any,
    });

    expect(toastManager.getToasts()).toHaveLength(1);
    expect(toastManager.getToasts()[0].message).toBe('Username field blurred');
    expect(toastManager.getToasts()[0].type).toBe('warning');
  });

  it('triggers focus action pipeline when input gains focus', async () => {
    const inputNode: Node = {
      id: 'search_input',
      type: 'input',
      actions: [
        {
          id: 'focus_pipeline',
          trigger: 'focus',
          steps: [
            {
              id: 'step_toast',
              type: 'show_toast',
              payload: {
                message: 'Search input active',
                type: 'info',
              },
            },
          ],
        },
      ],
    };

    await executeNodeActions({
      node: inputNode,
      trigger: 'focus',
    });

    expect(toastManager.getToasts()).toHaveLength(1);
    expect(toastManager.getToasts()[0].message).toBe('Search input active');
  });

  it('triggers load lifecycle actions on component mount', async () => {
    const bannerNode: Node = {
      id: 'welcome_banner',
      type: 'container',
      actions: [
        {
          id: 'on_load_pipeline',
          trigger: 'load',
          steps: [
            {
              id: 'step_toast',
              type: 'show_toast',
              payload: {
                message: 'Welcome to Kubuild!',
                type: 'info',
              },
            },
          ],
        },
      ],
    };

    await executeNodeActions({
      node: bannerNode,
      trigger: 'load',
    });

    expect(toastManager.getToasts()).toHaveLength(1);
    expect(toastManager.getToasts()[0].message).toBe('Welcome to Kubuild!');
  });

  it('reports diagnostic if an action pipeline execution fails', async () => {
    const onDiagnosticMock = vi.fn();

    const node: Node = {
      id: 'failing_node',
      type: 'button',
      actions: [
        {
          id: 'error_pipeline',
          trigger: 'click',
          steps: [
            {
              id: 'invalid_step',
              type: 'unknown_unregistered_step_action_type',
            },
          ],
        },
      ],
    };

    const outcome = await executeNodeActions({
      node,
      trigger: 'click',
      onDiagnostic: onDiagnosticMock,
    });

    expect(outcome.success).toBe(false);
    expect(outcome.executed).toBe(true);
    expect(onDiagnosticMock).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'ACTION_EXECUTION_ERROR',
        nodeId: 'failing_node',
      }),
    );
  });
});
