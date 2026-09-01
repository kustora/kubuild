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
  paragraphDefinition,
  linkDefinition,
  blockquoteDefinition,
  badgeDefinition,
  codeBlockDefinition,
  imageDefinition,
  videoDefinition,
  iconDefinition,
  htmlEmbedDefinition,
  buttonDefinition,
  buttonSubmitDefinition,
  formDefinition,
  inputDefinition,
  textareaDefinition,
  selectDefinition,
  checkboxDefinition,
  switchDefinition,
  radioGroupDefinition,
  radioDefinition,
  radioItemDefinition,
  fileUploadDefinition,
  listDefinition,
  listItemDefinition,
  tableDefinition,
  tableRowDefinition,
  tableCellDefinition,
  extractComponentRequirements,
  primitiveTypeForField,
  isBindableField,
  ComponentFieldDefinition,
  TRAIT_GROUP_ORDER,
} from '../src/index';
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

describe('STORA-190: list and list-item definitions', () => {
  it('registers list and list-item in default component registry', () => {
    const registry = createDefaultComponentRegistry();
    expect(registry.has('list')).toBe(true);
    expect(registry.has('list-item')).toBe(true);

    const listDef = registry.get('list');
    expect(listDef?.category).toBe('typography');
    expect(listDef?.acceptsChildren).toBe(true);
    expect(listDef?.allowedChildren).toEqual(['list-item']);

    const listItemDef = registry.get('list-item');
    expect(listItemDef?.category).toBe('typography');
    expect(listItemDef?.acceptsChildren).toBe(true);
  });

  it('validates list props (tag and listStyleType)', () => {
    expect(listDefinition.validateProps?.({ tag: 'ul', listStyleType: 'disc' })).toBe(true);
    expect(listDefinition.validateProps?.({ tag: 'ol', listStyleType: 'decimal' })).toBe(true);
    expect(listDefinition.validateProps?.({ tag: 'ul', listStyleType: 'custom-icon' })).toBe(true);

    const invalidTag = listDefinition.validateProps?.({ tag: 'div' });
    expect(Array.isArray(invalidTag)).toBe(true);
    expect((invalidTag as string[])[0]).toContain('must be either "ul" or "ol"');

    const invalidStyle = listDefinition.validateProps?.({ listStyleType: 'invalid-style' });
    expect(Array.isArray(invalidStyle)).toBe(true);
    expect((invalidStyle as string[])[0]).toContain('must be one of:');
  });

  it('validates list-item props', () => {
    expect(listItemDefinition.validateProps?.({ text: 'Valid item' })).toBe(true);
    expect(listItemDefinition.validateProps?.({ text: { type: 'variable', key: 'item.name' } })).toBe(true);

    const invalidText = listItemDefinition.validateProps?.({ text: 123 });
    expect(Array.isArray(invalidText)).toBe(true);
    expect((invalidText as string[])[0]).toContain('must be a string');
  });

  it('enforces parent-child hierarchy between list and list-item', () => {
    const registry = createDefaultComponentRegistry();

    // Section allows list
    const sectionCanInsertList = registry.canInsertChild('section', 'list');
    expect(sectionCanInsertList.valid).toBe(true);

    // List allows list-item
    const listCanInsertItem = registry.canInsertChild('list', 'list-item');
    expect(listCanInsertItem.valid).toBe(true);

    // List does not allow button directly
    const listCanInsertBtn = registry.canInsertChild('list', 'button');
    expect(listCanInsertBtn.valid).toBe(false);

    // List-item allows button or heading or text
    expect(registry.canInsertChild('list-item', 'button').valid).toBe(true);
    expect(registry.canInsertChild('list-item', 'heading').valid).toBe(true);
    expect(registry.canInsertChild('list-item', 'text').valid).toBe(true);
    expect(registry.canInsertChild('list-item', 'list').valid).toBe(true);
  });
});

describe('STORA-191: Table component definitions', () => {
  it('registers table, table-row, and table-cell in default component registry', () => {
    const registry = createDefaultComponentRegistry();
    expect(registry.has('table')).toBe(true);
    expect(registry.has('table-row')).toBe(true);
    expect(registry.has('table-cell')).toBe(true);

    const tableDef = registry.get('table');
    expect(tableDef?.category).toBe('layout');
    expect(tableDef?.acceptsChildren).toBe(true);
    expect(tableDef?.allowedChildren).toEqual(['table-row']);

    const rowDef = registry.get('table-row');
    expect(rowDef?.acceptsChildren).toBe(true);
    expect(rowDef?.allowedChildren).toEqual(['table-cell']);

    const cellDef = registry.get('table-cell');
    expect(cellDef?.acceptsChildren).toBe(true);
  });

  it('validates table and table-row props', () => {
    expect(tableDefinition.validateProps?.({ striped: true, bordered: true, compact: false })).toBe(true);
    expect(tableDefinition.validateProps?.({})).toBe(true);
    expect(tableRowDefinition.validateProps?.({}) ?? true).toBe(true);

    const invalidStriped = tableDefinition.validateProps?.({ striped: 'yes' as unknown as boolean });
    expect(Array.isArray(invalidStriped)).toBe(true);
    expect((invalidStriped as string[])[0]).toContain('must be a boolean');
  });

  it('validates table-cell props (tag, colSpan, rowSpan, text)', () => {
    expect(tableCellDefinition.validateProps?.({ tag: 'td', colSpan: 2, rowSpan: 3, text: 'Hello' })).toBe(true);
    expect(tableCellDefinition.validateProps?.({ tag: 'th', text: 'Header' })).toBe(true);

    const invalidTag = tableCellDefinition.validateProps?.({ tag: 'div' });
    expect(Array.isArray(invalidTag)).toBe(true);
    expect((invalidTag as string[])[0]).toContain('must be either "td" or "th"');

    const invalidColSpan = tableCellDefinition.validateProps?.({ colSpan: 0 });
    expect(Array.isArray(invalidColSpan)).toBe(true);
    expect((invalidColSpan as string[])[0]).toContain('must be a positive integer');

    const invalidRowSpan = tableCellDefinition.validateProps?.({ rowSpan: -1 });
    expect(Array.isArray(invalidRowSpan)).toBe(true);
    expect((invalidRowSpan as string[])[0]).toContain('must be a positive integer');
  });

  it('enforces table hierarchy (section > table > table-row > table-cell)', () => {
    const registry = createDefaultComponentRegistry();

    expect(registry.canInsertChild('section', 'table').valid).toBe(true);
    expect(registry.canInsertChild('table', 'table-row').valid).toBe(true);
    expect(registry.canInsertChild('table', 'button').valid).toBe(false);

    expect(registry.canInsertChild('table-row', 'table-cell').valid).toBe(true);
    expect(registry.canInsertChild('table-row', 'text').valid).toBe(false);

    expect(registry.canInsertChild('table-cell', 'text').valid).toBe(true);
    expect(registry.canInsertChild('table-cell', 'button').valid).toBe(true);
    expect(registry.canInsertChild('table-cell', 'heading').valid).toBe(true);
  });
});

describe('STORA-192: Core Semantic Typography Components', () => {
  it('registers all typography components in default registry', () => {
    const registry = createDefaultComponentRegistry();
    const typographyTypes = ['paragraph', 'link', 'blockquote', 'badge', 'code-block'];

    for (const type of typographyTypes) {
      expect(registry.has(type)).toBe(true);
      const def = registry.get(type);
      expect(def).toBeDefined();
      expect(def?.category).toBe('typography');
    }
  });

  it('validates paragraph definition and props', () => {
    expect(paragraphDefinition.type).toBe('paragraph');
    expect(paragraphDefinition.acceptsChildren).toBe(false);
    expect(paragraphDefinition.defaultProps?.text).toBeDefined();
    expect(paragraphDefinition.validateProps?.({ text: 'Valid paragraph' })).toBe(true);
    expect(paragraphDefinition.validateProps?.({ content: 'Alternative prop' })).toBe(true);

    const invalid = paragraphDefinition.validateProps?.({ text: '   ' });
    expect(Array.isArray(invalid)).toBe(true);
    expect((invalid as string[])[0]).toContain('Paragraph requires a non-empty "text"');
  });

  it('validates link definition and props', () => {
    expect(linkDefinition.type).toBe('link');
    expect(linkDefinition.acceptsChildren).toBe(false);
    expect(linkDefinition.validateProps?.({ text: 'Link text', href: 'https://example.com', target: '_blank', rel: 'noopener' })).toBe(true);

    const invalidTarget = linkDefinition.validateProps?.({ text: 'Link', target: '_invalid' });
    expect(Array.isArray(invalidTarget)).toBe(true);
    expect((invalidTarget as string[])[0]).toContain('Link "target" must be one of');

    const emptyText = linkDefinition.validateProps?.({ text: '' });
    expect(Array.isArray(emptyText)).toBe(true);
    expect((emptyText as string[])[0]).toContain('Link requires a non-empty "text"');
  });

  it('validates blockquote definition and props', () => {
    expect(blockquoteDefinition.type).toBe('blockquote');
    expect(blockquoteDefinition.acceptsChildren).toBe(true);
    expect(blockquoteDefinition.allowedChildren).toContain('paragraph');
    expect(blockquoteDefinition.validateProps?.({ text: 'A quote', cite: 'https://source.org' })).toBe(true);

    const invalidText = blockquoteDefinition.validateProps?.({ text: 123 as unknown as string });
    expect(Array.isArray(invalidText)).toBe(true);
    expect((invalidText as string[])[0]).toContain('Blockquote "text" must be a string');
  });

  it('validates badge definition and props', () => {
    expect(badgeDefinition.type).toBe('badge');
    expect(badgeDefinition.acceptsChildren).toBe(false);
    expect(badgeDefinition.validateProps?.({ text: 'New', variant: 'success' })).toBe(true);

    const emptyBadge = badgeDefinition.validateProps?.({ text: '  ' });
    expect(Array.isArray(emptyBadge)).toBe(true);
    expect((emptyBadge as string[])[0]).toContain('Badge requires a non-empty "text"');
  });

  it('validates code-block definition and props', () => {
    expect(codeBlockDefinition.type).toBe('code-block');
    expect(codeBlockDefinition.acceptsChildren).toBe(false);
    expect(codeBlockDefinition.validateProps?.({ code: 'const x = 1;', language: 'typescript' })).toBe(true);

    const invalidCode = codeBlockDefinition.validateProps?.({ code: 123 as unknown as string });
    expect(Array.isArray(invalidCode)).toBe(true);
    expect((invalidCode as string[])[0]).toContain('Code Block "code" must be a string');
  });

  it('allows typography components inside container, section, columns, list-item, and table-cell', () => {
    const registry = createDefaultComponentRegistry();
    const parents = ['section', 'container', 'columns', 'list-item', 'table-cell'];
    const types = ['paragraph', 'link', 'blockquote', 'badge', 'code-block'];

    for (const parent of parents) {
      for (const child of types) {
        const canInsert = registry.canInsertChild(parent, child);
        expect(canInsert.valid, `Expected ${child} to be insertable inside ${parent}`).toBe(true);
      }
    }
  });
});

describe('STORA-194: Video, Icon, and HTML Embed Components', () => {
  it('registers video, icon, and html-embed in default registry', () => {
    const registry = createDefaultComponentRegistry();
    const mediaTypes = ['video', 'icon', 'html-embed'];

    for (const type of mediaTypes) {
      expect(registry.has(type)).toBe(true);
      const def = registry.get(type);
      expect(def).toBeDefined();
      expect(def?.acceptsChildren).toBe(false);
    }
  });

  it('validates video definition and props', () => {
    expect(videoDefinition.type).toBe('video');
    expect(videoDefinition.category).toBe('media');
    expect(videoDefinition.validateProps?.({
      src: 'https://www.youtube.com/watch?v=12345678901',
      provider: 'youtube',
      controls: true,
      autoplay: false,
      loop: true,
      muted: true,
    })).toBe(true);

    const invalidProvider = videoDefinition.validateProps?.({ provider: 'invalid-provider' });
    expect(Array.isArray(invalidProvider)).toBe(true);
    expect((invalidProvider as string[])[0]).toContain('Video "provider" must be one of');

    const invalidControls = videoDefinition.validateProps?.({ controls: 'yes' as unknown as boolean });
    expect(Array.isArray(invalidControls)).toBe(true);
    expect((invalidControls as string[])[0]).toContain('Video "controls" must be a boolean');
  });

  it('validates icon definition and props', () => {
    expect(iconDefinition.type).toBe('icon');
    expect(iconDefinition.category).toBe('media');
    expect(iconDefinition.validateProps?.({
      name: 'heart',
      size: 32,
      color: '#ef4444',
      strokeWidth: 2.5,
    })).toBe(true);

    const emptyName = iconDefinition.validateProps?.({ name: '' });
    expect(Array.isArray(emptyName)).toBe(true);
    expect((emptyName as string[])[0]).toContain('Icon requires a non-empty "name"');

    const invalidSize = iconDefinition.validateProps?.({ name: 'star', size: -5 });
    expect(Array.isArray(invalidSize)).toBe(true);
    expect((invalidSize as string[])[0]).toContain('Icon "size" must be a non-negative number');
  });

  it('validates html-embed definition and props', () => {
    expect(htmlEmbedDefinition.type).toBe('html-embed');
    expect(htmlEmbedDefinition.category).toBe('custom');
    expect(htmlEmbedDefinition.validateProps?.({ html: '<iframe src="https://example.com"></iframe>' })).toBe(true);

    const invalidHtml = htmlEmbedDefinition.validateProps?.({ html: 12345 as unknown as string });
    expect(Array.isArray(invalidHtml)).toBe(true);
    expect((invalidHtml as string[])[0]).toContain('HTML Embed "html" must be a string');
  });

  it('allows video, icon, and html-embed inside containers, sections, columns, list-items, and table-cells', () => {
    const registry = createDefaultComponentRegistry();
    const parents = ['section', 'container', 'columns', 'list-item', 'table-cell'];
    const types = ['video', 'icon', 'html-embed'];

    for (const parent of parents) {
      for (const child of types) {
        const canInsert = registry.canInsertChild(parent, child);
        expect(canInsert.valid, `Expected ${child} to be insertable inside ${parent}`).toBe(true);
      }
    }
  });
});

describe('STORA-195: Form Controls (form, input, textarea, select, checkbox, radio)', () => {
  it('registers form, input, textarea, select, checkbox, and radio in default registry under form category', () => {
    const registry = createDefaultComponentRegistry();
    const formTypes = ['form', 'input', 'textarea', 'select', 'checkbox', 'radio'];

    for (const type of formTypes) {
      expect(registry.has(type)).toBe(true);
      const def = registry.get(type);
      expect(def).toBeDefined();
      expect(def?.category).toBe('form');
    }

    expect(registry.get('form')?.acceptsChildren).toBe(true);
    expect(registry.get('input')?.acceptsChildren).toBe(false);
    expect(registry.get('textarea')?.acceptsChildren).toBe(false);
    expect(registry.get('select')?.acceptsChildren).toBe(false);
    expect(registry.get('checkbox')?.acceptsChildren).toBe(false);
    expect(registry.get('radio')?.acceptsChildren).toBe(false);
  });

  it('validates form definition and props', () => {
    expect(formDefinition.type).toBe('form');
    expect(formDefinition.category).toBe('form');
    expect(formDefinition.validateProps?.({
      name: 'lead_capture',
      action: 'https://example.com/api/submit',
      method: 'POST',
      target: '_self',
      autoComplete: 'on',
    })).toBe(true);

    const invalidMethod = formDefinition.validateProps?.({ method: 'DELETE' });
    expect(Array.isArray(invalidMethod)).toBe(true);
    expect((invalidMethod as string[])[0]).toContain('Form "method" must be either "GET" or "POST"');

    const invalidTarget = formDefinition.validateProps?.({ target: 'invalid' });
    expect(Array.isArray(invalidTarget)).toBe(true);
    expect((invalidTarget as string[])[0]).toContain('Form "target" must be one of');
  });

  it('validates input definition and props', () => {
    expect(inputDefinition.type).toBe('input');
    expect(inputDefinition.category).toBe('form');
    expect(inputDefinition.validateProps?.({
      name: 'email',
      type: 'email',
      placeholder: 'user@example.com',
      required: true,
      disabled: false,
    })).toBe(true);

    const invalidType = inputDefinition.validateProps?.({ type: 'button' });
    expect(Array.isArray(invalidType)).toBe(true);
    expect((invalidType as string[])[0]).toContain('Input "type" must be one of');

    const invalidRequired = inputDefinition.validateProps?.({ required: 'yes' as unknown as boolean });
    expect(Array.isArray(invalidRequired)).toBe(true);
    expect((invalidRequired as string[])[0]).toContain('Input "required" must be a boolean');
  });

  it('validates textarea definition and props', () => {
    expect(textareaDefinition.type).toBe('textarea');
    expect(textareaDefinition.category).toBe('form');
    expect(textareaDefinition.validateProps?.({
      name: 'feedback',
      placeholder: 'Your feedback...',
      rows: 5,
      required: false,
    })).toBe(true);

    const invalidRows = textareaDefinition.validateProps?.({ rows: 0 });
    expect(Array.isArray(invalidRows)).toBe(true);
    expect((invalidRows as string[])[0]).toContain('Textarea "rows" must be a positive integer');
  });

  it('validates select definition and props', () => {
    expect(selectDefinition.type).toBe('select');
    expect(selectDefinition.category).toBe('form');
    expect(selectDefinition.validateProps?.({
      name: 'country',
      options: [
        { label: 'Indonesia', value: 'ID' },
        { label: 'United States', value: 'US' },
      ],
      required: true,
    })).toBe(true);

    const invalidOptions = selectDefinition.validateProps?.({ options: 12345 as unknown as string });
    expect(Array.isArray(invalidOptions)).toBe(true);
    expect((invalidOptions as string[])[0]).toContain('Select "options" must be an array');
  });

  it('validates checkbox and radio definitions and props', () => {
    expect(checkboxDefinition.type).toBe('checkbox');
    expect(checkboxDefinition.category).toBe('form');
    expect(checkboxDefinition.validateProps?.({
      name: 'terms',
      label: 'Accept Terms',
      value: 'agreed',
      defaultChecked: true,
      required: true,
    })).toBe(true);

    expect(radioDefinition.type).toBe('radio');
    expect(radioDefinition.category).toBe('form');
    expect(radioDefinition.validateProps?.({
      name: 'gender',
      label: 'Male',
      value: 'male',
      defaultChecked: false,
    })).toBe(true);

    const invalidLabel = checkboxDefinition.validateProps?.({ label: 123 as unknown as string });
    expect(Array.isArray(invalidLabel)).toBe(true);
    expect((invalidLabel as string[])[0]).toContain('Checkbox "label" must be a string');
  });

  it('allows form controls to be nested inside form, container, section, and columns', () => {
    const registry = createDefaultComponentRegistry();
    const parents = ['form', 'container', 'section', 'columns'];
    const children = ['input', 'textarea', 'select', 'checkbox', 'radio', 'button'];

    for (const parent of parents) {
      for (const child of children) {
        const canInsert = registry.canInsertChild(parent, child);
        expect(canInsert.valid, `Expected ${child} to be insertable inside ${parent}`).toBe(true);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// STORA-335 — Unit Tests Komponen Form di Component Registry
// ---------------------------------------------------------------------------
describe('STORA-335: Unit Tests Komponen Form di Component Registry', () => {
  const FORM_COMPONENT_TYPES = [
    'form',
    'input',
    'textarea',
    'select',
    'checkbox',
    'switch',
    'radio-group',
    'radio',
    'radio-item',
    'file-upload',
    'button-submit',
  ] as const;

  const FORM_DEFINITIONS = [
    formDefinition,
    inputDefinition,
    textareaDefinition,
    selectDefinition,
    checkboxDefinition,
    switchDefinition,
    radioGroupDefinition,
    radioDefinition,
    radioItemDefinition,
    fileUploadDefinition,
    buttonSubmitDefinition,
  ];

  describe('1. Registration & Category in ComponentRegistry', () => {
    it('registers all 11 form components in default registry', () => {
      const registry = createDefaultComponentRegistry();

      for (const type of FORM_COMPONENT_TYPES) {
        expect(registry.has(type), `Component "${type}" should be registered in registry`).toBe(true);
        const def = registry.get(type);
        expect(def, `Component definition for "${type}" should be defined`).toBeDefined();
        expect(def?.type).toBe(type);
      }
    });

    it('all 11 form components are classified under category "form"', () => {
      const registry = createDefaultComponentRegistry();
      const formComponents = registry.listByCategory('form');
      const registeredFormTypes = formComponents.map((def) => def.type);

      expect(registeredFormTypes.length).toBe(11);
      for (const type of FORM_COMPONENT_TYPES) {
        expect(registeredFormTypes).toContain(type);
      }

      for (const def of FORM_DEFINITIONS) {
        expect(def.category).toBe('form');
      }
    });

    it('retrieves each form component definition by type with correct label', () => {
      const registry = createDefaultComponentRegistry();

      const expectedLabels: Record<string, string> = {
        form: 'Form',
        input: 'Input',
        textarea: 'Textarea',
        select: 'Select',
        checkbox: 'Checkbox',
        switch: 'Switch',
        'radio-group': 'Radio Group',
        radio: 'Radio',
        'radio-item': 'Radio Item',
        'file-upload': 'File Upload',
        'button-submit': 'Submit Button',
      };

      for (const [type, label] of Object.entries(expectedLabels)) {
        const def = registry.get(type);
        expect(def?.label).toBe(label);
      }
    });
  });

  describe('2. Representative Icons', () => {
    it('every form component defines a representative, non-empty icon string', () => {
      for (const def of FORM_DEFINITIONS) {
        expect(def.icon, `${def.type} must have an icon defined`).toBeDefined();
        expect(typeof def.icon).toBe('string');
        expect(def.icon?.trim().length, `${def.type} icon must not be empty`).toBeGreaterThan(0);
      }
    });

    it('verifies expected semantic icons for all form components', () => {
      const expectedIcons: Record<string, string> = {
        form: 'form',
        input: 'input',
        textarea: 'textarea',
        select: 'select',
        checkbox: 'checkbox',
        switch: 'switch',
        'radio-group': 'radio-group',
        radio: 'radio',
        'radio-item': 'radio',
        'file-upload': 'upload',
        'button-submit': 'send',
      };

      for (const [type, expectedIcon] of Object.entries(expectedIcons)) {
        const def = FORM_DEFINITIONS.find((d) => d.type === type);
        expect(def?.icon, `${type} should use icon "${expectedIcon}"`).toBe(expectedIcon);
      }
    });
  });

  describe('3. Default Styles & Visual Quality', () => {
    it('100% of form components have defaultStyles conforming to ResponsiveStylesSchema', () => {
      for (const def of FORM_DEFINITIONS) {
        expect(def.defaultStyles, `${def.type} must define defaultStyles`).toBeDefined();
        const parsed = ResponsiveStylesSchema.safeParse(def.defaultStyles);
        expect(
          parsed.success,
          `${def.type} defaultStyles must conform to ResponsiveStylesSchema: ${JSON.stringify(parsed.error?.issues)}`,
        ).toBe(true);
      }
    });

    it('every form component defines a non-empty base style object', () => {
      for (const def of FORM_DEFINITIONS) {
        const base = def.defaultStyles?.base;
        expect(base, `${def.type} defaultStyles.base must be defined`).toBeDefined();
        expect(Object.keys(base || {}).length, `${def.type} defaultStyles.base must not be empty`).toBeGreaterThan(0);
      }
    });

    it('form container uses responsive flex column layout default styles', () => {
      const base = formDefinition.defaultStyles?.base;
      expect(base?.display).toBe('flex');
      expect(base?.flexDirection).toBe('column');
      expect(base?.gap).toBe('16px');
      expect(base?.width).toBe('100%');
    });

    it('text-entry controls (input, textarea, select) have cohesive boxed styles', () => {
      const textControls = [inputDefinition, textareaDefinition, selectDefinition];

      for (const control of textControls) {
        const base = control.defaultStyles?.base;
        expect(base?.width).toBe('100%');
        expect(base?.borderRadius).toBe('6px');
        expect(base?.borderWidth).toBe('1px');
        expect(base?.borderStyle).toBe('solid');
        expect(base?.borderColor).toBe('#cbd5e1');
        expect(base?.backgroundColor).toBe('#ffffff');
        expect(base?.color).toBe('#1e293b');
        expect(base?.boxSizing).toBe('border-box');
      }
    });

    it('toggle & choice controls (checkbox, switch, radio) have inline-flex and pointer cursor', () => {
      const toggleControls = [checkboxDefinition, switchDefinition, radioDefinition];

      for (const control of toggleControls) {
        const base = control.defaultStyles?.base;
        expect(base?.display).toBe('inline-flex');
        expect(base?.alignItems).toBe('center');
        expect(base?.gap).toBe('8px');
        expect(base?.cursor).toBe('pointer');
        expect(base?.userSelect).toBe('none');
      }
    });

    it('submit button has prominent action styling', () => {
      const base = buttonSubmitDefinition.defaultStyles?.base;
      expect(base?.backgroundColor).toBe('#2563eb');
      expect(base?.color).toBe('#ffffff');
      expect(base?.borderRadius).toBe('6px');
      expect(base?.fontWeight).toBe('500');
      expect(base?.cursor).toBe('pointer');
      expect(base?.display).toBe('inline-flex');
      expect(base?.alignItems).toBe('center');
      expect(base?.justifyContent).toBe('center');
    });
  });

  describe('4. Trait Metadata & Property Definitions', () => {
    it('100% of form components define rich traits', () => {
      for (const def of FORM_DEFINITIONS) {
        expect(Array.isArray(def.traits), `${def.type} traits must be an array`).toBe(true);
        expect(def.traits?.length, `${def.type} traits must not be empty`).toBeGreaterThan(0);
      }
    });

    it('no form component has duplicate trait names', () => {
      for (const def of FORM_DEFINITIONS) {
        const names = (def.traits ?? []).map((t) => t.name);
        const uniqueNames = new Set(names);
        expect(
          uniqueNames.size,
          `${def.type} has duplicate trait names: ${names.join(', ')}`,
        ).toBe(names.length);
      }
    });

    it('all traits define valid groups recognized by TRAIT_GROUP_ORDER', () => {
      for (const def of FORM_DEFINITIONS) {
        for (const trait of def.traits ?? []) {
          if (trait.group) {
            expect(
              TRAIT_GROUP_ORDER,
              `${def.type}.${trait.name} has invalid group "${trait.group}"`,
            ).toContain(trait.group);
          }
        }
      }
    });

    it('every form component includes identity (id) and accessibility (ariaLabel) traits', () => {
      for (const def of FORM_DEFINITIONS) {
        const traitNames = (def.traits ?? []).map((t) => t.name);
        expect(traitNames, `${def.type} must include "id" trait`).toContain('id');
        expect(traitNames, `${def.type} must include "ariaLabel" trait`).toContain('ariaLabel');
      }
    });

    it('every form field component includes fieldName/name trait and disabled trait', () => {
      const fieldComponents = [
        inputDefinition,
        textareaDefinition,
        selectDefinition,
        checkboxDefinition,
        switchDefinition,
        radioGroupDefinition,
        radioDefinition,
        radioItemDefinition,
        fileUploadDefinition,
      ];

      for (const def of fieldComponents) {
        const traitNames = (def.traits ?? []).map((t) => t.name);
        expect(traitNames, `${def.type} must include "name" trait`).toContain('name');
        expect(traitNames, `${def.type} must include "disabled" trait`).toContain('disabled');
      }
    });
  });

  describe('5. Hierarchy, Parent-Child Policy & Node Validation', () => {
    it('form container accepts all form controls, layout, and content elements', () => {
      const registry = createDefaultComponentRegistry();
      const formDef = registry.get('form');
      expect(formDef?.acceptsChildren).toBe(true);

      const expectedChildren = [
        'input',
        'textarea',
        'select',
        'checkbox',
        'switch',
        'radio-group',
        'radio',
        'radio-item',
        'file-upload',
        'button-submit',
        'button',
        'heading',
        'text',
        'container',
        'columns',
        'section',
      ];

      for (const childType of expectedChildren) {
        const canInsert = registry.canInsertChild('form', childType);
        expect(canInsert.valid, `Form should allow child "${childType}"`).toBe(true);
      }
    });

    it('radio-group allows radio and radio-item children, as well as registered custom components', () => {
      const registry = createDefaultComponentRegistry();
      expect(registry.canInsertChild('radio-group', 'radio').valid).toBe(true);
      expect(registry.canInsertChild('radio-group', 'radio-item').valid).toBe(true);

      registry.register({ type: 'custom.radio', label: 'Custom Radio', category: 'custom' });
      expect(registry.canInsertChild('radio-group', 'custom.radio').valid).toBe(true);

      // radio-group does not allow arbitrary input or heading directly
      expect(registry.canInsertChild('radio-group', 'input').valid).toBe(false);
      expect(registry.canInsertChild('radio-group', 'textarea').valid).toBe(false);
    });

    it('all leaf form controls reject children (acceptsChildren: false)', () => {
      const registry = createDefaultComponentRegistry();
      const leafTypes = [
        'input',
        'textarea',
        'select',
        'checkbox',
        'switch',
        'radio',
        'radio-item',
        'file-upload',
        'button-submit',
      ];

      for (const type of leafTypes) {
        const def = registry.get(type);
        expect(def?.acceptsChildren, `${type} must not accept children`).toBe(false);

        const canInsert = registry.canInsertChild(type, 'text');
        expect(canInsert.valid, `${type} should reject child insertion`).toBe(false);
        expect(canInsert.errors[0]).toContain('does not accept children');
      }
    });

    it('disallows placing form components directly under page node', () => {
      const registry = createDefaultComponentRegistry();

      for (const type of FORM_COMPONENT_TYPES) {
        const canInsert = registry.canInsertChild('page', type);
        expect(canInsert.valid, `Page must not directly allow form component "${type}"`).toBe(false);
      }
    });

    it('allows inserting form components into section, container, columns, and form', () => {
      const registry = createDefaultComponentRegistry();
      const parentTypes = ['section', 'container', 'columns', 'form'];

      for (const parent of parentTypes) {
        for (const type of FORM_COMPONENT_TYPES) {
          const canInsert = registry.canInsertChild(parent, type);
          expect(canInsert.valid, `"${parent}" should allow form component "${type}"`).toBe(true);
        }
      }
    });
  });

  describe('6. Prop Validation (validateProps) & Variable Binding Support', () => {
    it('100% of form component defaultProps pass validateProps', () => {
      for (const def of FORM_DEFINITIONS) {
        if (def.validateProps && def.defaultProps) {
          const result = def.validateProps(def.defaultProps);
          expect(
            result,
            `${def.type} defaultProps must be valid: ${Array.isArray(result) ? result.join(', ') : result}`,
          ).toBe(true);
        }
      }
    });

    it('validates custom props for each form component', () => {
      expect(formDefinition.validateProps?.({
        name: 'signup_form',
        action: 'https://api.example.com/signup',
        method: 'POST',
        target: '_blank',
        autoComplete: 'off',
        preventDefault: false,
        scrollToFirstError: false,
        resetOnSubmit: true,
      })).toBe(true);

      expect(inputDefinition.validateProps?.({
        name: 'username',
        type: 'text',
        placeholder: 'Enter username',
        defaultValue: 'john_doe',
        required: true,
        disabled: false,
        readOnly: true,
        pattern: '^[a-z0-9_]+$',
        minLength: 3,
        maxLength: 20,
        prefixIcon: 'user',
        suffixIcon: 'check',
        helperText: 'Username must be alphanumeric',
      })).toBe(true);

      expect(textareaDefinition.validateProps?.({
        name: 'bio',
        placeholder: 'Tell us about yourself',
        defaultValue: 'Software engineer',
        rows: 6,
        required: true,
        disabled: false,
        readOnly: false,
        resize: 'both',
        autoGrow: true,
        maxCharCount: 250,
        helperText: 'Max 250 characters',
      })).toBe(true);

      expect(selectDefinition.validateProps?.({
        name: 'department',
        placeholder: 'Select department',
        options: [
          { label: 'Engineering', value: 'eng' },
          { label: 'Design', value: 'des' },
        ],
        defaultValue: 'eng',
        required: true,
        disabled: false,
        helperText: 'Select your team',
      })).toBe(true);

      expect(checkboxDefinition.validateProps?.({
        name: 'newsletter',
        label: 'Subscribe to newsletter',
        value: 'subscribed',
        defaultChecked: true,
        indeterminate: false,
        required: false,
        disabled: false,
        helperText: 'Weekly digest',
      })).toBe(true);

      expect(switchDefinition.validateProps?.({
        name: 'dark_mode',
        label: 'Enable Dark Mode',
        value: 'dark',
        defaultChecked: true,
        switchSize: 'lg',
        required: false,
        disabled: false,
        helperText: 'Toggle dark appearance',
      })).toBe(true);

      expect(radioGroupDefinition.validateProps?.({
        name: 'frequency',
        defaultSelected: 'daily',
        orientation: 'horizontal',
        required: true,
        disabled: false,
        helperText: 'How often would you like emails?',
      })).toBe(true);

      expect(radioDefinition.validateProps?.({
        name: 'frequency',
        label: 'Daily Digest',
        value: 'daily',
        defaultChecked: true,
        required: true,
        disabled: false,
        helperText: 'Sent every morning',
      })).toBe(true);

      expect(radioItemDefinition.validateProps?.({
        name: 'frequency',
        label: 'Weekly Digest',
        value: 'weekly',
        defaultChecked: false,
        required: false,
        disabled: false,
        helperText: 'Sent every Sunday',
      })).toBe(true);

      expect(fileUploadDefinition.validateProps?.({
        name: 'resume',
        label: 'Upload CV',
        accept: '.pdf,.docx',
        maxFileSize: 5,
        multiple: false,
        showPreview: true,
        required: true,
        disabled: false,
        helperText: 'PDF format preferred',
      })).toBe(true);

      expect(buttonSubmitDefinition.validateProps?.({
        label: 'Create Account',
        loadingText: 'Creating Account...',
        showSpinner: true,
        autoDisableOnSubmit: true,
        buttonType: 'submit',
        disabled: false,
      })).toBe(true);
    });

    it('rejects invalid props across all form components', () => {
      // form
      const invalidForm = formDefinition.validateProps?.({ method: 'HEAD', target: '_invalid' });
      expect(Array.isArray(invalidForm)).toBe(true);
      expect((invalidForm as string[]).length).toBe(2);

      // input
      const invalidInput = inputDefinition.validateProps?.({ type: 'invalid_type', minLength: -5, maxLength: -1 });
      expect(Array.isArray(invalidInput)).toBe(true);
      expect((invalidInput as string[]).length).toBe(3);

      // textarea
      const invalidTextarea = textareaDefinition.validateProps?.({ rows: -2, resize: 'unsupported', maxCharCount: -10 });
      expect(Array.isArray(invalidTextarea)).toBe(true);
      expect((invalidTextarea as string[]).length).toBe(3);

      // select
      const invalidSelect = selectDefinition.validateProps?.({ options: 12345, required: 'yes' as unknown as boolean });
      expect(Array.isArray(invalidSelect)).toBe(true);
      expect((invalidSelect as string[]).length).toBe(2);

      // checkbox
      const invalidCheckbox = checkboxDefinition.validateProps?.({ label: 123, indeterminate: 'no' as unknown as boolean });
      expect(Array.isArray(invalidCheckbox)).toBe(true);
      expect((invalidCheckbox as string[]).length).toBe(2);

      // switch
      const invalidSwitch = switchDefinition.validateProps?.({ switchSize: 'xxl', defaultChecked: 'on' as unknown as boolean });
      expect(Array.isArray(invalidSwitch)).toBe(true);
      expect((invalidSwitch as string[]).length).toBe(2);

      // radio-group
      const invalidRadioGroup = radioGroupDefinition.validateProps?.({ orientation: 'diagonal', defaultSelected: 99 });
      expect(Array.isArray(invalidRadioGroup)).toBe(true);
      expect((invalidRadioGroup as string[]).length).toBe(2);

      // radio
      const invalidRadio = radioDefinition.validateProps?.({ label: {}, defaultChecked: 'yes' as unknown as boolean });
      expect(Array.isArray(invalidRadio)).toBe(true);
      expect((invalidRadio as string[]).length).toBe(2);

      // file-upload
      const invalidFile = fileUploadDefinition.validateProps?.({ maxFileSize: -1, multiple: 'yes' as unknown as boolean });
      expect(Array.isArray(invalidFile)).toBe(true);
      expect((invalidFile as string[]).length).toBe(2);

      // button-submit
      const invalidBtn = buttonSubmitDefinition.validateProps?.({ label: '', showSpinner: 123 as unknown as boolean });
      expect(Array.isArray(invalidBtn)).toBe(true);
      expect((invalidBtn as string[]).length).toBe(2);
    });

    it('supports variable bindings in bindable props for all form components without failing validation', () => {
      const varBinding = (key: string) => ({ type: 'variable' as const, key });

      expect(formDefinition.validateProps?.({
        name: varBinding('form.name'),
        action: varBinding('form.actionUrl'),
        method: varBinding('form.method'),
      })).toBe(true);

      expect(inputDefinition.validateProps?.({
        name: varBinding('fields.email.name'),
        type: varBinding('fields.email.type'),
        placeholder: varBinding('fields.email.placeholder'),
        required: varBinding('fields.email.required'),
      })).toBe(true);

      expect(textareaDefinition.validateProps?.({
        name: varBinding('fields.msg.name'),
        placeholder: varBinding('fields.msg.placeholder'),
        rows: varBinding('fields.msg.rows'),
      })).toBe(true);

      expect(selectDefinition.validateProps?.({
        name: varBinding('fields.country.name'),
        options: varBinding('fields.country.options'),
      })).toBe(true);

      expect(checkboxDefinition.validateProps?.({
        name: varBinding('fields.agree.name'),
        label: varBinding('fields.agree.label'),
        defaultChecked: varBinding('fields.agree.checked'),
      })).toBe(true);

      expect(switchDefinition.validateProps?.({
        name: varBinding('fields.optIn.name'),
        label: varBinding('fields.optIn.label'),
        switchSize: varBinding('fields.optIn.size'),
      })).toBe(true);

      expect(radioGroupDefinition.validateProps?.({
        name: varBinding('fields.plan.name'),
        defaultSelected: varBinding('fields.plan.selected'),
        orientation: varBinding('fields.plan.orientation'),
      })).toBe(true);

      expect(radioDefinition.validateProps?.({
        name: varBinding('fields.tier.name'),
        label: varBinding('fields.tier.label'),
        value: varBinding('fields.tier.value'),
      })).toBe(true);

      expect(fileUploadDefinition.validateProps?.({
        name: varBinding('fields.avatar.name'),
        label: varBinding('fields.avatar.label'),
        accept: varBinding('fields.avatar.accept'),
      })).toBe(true);

      expect(buttonSubmitDefinition.validateProps?.({
        label: varBinding('buttons.submit.label'),
        loadingText: varBinding('buttons.submit.loadingText'),
      })).toBe(true);
    });
  });

  describe('7. End-to-End Document Validation with 100% Form Components', () => {
    it('builds and validates a full form document containing all 11 form components with 0 errors', () => {
      const registry = createDefaultComponentRegistry();
      let doc = createBlankDocument('Full Form Document Test');

      // 1. Insert section
      doc = insertNode(doc, {
        parentId: 'root-page',
        node: { id: 'sec-1', type: 'section', props: {}, children: [] },
      }).document;

      // 2. Insert form
      doc = insertNode(doc, {
        parentId: 'sec-1',
        node: {
          id: 'form-1',
          type: 'form',
          props: {
            name: 'complete_form',
            action: 'https://api.example.com/submit',
            method: 'POST',
            preventDefault: true,
            scrollToFirstError: true,
            resetOnSubmit: false,
          },
          children: [],
        },
      }).document;

      // 3. Insert input
      doc = insertNode(doc, {
        parentId: 'form-1',
        node: {
          id: 'input-1',
          type: 'input',
          props: { name: 'full_name', type: 'text', placeholder: 'John Doe', required: true },
          children: [],
        },
      }).document;

      // 4. Insert textarea
      doc = insertNode(doc, {
        parentId: 'form-1',
        node: {
          id: 'textarea-1',
          type: 'textarea',
          props: { name: 'comments', placeholder: 'Your comments', rows: 4 },
          children: [],
        },
      }).document;

      // 5. Insert select
      doc = insertNode(doc, {
        parentId: 'form-1',
        node: {
          id: 'select-1',
          type: 'select',
          props: {
            name: 'country',
            options: [
              { label: 'Indonesia', value: 'ID' },
              { label: 'Singapore', value: 'SG' },
            ],
            defaultValue: 'ID',
          },
          children: [],
        },
      }).document;

      // 6. Insert checkbox
      doc = insertNode(doc, {
        parentId: 'form-1',
        node: {
          id: 'checkbox-1',
          type: 'checkbox',
          props: { name: 'agree', label: 'Agree to terms', value: 'yes', defaultChecked: false },
          children: [],
        },
      }).document;

      // 7. Insert switch
      doc = insertNode(doc, {
        parentId: 'form-1',
        node: {
          id: 'switch-1',
          type: 'switch',
          props: { name: 'notifications', label: 'Push Notifications', value: 'yes', switchSize: 'md' },
          children: [],
        },
      }).document;

      // 8. Insert radio-group
      doc = insertNode(doc, {
        parentId: 'form-1',
        node: {
          id: 'radio-group-1',
          type: 'radio-group',
          props: { name: 'subscription', defaultSelected: 'monthly', orientation: 'vertical' },
          children: [],
        },
      }).document;

      // 9. Insert radio inside radio-group
      doc = insertNode(doc, {
        parentId: 'radio-group-1',
        node: {
          id: 'radio-1',
          type: 'radio',
          props: { name: 'subscription', label: 'Monthly', value: 'monthly', defaultChecked: true },
          children: [],
        },
      }).document;

      // 10. Insert radio-item inside radio-group
      doc = insertNode(doc, {
        parentId: 'radio-group-1',
        node: {
          id: 'radio-item-1',
          type: 'radio-item',
          props: { name: 'subscription', label: 'Yearly', value: 'yearly', defaultChecked: false },
          children: [],
        },
      }).document;

      // 11. Insert file-upload
      doc = insertNode(doc, {
        parentId: 'form-1',
        node: {
          id: 'upload-1',
          type: 'file-upload',
          props: { name: 'attachment', label: 'Attachment', accept: '.pdf', maxFileSize: 10 },
          children: [],
        },
      }).document;

      // 12. Insert button-submit
      doc = insertNode(doc, {
        parentId: 'form-1',
        node: {
          id: 'btn-submit-1',
          type: 'button-submit',
          props: { label: 'Submit Application', buttonType: 'submit', loadingText: 'Submitting...' },
          children: [],
        },
      }).document;

      const result = validateDocument(doc, { componentRegistry: registry });
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('100% of form components pass registry.validateNode for valid node shapes', () => {
      const registry = createDefaultComponentRegistry();

      for (const def of FORM_DEFINITIONS) {
        const node = {
          id: `node-${def.type}`,
          type: def.type,
          props: { ...(def.defaultProps ?? {}) },
          children: [],
        };
        const validation = registry.validateNode(node, 'form');
        expect(
          validation.valid,
          `validateNode for valid ${def.type} node should pass: ${validation.errors.join(', ')}`,
        ).toBe(true);
      }
    });

    it('100% of leaf form components fail registry.validateNode when invalidly given children', () => {
      const registry = createDefaultComponentRegistry();
      const leafDefs = FORM_DEFINITIONS.filter((d) => !d.acceptsChildren);

      for (const def of leafDefs) {
        const invalidNode = {
          id: `invalid-${def.type}`,
          type: def.type,
          props: { ...(def.defaultProps ?? {}) },
          children: [{ id: 'child-1', type: 'text', props: { content: 'test' } }],
        };
        const validation = registry.validateNode(invalidNode, 'form');
        expect(validation.valid, `${def.type} must fail validation when children are present`).toBe(false);
        expect(validation.errors[0]).toContain('does not accept children');
      }
    });

    it('100% of form components fail registry.validateNode when placed directly under forbidden page parent', () => {
      const registry = createDefaultComponentRegistry();

      for (const def of FORM_DEFINITIONS) {
        const node = {
          id: `node-${def.type}`,
          type: def.type,
          props: { ...(def.defaultProps ?? {}) },
          children: [],
        };
        const validation = registry.validateNode(node, 'page');
        expect(
          validation.valid,
          `${def.type} must fail validation when placed directly under "page" parent`,
        ).toBe(false);
      }
    });
  });
});






