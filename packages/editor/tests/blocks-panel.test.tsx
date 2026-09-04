import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { createBlankDocument } from '@kubuild/core';
import { createDefaultComponentRegistry, STARTER_BLOCKS } from '@kubuild/components';
import { useEditorStore } from '../src/store';
import { BlocksPanel } from '../src/components/panels/blocks-panel';
import { LeftSidebar } from '../src/components/panels/left-sidebar';
import { KubuildEditor } from '../src/components/layout/editor';

describe('Block Manager & Pre-composed Templates (STORA-240)', () => {
  const registry = createDefaultComponentRegistry();

  beforeEach(() => {
    const doc = createBlankDocument('Blocks Test');
    useEditorStore.getState().setDocument(doc);
  });

  describe('STORA-240: BlocksPanel UI & Grid Rendering', () => {
    it('renders the blocks panel with categories and block cards', () => {
      const html = renderToString(<BlocksPanel registry={registry} />);

      expect(html).toContain('data-testid="blocks-panel"');
      expect(html).toContain('All Blocks');
      expect(html).toContain('layout');
      expect(html).toContain('sections');
      expect(html).toContain('ui');
      expect(html).toContain('pricing');
      expect(html).toContain('cta');

      // Check for starter block names
      expect(html).toContain('1 Column');
      expect(html).toContain('2 Columns (50/50)');
      expect(html).toContain('3 Columns');
      expect(html).toContain('Hero Section');
      expect(html).toContain('Feature Card');
      expect(html).toContain('Pricing Table');
      expect(html).toContain('CTA Banner');
    });

    it('renders card with name, category, and thumbnail for each block', () => {
      const html = renderToString(<BlocksPanel registry={registry} />);

      STARTER_BLOCKS.forEach((block) => {
        expect(html).toContain(block.name);
        expect(html).toContain(block.category);
        expect(html).toContain(`data-block-id="${block.id}"`);
      });
    });

    it('inserts a layout block into document when onInsertBlock / handleInsert is called', () => {
      const doc = createBlankDocument('Insertion Test');
      useEditorStore.getState().setDocument(doc);

      const block = STARTER_BLOCKS.find((b) => b.id === 'layout-2-col-50-50')!;
      const tree = block.createNodeTree();

      expect(tree.type).toBe('section');
      expect(tree.children?.[0].type).toBe('columns');
      expect(tree.children?.[0].children?.length).toBe(2);
    });

    it('inserts a pre-composed UI hero block with children and styling', () => {
      const block = STARTER_BLOCKS.find((b) => b.id === 'hero-section')!;
      const tree = block.createNodeTree();

      expect(tree.type).toBe('section');
      const container = tree.children?.[0];
      expect(container?.type).toBe('container');
      expect(container?.children?.map((c) => c.type)).toEqual(['heading', 'paragraph', 'button']);
    });
  });

  describe('LeftSidebar Tab Switcher', () => {
    it('renders Components, Blocks, and Layers tabs in LeftSidebar', () => {
      const html = renderToString(<LeftSidebar registry={registry} />);

      expect(html).toContain('data-testid="tab-components"');
      expect(html).toContain('data-testid="tab-blocks"');
      expect(html).toContain('data-testid="tab-layers"');
      expect(html).toContain('Components');
      expect(html).toContain('Blocks');
      expect(html).toContain('Layers');
    });

    it('renders BlocksPanel when defaultTab="blocks"', () => {
      const html = renderToString(<LeftSidebar registry={registry} defaultTab="blocks" />);

      expect(html).toContain('data-testid="blocks-panel"');
      expect(html).toContain('1 Column');
      expect(html).toContain('Hero Section');
    });

    it('is integrated inside KubuildEditor left area', () => {
      const html = renderToString(<KubuildEditor registry={registry} />);

      expect(html).toContain('data-testid="tab-components"');
      expect(html).toContain('data-testid="tab-blocks"');
      expect(html).toContain('data-testid="tab-layers"');
    });
  });

  describe('STORA-350: Form Starter Templates in BlocksPanel', () => {
    it('renders "forms" category pill and form starter block cards', () => {
      const html = renderToString(<BlocksPanel registry={registry} />);

      // Verify forms category appears in category filter pills
      expect(html).toContain('forms');

      // Verify form starter template cards appear in Block Manager
      expect(html).toContain('Contact Us Form');
      expect(html).toContain('Newsletter Subscribe Form');
      expect(html).toContain('Lead Generation Form');
      expect(html).toContain('data-block-id="form-contact-us"');
      expect(html).toContain('data-block-id="form-newsletter"');
      expect(html).toContain('data-block-id="form-lead-gen"');
    });

    it('inserts Contact Us Form into document store on canvas', () => {
      const store = useEditorStore.getState();
      const res = store.insertBlock('form-contact-us');

      expect(res.success).toBe(true);
      expect(res.nodeId).toBeDefined();

      const doc = useEditorStore.getState().document;
      const insertedSection = doc.document.children?.find((c) => c.id === res.nodeId);
      expect(insertedSection).toBeDefined();
      expect(insertedSection?.type).toBe('section');

      // Check form and fields exist inside container
      const container = insertedSection?.children?.[0];
      expect(container?.type).toBe('container');
      const form = container?.children?.find((c) => c.type === 'form');
      expect(form).toBeDefined();
      expect(form?.props?.name).toBe('contact_us_form');

      // Check submit button with action pipeline
      const submitBtn = form?.children?.find((c) => c.type === 'button');
      expect(submitBtn?.props?.buttonType).toBe('submit');
      expect(form?.actions?.[0].trigger).toBe('submit');
      expect(form?.actions?.[0].steps[0].type).toBe('api_request');
    });

    it('inserts Newsletter Subscribe Form into document store on canvas', () => {
      const store = useEditorStore.getState();
      const res = store.insertBlock('form-newsletter');

      expect(res.success).toBe(true);
      const doc = useEditorStore.getState().document;
      const insertedSection = doc.document.children?.find((c) => c.id === res.nodeId);
      expect(insertedSection).toBeDefined();

      const form = insertedSection?.children?.[0]?.children?.find((c) => c.type === 'form');
      expect(form).toBeDefined();
      expect(form?.props?.name).toBe('newsletter_form');
      expect(form?.children?.some((c) => c.props?.name === 'email')).toBe(true);
      expect(form?.children?.some((c) => c.type === 'button' && c.props?.buttonType === 'submit')).toBe(true);
    });

    it('inserts Lead Generation Form with phone validation and interest select dropdown', () => {
      const store = useEditorStore.getState();
      const res = store.insertBlock('form-lead-gen');

      expect(res.success).toBe(true);
      const doc = useEditorStore.getState().document;
      const insertedSection = doc.document.children?.find((c) => c.id === res.nodeId);
      expect(insertedSection).toBeDefined();

      const form = insertedSection?.children?.[0]?.children?.find((c) => c.type === 'form');
      expect(form).toBeDefined();

      // Check phone input with custom_regex rule
      const phoneInput = form?.children?.find((c) => c.props?.name === 'phone');
      expect(phoneInput).toBeDefined();
      const rules = (phoneInput?.props?.rules as Array<{ type: string; value?: unknown }>) ?? [];
      expect(rules.some((r) => r.type === 'custom_regex')).toBe(true);

      // Check interest select dropdown
      const interestSelect = form?.children?.find((c) => c.props?.name === 'interest');
      expect(interestSelect).toBeDefined();
      expect(interestSelect?.type).toBe('select');
      expect(Array.isArray(interestSelect?.props?.options)).toBe(true);
    });
  });
});
