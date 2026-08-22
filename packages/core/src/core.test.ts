import { describe, it, expect } from 'vitest';
import {
  createBlankDocument,
  validateDocument,
  findNodeById,
  insertNode,
  moveNode,
  updateProps,
  updateStyle,
  removeNode,
  duplicateNode,
  findNodeLocation,
  isDescendantOf,
  HistoryEngine,
  DocumentHistoryManager,
  DEFAULT_MAX_HISTORY,
  ComponentRegistryLike,
} from './index';
import { PageDocument, Node } from '@kubuild/schema';

describe('STORA-011: Document Validator and Error Diagnostics', () => {
  const mockRegistry: ComponentRegistryLike = {
    has(type: string) {
      return ['page', 'section', 'container', 'heading', 'text', 'image', 'button'].includes(type);
    },
    get(type: string) {
      if (type === 'page') {
        return { type: 'page', acceptsChildren: true, allowedChildren: ['section', 'container'] };
      }
      if (type === 'section') {
        return { type: 'section', acceptsChildren: true, allowedChildren: ['container', 'heading', 'text', 'button', 'image'] };
      }
      if (type === 'container') {
        return { type: 'container', acceptsChildren: true, allowedChildren: ['heading', 'text', 'button', 'image'] };
      }
      if (['heading', 'text', 'image', 'button'].includes(type)) {
        return { type, acceptsChildren: false };
      }
      return undefined;
    },
  };

  describe('Acceptance Criteria 1: Valid document produces success without input mutation', () => {
    it('returns success for a valid document without modifying input', () => {
      const originalDoc = createBlankDocument('Home Page');
      const clonedSnapshot = JSON.parse(JSON.stringify(originalDoc));

      const result = validateDocument(originalDoc);

      expect(result.valid).toBe(true);
      expect(result.success).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.data?.schema).toBe('stora.page');
      // Ensure input was not mutated
      expect(originalDoc).toEqual(clonedSnapshot);
    });
  });

  describe('Acceptance Criteria 2 & 4: Error Diagnostics with Code, Message, and JSON Path for all error classes', () => {
    it('Error Class 1: GLOBAL_SCHEMA_INVALID (missing or invalid schema/version/document)', () => {
      const invalidSchemaDoc = {
        schema: 'wrong.schema',
        version: '',
      };
      const result = validateDocument(invalidSchemaDoc);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);

      const schemaError = result.errors.find((e) => e.path === '/schema');
      expect(schemaError?.code).toBe('GLOBAL_SCHEMA_INVALID');
      expect(schemaError?.message).toContain('Expected "stora.page"');

      const versionError = result.errors.find((e) => e.path === '/version');
      expect(versionError?.code).toBe('GLOBAL_SCHEMA_INVALID');
      expect(versionError?.message).toContain('version');

      const docError = result.errors.find((e) => e.path === '/document');
      expect(docError?.code).toBe('GLOBAL_SCHEMA_INVALID');
    });

    it('Error Class 2: ROOT_NODE_INVALID (root node type is not "page")', () => {
      const docWithWrongRoot = {
        schema: 'stora.page',
        version: '1.0.0',
        document: {
          id: 'root-box',
          type: 'container',
          children: [],
        },
      };
      const result = validateDocument(docWithWrongRoot);
      expect(result.valid).toBe(false);
      const rootError = result.errors.find((e) => e.path === '/document/type');
      expect(rootError?.code).toBe('ROOT_NODE_INVALID');
      expect(rootError?.message).toContain('Root node type must be "page"');
      expect(rootError?.nodeId).toBe('root-box');
    });

    it('Error Class 3: NODE_SHAPE_INVALID (missing id or invalid type/children/props/styles)', () => {
      const malformedDoc = {
        schema: 'stora.page',
        version: '1.0.0',
        document: {
          id: '',
          type: 'page',
          children: [
            {
              id: 'node-1',
              type: '',
              children: 'not-an-array' as unknown as Node[],
            },
          ],
        },
      };
      const result = validateDocument(malformedDoc);
      expect(result.valid).toBe(false);

      const rootIdError = result.errors.find((e) => e.path === '/document/id');
      expect(rootIdError?.code).toBe('NODE_SHAPE_INVALID');

      const childTypeError = result.errors.find((e) => e.path === '/document/children/0/type');
      expect(childTypeError?.code).toBe('NODE_SHAPE_INVALID');

      const childrenShapeError = result.errors.find((e) => e.path === '/document/children/0/children');
      expect(childrenShapeError?.code).toBe('NODE_SHAPE_INVALID');
    });

    it('Error Class 4: DUPLICATE_NODE_ID (duplicate id across tree is rejected with JSON path)', () => {
      const docWithDuplicates = {
        schema: 'stora.page',
        version: '1.0.0',
        document: {
          id: 'root-page',
          type: 'page',
          children: [
            {
              id: 'dup-id',
              type: 'section',
              children: [],
            },
            {
              id: 'dup-id',
              type: 'section',
              children: [],
            },
          ],
        },
      };
      const result = validateDocument(docWithDuplicates);
      expect(result.valid).toBe(false);
      const dupError = result.errors.find((e) => e.code === 'DUPLICATE_NODE_ID');
      expect(dupError).toBeDefined();
      expect(dupError?.path).toBe('/document/children/1/id');
      expect(dupError?.nodeId).toBe('dup-id');
      expect(dupError?.message).toContain('Duplicate node ID "dup-id"');
    });

    it('Error Class 5: TREE_CYCLE_DETECTED (circular references in node tree are rejected)', () => {
      const cycleChild: Record<string, unknown> = {
        id: 'cycle-node',
        type: 'section',
        children: [],
      };
      // Create cycle
      const cycleParent: Record<string, unknown> = {
        id: 'root-page',
        type: 'page',
        children: [cycleChild],
      };
      (cycleChild.children as unknown[]).push(cycleParent);

      const cycleDoc = {
        schema: 'stora.page',
        version: '1.0.0',
        document: cycleParent,
      };

      const result = validateDocument(cycleDoc);
      expect(result.valid).toBe(false);
      const cycleError = result.errors.find((e) => e.code === 'TREE_CYCLE_DETECTED');
      expect(cycleError).toBeDefined();
      expect(cycleError?.path).toBe('/document/children/0/children/0');
    });

    it('Error Class 6: UNKNOWN_COMPONENT_TYPE (unregistered component type is rejected)', () => {
      const docWithUnknownType = {
        schema: 'stora.page',
        version: '1.0.0',
        document: {
          id: 'root-page',
          type: 'page',
          children: [
            {
              id: 'secret-widget',
              type: 'unregistered-3d-gizmo',
              children: [],
            },
          ],
        },
      };
      const result = validateDocument(docWithUnknownType, {
        componentRegistry: mockRegistry,
        strictComponentTypes: true,
      });
      expect(result.valid).toBe(false);
      const unknownError = result.errors.find((e) => e.code === 'UNKNOWN_COMPONENT_TYPE');
      expect(unknownError).toBeDefined();
      expect(unknownError?.path).toBe('/document/children/0/type');
      expect(unknownError?.message).toContain('Unknown component type: "unregistered-3d-gizmo"');
    });

    it('Error Class 7: CHILD_POLICY_VIOLATION (leaf components with children or disallowed types)', () => {
      const docWithLeafChildren = {
        schema: 'stora.page',
        version: '1.0.0',
        document: {
          id: 'root-page',
          type: 'page',
          children: [
            {
              id: 'section-1',
              type: 'section',
              children: [
                {
                  id: 'btn-1',
                  type: 'button', // leaf component (acceptsChildren: false)
                  children: [
                    {
                      id: 'nested-text',
                      type: 'text',
                      children: [],
                    },
                  ],
                },
              ],
            },
          ],
        },
      };
      const resultLeaf = validateDocument(docWithLeafChildren, {
        componentRegistry: mockRegistry,
      });
      expect(resultLeaf.valid).toBe(false);
      const policyError = resultLeaf.errors.find((e) => e.path === '/document/children/0/children/0/children');
      expect(policyError?.code).toBe('CHILD_POLICY_VIOLATION');
      expect(policyError?.message).toContain('does not accept children');

      // Test disallowed child type
      const docWithDisallowedChild = {
        schema: 'stora.page',
        version: '1.0.0',
        document: {
          id: 'root-page',
          type: 'page',
          children: [
            {
              id: 'image-root',
              type: 'image', // not allowed directly under page (page allows section, container)
              children: [],
            },
          ],
        },
      };
      const resultDisallowed = validateDocument(docWithDisallowedChild, {
        componentRegistry: mockRegistry,
      });
      expect(resultDisallowed.valid).toBe(false);
      const disallowedError = resultDisallowed.errors.find((e) => e.path === '/document/children/0/type');
      expect(disallowedError?.code).toBe('CHILD_POLICY_VIOLATION');
      expect(disallowedError?.message).toContain('is not allowed as a child of "page"');
    });

    it('Error Class 8: INVALID_ASSET_REFERENCE (asset binding with empty assetId)', () => {
      const docWithBadAsset = {
        schema: 'stora.page',
        version: '1.0.0',
        document: {
          id: 'root-page',
          type: 'page',
          children: [
            {
              id: 'img-1',
              type: 'image',
              props: {
                asset: {
                  type: 'asset',
                  assetId: '', // invalid empty assetId
                },
              },
              children: [],
            },
          ],
        },
      };
      const result = validateDocument(docWithBadAsset);
      expect(result.valid).toBe(false);
      const assetError = result.errors.find((e) => e.code === 'INVALID_ASSET_REFERENCE');
      expect(assetError).toBeDefined();
      expect(assetError?.path).toBe('/document/children/0/props/asset/assetId');
    });

    it('Error Class 9: INVALID_VARIABLE_BINDING (variable binding with empty key)', () => {
      const docWithBadVar = {
        schema: 'stora.page',
        version: '1.0.0',
        document: {
          id: 'root-page',
          type: 'page',
          children: [
            {
              id: 'head-1',
              type: 'heading',
              props: {
                title: {
                  type: 'variable',
                  key: '', // invalid empty key
                },
              },
              children: [],
            },
          ],
        },
      };
      const result = validateDocument(docWithBadVar);
      expect(result.valid).toBe(false);
      const varError = result.errors.find((e) => e.code === 'INVALID_VARIABLE_BINDING');
      expect(varError).toBeDefined();
      expect(varError?.path).toBe('/document/children/0/props/title/key');
    });

    it('Error Class 10: INVALID_ACTION_BINDING (action binding with empty type)', () => {
      const docWithBadAction = {
        schema: 'stora.page',
        version: '1.0.0',
        document: {
          id: 'root-page',
          type: 'page',
          children: [
            {
              id: 'btn-1',
              type: 'button',
              props: {
                action: {
                  type: '', // invalid empty type
                  payload: { url: '/test' },
                },
              },
              children: [],
            },
          ],
        },
      };
      const result = validateDocument(docWithBadAction);
      expect(result.valid).toBe(false);
      const actionError = result.errors.find((e) => e.code === 'INVALID_ACTION_BINDING');
      expect(actionError).toBeDefined();
      expect(actionError?.path).toBe('/document/children/0/props/action/type');
    });

    it('Error Class 11: INVALID_METADATA (empty title in metadata)', () => {
      const docWithBadMeta = {
        schema: 'stora.page',
        version: '1.0.0',
        metadata: {
          title: '',
        },
        document: {
          id: 'root-page',
          type: 'page',
          children: [],
        },
      };
      const result = validateDocument(docWithBadMeta);
      expect(result.valid).toBe(false);
      const metaError = result.errors.find((e) => e.code === 'INVALID_METADATA');
      expect(metaError).toBeDefined();
      expect(metaError?.path).toBe('/metadata/title');
    });
  });

  describe('Document tree helper utilities', () => {
    it('finds node by id correctly in nested tree', () => {
      const doc = createBlankDocument();
      doc.document.children = [
        {
          id: 'section-1',
          type: 'section',
          children: [
            {
              id: 'btn-1',
              type: 'button',
              props: { label: 'Click Me' },
            },
          ],
        },
      ];

      const found = findNodeById(doc.document, 'btn-1');
      expect(found).not.toBeNull();
      expect(found?.id).toBe('btn-1');
      expect(found?.props?.label).toBe('Click Me');

      const notFound = findNodeById(doc.document, 'non-existent');
      expect(notFound).toBeNull();
    });
  });
});

describe('STORA-012: Immutable Command Engine', () => {
  const createSampleDoc = (): PageDocument => {
    const doc = createBlankDocument('Test Page');
    doc.document.children = [
      {
        id: 'section-1',
        type: 'section',
        styles: { base: { padding: '20px' } },
        children: [
          {
            id: 'container-1',
            type: 'container',
            children: [
              {
                id: 'heading-1',
                type: 'heading',
                props: { title: 'Initial Title' },
                styles: { base: { color: '#000000' } },
                children: [],
              },
              {
                id: 'button-1',
                type: 'button',
                props: { label: 'Click Me' },
                styles: { base: { backgroundColor: '#blue' } },
                children: [],
              },
            ],
          },
        ],
      },
      {
        id: 'section-2',
        type: 'section',
        children: [],
      },
    ];
    return doc;
  };

  describe('Acceptance Criteria 1: Six commands available via public API', () => {
    it('exports all six commands as callable functions', () => {
      expect(typeof insertNode).toBe('function');
      expect(typeof moveNode).toBe('function');
      expect(typeof updateProps).toBe('function');
      expect(typeof updateStyle).toBe('function');
      expect(typeof removeNode).toBe('function');
      expect(typeof duplicateNode).toBe('function');
    });
  });

  describe('Acceptance Criteria 4: Input document immutability across all commands', () => {
    it('does not mutate input document when executing commands', () => {
      const doc = createSampleDoc();
      const snapshot = JSON.parse(JSON.stringify(doc));

      // Execute insert
      insertNode(doc, {
        parentId: 'container-1',
        node: { id: 'text-1', type: 'text', props: { text: 'Hello' } },
      });
      expect(doc).toEqual(snapshot);

      // Execute move
      moveNode(doc, {
        nodeId: 'button-1',
        targetParentId: 'section-2',
      });
      expect(doc).toEqual(snapshot);

      // Execute updateProps
      updateProps(doc, {
        nodeId: 'heading-1',
        props: { title: 'Updated Title' },
      });
      expect(doc).toEqual(snapshot);

      // Execute updateStyle
      updateStyle(doc, {
        nodeId: 'heading-1',
        styles: { color: '#ffffff' },
        breakpoint: 'base',
      });
      expect(doc).toEqual(snapshot);

      // Execute removeNode
      removeNode(doc, {
        nodeId: 'heading-1',
      });
      expect(doc).toEqual(snapshot);

      // Execute duplicateNode
      duplicateNode(doc, {
        nodeId: 'container-1',
      });
      expect(doc).toEqual(snapshot);
    });
  });

  describe('Command: insertNode', () => {
    it('inserts a node into target parent at specified or default index and emits NODE_INSERTED event', () => {
      const doc = createSampleDoc();
      const newNode: Node = {
        id: 'badge-1',
        type: 'badge',
        props: { label: 'New' },
        children: [],
      };

      const result = insertNode(doc, {
        parentId: 'container-1',
        node: newNode,
        index: 0,
      });

      expect(result.document).not.toBe(doc);
      expect(result.event.type).toBe('NODE_INSERTED');
      expect(result.event.nodeId).toBe('badge-1');
      expect(result.event.parentId).toBe('container-1');
      expect(result.event.index).toBe(0);

      const targetLoc = findNodeLocation(result.document.document, 'badge-1');
      expect(targetLoc?.parent?.id).toBe('container-1');
      expect(targetLoc?.index).toBe(0);
      expect(targetLoc?.node.props?.label).toBe('New');
    });

    it('rejects insertion with duplicate node ID', () => {
      const doc = createSampleDoc();
      const duplicateNodeItem: Node = {
        id: 'heading-1', // Already exists in doc
        type: 'heading',
        children: [],
      };

      expect(() => {
        insertNode(doc, {
          parentId: 'section-2',
          node: duplicateNodeItem,
        });
      }).toThrow(/Duplicate node ID "heading-1"/);
    });

    it('rejects insertion when parent node is not found', () => {
      const doc = createSampleDoc();
      expect(() => {
        insertNode(doc, {
          parentId: 'non-existent-parent',
          node: { id: 'new-node', type: 'text' },
        });
      }).toThrow(/Target parent node with ID "non-existent-parent" not found/);
    });
  });

  describe('Command: moveNode & Acceptance Criteria 2 (descendant check)', () => {
    it('moves node to a different parent with accurate NODE_MOVED event', () => {
      const doc = createSampleDoc();
      const result = moveNode(doc, {
        nodeId: 'button-1',
        targetParentId: 'section-2',
        index: 0,
      });

      expect(result.event.type).toBe('NODE_MOVED');
      expect(result.event.nodeId).toBe('button-1');
      expect(result.event.parentId).toBe('section-2');
      expect(result.event.previousParentId).toBe('container-1');
      expect(result.event.index).toBe(0);
      expect(result.event.previousIndex).toBe(1);

      const oldParentLoc = findNodeLocation(result.document.document, 'container-1');
      expect(oldParentLoc?.node.children?.map((c) => c.id)).toEqual(['heading-1']);

      const newParentLoc = findNodeLocation(result.document.document, 'section-2');
      expect(newParentLoc?.node.children?.map((c) => c.id)).toEqual(['button-1']);
    });

    it('reorders node within the same parent', () => {
      const doc = createSampleDoc();
      const result = moveNode(doc, {
        nodeId: 'button-1',
        targetParentId: 'container-1',
        index: 0,
      });

      expect(result.event.previousParentId).toBe('container-1');
      expect(result.event.parentId).toBe('container-1');

      const containerLoc = findNodeLocation(result.document.document, 'container-1');
      expect(containerLoc?.node.children?.map((c) => c.id)).toEqual(['button-1', 'heading-1']);
    });

    it('prevents moving a node into itself or its own descendant tree (Acceptance Criteria 2)', () => {
      const doc = createSampleDoc();

      // Trying to move section-1 into its child container-1
      expect(() => {
        moveNode(doc, {
          nodeId: 'section-1',
          targetParentId: 'container-1',
        });
      }).toThrow(/is the node itself or a descendant/);

      // Trying to move section-1 into itself
      expect(() => {
        moveNode(doc, {
          nodeId: 'section-1',
          targetParentId: 'section-1',
        });
      }).toThrow(/is the node itself or a descendant/);
    });

    it('prevents moving the root page node', () => {
      const doc = createSampleDoc();
      expect(() => {
        moveNode(doc, {
          nodeId: 'root-page',
          targetParentId: 'section-1',
        });
      }).toThrow(/Cannot move the root page node/);
    });
  });

  describe('Command: updateProps', () => {
    it('shallow merges props by default and emits PROPS_UPDATED event', () => {
      const doc = createSampleDoc();
      const result = updateProps(doc, {
        nodeId: 'heading-1',
        props: { subtitle: 'New Subtitle', level: 2 },
      });

      expect(result.event.type).toBe('PROPS_UPDATED');
      expect(result.event.nodeId).toBe('heading-1');
      expect(result.event.payload?.previousProps).toEqual({ title: 'Initial Title' });

      const updated = findNodeById(result.document.document, 'heading-1');
      expect(updated?.props).toEqual({
        title: 'Initial Title',
        subtitle: 'New Subtitle',
        level: 2,
      });
    });

    it('replaces props when merge is false', () => {
      const doc = createSampleDoc();
      const result = updateProps(doc, {
        nodeId: 'heading-1',
        props: { onlyNewProp: 'value' },
        merge: false,
      });

      const updated = findNodeById(result.document.document, 'heading-1');
      expect(updated?.props).toEqual({ onlyNewProp: 'value' });
    });
  });

  describe('Command: updateStyle', () => {
    it('updates specific breakpoint style with merge support', () => {
      const doc = createSampleDoc();
      const result = updateStyle(doc, {
        nodeId: 'heading-1',
        breakpoint: 'base',
        styles: { fontSize: '24px' },
      });

      expect(result.event.type).toBe('STYLE_UPDATED');
      expect(result.event.nodeId).toBe('heading-1');

      const updated = findNodeById(result.document.document, 'heading-1');
      expect(updated?.styles?.base).toEqual({
        color: '#000000',
        fontSize: '24px',
      });
    });

    it('updates full responsive styles structure', () => {
      const doc = createSampleDoc();
      const result = updateStyle(doc, {
        nodeId: 'heading-1',
        styles: {
          desktop: { display: 'block' },
          mobile: { display: 'none' },
        },
      });

      const updated = findNodeById(result.document.document, 'heading-1');
      expect(updated?.styles?.base).toEqual({ color: '#000000' });
      expect(updated?.styles?.desktop).toEqual({ display: 'block' });
      expect(updated?.styles?.mobile).toEqual({ display: 'none' });
    });
  });

  describe('Command: removeNode', () => {
    it('removes target node and emits NODE_REMOVED event', () => {
      const doc = createSampleDoc();
      const result = removeNode(doc, { nodeId: 'button-1' });

      expect(result.event.type).toBe('NODE_REMOVED');
      expect(result.event.nodeId).toBe('button-1');
      expect(result.event.parentId).toBe('container-1');

      const container = findNodeById(result.document.document, 'container-1');
      expect(container?.children?.map((c) => c.id)).toEqual(['heading-1']);
      expect(findNodeById(result.document.document, 'button-1')).toBeNull();
    });

    it('prevents removing the root page node', () => {
      const doc = createSampleDoc();
      expect(() => {
        removeNode(doc, { nodeId: 'root-page' });
      }).toThrow(/Cannot remove the root page node/);
    });
  });

  describe('Command: duplicateNode & Acceptance Criteria 3 (unique IDs for entire subtree)', () => {
    it('duplicates subtree generating new unique IDs while preserving props and styles (Acceptance Criteria 3)', () => {
      const doc = createSampleDoc();
      const result = duplicateNode(doc, {
        nodeId: 'container-1',
      });

      expect(result.event.type).toBe('NODE_DUPLICATED');
      expect(result.event.parentId).toBe('section-1');
      expect(result.event.payload?.originalNodeId).toBe('container-1');

      const section = findNodeById(result.document.document, 'section-1');
      expect(section?.children?.length).toBe(2);

      const originalContainer = section?.children?.[0];
      const duplicatedContainer = section?.children?.[1];

      expect(originalContainer?.id).toBe('container-1');
      expect(duplicatedContainer?.id).toBe('container-1_copy');

      // Verify all child IDs in duplicated subtree are brand new unique IDs
      expect(duplicatedContainer?.children?.length).toBe(2);
      const dupHeading = duplicatedContainer?.children?.[0];
      const dupButton = duplicatedContainer?.children?.[1];

      expect(dupHeading?.id).toBe('heading-1_copy');
      expect(dupHeading?.type).toBe('heading');
      expect(dupHeading?.props).toEqual({ title: 'Initial Title' });
      expect(dupHeading?.styles).toEqual({ base: { color: '#000000' } });

      expect(dupButton?.id).toBe('button-1_copy');
      expect(dupButton?.type).toBe('button');
      expect(dupButton?.props).toEqual({ label: 'Click Me' });
      expect(dupButton?.styles).toEqual({ base: { backgroundColor: '#blue' } });

      // Validating duplicated document passes whole schema validation
      const validation = validateDocument(result.document);
      expect(validation.valid).toBe(true);
    });

    it('supports duplicating to a different target parent and index with custom ID generator', () => {
      const doc = createSampleDoc();
      const customIdGen = (oldId: string) => `custom_${oldId}`;

      const result = duplicateNode(doc, {
        nodeId: 'button-1',
        targetParentId: 'section-2',
        index: 0,
        idGenerator: customIdGen,
      });

      const targetSection = findNodeById(result.document.document, 'section-2');
      expect(targetSection?.children?.length).toBe(1);
      expect(targetSection?.children?.[0].id).toBe('custom_button-1');
      expect(targetSection?.children?.[0].props?.label).toBe('Click Me');
    });

    it('prevents duplicating the root page node', () => {
      const doc = createSampleDoc();
      expect(() => {
        duplicateNode(doc, { nodeId: 'root-page' });
      }).toThrow(/Cannot duplicate the root page node/);
    });
  });
});

describe('STORA-013: Generic Undo/Redo History Engine', () => {
  const createSampleDoc = (): PageDocument => {
    const doc = createBlankDocument('Test History Page');
    doc.document.children = [
      {
        id: 'section-1',
        type: 'section',
        styles: { base: { padding: '20px' } },
        children: [
          {
            id: 'container-1',
            type: 'container',
            children: [
              {
                id: 'heading-1',
                type: 'heading',
                props: { title: 'Initial Title' },
                children: [],
              },
            ],
          },
        ],
      },
      {
        id: 'section-2',
        type: 'section',
        children: [],
      },
    ];
    return doc;
  };

  describe('Acceptance Criteria 1: Undo/Redo restores identical document across all command mutations', () => {
    it('restores identical state for insertNode', () => {
      const initialDoc = createSampleDoc();
      const manager = new DocumentHistoryManager(initialDoc);

      const insertResult = manager.execute((doc) =>
        insertNode(doc, {
          parentId: 'container-1',
          node: { id: 'btn-1', type: 'button', props: { label: 'Click' } },
        }),
      );

      expect(manager.document).toEqual(insertResult.document);
      expect(manager.canUndo).toBe(true);

      // Undo -> restores initialDoc
      const undone = manager.undo();
      expect(undone).toEqual(initialDoc);
      expect(manager.document).toEqual(initialDoc);
      expect(manager.canRedo).toBe(true);

      // Redo -> restores insertResult.document
      const redone = manager.redo();
      expect(redone).toEqual(insertResult.document);
      expect(manager.document).toEqual(insertResult.document);
    });

    it('restores identical state for moveNode', () => {
      const initialDoc = createSampleDoc();
      const manager = new DocumentHistoryManager(initialDoc);

      const moveResult = manager.execute((doc) =>
        moveNode(doc, {
          nodeId: 'heading-1',
          targetParentId: 'section-2',
        }),
      );

      expect(manager.document).toEqual(moveResult.document);

      manager.undo();
      expect(manager.document).toEqual(initialDoc);

      manager.redo();
      expect(manager.document).toEqual(moveResult.document);
    });

    it('restores identical state for updateProps', () => {
      const initialDoc = createSampleDoc();
      const manager = new DocumentHistoryManager(initialDoc);

      const updateResult = manager.execute((doc) =>
        updateProps(doc, {
          nodeId: 'heading-1',
          props: { title: 'Brand New Title', level: 1 },
        }),
      );

      manager.undo();
      expect(manager.document).toEqual(initialDoc);

      manager.redo();
      expect(manager.document).toEqual(updateResult.document);
    });

    it('restores identical state for updateStyle', () => {
      const initialDoc = createSampleDoc();
      const manager = new DocumentHistoryManager(initialDoc);

      const styleResult = manager.execute((doc) =>
        updateStyle(doc, {
          nodeId: 'heading-1',
          breakpoint: 'base',
          styles: { color: '#ff0000', fontSize: '32px' },
        }),
      );

      manager.undo();
      expect(manager.document).toEqual(initialDoc);

      manager.redo();
      expect(manager.document).toEqual(styleResult.document);
    });

    it('restores identical state for removeNode', () => {
      const initialDoc = createSampleDoc();
      const manager = new DocumentHistoryManager(initialDoc);

      const removeResult = manager.execute((doc) =>
        removeNode(doc, {
          nodeId: 'heading-1',
        }),
      );

      manager.undo();
      expect(manager.document).toEqual(initialDoc);

      manager.redo();
      expect(manager.document).toEqual(removeResult.document);
    });

    it('restores identical state for duplicateNode', () => {
      const initialDoc = createSampleDoc();
      const manager = new DocumentHistoryManager(initialDoc);

      const duplicateResult = manager.execute((doc) =>
        duplicateNode(doc, {
          nodeId: 'container-1',
        }),
      );

      manager.undo();
      expect(manager.document).toEqual(initialDoc);

      manager.redo();
      expect(manager.document).toEqual(duplicateResult.document);
    });
  });

  describe('Acceptance Criteria 2: New action after undo clears redo stack', () => {
    it('clears redo future entries when a new action is pushed after undoing', () => {
      const doc0 = createSampleDoc();
      const history = new HistoryEngine<PageDocument>(doc0);

      // 1. First action
      const doc1 = updateProps(doc0, {
        nodeId: 'heading-1',
        props: { title: 'State 1' },
      }).document;
      history.push(doc1);

      // 2. Second action
      const doc2 = updateProps(doc1, {
        nodeId: 'heading-1',
        props: { title: 'State 2' },
      }).document;
      history.push(doc2);

      // 3. Third action
      const doc3 = updateProps(doc2, {
        nodeId: 'heading-1',
        props: { title: 'State 3' },
      }).document;
      history.push(doc3);

      expect(history.undoCount).toBe(3);
      expect(history.redoCount).toBe(0);

      // Undo twice -> goes back to doc1
      history.undo(); // back to doc2
      history.undo(); // back to doc1
      expect(history.present).toEqual(doc1);
      expect(history.undoCount).toBe(1);
      expect(history.redoCount).toBe(2);
      expect(history.canRedo()).toBe(true);

      // Execute a new diverging action
      const docDiverged = updateProps(doc1, {
        nodeId: 'heading-1',
        props: { title: 'State Diverged' },
      }).document;
      history.push(docDiverged);

      // Redo stack must be completely cleared
      expect(history.canRedo()).toBe(false);
      expect(history.redoCount).toBe(0);
      expect(history.redo()).toBeUndefined();
      expect(history.undoCount).toBe(2); // doc0 -> doc1 -> docDiverged
      expect(history.present).toEqual(docDiverged);
    });
  });

  describe('Acceptance Criteria 3: Configurable history limit and default limit tested', () => {
    it('uses default maxHistory limit of 50 and discards oldest states', () => {
      const initialDoc = createSampleDoc();
      const history = new HistoryEngine<PageDocument>(initialDoc);
      expect(history.limit).toBe(DEFAULT_MAX_HISTORY);
      expect(DEFAULT_MAX_HISTORY).toBe(50);

      // Push 60 new states
      let current = initialDoc;
      for (let i = 1; i <= 60; i++) {
        current = updateProps(current, {
          nodeId: 'heading-1',
          props: { count: i },
        }).document;
        history.push(current);
      }

      // Undo count should be capped at 50
      expect(history.undoCount).toBe(50);

      // Can undo exactly 50 times
      for (let i = 0; i < 50; i++) {
        expect(history.canUndo()).toBe(true);
        history.undo();
      }

      // 51st undo is impossible because the oldest 10 states were discarded
      expect(history.canUndo()).toBe(false);
      expect(history.undo()).toBeUndefined();

      // Oldest available state has count: 10
      const oldestAvailable = findNodeById(history.present.document, 'heading-1');
      expect(oldestAvailable?.props?.count).toBe(10);
    });

    it('enforces custom maxHistory limit (e.g. 5)', () => {
      const initialDoc = createSampleDoc();
      const history = new HistoryEngine<PageDocument>(initialDoc, { maxHistory: 5 });
      expect(history.limit).toBe(5);

      let current = initialDoc;
      for (let i = 1; i <= 10; i++) {
        current = updateProps(current, {
          nodeId: 'heading-1',
          props: { step: i },
        }).document;
        history.push(current);
      }

      expect(history.undoCount).toBe(5);

      // Undo 5 times
      for (let i = 0; i < 5; i++) {
        history.undo();
      }

      expect(history.canUndo()).toBe(false);
      const oldest = findNodeById(history.present.document, 'heading-1');
      expect(oldest?.props?.step).toBe(5);
    });
  });

  describe('History reset and clear functionality', () => {
    it('resets history stacks when loading a new document', () => {
      const doc1 = createSampleDoc();
      const manager = new DocumentHistoryManager(doc1);

      manager.execute((doc) =>
        updateProps(doc, {
          nodeId: 'heading-1',
          props: { title: 'Edited' },
        }),
      );
      expect(manager.canUndo).toBe(true);

      const newDoc = createBlankDocument('New Fresh Page');
      manager.reset(newDoc);

      expect(manager.document).toEqual(newDoc);
      expect(manager.canUndo).toBe(false);
      expect(manager.canRedo).toBe(false);
      expect(manager.getState().undoCount).toBe(0);
      expect(manager.getState().redoCount).toBe(0);
    });

    it('clears past and future while retaining current present state', () => {
      const doc1 = createSampleDoc();
      const history = new HistoryEngine<PageDocument>(doc1);

      const modified = updateProps(doc1, {
        nodeId: 'heading-1',
        props: { title: 'Keep this' },
      }).document;
      history.push(modified);

      expect(history.canUndo()).toBe(true);

      history.clear();
      expect(history.present).toEqual(modified);
      expect(history.canUndo()).toBe(false);
      expect(history.canRedo()).toBe(false);
    });
  });
});
