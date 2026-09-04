import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { createDefaultComponentRegistry } from '@kubuild/components';
import { createBlankDocument } from '@kubuild/core';
import { ActionPipeline } from '@kubuild/schema';
import {
  ActionBuilderModal,
  TRIGGER_OPTIONS,
  STEP_TYPE_OPTIONS,
  formatStepSummary,
  getStepTypeMeta,
} from '../src/components/action-builder/action-builder-modal';
import { InspectorPanel } from '../src/components/panels/inspector-panel';
import { useEditorStore } from '../src/store';

describe('Visual Action Builder Modal & Flyout (STORA-340)', () => {
  const registry = createDefaultComponentRegistry();

  beforeEach(() => {
    const doc = createBlankDocument('Action Builder Test');
    doc.document.children = [
      {
        id: 'submit-btn',
        type: 'button',
        props: { label: 'Submit Form' },
        actions: [
          {
            id: 'pipeline-click',
            trigger: 'click',
            label: 'Click Pipeline',
            enabled: true,
            steps: [
              {
                id: 'step-1',
                type: 'api_request',
                label: 'Submit Lead to Webhook',
                payload: {
                  url: 'https://api.example.com/leads',
                  method: 'POST',
                },
              },
              {
                id: 'step-2',
                type: 'show_toast',
                label: 'Success Notification',
                payload: {
                  message: 'Your lead was submitted successfully!',
                  type: 'success',
                  duration: 4000,
                },
              },
            ],
          },
        ],
      },
      {
        id: 'text-input-email',
        type: 'input',
        props: { name: 'email', placeholder: 'Enter email' },
      },
    ];
    useEditorStore.getState().setDocument(doc);
    useEditorStore.getState().selectNode('submit-btn');
  });

  it('renders Action Builder button and action count badge inside InspectorPanel for any element', () => {
    const doc = useEditorStore.getState().document;
    const html = renderToString(
      <InspectorPanel registry={registry} document={doc} selectedNodeId="submit-btn" />,
    );

    expect(html).toContain('Interactivity &amp; Actions');
    expect(html).toContain('data-testid="open-action-builder-btn"');
    expect(html).toContain('2 step(s) across 1 trigger(s)');
    expect(html).toContain('Actions');
  });

  it('renders empty action summary in InspectorPanel when no actions are configured on the element', () => {
    const doc = useEditorStore.getState().document;
    const html = renderToString(
      <InspectorPanel registry={registry} document={doc} selectedNodeId="text-input-email" />,
    );

    expect(html).toContain('Interactivity &amp; Actions');
    expect(html).toContain('No actions configured');
    expect(html).toContain('data-testid="open-action-builder-btn"');
  });

  it('renders ActionBuilderModal dialog with triggers and action timeline when open', () => {
    const doc = useEditorStore.getState().document;
    const html = renderToString(
      <ActionBuilderModal
        isOpen={true}
        nodeId="submit-btn"
        document={doc}
        initialTrigger="click"
        onClose={() => {}}
      />,
    );

    expect(html).toContain('role="dialog"');
    expect(html).toContain('Visual Action Builder');
    expect(html).toContain('#submit-btn');
    expect(html).toContain('button');
    expect(html).toContain('2 Total Steps');

    // All triggers exist
    for (const trig of TRIGGER_OPTIONS) {
      expect(html).toContain(trig.label);
      expect(html).toContain(`data-testid="trigger-tab-${trig.type}"`);
    }

    // Step cards in timeline
    expect(html).toContain('data-testid="action-step-card-step-1"');
    expect(html).toContain('data-testid="action-step-card-step-2"');
    expect(html).toContain('Submit Lead to Webhook');
    expect(html).toContain('Success Notification');
    expect(html).toContain('POST https://api.example.com/leads');
    expect(html).toContain('Your lead was submitted successfully!');

    // Add Step button
    expect(html).toContain('data-testid="add-action-step-btn"');
    expect(html).toContain('Add Action Step');
  });

  it('renders nothing when isOpen is false', () => {
    const html = renderToString(
      <ActionBuilderModal
        isOpen={false}
        nodeId="submit-btn"
        onClose={() => {}}
      />,
    );
    expect(html).toBe('');
  });

  it('provides all 9 required action step types in STEP_TYPE_OPTIONS', () => {
    const types = STEP_TYPE_OPTIONS.map((s) => s.type);
    expect(types).toContain('api_request');
    expect(types).toContain('show_toast');
    expect(types).toContain('navigate');
    expect(types).toContain('open_modal');
    expect(types).toContain('close_modal');
    expect(types).toContain('set_state');
    expect(types).toContain('reset_form');
    expect(types).toContain('copy_clipboard');
    expect(types).toContain('custom_event');
  });

  it('formatStepSummary formats readable summaries for different step types', () => {
    expect(
      formatStepSummary({
        id: 's1',
        type: 'api_request',
        payload: { method: 'GET', url: 'https://api.example.com/users' },
      }),
    ).toBe('GET https://api.example.com/users');

    expect(
      formatStepSummary({
        id: 's2',
        type: 'show_toast',
        payload: { type: 'error', message: 'Something went wrong' },
      }),
    ).toBe('[ERROR] "Something went wrong"');

    expect(
      formatStepSummary({
        id: 's3',
        type: 'navigate',
        payload: { url: 'https://kustora.com', target: '_blank' },
      }),
    ).toBe('Go to https://kustora.com (New tab)');

    expect(
      formatStepSummary({
        id: 's4',
        type: 'open_modal',
        payload: { modalNodeId: 'contact-modal' },
      }),
    ).toBe('Open Modal #contact-modal');

    expect(
      formatStepSummary({
        id: 's5',
        type: 'close_modal',
        payload: { modalNodeId: 'contact-modal' },
      }),
    ).toBe('Close Modal #contact-modal');

    expect(
      formatStepSummary({
        id: 's6',
        type: 'set_state',
        payload: { key: 'selectedPlan' },
      }),
    ).toBe('Set selectedPlan');

    expect(
      formatStepSummary({
        id: 's7',
        type: 'reset_form',
        payload: { formId: 'checkout-form' },
      }),
    ).toBe('Reset #checkout-form');

    expect(
      formatStepSummary({
        id: 's8',
        type: 'copy_clipboard',
        payload: { text: 'PromoCode2026' },
      }),
    ).toBe('Copy "PromoCode2026"');

    expect(
      formatStepSummary({
        id: 's9',
        type: 'custom_event',
        payload: { eventName: 'purchase:completed' },
      }),
    ).toBe('Emit "purchase:completed"');
  });

  it('updates actions in the editor store via updateNodeActions command', () => {
    const state = useEditorStore.getState();
    const targetNodeId = 'text-input-email';

    const newPipelines: ActionPipeline[] = [
      {
        id: 'pipe-change-1',
        trigger: 'change',
        enabled: true,
        steps: [
          {
            id: 'step-change-1',
            type: 'set_state',
            label: 'Store Email',
            payload: { key: 'tempEmail', value: '{{form.email}}' },
          },
        ],
      },
    ];

    const result = state.updateNodeActions(targetNodeId, newPipelines);
    expect(result.success).toBe(true);

    const updatedDoc = useEditorStore.getState().document;
    const updatedNode = updatedDoc.document.children?.find((c) => c.id === targetNodeId);
    expect(updatedNode?.actions).toHaveLength(1);
    expect(updatedNode?.actions?.[0].trigger).toBe('change');
    expect(updatedNode?.actions?.[0].steps[0].type).toBe('set_state');

    // Clearing actions
    const clearResult = useEditorStore.getState().updateNodeActions(targetNodeId, null);
    expect(clearResult.success).toBe(true);

    const clearedDoc = useEditorStore.getState().document;
    const clearedNode = clearedDoc.document.children?.find((c) => c.id === targetNodeId);
    expect(clearedNode?.actions).toBeUndefined();
  });

  it('renders status badges for execution mode, branches, and conditions (STORA-346)', () => {
    const doc = createBlankDocument('Action Builder Test');
    doc.document.children = [
      {
        id: 'checkout-btn',
        type: 'button',
        props: { label: 'Checkout' },
        actions: [
          {
            id: 'pipeline-click',
            trigger: 'click',
            enabled: true,
            steps: [
              {
                id: 'step-api',
                type: 'api_request',
                label: 'Payment API',
                continueOnError: true,
                timeout: 5000,
                condition: '{{state.cartTotal > 0}}',
                onSuccess: [
                  {
                    id: 'sub-toast',
                    type: 'show_toast',
                    payload: { message: 'Paid!' },
                  },
                ],
                payload: { url: 'https://api.stripe.com/charge', method: 'POST' },
              },
            ],
          },
        ],
      },
    ];

    const html = renderToString(
      <ActionBuilderModal
        isOpen={true}
        onClose={() => {}}
        nodeId="checkout-btn"
        initialTrigger="click"
        document={doc}
      />,
    );

    expect(html).toContain('Payment API');
    expect(html).toContain('Continues on Error');
    expect(html).toContain('Branches (1)');
    expect(html).toContain('Conditional');
    expect(html).toContain('5000ms');
  });
});
