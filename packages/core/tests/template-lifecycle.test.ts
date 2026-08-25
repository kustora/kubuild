import { describe, it, expect } from 'vitest';
import {
  saveDraftAsTemplate,
  cloneTemplateAsPage,
  areNodeIdsCompletelyDistinct,
  createTemplateRecord,
} from '../src/template-utils';
import {
  insertNode,
  updateProps,
  updateStyle,
  removeNode,
  duplicateNode,
} from '../src/commands';
import { DocumentHistoryManager } from '../src/history';
import { starterPageFixture, collectNodeIds, type PageDocument, type Node } from '@kubuild/schema';

describe('STORA-071: Save Draft as Template and Clone as New Page', () => {
  describe('Acceptance Criteria 1: Save as template requires mandatory metadata and saves valid snapshot', () => {
    it('saves draft snapshot as a valid TemplateRecord with mandatory metadata', () => {
      const template = saveDraftAsTemplate(starterPageFixture, {
        id: 'tmpl_starter_01',
        name: 'Starter Landing Template',
        description: 'Clean starter landing page',
        category: 'landing',
        tags: ['starter', 'hero'],
        author: 'KUBUILD Team',
        version: '1.0.0',
      });

      expect(template.id).toBe('tmpl_starter_01');
      expect(template.name).toBe('Starter Landing Template');
      expect(template.description).toBe('Clean starter landing page');
      expect(template.category).toBe('landing');
      expect(template.tags).toEqual(['starter', 'hero']);
      expect(template.version).toBe('1.0.0');
      expect(template.document).toBeDefined();
      expect(template.createdAt).toBeDefined();
      expect(template.updatedAt).toBeDefined();
      expect(template.requirements.requiredComponents).toEqual([]);
    });

    it('rejects save as template if id or name is missing or empty', () => {
      expect(() =>
        saveDraftAsTemplate(starterPageFixture, {
          id: '',
          name: 'Valid Name',
        })
      ).toThrow(/Template ID is required/i);

      expect(() =>
        saveDraftAsTemplate(starterPageFixture, {
          id: '   ',
          name: 'Valid Name',
        })
      ).toThrow(/Template ID is required/i);

      expect(() =>
        saveDraftAsTemplate(starterPageFixture, {
          id: 'tmpl_01',
          name: '',
        })
      ).toThrow(/Template name is required/i);

      expect(() =>
        saveDraftAsTemplate(starterPageFixture, {
          id: 'tmpl_01',
          name: '   ',
        })
      ).toThrow(/Template name is required/i);

      expect(() =>
        // @ts-expect-error test runtime validation
        saveDraftAsTemplate(starterPageFixture, null)
      ).toThrow(/Save as template requires metadata/i);
    });

    it('automatically extracts custom requirements when saving a draft with custom components', () => {
      const draftWithCustom: PageDocument = {
        ...starterPageFixture,
        document: {
          ...starterPageFixture.document,
          children: [
            {
              id: 'custom_banner',
              type: 'custom.countdown-timer',
              props: { targetDate: '2026-12-31' },
            },
          ],
        },
      };

      const template = saveDraftAsTemplate(draftWithCustom, {
        id: 'tmpl_custom_timer',
        name: 'Countdown Timer Landing',
      });

      expect(template.requirements.requiredComponents).toContain('custom.countdown-timer');
    });

    it('rejects saving an invalid draft document', () => {
      const invalidDoc: PageDocument = {
        schema: 'stora.page',
        version: '1.0.0',
        document: {
          id: 'duplicate_root',
          // @ts-expect-error invalid root type
          type: 'container',
          children: [],
        },
      };

      expect(() =>
        saveDraftAsTemplate(invalidDoc, {
          id: 'tmpl_invalid',
          name: 'Invalid Draft',
        })
      ).toThrow(/Cannot save invalid draft as template/i);
    });

    it('creates an immutable snapshot decoupled from future draft changes', () => {
      const draft: PageDocument = JSON.parse(JSON.stringify(starterPageFixture));
      const template = saveDraftAsTemplate(draft, {
        id: 'tmpl_snapshot',
        name: 'Snapshot Template',
      });

      // Modify the original draft
      draft.document.children = [];
      if (draft.metadata) {
        draft.metadata.title = 'Mutated Draft Title';
      }

      // Template snapshot should remain completely intact
      expect(template.document?.document.children?.length).toBe(1);
      expect(template.document?.metadata?.title).toBe('Welcome to KUBUILD');
    });
  });

  describe('Acceptance Criteria 2: Use template generates document with all node IDs different', () => {
    it('clones a template into a new page document where 100% of node IDs are different', () => {
      const template = saveDraftAsTemplate(starterPageFixture, {
        id: 'tmpl_clone_source',
        name: 'Source Template',
        version: '2.1.0',
      });

      const clonedPage = cloneTemplateAsPage(template, {
        title: 'My Brand New Page',
      });

      expect(clonedPage.schema).toBe('stora.page');
      expect(clonedPage.metadata?.title).toBe('My Brand New Page');
      expect(clonedPage.metadata?.version).toBe('1.0.0');
      expect(clonedPage.metadata?.custom?.originTemplate).toEqual({
        id: 'tmpl_clone_source',
        name: 'Source Template',
        version: '2.1.0',
      });

      const templateIds = collectNodeIds(template.document!.document);
      const clonedIds = collectNodeIds(clonedPage.document);

      expect(templateIds.length).toBeGreaterThan(0);
      expect(clonedIds.length).toBe(templateIds.length);

      // Verify that every single node ID in clonedPage is distinct from templateIds
      expect(areNodeIdsCompletelyDistinct(template.document!, clonedPage)).toBe(true);

      // Verify no duplicate IDs within the cloned page itself
      const clonedIdSet = new Set(clonedIds);
      expect(clonedIdSet.size).toBe(clonedIds.length);

      // Root node ID is also changed and guaranteed to be 'page'
      expect(clonedPage.document.type).toBe('page');
      expect(clonedPage.document.id).not.toBe(template.document!.document.id);
    });

    it('clones directly from a PageDocument with newly generated unique IDs', () => {
      const clonedPage = cloneTemplateAsPage(starterPageFixture);
      expect(areNodeIdsCompletelyDistinct(starterPageFixture, clonedPage)).toBe(true);
    });

    it('throws when trying to clone a template record without an inline document snapshot', () => {
      const templateWithoutDoc = createTemplateRecord({
        id: 'tmpl_external_only',
        name: 'External Package Template',
        packageReference: {
          path: 'templates/sample.stora',
          format: 'stora',
        },
      });

      expect(() => cloneTemplateAsPage(templateWithoutDoc)).toThrow(
        /does not contain an inline document snapshot/i
      );
    });
  });

  describe('Acceptance Criteria 3: Edit and undo/redo on clone does not mutate template source', () => {
    it('editing cloned page via commands leaves template source completely untouched', () => {
      const template = saveDraftAsTemplate(starterPageFixture, {
        id: 'tmpl_for_edit_isolation',
        name: 'Isolation Template',
      });

      const originalTemplateJson = JSON.stringify(template);

      let clonedPage = cloneTemplateAsPage(template);

      // 1. Insert a new node into cloned page
      const newChildNode: Node = {
        id: 'newly_added_text',
        type: 'text',
        props: { content: 'Brand new text in clone' },
      };
      const insertResult = insertNode(clonedPage, {
        parentId: clonedPage.document.id,
        node: newChildNode,
      });
      clonedPage = insertResult.document;

      // 2. Update props of root page or hero heading in clone
      const firstSection = clonedPage.document.children?.[0];
      if (firstSection) {
        const updateResult = updateProps(clonedPage, {
          nodeId: firstSection.id,
          props: { customHeroProp: 'clonedValue' },
        });
        clonedPage = updateResult.document;
      }

      // 3. Remove a node from clone
      if (firstSection) {
        const removeResult = removeNode(clonedPage, { nodeId: firstSection.id });
        clonedPage = removeResult.document;
      }

      // Verify that template snapshot is identical to original stringified JSON
      expect(JSON.stringify(template)).toBe(originalTemplateJson);
    });

    it('undo and redo operations in history manager do not alter template source', () => {
      const template = saveDraftAsTemplate(starterPageFixture, {
        id: 'tmpl_history_test',
        name: 'History Isolation Template',
      });

      const initialTemplateSnapshot = JSON.stringify(template);

      const clonedPage = cloneTemplateAsPage(template);
      const history = new DocumentHistoryManager(clonedPage);

      // Perform multiple edits in history
      history.execute((doc) =>
        insertNode(doc, {
          parentId: doc.document.id,
          node: { id: 'temp_node_1', type: 'text', props: { text: 'Hello' } },
        })
      );

      history.execute((doc) =>
        updateProps(doc, {
          nodeId: 'temp_node_1',
          props: { text: 'Hello World' },
        })
      );

      // Undo all edits
      history.undo();
      history.undo();
      expect(history.canUndo).toBe(false);

      // Redo
      history.redo();
      expect(history.canRedo).toBe(true);

      // Verify template remains pristine
      expect(JSON.stringify(template)).toBe(initialTemplateSnapshot);
    });
  });
});
