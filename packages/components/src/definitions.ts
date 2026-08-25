import { isActionBinding, isAssetReference, isVariableBinding } from '@kubuild/schema';
import { ComponentDefinition, ComponentRegistry } from './registry';

/**
 * Layout nesting policy (STORA-021): page > section > container/columns > content.
 * `page` is never a valid child anywhere (excluded from every allowedChildren list
 * below, and explicitly barred via disallowedParents) so a "page" node can never
 * appear nested inside another node, and content nodes can never become the root
 * (enforced separately by the schema's RootPageNodeSchema refinement).
 */
const LAYOUT_PARENTS = ['page', 'section', 'container', 'columns'];
const CONTENT_CHILD_TYPES = ['heading', 'text', 'image', 'button', 'list', 'collection', 'custom'];

export const pageDefinition: ComponentDefinition = {
  type: 'page',
  label: 'Page',
  category: 'layout',
  icon: 'layout',
  acceptsChildren: true,
  allowedChildren: ['section', 'custom'],
  disallowedParents: [...LAYOUT_PARENTS, ...CONTENT_CHILD_TYPES, 'list-item'],
  defaultProps: { title: 'New Page' },
  defaultStyles: { base: { minHeight: '100vh', backgroundColor: '#ffffff' } },
};

export const sectionDefinition: ComponentDefinition = {
  type: 'section',
  label: 'Section',
  category: 'layout',
  icon: 'rows',
  acceptsChildren: true,
  allowedChildren: ['container', 'columns', ...CONTENT_CHILD_TYPES],
  defaultProps: {},
  defaultStyles: {
    base: {
      paddingTop: '48px',
      paddingBottom: '48px',
      paddingLeft: '16px',
      paddingRight: '16px',
    },
    tablet: {
      paddingTop: '32px',
      paddingBottom: '32px',
    },
    mobile: {
      paddingTop: '24px',
      paddingBottom: '24px',
      paddingLeft: '16px',
      paddingRight: '16px',
    },
  },
};

export const containerDefinition: ComponentDefinition = {
  type: 'container',
  label: 'Container',
  category: 'layout',
  icon: 'box',
  acceptsChildren: true,
  allowedChildren: ['columns', ...CONTENT_CHILD_TYPES],
  defaultProps: { maxWidth: '1200px' },
  defaultStyles: {
    base: {
      maxWidth: '1200px',
      margin: '0 auto',
      width: '100%',
    },
    tablet: {
      maxWidth: '720px',
    },
    mobile: {
      maxWidth: '100%',
      paddingLeft: '16px',
      paddingRight: '16px',
    },
  },
};

export const columnsDefinition: ComponentDefinition = {
  type: 'columns',
  label: 'Columns',
  category: 'layout',
  icon: 'columns',
  acceptsChildren: true,
  allowedChildren: ['container', ...CONTENT_CHILD_TYPES],
  defaultProps: { columns: 2, gap: '16px' },
  defaultStyles: {
    base: {
      display: 'grid',
      gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
      gap: '16px',
    },
    tablet: {
      gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
      gap: '12px',
    },
    mobile: {
      gridTemplateColumns: 'repeat(1, minmax(0, 1fr))',
      gap: '12px',
    },
  },
};

export const headingDefinition: ComponentDefinition = {
  type: 'heading',
  label: 'Heading',
  category: 'typography',
  icon: 'heading',
  acceptsChildren: false,
  defaultProps: { text: 'Heading Text', level: 2 },
  propFields: [
    { name: 'text', label: 'Text', type: 'string', defaultValue: 'Heading Text' },
    {
      name: 'level',
      label: 'Heading Level',
      type: 'select',
      defaultValue: 2,
      options: [1, 2, 3, 4, 5, 6].map((level) => ({ label: `H${level}`, value: level })),
    },
  ],
  validateProps: (props) => {
    const errors: string[] = [];
    if (!isVariableBinding(props.text) && (typeof props.text !== 'string' || props.text.trim().length === 0)) {
      errors.push('Heading requires a non-empty "text".');
    }
    if (props.level !== undefined && (typeof props.level !== 'number' || props.level < 1 || props.level > 6)) {
      errors.push('Heading "level" must be a number between 1 and 6.');
    }
    return errors.length > 0 ? errors : true;
  },
  defaultStyles: {
    base: {
      fontSize: '32px',
      fontWeight: '700',
      color: '#111827',
      margin: '0 0 16px 0',
    },
  },
};

export const textDefinition: ComponentDefinition = {
  type: 'text',
  label: 'Text',
  category: 'typography',
  icon: 'type',
  acceptsChildren: false,
  defaultProps: { content: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.' },
  propFields: [
    { name: 'content', label: 'Content', type: 'string', defaultValue: 'Lorem ipsum dolor sit amet.' },
  ],
  validateProps: (props) => {
    if (!isVariableBinding(props.content) && (typeof props.content !== 'string' || props.content.trim().length === 0)) {
      return ['Text requires a non-empty "content".'];
    }
    return true;
  },
  defaultStyles: {
    base: {
      fontSize: '16px',
      color: '#4b5563',
      lineHeight: '1.6',
    },
  },
};

export const imageDefinition: ComponentDefinition = {
  type: 'image',
  label: 'Image',
  category: 'media',
  icon: 'image',
  acceptsChildren: false,
  capabilities: ['assetProvider'],
  defaultProps: {
    src: 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=800&auto=format&fit=crop&q=80',
    alt: 'Default image',
    width: 600,
    height: 400,
  },
  propFields: [
    { name: 'src', label: 'Image URL', type: 'string' },
    { name: 'asset', label: 'Asset Reference', type: 'json' },
    { name: 'alt', label: 'Alt Text', type: 'string', defaultValue: 'Default image' },
    { name: 'width', label: 'Width', type: 'number' },
    { name: 'height', label: 'Height', type: 'number' },
  ],
  validateProps: (props) => {
    const errors: string[] = [];
    const hasSrc = (typeof props.src === 'string' && props.src.trim().length > 0) || isVariableBinding(props.src);
    const hasAsset = isAssetReference(props.asset);
    if (!hasSrc && !hasAsset) {
      errors.push('Image requires either a non-empty "src" URL or a valid "asset" reference.');
    }
    const hasAlt = (typeof props.alt === 'string' && props.alt.trim().length > 0) || isVariableBinding(props.alt);
    if (!hasAlt) {
      errors.push('Image requires non-empty "alt" text.');
    }
    return errors.length > 0 ? errors : true;
  },
  defaultStyles: {
    base: {
      maxWidth: '100%',
      height: 'auto',
      borderRadius: '8px',
    },
  },
};

export const buttonDefinition: ComponentDefinition = {
  type: 'button',
  label: 'Button',
  category: 'interactive',
  icon: 'mouse-pointer',
  acceptsChildren: false,
  capabilities: ['actionRegistry'],
  defaultProps: {
    label: 'Click Me',
    variant: 'primary',
  },
  propFields: [
    { name: 'label', label: 'Label', type: 'string', defaultValue: 'Click Me' },
    { name: 'href', label: 'Link URL', type: 'string' },
    { name: 'action', label: 'Action', type: 'action' },
    { name: 'disabled', label: 'Disabled', type: 'boolean', defaultValue: false },
    {
      name: 'variant',
      label: 'Variant',
      type: 'select',
      defaultValue: 'primary',
      options: [
        { label: 'Primary', value: 'primary' },
        { label: 'Secondary', value: 'secondary' },
      ],
    },
  ],
  validateProps: (props) => {
    const errors: string[] = [];
    const hasLabel =
      (typeof props.label === 'string' && props.label.trim().length > 0) || isVariableBinding(props.label);
    if (!hasLabel) {
      errors.push('Button requires a non-empty "label".');
    }
    if (props.href !== undefined && typeof props.href !== 'string' && !isVariableBinding(props.href)) {
      errors.push('Button "href" must be a string when provided.');
    }
    if (props.action !== undefined && !isActionBinding(props.action)) {
      errors.push('Button "action" must be a valid action binding when provided.');
    }
    if (props.disabled !== undefined && typeof props.disabled !== 'boolean' && !isVariableBinding(props.disabled)) {
      errors.push('Button "disabled" must be a boolean when provided.');
    }
    return errors.length > 0 ? errors : true;
  },
  defaultStyles: {
    base: {
      backgroundColor: '#2563eb',
      color: '#ffffff',
      paddingTop: '10px',
      paddingBottom: '10px',
      paddingLeft: '20px',
      paddingRight: '20px',
      borderRadius: '6px',
      fontWeight: '500',
      fontSize: '15px',
      border: 'none',
      cursor: 'pointer',
    },
  },
};

export const collectionDefinition: ComponentDefinition = {
  type: 'collection',
  label: 'Collection',
  category: 'data',
  icon: 'database',
  acceptsChildren: true,
  defaultProps: {
    sourceKey: 'items',
    itemAlias: 'item',
  },
  propFields: [
    { name: 'sourceKey', label: 'Source Variable', type: 'string', defaultValue: 'items' },
    { name: 'itemAlias', label: 'Item Alias', type: 'string', defaultValue: 'item' },
  ],
};

export const listDefinition: ComponentDefinition = {
  type: 'list',
  label: 'List',
  category: 'typography',
  icon: 'list',
  acceptsChildren: true,
  allowedChildren: ['list-item'],
  defaultProps: {
    tag: 'ul',
    listStyleType: 'disc',
  },
  defaultChildren: [
    { type: 'list-item', props: { text: 'List item 1' } },
    { type: 'list-item', props: { text: 'List item 2' } },
    { type: 'list-item', props: { text: 'List item 3' } },
  ],
  propFields: [
    {
      name: 'tag',
      label: 'Tag',
      type: 'select',
      defaultValue: 'ul',
      options: [
        { label: 'Unordered (ul)', value: 'ul' },
        { label: 'Ordered (ol)', value: 'ol' },
      ],
    },
    {
      name: 'listStyleType',
      label: 'List Style Type',
      type: 'select',
      defaultValue: 'disc',
      options: [
        { label: 'Disc', value: 'disc' },
        { label: 'Circle', value: 'circle' },
        { label: 'Square', value: 'square' },
        { label: 'Decimal', value: 'decimal' },
        { label: 'None', value: 'none' },
        { label: 'Custom Icon', value: 'custom-icon' },
      ],
    },
  ],
  validateProps: (props) => {
    const errors: string[] = [];
    if (props.tag !== undefined && !isVariableBinding(props.tag)) {
      if (props.tag !== 'ul' && props.tag !== 'ol') {
        errors.push('List "tag" must be either "ul" or "ol".');
      }
    }
    if (props.listStyleType !== undefined && !isVariableBinding(props.listStyleType)) {
      const allowed = ['disc', 'circle', 'square', 'decimal', 'none', 'custom-icon'];
      if (typeof props.listStyleType !== 'string' || !allowed.includes(props.listStyleType)) {
        errors.push(`List "listStyleType" must be one of: ${allowed.join(', ')}.`);
      }
    }
    return errors.length > 0 ? errors : true;
  },
  defaultStyles: {
    base: {
      margin: '0 0 16px 0',
      paddingLeft: '24px',
    },
  },
};

export const listItemDefinition: ComponentDefinition = {
  type: 'list-item',
  label: 'List Item',
  category: 'typography',
  icon: 'list-item',
  acceptsChildren: true,
  allowedChildren: ['heading', 'text', 'image', 'button', 'list', 'custom'],
  defaultProps: {
    text: 'List item',
  },
  propFields: [
    {
      name: 'text',
      label: 'Text',
      type: 'string',
      defaultValue: 'List item',
    },
  ],
  validateProps: (props) => {
    const errors: string[] = [];
    if (props.text !== undefined && typeof props.text !== 'string' && !isVariableBinding(props.text)) {
      errors.push('List Item "text" must be a string when provided.');
    }
    return errors.length > 0 ? errors : true;
  },
  defaultStyles: {
    base: {
      margin: '4px 0',
      fontSize: '16px',
      color: '#374151',
      lineHeight: '1.5',
    },
  },
};

export const coreComponentDefinitions: ComponentDefinition[] = [
  pageDefinition,
  sectionDefinition,
  containerDefinition,
  columnsDefinition,
  headingDefinition,
  textDefinition,
  imageDefinition,
  buttonDefinition,
  collectionDefinition,
  listDefinition,
  listItemDefinition,
];

export function createDefaultComponentRegistry(): ComponentRegistry {
  const registry = new ComponentRegistry();
  for (const def of coreComponentDefinitions) {
    registry.register(def);
  }
  return registry;
}
