import { describe, it, expect } from 'vitest';
import {
  PageDocumentSchema,
  SCHEMA_NAME,
  CURRENT_SCHEMA_VERSION,
  AssetReferenceSchema,
  VariableBindingSchema,
  ActionBindingSchema,
  generateDeterministicNodeId,
  validateNodeIdUniqueness,
  collectNodeIds,
  isAssetReference,
  isVariableBinding,
  isActionBinding,
  Node,
  StyleValueSchema,
  StyleDefinitionSchema,
  ResponsiveStylesSchema,
} from './document';
import { PAGE_DOCUMENT_JSON_SCHEMA_V1, getPageDocumentJsonSchema } from './json-schema';
import starterPage from './fixtures/starter-page.json';

describe('STORA-010: Page Document v1 Schema Specification', () => {
  describe('Acceptance Criteria 1: TypeScript type and JSON Schema alignment', () => {
    it('provides a valid JSON Schema Draft-07 matching PageDocument v1', () => {
      const jsonSchema = getPageDocumentJsonSchema();
      expect(jsonSchema).toBeDefined();
      expect(jsonSchema.$schema).toBe('http://json-schema.org/draft-07/schema#');
      expect(jsonSchema.properties.schema.const).toBe(SCHEMA_NAME);
      expect(jsonSchema.properties.version.default).toBe(CURRENT_SCHEMA_VERSION);
      expect(jsonSchema.definitions.node).toBeDefined();
      expect(jsonSchema.definitions.rootPageNode).toBeDefined();
      expect(jsonSchema.definitions.assetReference).toBeDefined();
      expect(jsonSchema.definitions.variableBinding).toBeDefined();
      expect(jsonSchema.definitions.actionBinding).toBeDefined();
      expect(jsonSchema.definitions.responsiveStyles).toBeDefined();
    });
  });

  describe('Acceptance Criteria 2: Root Document Structure and Root Page Node', () => {
    it('requires schema: "stora.page"', () => {
      const docWithInvalidSchema = {
        ...starterPage,
        schema: 'invalid.schema',
      };
      const result = PageDocumentSchema.safeParse(docWithInvalidSchema);
      expect(result.success).toBe(false);
    });

    it('requires a schema version string', () => {
      const docWithoutVersion = {
        ...starterPage,
        version: '',
      };
      const result = PageDocumentSchema.safeParse(docWithoutVersion);
      expect(result.success).toBe(false);
    });

    it('strictly requires the root node type to be "page"', () => {
      const docWithNonPageRoot = {
        ...starterPage,
        document: {
          id: 'root-container',
          type: 'container',
          children: [],
        },
      };
      const result = PageDocumentSchema.safeParse(docWithNonPageRoot);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toContain('Root node must have type "page"');
      }
    });

    it('accepts valid root page document structure', () => {
      const validDoc = {
        schema: 'stora.page',
        version: '1.0.0',
        metadata: {
          title: 'Landing Page',
        },
        document: {
          id: 'page_main',
          type: 'page',
          props: {},
          styles: { base: { backgroundColor: '#fff' } },
          children: [],
        },
      };
      const result = PageDocumentSchema.safeParse(validDoc);
      expect(result.success).toBe(true);
    });
  });

  describe('Acceptance Criteria 3: Unique, Deterministic Node IDs decoupled from React keys', () => {
    it('generates predictable, deterministic node IDs when supplied with a prefix and index', () => {
      const id1 = generateDeterministicNodeId('section', 1);
      const id2 = generateDeterministicNodeId('hero_heading', 'title');
      expect(id1).toBe('section_1');
      expect(id2).toBe('hero_heading_title');
    });

    it('collects all node IDs across the entire tree', () => {
      const ids = collectNodeIds(starterPage.document as unknown as Node);
      expect(ids).toContain('root-page');
      expect(ids).toContain('hero-section');
      expect(ids).toContain('hero-container');
      expect(ids).toContain('hero-heading');
      expect(ids).toContain('hero-text');
      expect(ids).toContain('hero-image');
      expect(ids).toContain('hero-button');
    });

    it('validates node ID uniqueness across the document tree', () => {
      const validation = validateNodeIdUniqueness(starterPage.document as unknown as Node);
      expect(validation.valid).toBe(true);
      expect(validation.duplicateIds).toEqual([]);
    });

    it('detects duplicate node IDs in an invalid tree', () => {
      const treeWithDuplicates: Node = {
        id: 'root-page',
        type: 'page',
        children: [
          {
            id: 'duplicate-id',
            type: 'section',
            children: [{ id: 'child-1', type: 'text' }],
          },
          {
            id: 'duplicate-id',
            type: 'section',
            children: [{ id: 'child-2', type: 'text' }],
          },
        ],
      };
      const validation = validateNodeIdUniqueness(treeWithDuplicates);
      expect(validation.valid).toBe(false);
      expect(validation.duplicateIds).toContain('duplicate-id');
    });
  });

  describe('Acceptance Criteria 4: Starter Fixture Validation', () => {
    it('successfully validates the starter page fixture against PageDocumentSchema', () => {
      const result = PageDocumentSchema.safeParse(starterPage);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.schema).toBe('stora.page');
        expect(result.data.version).toBe('1.0.0');
        expect(result.data.metadata.title).toBe('Welcome to KUBUILD');
        expect(result.data.document.type).toBe('page');
        expect(result.data.document.children?.length).toBe(1);
      }
    });
  });

  describe('Asset References, Variable Bindings, and Action Bindings', () => {
    it('validates and recognizes asset references', () => {
      const assetRef = {
        type: 'asset',
        assetId: 'hero_img_001',
        filename: 'hero.png',
        mimeType: 'image/png',
      };
      expect(AssetReferenceSchema.safeParse(assetRef).success).toBe(true);
      expect(isAssetReference(assetRef)).toBe(true);
      expect(isAssetReference({ type: 'other' })).toBe(false);
    });

    it('validates and recognizes variable bindings', () => {
      const varBinding = {
        type: 'variable',
        key: 'site.title',
        fallback: 'Default Site Title',
      };
      expect(VariableBindingSchema.safeParse(varBinding).success).toBe(true);
      expect(isVariableBinding(varBinding)).toBe(true);
      expect(isVariableBinding({ key: 'site.title' })).toBe(false);
    });

    it('validates and recognizes action bindings', () => {
      const actionBinding = {
        type: 'navigate',
        payload: { url: '/about' },
      };
      expect(ActionBindingSchema.safeParse(actionBinding).success).toBe(true);
      expect(isActionBinding(actionBinding)).toBe(true);
      expect(isActionBinding({ type: '' })).toBe(false);
    });
  });

  describe('Serializable Document Separation from UI State', () => {
    it('ensures document is pure JSON-serializable without runtime functions or circular refs', () => {
      const serialized = JSON.stringify(starterPage);
      const parsed = JSON.parse(serialized);
      const result = PageDocumentSchema.safeParse(parsed);
      expect(result.success).toBe(true);
    });
  });
});

describe('STORA-023: Style Token and Responsive Style Schema Hardening', () => {
  describe('Acceptance Criteria 1: rejects function, dangerous CSS strings, and non-serializable values', () => {
    it('rejects a function value', () => {
      expect(StyleValueSchema.safeParse(() => 'x').success).toBe(false);
    });

    it('rejects an object value', () => {
      expect(StyleValueSchema.safeParse({ nested: true }).success).toBe(false);
    });

    it('rejects an array value', () => {
      expect(StyleValueSchema.safeParse(['a', 'b']).success).toBe(false);
    });

    it.each([
      'background: url(javascript:alert(1))',
      'width: expression(alert(1))',
      '@import url(evil.css)',
      '<script>alert(1)</script>',
      'behavior: vbscript:msgbox(1)',
      'background-image: data:text/html,<script>alert(1)</script>',
    ])('rejects the dangerous string "%s"', (value) => {
      expect(StyleValueSchema.safeParse(value).success).toBe(false);
    });

    it.each(['16px', 700, true, null])('accepts the safe serializable value %s', (value) => {
      expect(StyleValueSchema.safeParse(value).success).toBe(true);
    });

    it('rejects an entire StyleDefinition containing one unsafe value', () => {
      const result = StyleDefinitionSchema.safeParse({
        color: '#111827',
        background: 'url(javascript:alert(1))',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('Acceptance Criteria 2: a node can have base style plus desktop/tablet/mobile overrides', () => {
    it('parses a ResponsiveStyles object with all four breakpoints', () => {
      const result = ResponsiveStylesSchema.safeParse({
        base: { fontSize: '16px' },
        desktop: { fontSize: '48px' },
        tablet: { fontSize: '36px' },
        mobile: { fontSize: '28px' },
      });
      expect(result.success).toBe(true);
    });
  });
});
