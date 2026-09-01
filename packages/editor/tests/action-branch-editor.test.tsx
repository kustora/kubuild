import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { createBlankDocument } from '@kubuild/core';
import { ActionStep } from '@kubuild/schema';
import {
  ActionBranchEditor,
  BranchLane,
} from '../src/action-branch-editor';
import { ActionStepForm } from '../src/action-step-form';

describe('STORA-342: Visual Branching Editor (On Success & On Error)', () => {
  const sampleDoc = createBlankDocument('Branching Test Doc');
  sampleDoc.document.children = [
    {
      id: 'success-modal',
      type: 'modal',
      props: { title: 'Success Dialog' },
    },
  ];

  const parentApiStep: ActionStep = {
    id: 'api-lead-step',
    type: 'api_request',
    label: 'Send Lead to CRM',
    payload: {
      url: 'https://api.example.com/leads',
      method: 'POST',
    },
    onSuccess: [
      {
        id: 'succ-step-1',
        type: 'show_toast',
        label: 'Success Notification',
        payload: {
          type: 'success',
          message: 'Lead sent successfully!',
        },
      },
      {
        id: 'succ-step-2',
        type: 'close_modal',
        label: 'Close Contact Modal',
        payload: {
          modalNodeId: 'success-modal',
        },
      },
    ],
    onError: [
      {
        id: 'err-step-1',
        type: 'show_toast',
        label: 'Error Alert',
        payload: {
          type: 'error',
          message: 'Failed to send lead. Please retry.',
        },
      },
    ],
  };

  it('renders ActionBranchEditor with On Success and On Error lanes', () => {
    const html = renderToString(
      <ActionBranchEditor
        parentStep={parentApiStep}
        document={sampleDoc}
        onUpdateSuccessSteps={() => {}}
        onUpdateErrorSteps={() => {}}
      />,
    );

    expect(html).toContain('Response Branching Pipeline');
    expect(html).toContain('data-testid="branch-lane-success"');
    expect(html).toContain('data-testid="branch-lane-error"');

    // On Success lane header and steps
    expect(html).toContain('On Success (HTTP 2xx)');
    expect(html).toContain('data-testid="add-success-step-btn"');
    expect(html).toContain('data-testid="branch-step-card-succ-step-1"');
    expect(html).toContain('data-testid="branch-step-card-succ-step-2"');
    expect(html).toContain('Success Notification');
    expect(html).toContain('Close Contact Modal');
    expect(html).toContain('S1');
    expect(html).toContain('S2');

    // On Error lane header and steps
    expect(html).toContain('On Error (HTTP 4xx / 5xx / Network Failure)');
    expect(html).toContain('data-testid="add-error-step-btn"');
    expect(html).toContain('data-testid="branch-step-card-err-step-1"');
    expect(html).toContain('Error Alert');
    expect(html).toContain('E1');
  });

  it('renders empty branch lane placeholder when no sub-steps exist', () => {
    const emptyStep: ActionStep = {
      id: 'api-empty',
      type: 'api_request',
      payload: { url: 'https://api.example.com' },
    };

    const html = renderToString(
      <ActionBranchEditor
        parentStep={emptyStep}
        document={sampleDoc}
        onUpdateSuccessSteps={() => {}}
        onUpdateErrorSteps={() => {}}
      />,
    );

    expect(html).toContain('No success action steps configured yet');
    expect(html).toContain('No error action steps configured yet');
  });

  it('renders BranchLane independently for success and error', () => {
    const successHtml = renderToString(
      <BranchLane
        branchType="success"
        steps={parentApiStep.onSuccess || []}
        document={sampleDoc}
        onUpdateSteps={() => {}}
      />,
    );
    expect(successHtml).toContain('On Success (HTTP 2xx)');
    expect(successHtml).toContain('Success Notification');

    const errorHtml = renderToString(
      <BranchLane
        branchType="error"
        steps={parentApiStep.onError || []}
        document={sampleDoc}
        onUpdateSteps={() => {}}
      />,
    );
    expect(errorHtml).toContain('On Error (HTTP 4xx / 5xx / Network Failure)');
    expect(errorHtml).toContain('Error Alert');
  });

  it('integrates ActionBranchEditor inside ActionStepForm for api_request step type', () => {
    const html = renderToString(
      <ActionStepForm
        step={parentApiStep}
        document={sampleDoc}
        onUpdatePayload={() => {}}
        onUpdateMeta={() => {}}
        onUpdateBranches={() => {}}
      />,
    );

    expect(html).toContain('data-testid="action-branch-editor-api-lead-step"');
    expect(html).toContain('On Success (HTTP 2xx)');
    expect(html).toContain('On Error (HTTP 4xx / 5xx / Network Failure)');
  });

  it('hides ActionBranchEditor when hideBranches is true (for sub-steps inside lanes)', () => {
    const html = renderToString(
      <ActionStepForm
        step={parentApiStep}
        document={sampleDoc}
        onUpdatePayload={() => {}}
        onUpdateMeta={() => {}}
        onUpdateBranches={() => {}}
        hideBranches={true}
      />,
    );

    expect(html).not.toContain('data-testid="action-branch-editor-api-lead-step"');
  });
});
