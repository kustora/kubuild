import { describe, it, expect } from 'vitest';
import {
  PageDocumentSchema,
  NodeSchema,
  SCHEMA_NAME,
  CURRENT_SCHEMA_VERSION,
  AssetReferenceSchema,
  VariableBindingSchema,
  ActionBindingSchema,
  AnimationConfigSchema,
  AnimationConfig,
  DEFAULT_ANIMATION_CONFIG,
  isAnimationConfig,
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
} from '../src/document';
import { ManifestSchema, isManifest } from '../src/manifest';
import {
  TemplateRecordSchema,
  SafeThumbnailSchema,
  SafeThumbnailObjectSchema,
  SafeThumbnailUrlSchema,
  TemplateRequirementsSchema,
  isTemplateRecord,
  isSafeThumbnail,
  isSafeThumbnailUrl,
} from '../src/template';
import {
  getPageDocumentJsonSchema,
  getManifestJsonSchema,
  getTemplateRecordJsonSchema,
} from '../src/json-schema';
import starterPage from '../src/fixtures/starter-page.json';




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
      expect(jsonSchema.definitions.animationConfig).toBeDefined();
      expect(jsonSchema.definitions.actionPipeline).toBeDefined();
      expect(jsonSchema.definitions.actionStep).toBeDefined();
      expect(jsonSchema.definitions.formConfig).toBeDefined();
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

  describe('STORA-220: Pseudo-state style layers on ResponsiveStyles', () => {
    it('validates a document with a :hover state layer', () => {
      const result = ResponsiveStylesSchema.safeParse({
        base: { backgroundColor: '#2563eb' },
        states: {
          ':hover': { backgroundColor: '#1d4ed8', cursor: 'pointer' },
        },
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.states?.[':hover']).toEqual({
          backgroundColor: '#1d4ed8',
          cursor: 'pointer',
        });
      }
    });

    it('is backward-compatible: documents without states still parse', () => {
      const result = ResponsiveStylesSchema.safeParse({
        base: { fontSize: '16px' },
        desktop: { fontSize: '48px' },
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.states).toBeUndefined();
      }
    });

    it('rejects unsafe style values inside state layers', () => {
      const result = ResponsiveStylesSchema.safeParse({
        states: {
          ':hover': { background: 'url(javascript:alert(1))' },
        },
      });
      expect(result.success).toBe(false);
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

describe('STORA-260: AnimationConfig Schema Specification', () => {
  describe('Acceptance Criteria: Skema memvalidasi properti animasi dengan default yang aman dan serializable', () => {
    it('applies safe defaults when parsing an empty animation config object', () => {
      const parsed = AnimationConfigSchema.parse({});
      expect(parsed).toEqual({
        type: 'none',
        duration: 600,
        delay: 0,
        easing: 'ease-out',
        once: true,
        hoverEffect: 'none',
        loopEffect: 'none',
      });
    });

    it('matches the DEFAULT_ANIMATION_CONFIG constant', () => {
      expect(DEFAULT_ANIMATION_CONFIG).toEqual({
        type: 'none',
        duration: 600,
        delay: 0,
        easing: 'ease-out',
        once: true,
        hoverEffect: 'none',
        loopEffect: 'none',
      });
      expect(AnimationConfigSchema.parse({})).toEqual(DEFAULT_ANIMATION_CONFIG);
    });

    it('accepts valid custom animation configuration', () => {
      const customConfig: AnimationConfig = {
        type: 'fade-up',
        duration: 800,
        delay: 200,
        easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
        once: false,
        hoverEffect: 'lift',
        loopEffect: 'pulse',
      };

      const result = AnimationConfigSchema.safeParse(customConfig);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(customConfig);
      }
    });

    it('validates partial configs and fills default values for omitted fields', () => {
      const partialConfig = {
        type: 'zoom-in',
        hoverEffect: 'scale',
      };

      const parsed = AnimationConfigSchema.parse(partialConfig);
      expect(parsed).toEqual({
        type: 'zoom-in',
        duration: 600,
        delay: 0,
        easing: 'ease-out',
        once: true,
        hoverEffect: 'scale',
        loopEffect: 'none',
      });
    });

    it('rejects negative numbers for duration or delay', () => {
      const negativeDuration = { duration: -100 };
      const res1 = AnimationConfigSchema.safeParse(negativeDuration);
      expect(res1.success).toBe(false);

      const negativeDelay = { delay: -50 };
      const res2 = AnimationConfigSchema.safeParse(negativeDelay);
      expect(res2.success).toBe(false);
    });

    it.each([
      'javascript:alert(1)',
      'expression(alert(1))',
      '@import url("hack.css")',
      '<script>alert(1)</script>',
      'vbscript:msgbox(1)',
      'data:text/html,<script>alert(1)</script>',
    ])('rejects dangerous injection strings in animation properties: "%s"', (unsafeValue) => {
      expect(AnimationConfigSchema.safeParse({ type: unsafeValue }).success).toBe(false);
      expect(AnimationConfigSchema.safeParse({ easing: unsafeValue }).success).toBe(false);
      expect(AnimationConfigSchema.safeParse({ hoverEffect: unsafeValue }).success).toBe(false);
      expect(AnimationConfigSchema.safeParse({ loopEffect: unsafeValue }).success).toBe(false);
    });

    it('validates animation field when attached to a Node in NodeSchema', () => {
      const nodeWithAnimation: Node = {
        id: 'hero-title',
        type: 'heading',
        props: { text: 'Welcome' },
        animation: {
          type: 'fade-up',
          duration: 700,
          delay: 150,
          easing: 'ease-out',
          once: true,
          hoverEffect: 'glow',
          loopEffect: 'none',
        },
      };

      const parsedNode = NodeSchema.parse(nodeWithAnimation);
      expect(parsedNode.animation).toBeDefined();
      expect(parsedNode.animation?.type).toBe('fade-up');
      expect(parsedNode.animation?.duration).toBe(700);
      expect(parsedNode.animation?.delay).toBe(150);
      expect(parsedNode.animation?.hoverEffect).toBe('glow');
    });

    it('validates entire PageDocument with animated nodes and serializes cleanly', () => {
      const doc = {
        schema: 'stora.page',
        version: '1.0.0',
        metadata: {
          title: 'Animated Landing Page',
        },
        document: {
          id: 'root-page',
          type: 'page',
          children: [
            {
              id: 'hero-btn',
              type: 'button',
              props: { label: 'Get Started' },
              animation: {
                type: 'slide-up',
                duration: 500,
                delay: 100,
                once: true,
                hoverEffect: 'lift',
                loopEffect: 'none',
              },
            },
            {
              id: 'badge',
              type: 'badge',
              animation: {
                type: 'none',
                loopEffect: 'pulse',
              },
            },
          ],
        },
      };

      const parsedDoc = PageDocumentSchema.parse(doc);
      expect(parsedDoc.document.children?.[0]?.animation?.type).toBe('slide-up');
      expect(parsedDoc.document.children?.[0]?.animation?.hoverEffect).toBe('lift');
      expect(parsedDoc.document.children?.[1]?.animation?.loopEffect).toBe('pulse');
      expect(parsedDoc.document.children?.[1]?.animation?.duration).toBe(600);

      // Verify serializability
      const json = JSON.stringify(parsedDoc);
      const restored = JSON.parse(json);
      expect(restored.document.children[0].animation.type).toBe('slide-up');
    });

    it('isAnimationConfig type guard correctly identifies valid animation configs', () => {
      expect(isAnimationConfig({})).toBe(true);
      expect(isAnimationConfig({ type: 'fade-up', duration: 1000 })).toBe(true);
      expect(isAnimationConfig(DEFAULT_ANIMATION_CONFIG)).toBe(true);
      expect(isAnimationConfig({ duration: -1 })).toBe(false);
      expect(isAnimationConfig({ type: 'javascript:alert(1)' })).toBe(false);
      expect(isAnimationConfig(null)).toBe(false);
      expect(isAnimationConfig('not-an-object')).toBe(false);
    });
  });
});

describe('STORA-302: NodeSchema Action Pipeline & Form Config Integration', () => {
  describe('Acceptance Criteria 1: NodeSchema validates nodes with actions & formConfig', () => {
    it('validates a node with multi-step actions pipeline', () => {
      const nodeWithActions: Node = {
        id: 'submit-btn',
        type: 'button',
        props: { label: 'Send Message' },
        actions: [
          {
            id: 'pipeline-click',
            trigger: 'click',
            label: 'Submit Form Pipeline',
            debounceMs: 250,
            preventDuplicate: true,
            enabled: true,
            steps: [
              {
                id: 'step-api',
                type: 'api_request',
                payload: {
                  url: 'https://api.example.com/contact',
                  method: 'POST',
                  body: { message: 'Hello' },
                },
                timeout: 5000,
                onSuccess: [
                  {
                    id: 'step-toast-success',
                    type: 'show_toast',
                    payload: { message: 'Message sent!', type: 'success' },
                  },
                  {
                    id: 'step-nav',
                    type: 'navigate',
                    payload: { url: '/thank-you' },
                  },
                ],
                onError: [
                  {
                    id: 'step-toast-error',
                    type: 'show_toast',
                    payload: { message: 'Failed to send message', type: 'error' },
                  },
                ],
              },
            ],
          },
        ],
      };

      const parsed = NodeSchema.safeParse(nodeWithActions);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.actions).toBeDefined();
        expect(parsed.data.actions).toHaveLength(1);
        expect(parsed.data.actions?.[0].trigger).toBe('click');
        expect(parsed.data.actions?.[0].steps[0].type).toBe('api_request');
        expect(parsed.data.actions?.[0].steps[0].onSuccess).toHaveLength(2);
      }
    });

    it('validates a node with formConfig', () => {
      const formNode: Node = {
        id: 'contact-form-container',
        type: 'form',
        props: {},
        formConfig: {
          formId: 'contact_form_01',
          resetOnSubmit: true,
          scrollToFirstError: true,
          validateOn: 'submit',
          initialValues: {
            name: '',
            email: 'user@example.com',
          },
        },
        children: [
          {
            id: 'input-name',
            type: 'input',
            props: { name: 'name', label: 'Your Name' },
          },
        ],
      };

      const parsed = NodeSchema.safeParse(formNode);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.formConfig).toBeDefined();
        expect(parsed.data.formConfig?.formId).toBe('contact_form_01');
        expect(parsed.data.formConfig?.resetOnSubmit).toBe(true);
        expect(parsed.data.formConfig?.validateOn).toBe('submit');
        expect(parsed.data.children).toHaveLength(1);
      }
    });

    it('validates a node having both actions and formConfig alongside styles and animation', () => {
      const complexNode: Node = {
        id: 'newsletter-form',
        type: 'form',
        styles: {
          base: { padding: '24px', backgroundColor: '#f9fafb' },
        },
        animation: {
          type: 'fade-up',
          duration: 400,
        },
        formConfig: {
          formId: 'newsletter_form',
          validateOn: 'blur',
        },
        actions: [
          {
            id: 'submit-pipeline',
            trigger: 'submit',
            steps: [
              {
                id: 'api-sub',
                type: 'api_request',
                payload: { url: '/api/subscribe', method: 'POST' },
              },
            ],
          },
        ],
      };

      const parsed = NodeSchema.safeParse(complexNode);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.formConfig?.formId).toBe('newsletter_form');
        expect(parsed.data.actions?.[0].trigger).toBe('submit');
        expect(parsed.data.animation?.type).toBe('fade-up');
        expect(parsed.data.styles?.base?.padding).toBe('24px');
      }
    });

    it('validates an entire PageDocument containing nodes with actions and formConfig', () => {
      const pageDoc = {
        schema: 'stora.page',
        version: '1.0.0',
        metadata: {
          title: 'Interactive Form Page',
        },
        document: {
          id: 'root-page',
          type: 'page',
          children: [
            {
              id: 'form-node',
              type: 'form',
              formConfig: {
                formId: 'lead_form',
                resetOnSubmit: false,
              },
              children: [
                {
                  id: 'btn-submit',
                  type: 'button',
                  actions: [
                    {
                      id: 'pipe-submit',
                      trigger: 'click',
                      steps: [
                        {
                          id: 'step-1',
                          type: 'show_toast',
                          payload: { message: 'Submitting...' },
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      };

      const parsed = PageDocumentSchema.safeParse(pageDoc);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        const formChild = parsed.data.document.children?.[0];
        expect(formChild?.formConfig?.formId).toBe('lead_form');
        expect(formChild?.children?.[0]?.actions?.[0]?.steps[0].type).toBe('show_toast');
      }
    });

    it('preserves complete action pipelines and form config through JSON serialization roundtrip', () => {
      const doc = {
        schema: 'stora.page',
        version: '1.0.0',
        document: {
          id: 'root-page',
          type: 'page',
          children: [
            {
              id: 'form-1',
              type: 'form',
              formConfig: {
                formId: 'form_123',
                initialValues: { email: 'test@example.com' },
              },
              actions: [
                {
                  id: 'pipe_1',
                  trigger: 'submit',
                  steps: [
                    {
                      id: 'step_api',
                      type: 'api_request',
                      payload: { url: 'https://api.example.com/v1/save' },
                    },
                  ],
                },
              ],
            },
          ],
        },
      };

      const json = JSON.stringify(doc);
      const restored = JSON.parse(json);
      const parsed = PageDocumentSchema.safeParse(restored);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.document.children?.[0].formConfig?.formId).toBe('form_123');
        expect(parsed.data.document.children?.[0].actions?.[0].id).toBe('pipe_1');
      }
    });

    it('rejects invalid action pipelines on a Node', () => {
      const nodeWithEmptySteps = {
        id: 'btn-invalid',
        type: 'button',
        actions: [
          {
            id: 'pipe-empty',
            trigger: 'click',
            steps: [],
          },
        ],
      };
      expect(NodeSchema.safeParse(nodeWithEmptySteps).success).toBe(false);

      const nodeWithInvalidTrigger = {
        id: 'btn-invalid-trigger',
        type: 'button',
        actions: [
          {
            id: 'pipe-bad-trigger',
            trigger: 'invalid_trigger',
            steps: [{ id: 's1', type: 'show_toast', payload: { message: 'hi' } }],
          },
        ],
      };
      expect(NodeSchema.safeParse(nodeWithInvalidTrigger).success).toBe(false);
    });

    it('rejects invalid formConfig on a Node', () => {
      const nodeWithInvalidFormConfig = {
        id: 'form-bad',
        type: 'form',
        formConfig: {
          formId: '',
        },
      };
      expect(NodeSchema.safeParse(nodeWithInvalidFormConfig).success).toBe(false);
    });
  });

  describe('Acceptance Criteria 2: Backward compatibility with legacy v1.0.0 documents & ActionBindingSchema', () => {
    it('successfully parses legacy starterPage fixture without actions or formConfig', () => {
      const result = PageDocumentSchema.safeParse(starterPage);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.document.actions).toBeUndefined();
        expect(result.data.document.formConfig).toBeUndefined();
      }
    });

    it('parses legacy node without actions or formConfig fields cleanly', () => {
      const legacyNode = {
        id: 'legacy-box',
        type: 'container',
        props: { layout: 'flex' },
        styles: { base: { display: 'flex' } },
        children: [],
      };

      const parsed = NodeSchema.safeParse(legacyNode);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.actions).toBeUndefined();
        expect(parsed.data.formConfig).toBeUndefined();
      }
    });

    it('maintains full backward compatibility with ActionBindingSchema and isActionBinding', () => {
      const legacyActionBinding = {
        type: 'navigate',
        payload: { url: '/features' },
      };

      const result = ActionBindingSchema.safeParse(legacyActionBinding);
      expect(result.success).toBe(true);
      expect(isActionBinding(legacyActionBinding)).toBe(true);
      if (result.success) {
        expect(result.data.type).toBe('navigate');
        expect(result.data.payload).toEqual({ url: '/features' });
      }
    });
  });
});

describe('STORA-101 & STORA-110: Flexbox, CSS Grid & Sizing Constraints Schema Suite', () => {
  describe('STORA-101: Flexbox and Sizing constraints in StyleDefinitionSchema', () => {
    it('validates comprehensive Flexbox and Sizing property sets', () => {
      const flexStyles = {
        display: 'flex',
        flexDirection: 'row-reverse',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'center',
        alignContent: 'space-around',
        gap: '24px',
        rowGap: '16px',
        columnGap: '8px',
        flexGrow: 1,
        flexShrink: 0,
        flexBasis: '250px',
        alignSelf: 'stretch',
        width: 'fit-content',
        height: '100%',
        minWidth: '320px',
        maxWidth: '1440px',
        minHeight: '200px',
        maxHeight: '100vh',
      };

      const result = StyleDefinitionSchema.safeParse(flexStyles);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.flexDirection).toBe('row-reverse');
        expect(result.data.justifyContent).toBe('space-between');
        expect(result.data.flexGrow).toBe(1);
        expect(result.data.width).toBe('fit-content');
      }
    });

    it('validates sizing constraints including fit-content, max-content, min-content, and percentages', () => {
      const sizingStyles = {
        width: 'max-content',
        height: 'min-content',
        minWidth: '50%',
        maxWidth: '100vw',
        minHeight: '25vh',
        maxHeight: '75%',
      };

      const result = StyleDefinitionSchema.safeParse(sizingStyles);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.width).toBe('max-content');
        expect(result.data.height).toBe('min-content');
        expect(result.data.minWidth).toBe('50%');
        expect(result.data.maxHeight).toBe('75%');
      }
    });

    it('validates effects properties: 4-corner border radiuses, backdropFilter, filter, and boxShadow', () => {
      const effectsStyles = {
        borderRadius: '12px',
        borderTopLeftRadius: '16px',
        borderTopRightRadius: 8,
        borderBottomRightRadius: '24px',
        borderBottomLeftRadius: 0,
        backdropFilter: 'blur(10px) saturate(180%)',
        filter: 'drop-shadow(0 4px 6px rgba(0, 0, 0, 0.1))',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
      };

      const result = StyleDefinitionSchema.safeParse(effectsStyles);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.borderTopLeftRadius).toBe('16px');
        expect(result.data.borderTopRightRadius).toBe(8);
        expect(result.data.backdropFilter).toBe('blur(10px) saturate(180%)');
        expect(result.data.filter).toContain('drop-shadow');
        expect(result.data.boxShadow).toContain('rgba');
      }
    });

    it('rejects dangerous injection vectors inside Flexbox/Sizing/Effects style values', () => {
      const dangerousFlexStyle = {
        flexDirection: 'javascript:alert(1)',
      };
      expect(StyleDefinitionSchema.safeParse(dangerousFlexStyle).success).toBe(false);

      const dangerousBackdropStyle = {
        backdropFilter: 'url(javascript:malicious())',
      };
      expect(StyleDefinitionSchema.safeParse(dangerousBackdropStyle).success).toBe(false);

      const dangerousBoxShadowStyle = {
        boxShadow: '@import url("http://evil.com")',
      };
      expect(StyleDefinitionSchema.safeParse(dangerousBoxShadowStyle).success).toBe(false);
    });
  });

  describe('STORA-110: CSS Grid & Grid Child Item properties in StyleDefinitionSchema', () => {
    it('validates CSS Grid container expressions and grid track formats', () => {
      const gridContainerStyles = {
        display: 'grid',
        gridTemplateColumns: 'repeat(12, minmax(0, 1fr))',
        gridTemplateRows: 'auto 1fr auto',
        gridAutoFlow: 'row dense',
        gridAutoColumns: 'minmax(200px, auto)',
        gridAutoRows: 'minmax(100px, auto)',
        gap: '20px',
        rowGap: '16px',
        columnGap: '24px',
      };

      const result = StyleDefinitionSchema.safeParse(gridContainerStyles);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.gridTemplateColumns).toBe('repeat(12, minmax(0, 1fr))');
        expect(result.data.gridAutoFlow).toBe('row dense');
      }
    });

    it('validates CSS Grid child placement, colSpan, rowSpan, and span properties', () => {
      const gridItemStyles = {
        gridColumn: 'span 3 / span 3',
        gridRow: '1 / 3',
        gridColumnStart: '1',
        gridColumnEnd: '4',
        gridRowStart: 'auto',
        gridRowEnd: 'span 2',
        colSpan: 3,
        rowSpan: 'span 2',
        justifySelf: 'center',
        alignSelf: 'end',
      };

      const result = StyleDefinitionSchema.safeParse(gridItemStyles);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.gridColumn).toBe('span 3 / span 3');
        expect(result.data.colSpan).toBe(3);
        expect(result.data.rowSpan).toBe('span 2');
        expect(result.data.justifySelf).toBe('center');
      }
    });

    it('rejects dangerous injection vectors inside CSS Grid style values', () => {
      const dangerousGridStyle = {
        gridTemplateColumns: 'expression(document.cookie)',
      };
      expect(StyleDefinitionSchema.safeParse(dangerousGridStyle).success).toBe(false);
    });
  });
});





