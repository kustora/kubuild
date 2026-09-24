import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import type { ActionStep } from '@kubuild/schema';
import {
  ActionStepForm,
  ApiRequestStepForm,
} from '../src/components/action-builder/action-step-form';

describe('STORA-532: submit pipeline body default hint', () => {
  const apiStep: ActionStep = {
    id: 'step_submit_api',
    type: 'api_request',
    payload: { url: 'https://api.example.com/leads', method: 'POST', bodyFormat: 'json' },
  };

  it('shows the "Default: entire form data" hint for an api_request without body in a submit pipeline', () => {
    const html = renderToString(
      <ActionStepForm step={apiStep} trigger="submit" onUpdatePayload={() => {}} />,
    );
    expect(html).toContain('data-testid="body-submit-default-hint"');
    expect(html).toContain('Default: entire form data');
  });

  it('hides the hint outside submit pipelines or when a body is set', () => {
    const clickHtml = renderToString(
      <ActionStepForm step={apiStep} trigger="click" onUpdatePayload={() => {}} />,
    );
    expect(clickHtml).not.toContain('body-submit-default-hint');

    const withBody = renderToString(
      <ApiRequestStepForm
        payload={{ ...apiStep.payload, body: { email: '{{form.email}}' } }}
        pipelineTrigger="submit"
        onChange={() => {}}
      />,
    );
    expect(withBody).not.toContain('body-submit-default-hint');
  });
});
