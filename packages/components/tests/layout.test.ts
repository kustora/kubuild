import { describe, it, expect } from 'vitest';
import {
  createDefaultComponentRegistry,
  pageDefinition,
  sectionDefinition,
  containerDefinition,
  columnsDefinition,
} from '../src/index';
import { validateDocument, createBlankDocument, insertNode } from '@kubuild/core';
import { ResponsiveStylesSchema } from '@kubuild/schema';

describe('STORA-021: Layout Components (page/section/container/columns)', () => {
  describe('Acceptance Criteria 1: page > section > container > columns forms a valid document', () => {
    it('validates a document built from the full layout chain', () => {
      const registry = createDefaultComponentRegistry();
      let doc = createBlankDocument('Layout Test');

      doc = insertNode(doc, {
        parentId: 'root-page',
        node: { id: 'section-1', type: 'section', props: {}, children: [] },
      }).document;
      doc = insertNode(doc, {
        parentId: 'section-1',
        node: { id: 'container-1', type: 'container', props: {}, children: [] },
      }).document;
      doc = insertNode(doc, {
        parentId: 'container-1',
        node: { id: 'columns-1', type: 'columns', props: {}, children: [] },
      }).document;

      const result = validateDocument(doc, { componentRegistry: registry });
      expect(result.errors).toEqual([]);
      expect(result.valid).toBe(true);
    });
  });

  describe('Acceptance Criteria 2: child policy prevents content-as-root and page-in-page', () => {
    it('rejects a content node as the document root', () => {
      const registry = createDefaultComponentRegistry();
      const doc = createBlankDocument('Invalid Root');
      const invalidDoc = { ...doc, document: { id: 'root-page', type: 'heading', props: {}, children: [] } };

      const result = validateDocument(invalidDoc, { componentRegistry: registry });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === 'ROOT_NODE_INVALID')).toBe(true);
    });

    it('rejects a "page" node nested inside the document tree', () => {
      const registry = createDefaultComponentRegistry();
      let doc = createBlankDocument('Nested Page Test');
      doc = insertNode(doc, {
        parentId: 'root-page',
        node: { id: 'section-1', type: 'section', props: {}, children: [] },
      }).document;
      doc = insertNode(doc, {
        parentId: 'section-1',
        node: { id: 'container-1', type: 'container', props: {}, children: [] },
      }).document;
      doc = insertNode(doc, {
        parentId: 'container-1',
        node: { id: 'nested-page', type: 'page', props: {}, children: [] },
      }).document;

      const result = validateDocument(doc, { componentRegistry: registry });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === 'CHILD_POLICY_VIOLATION')).toBe(true);
    });
  });

  describe('Acceptance Criteria 3: desktop/tablet/mobile style overrides are validated', () => {
    it.each([
      ['page', pageDefinition],
      ['section', sectionDefinition],
      ['container', containerDefinition],
      ['columns', columnsDefinition],
    ])('%s defaultStyles conform to ResponsiveStylesSchema', (_type, definition) => {
      const parsed = ResponsiveStylesSchema.safeParse(definition.defaultStyles);
      expect(parsed.success).toBe(true);
    });

    it('section, container, and columns declare tablet and mobile overrides', () => {
      expect(sectionDefinition.defaultStyles?.tablet).toBeDefined();
      expect(sectionDefinition.defaultStyles?.mobile).toBeDefined();
      expect(containerDefinition.defaultStyles?.tablet).toBeDefined();
      expect(containerDefinition.defaultStyles?.mobile).toBeDefined();
      expect(columnsDefinition.defaultStyles?.tablet).toBeDefined();
      expect(columnsDefinition.defaultStyles?.mobile).toBeDefined();
    });

    it('columns collapses to a single track on mobile', () => {
      expect(columnsDefinition.defaultStyles?.mobile?.gridTemplateColumns).toBe('repeat(1, minmax(0, 1fr))');
    });
  });
});

