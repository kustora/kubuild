import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { createBlankDocument } from '@kubuild/core';
import type { ActionPipeline, FormConfig } from '@kubuild/schema';
import { createDefaultComponentRegistry } from '@kubuild/components';
import {
  FormRuntimeProvider,
  useFormRuntime,
  useFormContext,
  useFormField,
  useFormStatus,
  KubuildRenderer,
  NodeRenderer,
  type FormRuntimeContextValue,
} from '../src/index';

describe('STORA-320: FormRuntimeContext & React Context Provider', () => {
  const registry = createDefaultComponentRegistry();

  describe('FormRuntimeContext & Provider Initialization', () => {
    it('provides default and configured initial values to context consumers', () => {
      let capturedForm: FormRuntimeContextValue | null = null;

      const FormConsumer: React.FC = () => {
        capturedForm = useFormRuntime();
        const status = useFormStatus();
        return (
          <div data-testid="consumer">
            <span>{capturedForm?.formId}</span>
            <span>{status.isSubmitting ? 'submitting' : 'idle'}</span>
            <span>{status.isValid ? 'valid' : 'invalid'}</span>
            <span>{status.dirty ? 'dirty' : 'pristine'}</span>
          </div>
        );
      };

      const formConfig: FormConfig = {
        formId: 'contact_form_id',
        initialValues: {
          email: 'hello@kubuild.dev',
          count: 5,
        },
      };

      const html = renderToString(
        <FormRuntimeProvider formConfig={formConfig}>
          <FormConsumer />
        </FormRuntimeProvider>,
      );

      expect(html).toContain('contact_form_id');
      expect(html).toContain('idle');
      expect(html).toContain('valid');
      expect(html).toContain('pristine');
      expect(capturedForm).not.toBeNull();
      expect(capturedForm?.values).toEqual({
        email: 'hello@kubuild.dev',
        count: 5,
      });
      expect(capturedForm?.errors).toEqual({});
      expect(capturedForm?.touched).toEqual({});
    });

    it('returns null when useFormRuntime is used outside provider', () => {
      let capturedForm: FormRuntimeContextValue | null = null;
      let capturedAlias: FormRuntimeContextValue | null = null;

      const Consumer: React.FC = () => {
        capturedForm = useFormRuntime();
        capturedAlias = useFormContext();
        return <div>Outside</div>;
      };

      renderToString(<Consumer />);

      expect(capturedForm).toBeNull();
      expect(capturedAlias).toBeNull();
    });
  });

  describe('Form Callbacks & Mutation Methods', () => {
    it('supports setFieldValue, setFieldTouched, setFieldError, setErrors, setValues, and resetForm', () => {
      let capturedForm!: FormRuntimeContextValue;

      const Consumer: React.FC = () => {
        capturedForm = useFormRuntime()!;
        return <div>{JSON.stringify(capturedForm.values)}</div>;
      };

      // Initial render
      renderToString(
        <FormRuntimeProvider
          formConfig={{ formId: 'test_form', initialValues: { name: 'Initial Name' } }}
        >
          <Consumer />
        </FormRuntimeProvider>,
      );

      expect(capturedForm).toBeDefined();
      expect(typeof capturedForm.setFieldValue).toBe('function');
      expect(typeof capturedForm.setFieldTouched).toBe('function');
      expect(typeof capturedForm.setFieldError).toBe('function');
      expect(typeof capturedForm.setErrors).toBe('function');
      expect(typeof capturedForm.setValues).toBe('function');
      expect(typeof capturedForm.setSubmitting).toBe('function');
      expect(typeof capturedForm.resetForm).toBe('function');
      expect(typeof capturedForm.validateField).toBe('function');
      expect(typeof capturedForm.validateForm).toBe('function');
      expect(typeof capturedForm.handleFormSubmit).toBe('function');
    });

    it('validates fields against registered rules and transforms', () => {
      let capturedForm!: FormRuntimeContextValue;

      const FieldRegistrar: React.FC = () => {
        capturedForm = useFormRuntime()!;
        const { value, error, isInvalid } = useFormField('email', {
          name: 'email',
          required: true,
          transform: 'trim',
          rules: [
            { type: 'required', message: 'Email is required' },
            { type: 'email', message: 'Must be a valid email' },
          ],
        });

        return (
          <div>
            <span data-value>{String(value || '')}</span>
            <span data-invalid>{isInvalid ? 'invalid' : 'valid'}</span>
            <span data-error>{error || ''}</span>
          </div>
        );
      };

      renderToString(
        <FormRuntimeProvider initialValues={{ email: 'bad-email' }}>
          <FieldRegistrar />
        </FormRuntimeProvider>,
      );

      expect(capturedForm).toBeDefined();

      // Validate email field
      const error1 = capturedForm.validateField('email', 'bad-email');
      expect(error1).toBe('Must be a valid email');

      const error2 = capturedForm.validateField('email', '   ');
      expect(error2).toBe('Email is required');

      const error3 = capturedForm.validateField('email', 'valid@example.com');
      expect(error3).toBeNull();
    });

    it('validates full form and returns error map', () => {
      let capturedForm!: FormRuntimeContextValue;

      const FormFields: React.FC = () => {
        capturedForm = useFormRuntime()!;
        useFormField('name', {
          name: 'name',
          required: true,
          rules: [{ type: 'required', message: 'Name is required' }],
        });
        useFormField('age', {
          name: 'age',
          rules: [{ type: 'numeric_min', value: 18, message: 'Must be at least 18' }],
        });

        return <div>Form Fields</div>;
      };

      renderToString(
        <FormRuntimeProvider initialValues={{ name: '', age: 12 }}>
          <FormFields />
        </FormRuntimeProvider>,
      );

      const errors = capturedForm.validateForm();
      expect(errors.name).toBe('Name is required');
      expect(errors.age).toBe('Must be at least 18');
    });
  });

  describe('Form Submission & Pipeline Execution', () => {
    it('executes handleFormSubmit with validation checking', async () => {
      let capturedForm!: FormRuntimeContextValue;
      const onSubmit = vi.fn();
      const onError = vi.fn();
      const onSuccess = vi.fn();

      const FormFields: React.FC = () => {
        capturedForm = useFormRuntime()!;
        useFormField('username', {
          name: 'username',
          required: true,
          rules: [{ type: 'required', message: 'Username is required' }],
        });
        return <div>Form Fields</div>;
      };

      renderToString(
        <FormRuntimeProvider
          initialValues={{ username: '' }}
          onSubmit={onSubmit}
          onError={onError}
          onSuccess={onSuccess}
        >
          <FormFields />
        </FormRuntimeProvider>,
      );

      // 1. Submit with empty username -> fails validation
      const success1 = await capturedForm.handleFormSubmit();
      expect(success1).toBe(false);
      expect(onError).toHaveBeenCalledWith(expect.objectContaining({ username: 'Username is required' }));
      expect(onSubmit).not.toHaveBeenCalled();
      expect(onSuccess).not.toHaveBeenCalled();
    });

    it('executes submit action pipeline on successful form submission', async () => {
      let capturedForm!: FormRuntimeContextValue;
      const onSuccess = vi.fn();

      const submitPipeline: ActionPipeline = {
        id: 'submit_pipeline_test',
        trigger: 'submit',
        steps: [
          {
            id: 'step_1',
            type: 'set_state',
            payload: { key: 'status', value: 'success' },
          },
        ],
      };

      const FormFields: React.FC = () => {
        capturedForm = useFormRuntime()!;
        useFormField('username', {
          name: 'username',
          rules: [{ type: 'required', message: 'Username is required' }],
        });
        return <div>Form Fields</div>;
      };

      renderToString(
        <FormRuntimeProvider
          initialValues={{ username: 'alice' }}
          actions={[submitPipeline]}
          onSuccess={onSuccess}
        >
          <FormFields />
        </FormRuntimeProvider>,
      );

      const success = await capturedForm.handleFormSubmit();
      expect(success).toBe(true);
      expect(onSuccess).toHaveBeenCalledWith(expect.objectContaining({ username: 'alice' }));
    });
  });

  describe('Integration with KubuildRenderer & NodeRenderer', () => {
    it('renders a form container wrapping input, textarea, select, checkbox, radio, and submit button', () => {
      const doc = createBlankDocument('Form Test Document');
      doc.document.children = [
        {
          id: 'lead-form',
          type: 'form',
          props: {
            name: 'lead_form',
            action: '/api/leads',
            method: 'POST',
          },
          formConfig: {
            formId: 'lead_form',
            resetOnSubmit: true,
            validateOn: 'blur',
          },
          children: [
            {
              id: 'input-name',
              type: 'input',
              props: {
                name: 'fullname',
                placeholder: 'Your Full Name',
                required: true,
                rules: [{ type: 'required', message: 'Full name is required' }],
              },
            },
            {
              id: 'input-email',
              type: 'input',
              props: {
                name: 'email',
                type: 'email',
                placeholder: 'email@example.com',
                rules: [{ type: 'email', message: 'Invalid email' }],
              },
            },
            {
              id: 'textarea-comments',
              type: 'textarea',
              props: {
                name: 'comments',
                placeholder: 'Additional comments',
                rows: 3,
              },
            },
            {
              id: 'select-service',
              type: 'select',
              props: {
                name: 'service',
                options: [
                  { label: 'Consulting', value: 'consulting' },
                  { label: 'Development', value: 'dev' },
                ],
                defaultValue: 'consulting',
              },
            },
            {
              id: 'checkbox-terms',
              type: 'checkbox',
              props: {
                name: 'terms',
                label: 'Agree to Terms',
                value: 'yes',
                defaultChecked: true,
              },
            },
            {
              id: 'radio-contact-method',
              type: 'radio',
              props: {
                name: 'contact_pref',
                label: 'Email',
                value: 'email',
                defaultChecked: true,
              },
            },
            {
              id: 'btn-submit',
              type: 'button',
              props: {
                label: 'Send Application',
                buttonType: 'submit',
              },
            },
          ],
        },
      ];

      const html = renderToString(<KubuildRenderer document={doc} registry={registry} mode="runtime" />);

      // Verify form rendered with correct semantic tags and attributes
      expect(html).toContain('<form');
      expect(html).toContain('name="lead_form"');
      expect(html).toContain('action="/api/leads"');
      expect(html).toContain('method="POST"');
      expect(html).toContain('data-kubuild-node="lead-form"');

      // Verify input elements
      expect(html).toContain('type="text"');
      expect(html).toContain('name="fullname"');
      expect(html).toContain('placeholder="Your Full Name"');
      expect(html).toContain('data-field="fullname"');

      expect(html).toContain('type="email"');
      expect(html).toContain('name="email"');
      expect(html).toContain('data-field="email"');

      // Verify textarea
      expect(html).toContain('<textarea');
      expect(html).toContain('name="comments"');
      expect(html).toContain('rows="3"');
      expect(html).toContain('data-field="comments"');

      // Verify select
      expect(html).toContain('<select');
      expect(html).toContain('name="service"');
      expect(html).toContain('Consulting');
      expect(html).toContain('Development');

      // Verify checkbox
      expect(html).toContain('type="checkbox"');
      expect(html).toContain('name="terms"');
      expect(html).toContain('Agree to Terms');
      expect(html).toContain('checked=""');

      // Verify radio
      expect(html).toContain('type="radio"');
      expect(html).toContain('name="contact_pref"');
      expect(html).toContain('Email');
      expect(html).toContain('checked=""');

      // Verify submit button
      expect(html).toContain('<button');
      expect(html).toContain('type="submit"');
      expect(html).toContain('Send Application');
    });

    it('renders input, select, textarea, checkbox, radio safely outside form containers without throwing', () => {
      const doc = createBlankDocument('Standalone Inputs');
      doc.document.children = [
        {
          id: 'solo-input',
          type: 'input',
          props: { name: 'search', placeholder: 'Search...' },
        },
        {
          id: 'solo-textarea',
          type: 'textarea',
          props: { name: 'notes', defaultValue: 'Some notes' },
        },
        {
          id: 'solo-select',
          type: 'select',
          props: { name: 'category', options: ['A', 'B'] },
        },
        {
          id: 'solo-checkbox',
          type: 'checkbox',
          props: { label: 'Toggle me', defaultChecked: false },
        },
        {
          id: 'solo-radio',
          type: 'radio',
          props: { label: 'Option 1', value: 'opt1' },
        },
      ];

      const html = renderToString(<KubuildRenderer document={doc} registry={registry} mode="runtime" />);

      expect(html).toContain('placeholder="Search..."');
      expect(html).toContain('Some notes');
      expect(html).toContain('<select');
      expect(html).toContain('Toggle me');
      expect(html).toContain('Option 1');
    });
  });
});

