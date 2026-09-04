import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { createBlankDocument } from '@kubuild/core';
import { collectDocumentFormFields } from '../src/utils/document-scanner';
import {
  getAllVariableSuggestions,
  filterVariableSuggestions,
  insertVariableToken,
  VariableSuggestionMenu,
  VariableAutocompleteInput,
  VariableAutocompleteTextarea,
} from '../src/components/ui/variable-autocomplete-input';

describe('STORA-343: Variable Chip / Autocomplete Picker', () => {
  const sampleDoc = createBlankDocument('Test Form Document');
  sampleDoc.document.children = [
    {
      id: 'contact-form',
      type: 'form',
      children: [
        { id: 'input-email', type: 'input', props: { name: 'userEmail' } },
        { id: 'input-fullname', type: 'input', props: { name: 'fullName' } },
        { id: 'textarea-comments', type: 'textarea', props: { name: 'customerMessage' } },
      ],
    },
  ];

  it('scans document nodes and collects dynamic form field names', () => {
    const fields = collectDocumentFormFields(sampleDoc);
    expect(fields).toContain('userEmail');
    expect(fields).toContain('fullName');
    expect(fields).toContain('customerMessage');
  });

  it('generates grouped variable suggestions for form, variables, response, and state', () => {
    const suggestions = getAllVariableSuggestions(sampleDoc);
    const keys = suggestions.map((s) => s.key);

    // Form fields
    expect(keys).toContain('form.userEmail');
    expect(keys).toContain('form.fullName');
    expect(keys).toContain('form.customerMessage');
    expect(keys).toContain('form.email');

    // Variables
    expect(keys).toContain('variables.token');
    expect(keys).toContain('variables.userId');
    expect(keys).toContain('variables.apiKey');

    // Response
    expect(keys).toContain('response.data');
    expect(keys).toContain('response.id');
    expect(keys).toContain('response.status');

    // State
    expect(keys).toContain('state.isSubmitted');
    expect(keys).toContain('state.selectedPlan');
  });

  it('filters variable suggestions based on query', () => {
    const emailMatches = filterVariableSuggestions('email', sampleDoc);
    expect(emailMatches.some((s) => s.key.includes('email'))).toBe(true);

    const tokenMatches = filterVariableSuggestions('token', sampleDoc);
    expect(tokenMatches.some((s) => s.key === 'variables.token')).toBe(true);
    expect(tokenMatches.some((s) => s.key === 'response.token')).toBe(true);

    const responseMatches = filterVariableSuggestions('response', sampleDoc);
    expect(responseMatches.every((s) => s.category === 'response' || s.key.includes('response'))).toBe(true);
  });

  describe('insertVariableToken helper', () => {
    it('replaces unclosed {{... token at cursor position with valid {{variableKey}} template string', () => {
      const input = 'https://api.example.com/users/{{use';
      const cursor = input.length;
      const { nextText, newCursorPos } = insertVariableToken(input, cursor, 'form.userEmail');

      expect(nextText).toBe('https://api.example.com/users/{{form.userEmail}}');
      expect(newCursorPos).toBe('https://api.example.com/users/{{form.userEmail}}'.length);
    });

    it('replaces unclosed {{... even if closing }} follows immediately', () => {
      const input = 'Hello {{na}} welcome!';
      const cursor = 'Hello {{na'.length;
      const { nextText } = insertVariableToken(input, cursor, 'form.fullName');

      expect(nextText).toBe('Hello {{form.fullName}} welcome!');
    });

    it('inserts {{variableKey}} at current cursor position if no unclosed {{ exists', () => {
      const input = 'Bearer ';
      const cursor = input.length;
      const { nextText } = insertVariableToken(input, cursor, 'variables.token');

      expect(nextText).toBe('Bearer {{variables.token}}');
    });
  });

  describe('VariableSuggestionMenu component', () => {
    it('renders list of variable suggestions with category badges', () => {
      const suggestions = filterVariableSuggestions('token', sampleDoc);
      const html = renderToString(
        <VariableSuggestionMenu
          suggestions={suggestions}
          selectedIndex={0}
          onSelect={() => {}}
          onClose={() => {}}
        />,
      );

      expect(html).toContain('data-testid="variable-autocomplete-menu"');
      expect(html).toContain('data-testid="variable-option-variables.token"');
      expect(html).toContain('data-testid="variable-option-response.token"');
      expect(html).toContain('Variable');
      expect(html).toContain('API Response');
    });
  });

  describe('VariableAutocompleteInput component', () => {
    it('renders text input with quick variable chip launcher button', () => {
      const html = renderToString(
        <VariableAutocompleteInput
          value="https://api.example.com/submit"
          onChange={() => {}}
          document={sampleDoc}
          placeholder="Enter endpoint"
        />,
      );

      expect(html).toContain('value="https://api.example.com/submit"');
      expect(html).toContain('placeholder="Enter endpoint"');
      expect(html).toContain('data-testid="toggle-variable-picker-btn"');
    });
  });

  describe('VariableAutocompleteTextarea component', () => {
    it('renders textarea with quick variable chip launcher button', () => {
      const html = renderToString(
        <VariableAutocompleteTextarea
          value="Thank you for subscribing, {{form.userEmail}}!"
          onChange={() => {}}
          document={sampleDoc}
          rows={3}
        />,
      );

      expect(html).toContain('Thank you for subscribing, {{form.userEmail}}!');
      expect(html).toContain('data-testid="toggle-textarea-variable-picker-btn"');
    });
  });
});
