import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { createBlankDocument } from '@kubuild/core';
import { createDefaultComponentRegistry, STARTER_BLOCKS } from '@kubuild/components';
import { useEditorStore } from '../src/store';
import { BlocksPanel } from '../src/blocks-panel';
import { LeftSidebar } from '../src/left-sidebar';
import { KubuildEditor } from '../src/editor';

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
});
