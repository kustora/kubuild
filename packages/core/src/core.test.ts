import { describe, it, expect } from 'vitest';
import {
  createBlankDocument,
  validateDocument,
  findNodeById,
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
