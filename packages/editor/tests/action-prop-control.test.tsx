import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import {
  ActionPropControl,
  ACTION_TYPES,
  getActionTypeMeta,
  formatActionSummary,
  parseActionBinding,
} from '../src/components/panels/action-prop-control';
import { ComponentFieldDefinition } from '@kubuild/components';
import { PageDocument } from '@kubuild/schema';

describe('ActionPropControl Component', () => {
  const dummyField: ComponentFieldDefinition = {
    name: 'action',
    label: 'Action',
    type: 'action',
  };

  const dummyDocument: PageDocument = {
    schemaVersion: '1.0.0',
    metadata: { title: 'Test Document' },
    document: {
      id: 'root-page',
      type: 'page',
      children: [
        {
          id: 'modal-contact',
          type: 'modal',
          props: { title: 'Contact Us Dialog' },
        },
        {
          id: 'lead-form',
          type: 'form',
          props: { name: 'Lead Form' },
        },
      ],
    },
  };

  describe('Utility functions', () => {
    it('correctly parses ActionBinding objects and rejects malformed values', () => {
      expect(parseActionBinding(null)).toBeNull();
      expect(parseActionBinding(undefined)).toBeNull();
      expect(parseActionBinding('')).toBeNull();
      expect(parseActionBinding('invalid string')).toBeNull();
      expect(parseActionBinding({})).toBeNull();
      expect(parseActionBinding({ type: '' })).toBeNull();

      const valid = { type: 'navigate', payload: { url: '/docs' } };
      expect(parseActionBinding(valid)).toEqual({
        type: 'navigate',
        payload: { url: '/docs' },
      });

      const withoutPayload = { type: 'reset_form' };
      expect(parseActionBinding(withoutPayload)).toEqual({
        type: 'reset_form',
        payload: {},
      });
    });

    it('exposes metadata for all standard action types', () => {
      const expectedTypes = [
        'navigate',
        'open_modal',
        'close_modal',
        'show_toast',
        'api_request',
        'copy_clipboard',
        'set_state',
        'reset_form',
        'custom_event',
      ];

      for (const t of expectedTypes) {
        const meta = getActionTypeMeta(t);
        expect(meta).toBeDefined();
        expect(meta.type).toBe(t);
        expect(meta.label).toBeDefined();
        expect(meta.badgeClass).toBeDefined();
        expect(meta.icon).toBeDefined();
      }
    });

    it('formats human-friendly summaries for actions', () => {
      expect(formatActionSummary({ type: 'navigate', payload: { url: '/docs' } })).toBe('Go to /docs');
      expect(
        formatActionSummary({ type: 'navigate', payload: { url: 'https://google.com', target: '_blank' } }),
      ).toBe('Go to https://google.com (New tab)');
      expect(formatActionSummary({ type: 'open_modal', payload: { modalNodeId: 'modal-1' } })).toBe('Open #modal-1');
      expect(formatActionSummary({ type: 'show_toast', payload: { message: 'Item saved', type: 'success' } })).toBe(
        '[SUCCESS] "Item saved"',
      );
      expect(formatActionSummary({ type: 'api_request', payload: { method: 'POST', url: '/api/v1' } })).toBe(
        'POST /api/v1',
      );
      expect(formatActionSummary({ type: 'copy_clipboard', payload: { text: 'Hello World' } })).toBe(
        'Copy "Hello World"',
      );
      expect(formatActionSummary({ type: 'set_state', payload: { key: 'count', value: '5' } })).toBe(
        'Set count = 5',
      );
      expect(formatActionSummary({ type: 'reset_form', payload: { formId: 'user-form' } })).toBe(
        'Reset #user-form',
      );
      expect(formatActionSummary({ type: 'custom_event', payload: { eventName: 'btn:click' } })).toBe(
        'Emit "btn:click"',
      );
    });
  });

  describe('Rendering', () => {
    it('renders empty state "+ Configure" button when value is empty', () => {
      const onCommit = vi.fn();
      const html = renderToString(
        <ActionPropControl
          nodeId="button-1"
          field={dummyField}
          value={undefined}
          onCommit={onCommit}
        />,
      );

      expect(html).toContain('Add Interactive Action');
      expect(html).toContain('+ Configure');
      expect(html).not.toContain('<textarea');
    });

    it('renders clean visual summary card when an action is configured', () => {
      const onCommit = vi.fn();
      const actionValue = {
        type: 'navigate',
        payload: { url: '/docs' },
      };

      const html = renderToString(
        <ActionPropControl
          nodeId="button-1"
          field={dummyField}
          value={actionValue}
          onCommit={onCommit}
        />,
      );

      // Verify no plain json textarea
      expect(html).not.toContain('<textarea');
      // Verify visual summary card rendered
      expect(html).toContain('data-testid="action-summary-card"');
      expect(html).toContain('Navigate');
      expect(html).toContain('Go to /docs');
      expect(html).toContain('data-testid="edit-action-btn"');
      expect(html).toContain('data-testid="toggle-json-btn"');
      expect(html).toContain('data-testid="clear-action-btn"');
    });

    it('renders modal dialog action summary properly', () => {
      const onCommit = vi.fn();
      const actionValue = {
        type: 'open_modal',
        payload: { modalNodeId: 'modal-contact' },
      };

      const html = renderToString(
        <ActionPropControl
          nodeId="button-1"
          field={dummyField}
          value={actionValue}
          document={dummyDocument}
          onCommit={onCommit}
        />,
      );

      expect(html).toContain('Open Modal');
      expect(html).toContain('Open #modal-contact');
    });

    it('renders toast notification action summary properly', () => {
      const onCommit = vi.fn();
      const actionValue = {
        type: 'show_toast',
        payload: { message: 'Account updated successfully!', type: 'success' },
      };

      const html = renderToString(
        <ActionPropControl
          nodeId="button-1"
          field={dummyField}
          value={actionValue}
          onCommit={onCommit}
        />,
      );

      expect(html).toContain('Toast');
      expect(html).toContain('[SUCCESS] &quot;Account updated successfully!&quot;');
    });
  });
});
