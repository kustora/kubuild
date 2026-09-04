import { describe, it, expect } from 'vitest';
import {
  createDefaultComponentRegistry,
  STARTER_BLOCKS,
} from '../src/index';
import { validateDocument, createBlankDocument, insertNode } from '@kubuild/core';

describe('STARTER_BLOCKS & STORA-350 Starter Form Templates', () => {
  const registry = createDefaultComponentRegistry();

  it('provides all default starter blocks with required metadata', () => {
    expect(STARTER_BLOCKS.length).toBeGreaterThanOrEqual(3);
    for (const block of STARTER_BLOCKS) {
      expect(block.id).toBeDefined();
      expect(block.name).toBeDefined();
      expect(block.category).toBeDefined();
      expect(typeof block.createNodeTree).toBe('function');
    }
  });

  describe('STORA-350: Starter Form Templates in Block Manager', () => {
    it('all three starter form templates are registered in STARTER_BLOCKS under "forms" category', () => {
      const formBlocks = STARTER_BLOCKS.filter((b) => b.category === 'forms');
      expect(formBlocks.length).toBe(3);

      const ids = formBlocks.map((b) => b.id);
      expect(ids).toContain('form-contact-us');
      expect(ids).toContain('form-newsletter');
      expect(ids).toContain('form-lead-gen');

      for (const block of formBlocks) {
        expect(block.categoryLabel).toBe('Form Templates');
        expect(block.description).toBeDefined();
        expect(block.description!.length).toBeGreaterThan(10);
        expect(block.icon).toBeDefined();
      }
    });

    describe('Contact Us Form (form-contact-us)', () => {
      it('generates a valid node tree with Name, Email, Subject, Message, and Submit Button', () => {
        const block = STARTER_BLOCKS.find((b) => b.id === 'form-contact-us')!;
        expect(block).toBeDefined();
        expect(block.name).toBe('Contact Us Form');

        const tree = block.createNodeTree();
        expect(tree.type).toBe('section');

        const container = tree.children?.[0];
        expect(container?.type).toBe('container');

        const formNode = container?.children?.find((c) => c.type === 'form');
        expect(formNode).toBeDefined();
        expect(formNode?.props?.name).toBe('contact_us_form');

        const formChildren = formNode?.children ?? [];
        const inputNames = formChildren
          .filter((c) => c.type === 'input' || c.type === 'textarea')
          .map((c) => c.props?.name);

        expect(inputNames).toContain('name');
        expect(inputNames).toContain('email');
        expect(inputNames).toContain('subject');
        expect(inputNames).toContain('message');

        const submitBtn = formChildren.find((c) => c.type === 'button');
        expect(submitBtn).toBeDefined();
        expect(submitBtn?.props?.buttonType).toBe('submit');
        expect(submitBtn?.props?.label).toBe('Send Message');
      });

      it('includes submit action pipeline with api_request, success toast, and error toast', () => {
        const block = STARTER_BLOCKS.find((b) => b.id === 'form-contact-us')!;
        const tree = block.createNodeTree();
        const container = tree.children?.[0];
        const formNode = container?.children?.find((c) => c.type === 'form')!;

        expect(formNode.actions).toBeDefined();
        expect(formNode.actions!.length).toBe(1);

        const pipeline = formNode.actions![0];
        expect(pipeline.trigger).toBe('submit');
        expect(pipeline.steps.length).toBe(1);

        const apiStep = pipeline.steps[0];
        expect(apiStep.type).toBe('api_request');
        expect(apiStep.payload?.url).toBe('/api/mock/submit-lead');
        expect(apiStep.payload?.method).toBe('POST');

        // Verify onSuccess toast
        expect(apiStep.onSuccess).toBeDefined();
        const toastSuccess = apiStep.onSuccess?.find((s) => s.type === 'show_toast');
        expect(toastSuccess).toBeDefined();
        expect(toastSuccess?.payload?.type).toBe('success');

        // Verify onError toast
        expect(apiStep.onError).toBeDefined();
        const toastError = apiStep.onError?.find((s) => s.type === 'show_toast');
        expect(toastError).toBeDefined();
        expect(toastError?.payload?.type).toBe('error');
      });

      it('inserts cleanly into document and passes full schema & registry validation', () => {
        const block = STARTER_BLOCKS.find((b) => b.id === 'form-contact-us')!;
        const tree = block.createNodeTree();

        let doc = createBlankDocument('Contact Us Page');
        doc = insertNode(doc, { parentId: doc.document.id, node: tree }).document;

        const validation = validateDocument(doc, { componentRegistry: registry });
        expect(validation.valid).toBe(true);
        expect(validation.errors).toEqual([]);
      });
    });

    describe('Newsletter Subscribe Form (form-newsletter)', () => {
      it('generates an inline form with Email input and Subscribe button', () => {
        const block = STARTER_BLOCKS.find((b) => b.id === 'form-newsletter')!;
        expect(block).toBeDefined();
        expect(block.name).toBe('Newsletter Subscribe Form');

        const tree = block.createNodeTree();
        expect(tree.type).toBe('section');

        const container = tree.children?.[0];
        expect(container?.type).toBe('container');

        const formNode = container?.children?.find((c) => c.type === 'form');
        expect(formNode).toBeDefined();
        expect(formNode?.props?.name).toBe('newsletter_form');

        // Check inline layout style
        expect(formNode?.styles?.base?.display).toBe('flex');
        expect(formNode?.styles?.base?.flexDirection).toBe('row');

        const emailInput = formNode?.children?.find((c) => c.type === 'input');
        expect(emailInput).toBeDefined();
        expect(emailInput?.props?.name).toBe('email');
        expect(emailInput?.props?.type).toBe('email');
        expect(emailInput?.props?.required).toBe(true);

        const subBtn = formNode?.children?.find((c) => c.type === 'button');
        expect(subBtn).toBeDefined();
        expect(subBtn?.props?.buttonType).toBe('submit');
        expect(subBtn?.props?.label).toBe('Subscribe');
      });

      it('includes submit action pipeline with api_request and toast feedback', () => {
        const block = STARTER_BLOCKS.find((b) => b.id === 'form-newsletter')!;
        const tree = block.createNodeTree();
        const container = tree.children?.[0];
        const formNode = container?.children?.find((c) => c.type === 'form')!;

        expect(formNode.actions).toBeDefined();
        expect(formNode.actions!.length).toBe(1);

        const apiStep = formNode.actions![0].steps[0];
        expect(apiStep.type).toBe('api_request');
        expect(apiStep.onSuccess?.some((s) => s.type === 'show_toast')).toBe(true);
        expect(apiStep.onError?.some((s) => s.type === 'show_toast')).toBe(true);
      });

      it('inserts cleanly into document and passes full schema & registry validation', () => {
        const block = STARTER_BLOCKS.find((b) => b.id === 'form-newsletter')!;
        const tree = block.createNodeTree();

        let doc = createBlankDocument('Newsletter Page');
        doc = insertNode(doc, { parentId: doc.document.id, node: tree }).document;

        const validation = validateDocument(doc, { componentRegistry: registry });
        expect(validation.valid).toBe(true);
        expect(validation.errors).toEqual([]);
      });
    });

    describe('Lead Generation Form (form-lead-gen)', () => {
      it('generates a multi-field form with phone validation rule and interest dropdown', () => {
        const block = STARTER_BLOCKS.find((b) => b.id === 'form-lead-gen')!;
        expect(block).toBeDefined();
        expect(block.name).toBe('Lead Generation Form');

        const tree = block.createNodeTree();
        expect(tree.type).toBe('section');

        const container = tree.children?.[0];
        expect(container?.type).toBe('container');

        const formNode = container?.children?.find((c) => c.type === 'form');
        expect(formNode).toBeDefined();
        expect(formNode?.props?.name).toBe('lead_generation_form');

        // Check phone input with custom_regex rule
        const phoneInput = formNode?.children?.find(
          (c) => c.type === 'input' && c.props?.name === 'phone',
        );
        expect(phoneInput).toBeDefined();
        expect(phoneInput?.props?.type).toBe('tel');
        expect(phoneInput?.props?.required).toBe(true);

        const phoneRules = (phoneInput?.props?.rules as Array<{ type: string; value?: unknown }>) ?? [];
        expect(phoneRules.some((r) => r.type === 'required')).toBe(true);
        const regexRule = phoneRules.find((r) => r.type === 'custom_regex');
        expect(regexRule).toBeDefined();
        expect(regexRule?.value).toBe('^[+]?[0-9\\s-()]{8,20}$');

        // Check interest select dropdown with options
        const selectNode = formNode?.children?.find((c) => c.type === 'select');
        expect(selectNode).toBeDefined();
        expect(selectNode?.props?.name).toBe('interest');
        expect(selectNode?.props?.required).toBe(true);
        const options = selectNode?.props?.options as Array<{ label: string; value: string }>;
        expect(Array.isArray(options)).toBe(true);
        expect(options.length).toBeGreaterThanOrEqual(4);
        expect(options.some((o) => o.value === 'web_platform')).toBe(true);

        // Check submit button
        const submitBtn = formNode?.children?.find((c) => c.type === 'button');
        expect(submitBtn).toBeDefined();
        expect(submitBtn?.props?.buttonType).toBe('submit');
      });

      it('includes submit action pipeline with api_request and toast feedback', () => {
        const block = STARTER_BLOCKS.find((b) => b.id === 'form-lead-gen')!;
        const tree = block.createNodeTree();
        const container = tree.children?.[0];
        const formNode = container?.children?.find((c) => c.type === 'form')!;

        expect(formNode.actions).toBeDefined();
        expect(formNode.actions!.length).toBe(1);

        const apiStep = formNode.actions![0].steps[0];
        expect(apiStep.type).toBe('api_request');
        expect(apiStep.payload?.url).toBe('/api/mock/submit-lead');
        expect(apiStep.onSuccess?.some((s) => s.type === 'show_toast')).toBe(true);
        expect(apiStep.onError?.some((s) => s.type === 'show_toast')).toBe(true);
      });

      it('inserts cleanly into document and passes full schema & registry validation', () => {
        const block = STARTER_BLOCKS.find((b) => b.id === 'form-lead-gen')!;
        const tree = block.createNodeTree();

        let doc = createBlankDocument('Lead Gen Page');
        doc = insertNode(doc, { parentId: doc.document.id, node: tree }).document;

        const validation = validateDocument(doc, { componentRegistry: registry });
        expect(validation.valid).toBe(true);
        expect(validation.errors).toEqual([]);
      });
    });
  });
});

