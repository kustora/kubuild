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
import { ManifestSchema, isManifest } from './manifest';
import {
  TemplateRecordSchema,
  SafeThumbnailSchema,
  SafeThumbnailObjectSchema,
  SafeThumbnailUrlSchema,
  TemplateRequirementsSchema,
  isTemplateRecord,
  isSafeThumbnail,
  isSafeThumbnailUrl,
} from './template';
import {
  getPageDocumentJsonSchema,
  getManifestJsonSchema,
  getTemplateRecordJsonSchema,
} from './json-schema';
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
        expect(result.data.metadata?.title).toBe('Welcome to KUBUILD');
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

describe('STORA-060: Package Manifest v1 Schema Specification', () => {
  describe('Acceptance Criteria 1: JSON Schema and TypeScript alignment', () => {
    it('provides a valid JSON Schema Draft-07 matching Manifest v1', () => {
      const jsonSchema = getManifestJsonSchema();
      expect(jsonSchema).toBeDefined();
      expect(jsonSchema.$schema).toBe('http://json-schema.org/draft-07/schema#');
      expect(jsonSchema.properties.schema.const).toBe(SCHEMA_NAME);
      expect(jsonSchema.properties.schemaVersion.default).toBe('1.0.0');
      expect(jsonSchema.definitions.manifestAssetItem).toBeDefined();
    });
  });

  describe('Acceptance Criteria 2: Manifest fields and custom component/capability requirements', () => {
    it('validates a complete manifest with custom components, capabilities, and assets', () => {
      const validManifest = {
        schema: 'stora.page',
        schemaVersion: '1.0.0',
        packageVersion: '1.0.0',
        builderCompatibility: '>=0.1.0',
        requiredComponents: ['custom.product-card', 'custom.pricing-table'],
        requiredCapabilities: ['audio-player', 'web-share'],
        assets: [
          {
            id: 'hero_img',
            path: 'assets/hero.png',
            mimeType: 'image/png',
            size: 10240,
            checksum: 'sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
          },
        ],
        createdAt: '2026-08-24T12:00:00.000Z',
      };

      const result = ManifestSchema.safeParse(validManifest);
      expect(result.success).toBe(true);
      expect(isManifest(validManifest)).toBe(true);
    });

    it('rejects invalid manifest asset items missing required fields or negative size', () => {
      const invalidAssetManifest = {
        assets: [
          {
            id: '',
            path: 'assets/hero.png',
            mimeType: 'image/png',
            size: -10,
          },
        ],
      };
      const result = ManifestSchema.safeParse(invalidAssetManifest);
      expect(result.success).toBe(false);
    });
  });
});

describe('STORA-070: Reusable Page Template Record and Metadata v1', () => {
  describe('Acceptance Criteria 1: Template metadata is validated and JSON-serializable', () => {
    it('provides a valid JSON Schema Draft-07 matching TemplateRecord v1', () => {
      const jsonSchema = getTemplateRecordJsonSchema();
      expect(jsonSchema).toBeDefined();
      expect(jsonSchema.$schema).toBe('http://json-schema.org/draft-07/schema#');
      expect(jsonSchema.required).toEqual(['id', 'name']);
      expect(jsonSchema.properties.id).toBeDefined();
      expect(jsonSchema.properties.name).toBeDefined();
      expect(jsonSchema.properties.description).toBeDefined();
      expect(jsonSchema.properties.category).toBeDefined();
      expect(jsonSchema.properties.tags).toBeDefined();
      expect(jsonSchema.properties.thumbnail).toBeDefined();
      expect(jsonSchema.properties.author).toBeDefined();
      expect(jsonSchema.properties.version).toBeDefined();
      expect(jsonSchema.properties.document).toBeDefined();
      expect(jsonSchema.properties.packageReference).toBeDefined();
      expect(jsonSchema.properties.requirements).toBeDefined();
      expect(jsonSchema.properties.createdAt).toBeDefined();
      expect(jsonSchema.properties.updatedAt).toBeDefined();
    });

    it('validates a complete template record with embedded document and metadata', () => {
      const template = {
        id: 'template_saas_01',
        name: 'SaaS Modern Landing',
        description: 'High converting SaaS landing page with hero and pricing',
        category: 'saas',
        tags: ['landing', 'saas', 'dark-mode'],
        thumbnail: 'https://cdn.stora.page/templates/saas-01/thumb.webp',
        author: 'KUBUILD Team',
        version: '1.2.0',
        document: starterPage,
        requirements: {
          requiredComponents: ['custom.pricing-table'],
          requiredCapabilities: ['audio-player'],
        },
        createdAt: '2026-08-24T10:00:00.000Z',
        updatedAt: '2026-08-24T12:30:00.000Z',
        custom: { featured: true },
      };

      const result = TemplateRecordSchema.safeParse(template);
      expect(result.success).toBe(true);
      expect(isTemplateRecord(template)).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe('template_saas_01');
        expect(result.data.name).toBe('SaaS Modern Landing');
        expect(result.data.category).toBe('saas');
        expect(result.data.tags).toContain('dark-mode');
        expect(result.data.requirements.requiredComponents).toContain('custom.pricing-table');
      }
    });

    it('validates a template record with package reference instead of inline document', () => {
      const template = {
        id: 'template_ecommerce_01',
        name: 'Modern Storefront',
        description: 'E-commerce template package',
        category: 'ecommerce',
        packageReference: {
          path: 'templates/storefront.stora',
          format: 'stora',
          checksum: 'sha256:abcd1234efgh5678',
        },
      };

      const result = TemplateRecordSchema.safeParse(template);
      expect(result.success).toBe(true);
      expect(isTemplateRecord(template)).toBe(true);
    });

    it('is strictly serializable without loss across JSON parse/stringify cycle', () => {
      const template = {
        id: 'template_agency_01',
        name: 'Creative Agency',
        description: 'Agency portfolio and services',
        category: 'agency',
        tags: ['portfolio', 'creative'],
        author: 'Designer A',
        version: '1.0.0',
        document: starterPage,
        requirements: {
          requiredComponents: [],
          requiredCapabilities: [],
        },
        createdAt: '2026-08-24T08:00:00.000Z',
      };

      const jsonStr = JSON.stringify(template);
      const parsed = JSON.parse(jsonStr);
      const result = TemplateRecordSchema.safeParse(parsed);
      expect(result.success).toBe(true);
    });

    it('rejects template missing required id or name', () => {
      expect(TemplateRecordSchema.safeParse({ name: 'No ID' }).success).toBe(false);
      expect(TemplateRecordSchema.safeParse({ id: '', name: 'Empty ID' }).success).toBe(false);
      expect(TemplateRecordSchema.safeParse({ id: 'tmpl_1', name: '' }).success).toBe(false);
    });
  });

  describe('Acceptance Criteria 2: Thumbnail refers to safe asset or safe URL', () => {
    it('accepts safe URL string thumbnails (https, http, relative, data:image)', () => {
      const safeUrls = [
        'https://cdn.example.com/thumb.png',
        'http://example.com/images/preview.jpg',
        'assets/thumbnails/hero.webp',
        '/static/templates/saas.png',
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        'data:image/svg+xml;utf8,<svg></svg>',
      ];

      for (const url of safeUrls) {
        expect(isSafeThumbnailUrl(url)).toBe(true);
        expect(SafeThumbnailUrlSchema.safeParse(url).success).toBe(true);
        expect(SafeThumbnailSchema.safeParse(url).success).toBe(true);
      }
    });

    it('accepts SafeThumbnailObject with dimensions and alt text', () => {
      const obj = {
        url: 'https://cdn.example.com/thumb.webp',
        alt: 'SaaS Template Preview',
        width: 800,
        height: 600,
      };
      expect(SafeThumbnailObjectSchema.safeParse(obj).success).toBe(true);
      expect(SafeThumbnailSchema.safeParse(obj).success).toBe(true);
      expect(isSafeThumbnail(obj)).toBe(true);
    });

    it('accepts AssetReference as thumbnail', () => {
      const assetRef = {
        type: 'asset',
        assetId: 'asset_thumb_01',
        filename: 'preview.png',
        mimeType: 'image/png',
      };
      expect(SafeThumbnailSchema.safeParse(assetRef).success).toBe(true);
      expect(isSafeThumbnail(assetRef)).toBe(true);
    });

    it.each([
      'javascript:alert(1)',
      'javascript:/*--></title></style></textarea></script><svg/onload=alert(1)>',
      'vbscript:msgbox(1)',
      'data:text/html,<script>alert(1)</script>',
      'data:text/plain;base64,SGVsbG8=',
      '<script>alert("xss")</script>',
    ])('rejects dangerous thumbnail URL: "%s"', (unsafeUrl) => {
      expect(isSafeThumbnailUrl(unsafeUrl)).toBe(false);
      expect(SafeThumbnailUrlSchema.safeParse(unsafeUrl).success).toBe(false);
      expect(SafeThumbnailSchema.safeParse(unsafeUrl).success).toBe(false);
      expect(isSafeThumbnail(unsafeUrl)).toBe(false);
    });
  });

  describe('Acceptance Criteria 3: Template declares component and capability requirements', () => {
    it('validates requirements object with requiredComponents and requiredCapabilities', () => {
      const reqs = {
        requiredComponents: ['custom.pricing-table', 'custom.testimonial-slider'],
        requiredCapabilities: ['audio-player', 'web-share'],
      };
      const result = TemplateRequirementsSchema.safeParse(reqs);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.requiredComponents).toHaveLength(2);
        expect(result.data.requiredCapabilities).toHaveLength(2);
      }
    });

    it('defaults requirements to empty arrays if omitted', () => {
      const template = {
        id: 'tmpl_minimal',
        name: 'Minimal Template',
      };
      const result = TemplateRecordSchema.safeParse(template);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.requirements.requiredComponents).toEqual([]);
        expect(result.data.requirements.requiredCapabilities).toEqual([]);
      }
    });
  });
});


