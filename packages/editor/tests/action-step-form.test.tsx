import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { createBlankDocument } from '@kubuild/core';
import { ActionStep } from '@kubuild/schema';
import {
  ActionStepForm,
  ApiRequestStepForm,
  ShowToastStepForm,
  NavigateStepForm,
  ModalStepForm,
  SetStateStepForm,
  ResetFormStepForm,
  CopyClipboardStepForm,
  CustomEventStepForm,
  KeyValueEditor,
  collectDocumentModals,
  collectDocumentForms,
  collectDocumentAnchors,
} from '../src/action-step-form';

describe('STORA-341: Action Step Parameter Configuration Forms', () => {
  const sampleDoc = createBlankDocument('Test Form Document');
  sampleDoc.document.children = [
    {
      id: 'contact-modal',
      type: 'modal',
      props: { title: 'Contact Us Modal' },
    },
    {
      id: 'lead-capture-form',
      type: 'form',
      props: { name: 'Lead Form' },
      children: [
        { id: 'input-name', type: 'input' },
        { id: 'btn-submit', type: 'button' },
      ],
    },
    {
      id: 'features-section',
      type: 'section',
      props: { title: 'Product Features' },
    },
  ];

  it('scans document correctly for modals, forms, and section anchors', () => {
    const modals = collectDocumentModals(sampleDoc);
    expect(modals).toHaveLength(1);
    expect(modals[0].id).toBe('contact-modal');
    expect(modals[0].label).toBe('Contact Us Modal');

    const forms = collectDocumentForms(sampleDoc);
    expect(forms).toHaveLength(1);
    expect(forms[0].id).toBe('lead-capture-form');
    expect(forms[0].label).toBe('Lead Form');

    const anchors = collectDocumentAnchors(sampleDoc);
    expect(anchors.some((a) => a.id === 'features-section')).toBe(true);
  });

  describe('KeyValueEditor component', () => {
    it('renders empty label when no entries exist', () => {
      const html = renderToString(
        <KeyValueEditor
          title="Headers"
          entries={{}}
          onChange={() => {}}
          emptyLabel="No custom headers"
        />,
      );
      expect(html).toContain('Headers');
      expect(html).toContain('No custom headers');
    });

    it('renders key-value inputs when entries are provided', () => {
      const html = renderToString(
        <KeyValueEditor
          title="Query Parameters"
          entries={{ search: 'kubuild', page: '1' }}
          onChange={() => {}}
        />,
      );
      expect(html).toContain('Query Parameters');
      expect(html).toContain('value="search"');
      expect(html).toContain('value="kubuild"');
      expect(html).toContain('value="page"');
      expect(html).toContain('value="1"');
    });
  });

  describe('ApiRequestStepForm', () => {
    it('renders method dropdown, URL input, headers and body editors', () => {
      const payload = {
        method: 'POST',
        url: 'https://api.example.com/leads',
        headers: { 'Authorization': 'Bearer {{token}}' },
        bodyFormat: 'json',
        body: { email: '{{form.email}}' },
        timeout: 5000,
      };

      const html = renderToString(
        <ApiRequestStepForm payload={payload} onChange={() => {}} />,
      );

      expect(html).toContain('HTTP Method &amp; Endpoint URL');
      expect(html).toContain('value="https://api.example.com/leads"');
      expect(html).toContain('HTTP Headers');
      expect(html).toContain('value="Authorization"');
      expect(html).toContain('Request Body Payload');
      expect(html).toContain('Request Timeout');
      expect(html).toContain('value="5000"');
    });

    it('renders Request Body Payload in Form Inputs mode with key and variable autocomplete values', () => {
      const payload = {
        method: 'POST',
        url: 'https://api.example.com/leads',
        bodyFormat: 'json',
        body: { email: '{{form.email}}', name: '{{form.name}}' },
      };

      const html = renderToString(
        <ApiRequestStepForm payload={payload} onChange={() => {}} />,
      );

      expect(html).toContain('Request Body Payload');
      expect(html).toContain('data-testid="body-mode-fields-btn"');
      expect(html).toContain('data-testid="body-mode-raw-btn"');
      expect(html).toContain('value="email"');
      expect(html).toContain('value="{{form.email}}"');
      expect(html).toContain('value="name"');
      expect(html).toContain('value="{{form.name}}"');
      expect(html).toContain('data-testid="add-body-field-btn"');
    });

    it('renders Auto-fill from Form button when document contains form inputs', () => {
      const doc = {
        id: 'page-1',
        title: 'Form Page',
        document: {
          id: 'root',
          type: 'container',
          children: [
            { id: 'input-email', type: 'input', props: { name: 'email' } },
            { id: 'input-phone', type: 'input', props: { name: 'phone' } },
          ],
        },
      };

      const payload = {
        method: 'POST',
        url: 'https://api.example.com/leads',
        bodyFormat: 'json',
        body: {},
      };

      const html = renderToString(
        <ApiRequestStepForm payload={payload} document={doc as any} onChange={() => {}} />,
      );

      expect(html).toContain('data-testid="autofill-body-fields-btn"');
      expect(html).toContain('Auto-fill from Form');
    });
  });

  describe('ShowToastStepForm', () => {
    it('renders type selector, message textarea, duration slider and position', () => {
      const payload = {
        type: 'success',
        message: 'Lead sent successfully!',
        title: 'Thank you',
        duration: 4000,
        position: 'top-right',
      };

      const html = renderToString(
        <ShowToastStepForm payload={payload} onChange={() => {}} />,
      );

      expect(html).toContain('Notification Type');
      expect(html).toContain('Success');
      expect(html).toContain('Error');
      expect(html).toContain('Lead sent successfully!');
      expect(html).toContain('value="Thank you"');
      expect(html).toContain('4000 ms');
      expect(html).toContain('Screen Position');
    });
  });

  describe('NavigateStepForm', () => {
    it('renders destination input, section picker, and open in new tab toggle', () => {
      const payload = {
        url: '#features-section',
        target: '_blank',
        scroll: true,
      };

      const html = renderToString(
        <NavigateStepForm payload={payload} document={sampleDoc} onChange={() => {}} />,
      );

      expect(html).toContain('Target Destination URL or Route');
      expect(html).toContain('value="#features-section"');
      expect(html).toContain('Product Features');
      expect(html).toContain('Open in New Tab');
      expect(html).toContain('Smooth Scroll into View');
    });
  });

  describe('ModalStepForm', () => {
    it('renders detected modal options for open and close modal actions', () => {
      const openHtml = renderToString(
        <ModalStepForm
          payload={{ modalNodeId: 'contact-modal' }}
          isOpenAction={true}
          document={sampleDoc}
          onChange={() => {}}
        />,
      );

      expect(openHtml).toContain('Target Modal Node ID');
      expect(openHtml).toContain('Contact Us Modal (#contact-modal)');
      expect(openHtml).toContain('open');

      const closeHtml = renderToString(
        <ModalStepForm
          payload={{ modalNodeId: 'contact-modal' }}
          isOpenAction={false}
          document={sampleDoc}
          onChange={() => {}}
        />,
      );
      expect(closeHtml).toContain('close');
    });
  });

  describe('SetStateStepForm', () => {
    it('renders state key, value expression, and storage scope picker', () => {
      const payload = {
        key: 'isSubmitted',
        value: 'true',
        scope: 'session',
      };

      const html = renderToString(
        <SetStateStepForm payload={payload} onChange={() => {}} />,
      );

      expect(html).toContain('State Variable Key');
      expect(html).toContain('value="isSubmitted"');
      expect(html).toContain('Value Expression');
      expect(html).toContain('value="true"');
      expect(html).toContain('Storage Scope');
      expect(html).toContain('Session (Browser sessionStorage)');
    });
  });

  describe('ResetFormStepForm', () => {
    it('renders target form dropdown with detected form nodes', () => {
      const payload = { formId: 'lead-capture-form' };
      const html = renderToString(
        <ResetFormStepForm payload={payload} document={sampleDoc} onChange={() => {}} />,
      );

      expect(html).toContain('Target Form');
      expect(html).toContain('Lead Form (#lead-capture-form)');
    });
  });

  describe('CopyClipboardStepForm', () => {
    it('renders text to copy and toast notification feedback inputs', () => {
      const payload = {
        text: 'PROMO-2026',
        notify: true,
        toastMessage: 'Discount copied!',
      };

      const html = renderToString(
        <CopyClipboardStepForm payload={payload} onChange={() => {}} />,
      );

      expect(html).toContain('Text / Value to Copy');
      expect(html).toContain('PROMO-2026');
      expect(html).toContain('Show Toast Notification on Copy');
      expect(html).toContain('value="Discount copied!"');
    });
  });

  describe('CustomEventStepForm', () => {
    it('renders custom event name, bubbles/cancelable checkboxes, and detail editor', () => {
      const payload = {
        eventName: 'lead:submitted',
        bubbles: true,
        cancelable: true,
        detail: { leadId: '123' },
      };

      const html = renderToString(
        <CustomEventStepForm payload={payload} onChange={() => {}} />,
      );

      expect(html).toContain('Custom Event Name');
      expect(html).toContain('value="lead:submitted"');
      expect(html).toContain('Bubbles');
      expect(html).toContain('Cancelable');
      expect(html).toContain('Event Detail Payload');
    });
  });

  describe('ActionStepForm Master Wrapper', () => {
    it('renders step description header, dynamic form, and continue-on-error toggle', () => {
      const step: ActionStep = {
        id: 'step-api-1',
        type: 'api_request',
        label: 'Submit Customer Lead',
        continueOnError: true,
        payload: {
          url: 'https://api.example.com/lead',
          method: 'POST',
        },
      };

      const html = renderToString(
        <ActionStepForm
          step={step}
          document={sampleDoc}
          onUpdatePayload={() => {}}
          onUpdateMeta={() => {}}
        />,
      );

      expect(html).toContain('data-testid="action-step-form-step-api-1"');
      expect(html).toContain('Step Description / Label');
      expect(html).toContain('value="Submit Customer Lead"');
      expect(html).toContain('HTTP Method &amp; Endpoint URL');
      expect(html).toContain('Continue pipeline execution if this step fails');
    });
  });
});
