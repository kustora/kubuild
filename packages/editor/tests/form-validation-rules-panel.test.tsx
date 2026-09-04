import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { Node, FormConfig } from '@kubuild/schema';
import {
  FormValidationRulesPanel,
  SUPPORTED_RULES,
  getRuleDefinition,
  isFormFieldNode,
} from '../src/components/panels/form-validation-rules-panel';
import { useEditorStore } from '../src/store';
import { createBlankDocument } from '@kubuild/core';

describe('Form Validation Rules Inspector Panel (STORA-344)', () => {
  beforeEach(() => {
    useEditorStore.getState().setDocument(createBlankDocument('Test'));
  });

  it('correctly identifies form field nodes with isFormFieldNode', () => {
    const inputNode: Node = { id: 'email-field', type: 'input', props: { name: 'email' } };
    const textareaNode: Node = { id: 'bio-field', type: 'textarea', props: {} };
    const selectNode: Node = { id: 'country-field', type: 'select', props: {} };
    const checkboxNode: Node = { id: 'agree-field', type: 'checkbox', props: {} };
    const radioNode: Node = { id: 'gender-field', type: 'radio', props: {} };
    const genericNodeWithName: Node = { id: 'custom-field', type: 'custom-widget', props: { name: 'customVal' } };
    const buttonNode: Node = { id: 'btn', type: 'button', props: { label: 'Click' } };
    const containerNode: Node = { id: 'box', type: 'container', props: {} };

    expect(isFormFieldNode(inputNode)).toBe(true);
    expect(isFormFieldNode(textareaNode)).toBe(true);
    expect(isFormFieldNode(selectNode)).toBe(true);
    expect(isFormFieldNode(checkboxNode)).toBe(true);
    expect(isFormFieldNode(radioNode)).toBe(true);
    expect(isFormFieldNode(genericNodeWithName)).toBe(true);
    expect(isFormFieldNode(buttonNode)).toBe(false);
    expect(isFormFieldNode(containerNode)).toBe(false);
    expect(isFormFieldNode(null)).toBe(false);
  });

  it('exposes definitions for all supported validation rule types', () => {
    const supportedTypes = ['required', 'email', 'custom_regex', 'min_length', 'max_length'];
    for (const type of supportedTypes) {
      const def = getRuleDefinition(type);
      expect(def).toBeDefined();
      expect(def?.type).toBe(type);
      expect(def?.label).toBeDefined();
      expect(def?.defaultMessage).toBeDefined();
    }
  });

  it('renders empty rules state when node has no rules', () => {
    const node: Node = {
      id: 'input-1',
      type: 'input',
      props: { name: 'username' },
    };

    const html = renderToString(
      <FormValidationRulesPanel
        node={node}
        onUpdateFormConfig={() => {}}
      />,
    );

    expect(html).toContain('Validation Rules');
    expect(html).toContain('No validation rules configured');
    expect(html).toContain('Add Rule');
  });

  it('renders list of active rules with custom messages and values', () => {
    const node: Node = {
      id: 'input-email',
      type: 'input',
      props: { name: 'email' },
      formConfig: {
        formId: 'contactForm',
        rules: [
          { type: 'required', message: 'Email address is required!' },
          { type: 'email', message: 'Must be a valid corporate email' },
          { type: 'min_length', value: 5, message: 'Minimum 5 chars' },
        ],
      },
    };

    const html = renderToString(
      <FormValidationRulesPanel
        node={node}
        onUpdateFormConfig={() => {}}
      />,
    );

    expect(html).toContain('Validation Rules');
    expect(html).toContain('3'); // count badge
    expect(html).toContain('Required');
    expect(html).toContain('Email address is required!');
    expect(html).toContain('Email');
    expect(html).toContain('Must be a valid corporate email');
    expect(html).toContain('Min Length');
    expect(html).toContain('Minimum 5 chars');
    expect(html).toContain('5');
  });

  it('falls back to node.props.rules when formConfig.rules is not yet set', () => {
    const node: Node = {
      id: 'input-phone',
      type: 'input',
      props: {
        name: 'phone',
        rules: [
          { type: 'required', message: 'Phone is mandatory' },
          { type: 'custom_regex', value: '^[0-9]+$', message: 'Digits only' },
        ],
      },
    };

    const html = renderToString(
      <FormValidationRulesPanel
        node={node}
        onUpdateFormConfig={() => {}}
      />,
    );

    expect(html).toContain('Phone is mandatory');
    expect(html).toContain('Custom Regex');
    expect(html).toContain('Digits only');
    expect(html).toContain('^[0-9]+$');
  });

  it('updates store formConfig properly via updateNodeFormConfig', () => {
    const doc = createBlankDocument('Form Test');
    doc.document.children = [
      {
        id: 'user-email',
        type: 'input',
        props: { name: 'email' },
      },
    ];
    useEditorStore.getState().setDocument(doc);

    const store = useEditorStore.getState();
    const result = store.updateNodeFormConfig('user-email', {
      formId: 'signupForm',
      rules: [
        { type: 'required', message: 'Email is required' },
        { type: 'email', message: 'Invalid email' },
      ],
    });

    expect(result.success).toBe(true);
    const updatedNode = useEditorStore.getState().document.document.children?.[0];
    expect(updatedNode?.formConfig?.formId).toBe('signupForm');
    expect(updatedNode?.formConfig?.rules).toHaveLength(2);
    expect(updatedNode?.formConfig?.rules?.[0].type).toBe('required');
  });
});
