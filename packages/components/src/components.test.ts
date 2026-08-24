import { describe, it, expect } from 'vitest';
import {
  createDefaultComponentRegistry,
  ComponentRegistry,
  pageDefinition,
  sectionDefinition,
  containerDefinition,
  columnsDefinition,
  headingDefinition,
  textDefinition,
  imageDefinition,
  buttonDefinition,
  extractComponentRequirements,
  primitiveTypeForField,
  isBindableField,
  ComponentFieldDefinition,
} from './index';
import { validateDocument, createBlankDocument, insertNode } from '@kubuild/core';
import { ResponsiveStylesSchema, ManifestSchema } from '@kubuild/schema';

describe('ComponentRegistry', () => {
  it('registers and retrieves core components', () => {
    const registry = createDefaultComponentRegistry();
    expect(registry.has('page')).toBe(true);
    expect(registry.has('heading')).toBe(true);
    expect(registry.has('button')).toBe(true);

    const buttonDef = registry.get('button');
    expect(buttonDef?.label).toBe('Button');
    expect(buttonDef?.acceptsChildren).toBe(false);
  });

  it('validates node structure against component policy', () => {
    const registry = createDefaultComponentRegistry();

    // Valid button
    const validBtn = { id: 'btn-1', type: 'button', props: { label: 'Click' }, children: [] };
    const validResult = registry.validateNode(validBtn);
    expect(validResult.valid).toBe(true);

    // Invalid button with children (acceptsChildren: false)
    const invalidBtn = {
      id: 'btn-2',
      type: 'button',
      children: [{ id: 'child-1', type: 'text' }],
    };
    const invalidResult = registry.validateNode(invalidBtn);
    expect(invalidResult.valid).toBe(false);
    expect(invalidResult.errors[0]).toContain('does not accept children');
  });

  it('supports custom component registration', () => {
    const registry = new ComponentRegistry();
    registry.register({
      type: 'custom.card',
      label: 'Card',
      category: 'custom',
      acceptsChildren: true,
    });

    expect(registry.has('custom.card')).toBe(true);
    expect(registry.listByCategory('custom').length).toBe(1);
  });
});

describe('STORA-020: Component Registry Contract', () => {
  describe('Acceptance Criteria 1: typed register/get/list/unregister API', () => {
    it('list() and listByCategory() reflect registered definitions', () => {
      const registry = new ComponentRegistry();
      registry.register({ type: 'a', label: 'A', category: 'custom' });
      registry.register({ type: 'b', label: 'B', category: 'layout' });

      expect(registry.list().map((d) => d.type).sort()).toEqual(['a', 'b']);
      expect(registry.listByCategory('custom').map((d) => d.type)).toEqual(['a']);
    });

    it('unregister() removes a type and returns false for an unknown type', () => {
      const registry = new ComponentRegistry();
      registry.register({ type: 'a', label: 'A', category: 'custom' });

      expect(registry.unregister('a')).toBe(true);
      expect(registry.has('a')).toBe(false);
      expect(registry.unregister('does-not-exist')).toBe(false);
    });
  });

  describe('Acceptance Criteria 2: duplicate type rejected unless explicit replace mode', () => {
    it('throws when registering an existing type without allowOverride', () => {
      const registry = new ComponentRegistry();
      registry.register({ type: 'a', label: 'A', category: 'custom' });

      expect(() => registry.register({ type: 'a', label: 'A2', category: 'custom' })).toThrow(
        /already registered/,
      );
      expect(registry.get('a')?.label).toBe('A');
    });

    it('replaces the stored definition when allowOverride is true', () => {
      const registry = new ComponentRegistry();
      registry.register({ type: 'a', label: 'A', category: 'custom' });
      registry.register({ type: 'a', label: 'A2', category: 'layout' }, true);

      expect(registry.get('a')?.label).toBe('A2');
      expect(registry.get('a')?.category).toBe('layout');
    });
  });

  describe('Acceptance Criteria 3: registry validates props and child component limits', () => {
    it('rejects a child whose type is not in allowedChildren', () => {
      const registry = new ComponentRegistry();
      registry.register({ type: 'parent', label: 'Parent', category: 'custom', acceptsChildren: true, allowedChildren: ['allowed-child'] });
      registry.register({ type: 'allowed-child', label: 'Allowed', category: 'custom' });
      registry.register({ type: 'other-child', label: 'Other', category: 'custom' });

      const node = {
        id: 'p1',
        type: 'parent',
        children: [{ id: 'c1', type: 'other-child' }],
      };
      const result = registry.validateNode(node);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('does not allow child type "other-child"');
    });

    it('allows a child type explicitly present in allowedChildren', () => {
      const registry = new ComponentRegistry();
      registry.register({ type: 'parent', label: 'Parent', category: 'custom', acceptsChildren: true, allowedChildren: ['allowed-child'] });
      registry.register({ type: 'allowed-child', label: 'Allowed', category: 'custom' });

      const node = {
        id: 'p1',
        type: 'parent',
        children: [{ id: 'c1', type: 'allowed-child' }],
      };
      expect(registry.validateNode(node).valid).toBe(true);
    });

    it('rejects a node placed under a disallowed parent type when parentType is supplied', () => {
      const registry = new ComponentRegistry();
      registry.register({ type: 'child', label: 'Child', category: 'custom', disallowedParents: ['forbidden-parent'] });

      const node = { id: 'c1', type: 'child' };
      const result = registry.validateNode(node, 'forbidden-parent');
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('not allowed inside parent "forbidden-parent"');

      expect(registry.validateNode(node, 'other-parent').valid).toBe(true);
      expect(registry.validateNode(node).valid).toBe(true);
    });

    it('surfaces validateProps error messages via validateNode', () => {
      const registry = new ComponentRegistry();
      registry.register({
        type: 'strict',
        label: 'Strict',
        category: 'custom',
        validateProps: (props) => (typeof props.title === 'string' ? true : ['title must be a string']),
      });

      expect(registry.validateNode({ id: 's1', type: 'strict', props: { title: 'ok' } }).valid).toBe(true);
      const invalid = registry.validateNode({ id: 's2', type: 'strict', props: {} });
      expect(invalid.valid).toBe(false);
      expect(invalid.errors).toContain('title must be a string');
    });
  });

  describe('Acceptance Criteria 4: renderer contract slot stays framework-agnostic', () => {
    it('round-trips an arbitrary renderer value through register/get without interpretation', () => {
      const registry = new ComponentRegistry<() => string>();
      const renderer = () => 'rendered';
      registry.register({ type: 'a', label: 'A', category: 'custom', renderer });

      expect(registry.get('a')?.renderer).toBe(renderer);
      expect(registry.get('a')?.renderer?.()).toBe('rendered');
    });

    it('defaults renderer to unknown and leaves it undefined when omitted', () => {
      const registry = new ComponentRegistry();
      registry.register({ type: 'a', label: 'A', category: 'custom' });
      expect(registry.get('a')?.renderer).toBeUndefined();
    });
  });
});

describe('ComponentRegistry.canInsertChild', () => {
  it('reports unknown parent/child types', () => {
    const registry = createDefaultComponentRegistry();
    expect(registry.canInsertChild('does-not-exist', 'heading').errors[0]).toContain('Unknown target parent type');
    expect(registry.canInsertChild('section', 'does-not-exist').errors[0]).toContain('Unknown component type');
  });

  it('rejects insertion into a component that does not accept children', () => {
    const registry = createDefaultComponentRegistry();
    const result = registry.canInsertChild('button', 'text');
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('does not accept children');
  });

  it('rejects a child type not present in the parent allowedChildren list', () => {
    const registry = createDefaultComponentRegistry();
    // container.allowedChildren = ['columns', ...content types] — 'section' is not allowed inside 'container'.
    const result = registry.canInsertChild('container', 'section');
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('does not allow');
  });

  it('allows a child type explicitly listed in allowedChildren', () => {
    const registry = createDefaultComponentRegistry();
    expect(registry.canInsertChild('section', 'heading').valid).toBe(true);
    expect(registry.canInsertChild('page', 'section').valid).toBe(true);
  });

  it('allows a child type matched via category membership in allowedChildren', () => {
    const registry = new ComponentRegistry();
    registry.register({ type: 'parent', label: 'Parent', category: 'custom', acceptsChildren: true, allowedChildren: ['typography'] });
    registry.register({ type: 'label', label: 'Label', category: 'typography' });
    expect(registry.canInsertChild('parent', 'label').valid).toBe(true);
  });

  it('allows any child type when allowedChildren includes "*"', () => {
    const registry = new ComponentRegistry();
    registry.register({ type: 'parent', label: 'Parent', category: 'custom', acceptsChildren: true, allowedChildren: ['*'] });
    registry.register({ type: 'anything', label: 'Anything', category: 'custom' });
    expect(registry.canInsertChild('parent', 'anything').valid).toBe(true);
  });

  it('rejects insertion when the child declares the parent type in disallowedParents', () => {
    const registry = new ComponentRegistry();
    registry.register({ type: 'parent', label: 'Parent', category: 'custom', acceptsChildren: true, allowedChildren: ['*'] });
    registry.register({ type: 'child', label: 'Child', category: 'custom', disallowedParents: ['parent'] });
    const result = registry.canInsertChild('parent', 'child');
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('is not allowed inside');
  });

  it('rejects nesting a "page" node anywhere (page is never a valid child)', () => {
    const registry = createDefaultComponentRegistry();
    expect(registry.canInsertChild('section', 'page').valid).toBe(false);
  });
});

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

describe('STORA-022: Content Components (heading/text/image/button)', () => {
  const registry = createDefaultComponentRegistry();

  describe('heading', () => {
    it('is valid with a non-empty text and level in range', () => {
      expect(headingDefinition.validateProps?.({ text: 'Hi', level: 3 })).toBe(true);
    });

    it('is valid with a variable binding for text (STORA-051: bindable props)', () => {
      expect(headingDefinition.validateProps?.({ text: { type: 'variable', key: 'site.name' }, level: 2 })).toBe(
        true,
      );
    });

    it('rejects empty text', () => {
      const result = headingDefinition.validateProps?.({ text: '' });
      expect(Array.isArray(result)).toBe(true);
      expect((result as string[])[0]).toContain('non-empty "text"');
    });

    it('rejects an out-of-range level', () => {
      const result = headingDefinition.validateProps?.({ text: 'Hi', level: 9 });
      expect((result as string[])[0]).toContain('level');
    });
  });

  describe('text', () => {
    it('is valid with non-empty content', () => {
      expect(textDefinition.validateProps?.({ content: 'Hello' })).toBe(true);
    });

    it('is valid with a variable binding for content (STORA-051: bindable props)', () => {
      expect(textDefinition.validateProps?.({ content: { type: 'variable', key: 'tagline' } })).toBe(true);
    });

    it('rejects missing content', () => {
      expect(textDefinition.validateProps?.({})).toEqual(['Text requires a non-empty "content".']);
    });
  });

  describe('image', () => {
    it('is valid with a direct src and alt text', () => {
      expect(imageDefinition.validateProps?.({ src: 'https://x/y.png', alt: 'An image' })).toBe(true);
    });

    it('is valid with a valid asset reference and alt text (no src required)', () => {
      expect(
        imageDefinition.validateProps?.({ asset: { type: 'asset', assetId: 'a1' }, alt: 'An image' }),
      ).toBe(true);
    });

    it('is valid with variable bindings for src and alt (STORA-051: bindable props)', () => {
      expect(
        imageDefinition.validateProps?.({
          src: { type: 'variable', key: 'hero.src' },
          alt: { type: 'variable', key: 'hero.alt' },
        }),
      ).toBe(true);
    });

    it('rejects when neither src nor a valid asset reference is present', () => {
      const result = imageDefinition.validateProps?.({ alt: 'An image' });
      expect((result as string[])[0]).toContain('src" URL or a valid "asset"');
    });

    it('rejects missing alt text', () => {
      const result = imageDefinition.validateProps?.({ src: 'https://x/y.png' });
      expect((result as string[])[0]).toContain('alt');
    });

    it('declares the assetProvider capability', () => {
      expect(imageDefinition.capabilities).toContain('assetProvider');
    });
  });

  describe('button', () => {
    it('is valid with just a label', () => {
      expect(buttonDefinition.validateProps?.({ label: 'Click' })).toBe(true);
    });

    it('is valid with a well-formed action', () => {
      expect(
        buttonDefinition.validateProps?.({ label: 'Go', action: { type: 'navigate', payload: { url: '/x' } } }),
      ).toBe(true);
    });

    it('is valid with variable bindings for label/href/disabled (STORA-051: bindable props)', () => {
      expect(
        buttonDefinition.validateProps?.({
          label: { type: 'variable', key: 'cta.label' },
          href: { type: 'variable', key: 'cta.href' },
          disabled: { type: 'variable', key: 'cta.disabled' },
        }),
      ).toBe(true);
    });

    it('rejects an empty label', () => {
      expect(buttonDefinition.validateProps?.({ label: '' })).toEqual(['Button requires a non-empty "label".']);
    });

    it('rejects a malformed action', () => {
      const result = buttonDefinition.validateProps?.({ label: 'Go', action: { payload: {} } });
      expect((result as string[])[0]).toContain('action');
    });

    it('rejects a non-boolean disabled value', () => {
      const result = buttonDefinition.validateProps?.({ label: 'Go', disabled: 'yes' });
      expect((result as string[])[0]).toContain('disabled');
    });

    it('declares the actionRegistry capability', () => {
      expect(buttonDefinition.capabilities).toContain('actionRegistry');
    });
  });

  it('registry.validateNode reports content-component prop errors end to end', () => {
    const invalidHeading = { id: 'h1', type: 'heading', props: { text: '' } };
    const result = registry.validateNode(invalidHeading);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('non-empty "text"');
  });
});

describe('STORA-051: prop-types bindability mapping', () => {
  const field = (type: ComponentFieldDefinition['type']): ComponentFieldDefinition => ({
    name: 'x',
    label: 'X',
    type,
  });

  it.each([
    ['string', 'string'],
    ['color', 'string'],
    ['number', 'number'],
    ['boolean', 'boolean'],
  ] as const)('maps field type "%s" to primitive type "%s"', (fieldType, expected) => {
    expect(primitiveTypeForField(field(fieldType))).toBe(expected);
  });

  it.each(['select', 'image', 'action', 'json'] as const)(
    'field type "%s" is not bindable',
    (fieldType) => {
      expect(primitiveTypeForField(field(fieldType))).toBeUndefined();
      expect(isBindableField(field(fieldType))).toBe(false);
    },
  );

  it('isBindableField is true for string/number/boolean fields', () => {
    expect(isBindableField(field('string'))).toBe(true);
    expect(isBindableField(field('number'))).toBe(true);
    expect(isBindableField(field('boolean'))).toBe(true);
  });
});

describe('STORA-024: Custom Component Extension Contract', () => {
  const productCardDefinition = {
    type: 'custom.product-card',
    label: 'Product Card',
    category: 'custom' as const,
    acceptsChildren: false,
    capabilities: ['dataProvider'],
    propFields: [
      { name: 'title', label: 'Title', type: 'string' as const },
      { name: 'price', label: 'Price', type: 'number' as const },
    ],
    validateProps: (props: Record<string, unknown>) =>
      typeof props.title === 'string' && props.title.length > 0 ? true : ['Product card requires a "title".'],
  };

  it('registers a sample custom component without touching core source', () => {
    const registry = new ComponentRegistry();
    expect(() => registry.register(productCardDefinition)).not.toThrow();
    expect(registry.get('custom.product-card')?.label).toBe('Product Card');
  });

  it('AC2: a document using the custom component fails validation without the registry, and passes with it', () => {
    let doc = createBlankDocument('Custom Component Test');
    doc = insertNode(doc, {
      parentId: 'root-page',
      node: { id: 'section-1', type: 'section', props: {}, children: [] },
    }).document;
    doc = insertNode(doc, {
      parentId: 'section-1',
      node: { id: 'card-1', type: 'custom.product-card', props: { title: 'Widget', price: 10 }, children: [] },
    }).document;

    const withoutRegistry = validateDocument(doc, { strictComponentTypes: true, componentRegistry: createDefaultComponentRegistry() });
    expect(withoutRegistry.valid).toBe(false);
    expect(withoutRegistry.errors.some((e) => e.code === 'UNKNOWN_COMPONENT_TYPE')).toBe(true);

    const registryWithCustom = createDefaultComponentRegistry();
    registryWithCustom.register(productCardDefinition);
    const withRegistry = validateDocument(doc, { strictComponentTypes: true, componentRegistry: registryWithCustom });
    expect(withRegistry.valid).toBe(true);
  });

  it('AC3: required components/capabilities can be extracted and feed a valid manifest', () => {
    const registry = createDefaultComponentRegistry();
    registry.register(productCardDefinition);

    let doc = createBlankDocument('Manifest Requirements Test');
    doc = insertNode(doc, {
      parentId: 'root-page',
      node: { id: 'section-1', type: 'section', props: {}, children: [] },
    }).document;
    doc = insertNode(doc, {
      parentId: 'section-1',
      node: { id: 'card-1', type: 'custom.product-card', props: { title: 'Widget', price: 10 }, children: [] },
    }).document;
    doc = insertNode(doc, {
      parentId: 'section-1',
      node: { id: 'btn-1', type: 'button', props: { label: 'Buy' }, children: [] },
    }).document;

    const requirements = extractComponentRequirements(doc.document, registry);
    expect(requirements.requiredComponents).toEqual(['custom.product-card']);
    expect(requirements.requiredCapabilities).toContain('dataProvider');
    expect(requirements.requiredCapabilities).toContain('actionRegistry');

    const manifestResult = ManifestSchema.safeParse({ ...requirements });
    expect(manifestResult.success).toBe(true);
  });
});
