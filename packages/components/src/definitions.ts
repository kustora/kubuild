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
const CONTENT_CHILD_TYPES = [
  'heading',
  'text',
  'paragraph',
  'link',
  'blockquote',
  'badge',
  'code-block',
  'image',
  'button',
  'list',
  'table',
  'collection',
  'custom',
];

export const pageDefinition: ComponentDefinition = {
  type: 'page',
  label: 'Page',
  category: 'layout',
  icon: 'layout',
  acceptsChildren: true,
  allowedChildren: ['section', 'custom'],
  disallowedParents: [...LAYOUT_PARENTS, ...CONTENT_CHILD_TYPES, 'list-item', 'table-row', 'table-cell'],
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
  allowedChildren: [
    'heading',
    'text',
    'paragraph',
    'link',
    'blockquote',
    'badge',
    'code-block',
    'image',
    'button',
    'list',
    'custom',
  ],
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

export const paragraphDefinition: ComponentDefinition = {
  type: 'paragraph',
  label: 'Paragraph',
  category: 'typography',
  icon: 'paragraph',
  acceptsChildren: false,
  defaultProps: {
    text: 'A paragraph of text with clean semantic typography.',
  },
  propFields: [
    {
      name: 'text',
      label: 'Text',
      type: 'string',
      defaultValue: 'A paragraph of text with clean semantic typography.',
    },
  ],
  validateProps: (props) => {
    const errors: string[] = [];
    const textVal = props.text ?? props.content;
    if (
      textVal !== undefined &&
      !isVariableBinding(textVal) &&
      (typeof textVal !== 'string' || textVal.trim().length === 0)
    ) {
      errors.push('Paragraph requires a non-empty "text".');
    }
    return errors.length > 0 ? errors : true;
  },
  defaultStyles: {
    base: {
      fontSize: '16px',
      color: '#4b5563',
      lineHeight: '1.6',
      margin: '0 0 16px 0',
    },
  },
};

export const linkDefinition: ComponentDefinition = {
  type: 'link',
  label: 'Link',
  category: 'typography',
  icon: 'link',
  acceptsChildren: false,
  defaultProps: {
    text: 'Click here',
    href: '#',
    target: '_self',
    rel: '',
  },
  propFields: [
    { name: 'text', label: 'Link Text', type: 'string', defaultValue: 'Click here' },
    { name: 'href', label: 'URL (href)', type: 'string', defaultValue: '#' },
    {
      name: 'target',
      label: 'Target',
      type: 'select',
      defaultValue: '_self',
      options: [
        { label: 'Same tab (_self)', value: '_self' },
        { label: 'New tab (_blank)', value: '_blank' },
        { label: 'Parent (_parent)', value: '_parent' },
        { label: 'Top (_top)', value: '_top' },
      ],
    },
    { name: 'rel', label: 'Relationship (rel)', type: 'string', defaultValue: '' },
  ],
  validateProps: (props) => {
    const errors: string[] = [];
    if (
      props.text !== undefined &&
      !isVariableBinding(props.text) &&
      (typeof props.text !== 'string' || props.text.trim().length === 0)
    ) {
      errors.push('Link requires a non-empty "text".');
    }
    if (props.href !== undefined && typeof props.href !== 'string' && !isVariableBinding(props.href)) {
      errors.push('Link "href" must be a string when provided.');
    }
    if (props.target !== undefined && !isVariableBinding(props.target)) {
      const allowedTargets = ['_self', '_blank', '_parent', '_top'];
      if (typeof props.target !== 'string' || !allowedTargets.includes(props.target)) {
        errors.push(`Link "target" must be one of: ${allowedTargets.join(', ')}.`);
      }
    }
    if (props.rel !== undefined && typeof props.rel !== 'string' && !isVariableBinding(props.rel)) {
      errors.push('Link "rel" must be a string when provided.');
    }
    return errors.length > 0 ? errors : true;
  },
  defaultStyles: {
    base: {
      color: '#2563eb',
      textDecoration: 'underline',
      cursor: 'pointer',
    },
  },
};

export const blockquoteDefinition: ComponentDefinition = {
  type: 'blockquote',
  label: 'Blockquote',
  category: 'typography',
  icon: 'blockquote',
  acceptsChildren: true,
  allowedChildren: [
    'paragraph',
    'text',
    'heading',
    'link',
    'badge',
    'code-block',
    'image',
    'custom',
  ],
  defaultProps: {
    text: '“Simplicity is the soul of efficiency.”',
  },
  propFields: [
    {
      name: 'text',
      label: 'Quote Text',
      type: 'string',
      defaultValue: '“Simplicity is the soul of efficiency.”',
    },
    { name: 'cite', label: 'Citation URL (cite)', type: 'string' },
  ],
  validateProps: (props) => {
    const errors: string[] = [];
    if (props.text !== undefined && typeof props.text !== 'string' && !isVariableBinding(props.text)) {
      errors.push('Blockquote "text" must be a string when provided.');
    }
    if (props.cite !== undefined && typeof props.cite !== 'string' && !isVariableBinding(props.cite)) {
      errors.push('Blockquote "cite" must be a string when provided.');
    }
    return errors.length > 0 ? errors : true;
  },
  defaultStyles: {
    base: {
      borderLeftWidth: '4px',
      borderLeftColor: '#3b82f6',
      borderLeftStyle: 'solid',
      paddingTop: '8px',
      paddingBottom: '8px',
      paddingLeft: '16px',
      paddingRight: '12px',
      margin: '0 0 16px 0',
      fontStyle: 'italic',
      color: '#4b5563',
      backgroundColor: '#f8fafc',
    },
  },
};

export const badgeDefinition: ComponentDefinition = {
  type: 'badge',
  label: 'Badge',
  category: 'typography',
  icon: 'badge',
  acceptsChildren: false,
  defaultProps: {
    text: 'Badge',
    variant: 'default',
  },
  propFields: [
    { name: 'text', label: 'Badge Text', type: 'string', defaultValue: 'Badge' },
    {
      name: 'variant',
      label: 'Variant',
      type: 'select',
      defaultValue: 'default',
      options: [
        { label: 'Default', value: 'default' },
        { label: 'Success', value: 'success' },
        { label: 'Warning', value: 'warning' },
        { label: 'Danger', value: 'danger' },
        { label: 'Info', value: 'info' },
      ],
    },
  ],
  validateProps: (props) => {
    const errors: string[] = [];
    if (
      props.text !== undefined &&
      !isVariableBinding(props.text) &&
      (typeof props.text !== 'string' || props.text.trim().length === 0)
    ) {
      errors.push('Badge requires a non-empty "text".');
    }
    if (props.variant !== undefined && typeof props.variant !== 'string' && !isVariableBinding(props.variant)) {
      errors.push('Badge "variant" must be a string.');
    }
    return errors.length > 0 ? errors : true;
  },
  defaultStyles: {
    base: {
      display: 'inline-flex',
      alignItems: 'center',
      paddingLeft: '10px',
      paddingRight: '10px',
      paddingTop: '2px',
      paddingBottom: '2px',
      borderRadius: '9999px',
      fontSize: '12px',
      fontWeight: '500',
      lineHeight: '1.4',
      backgroundColor: '#e0e7ff',
      color: '#3730a3',
    },
  },
};

export const codeBlockDefinition: ComponentDefinition = {
  type: 'code-block',
  label: 'Code Block',
  category: 'typography',
  icon: 'code-block',
  acceptsChildren: false,
  defaultProps: {
    code: 'console.log("Hello, world!");',
    language: 'javascript',
  },
  propFields: [
    {
      name: 'code',
      label: 'Code',
      type: 'textarea',
      defaultValue: 'console.log("Hello, world!");',
    },
    {
      name: 'language',
      label: 'Language',
      type: 'string',
      defaultValue: 'javascript',
    },
  ],
  validateProps: (props) => {
    const errors: string[] = [];
    if (props.code !== undefined && typeof props.code !== 'string' && !isVariableBinding(props.code)) {
      errors.push('Code Block "code" must be a string when provided.');
    }
    if (props.language !== undefined && typeof props.language !== 'string' && !isVariableBinding(props.language)) {
      errors.push('Code Block "language" must be a string when provided.');
    }
    return errors.length > 0 ? errors : true;
  },
  defaultStyles: {
    base: {
      backgroundColor: '#1e293b',
      color: '#f8fafc',
      padding: '16px',
      borderRadius: '8px',
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
      fontSize: '14px',
      lineHeight: '1.5',
      overflowX: 'auto',
      margin: '0 0 16px 0',
      whiteSpace: 'pre',
    },
  },
};

export const tableDefinition: ComponentDefinition = {
  type: 'table',
  label: 'Table',
  category: 'layout',
  icon: 'table',
  acceptsChildren: true,
  allowedChildren: ['table-row'],
  defaultProps: {
    striped: false,
    bordered: true,
    compact: false,
  },
  defaultChildren: [
    {
      type: 'table-row',
      children: [
        { type: 'table-cell', props: { tag: 'th', text: 'Header 1' } },
        { type: 'table-cell', props: { tag: 'th', text: 'Header 2' } },
      ],
    },
    {
      type: 'table-row',
      children: [
        { type: 'table-cell', props: { tag: 'td', text: 'Data 1' } },
        { type: 'table-cell', props: { tag: 'td', text: 'Data 2' } },
      ],
    },
  ],
  propFields: [
    { name: 'striped', label: 'Striped Rows', type: 'boolean', defaultValue: false },
    { name: 'bordered', label: 'Bordered', type: 'boolean', defaultValue: true },
    { name: 'compact', label: 'Compact Spacing', type: 'boolean', defaultValue: false },
  ],
  validateProps: (props) => {
    const errors: string[] = [];
    if (props.striped !== undefined && typeof props.striped !== 'boolean' && !isVariableBinding(props.striped)) {
      errors.push('Table "striped" must be a boolean.');
    }
    if (props.bordered !== undefined && typeof props.bordered !== 'boolean' && !isVariableBinding(props.bordered)) {
      errors.push('Table "bordered" must be a boolean.');
    }
    if (props.compact !== undefined && typeof props.compact !== 'boolean' && !isVariableBinding(props.compact)) {
      errors.push('Table "compact" must be a boolean.');
    }
    return errors.length > 0 ? errors : true;
  },
  defaultStyles: {
    base: {
      width: '100%',
      margin: '0 0 16px 0',
      borderCollapse: 'collapse',
    },
  },
};

export const tableRowDefinition: ComponentDefinition = {
  type: 'table-row',
  label: 'Table Row',
  category: 'layout',
  icon: 'table-row',
  acceptsChildren: true,
  allowedChildren: ['table-cell'],
  disallowedParents: ['page'],
  defaultProps: {},
  defaultChildren: [
    { type: 'table-cell', props: { tag: 'td', text: 'Data' } },
  ],
  defaultStyles: {
    base: {},
  },
};

export const tableCellDefinition: ComponentDefinition = {
  type: 'table-cell',
  label: 'Table Cell',
  category: 'layout',
  icon: 'table-cell',
  acceptsChildren: true,
  allowedChildren: [
    'heading',
    'text',
    'paragraph',
    'link',
    'blockquote',
    'badge',
    'code-block',
    'image',
    'button',
    'list',
    'custom',
  ],
  disallowedParents: ['page'],
  defaultProps: {
    tag: 'td',
    text: 'Cell',
    colSpan: 1,
    rowSpan: 1,
  },
  propFields: [
    {
      name: 'tag',
      label: 'Cell Type',
      type: 'select',
      defaultValue: 'td',
      options: [
        { label: 'Data Cell (td)', value: 'td' },
        { label: 'Header Cell (th)', value: 'th' },
      ],
    },
    { name: 'text', label: 'Text', type: 'string', defaultValue: 'Cell' },
    { name: 'colSpan', label: 'Column Span (colSpan)', type: 'number', defaultValue: 1 },
    { name: 'rowSpan', label: 'Row Span (rowSpan)', type: 'number', defaultValue: 1 },
  ],
  validateProps: (props) => {
    const errors: string[] = [];
    if (props.tag !== undefined && !isVariableBinding(props.tag)) {
      if (props.tag !== 'td' && props.tag !== 'th') {
        errors.push('Table Cell "tag" must be either "td" or "th".');
      }
    }
    if (props.colSpan !== undefined && !isVariableBinding(props.colSpan)) {
      if (typeof props.colSpan !== 'number' || props.colSpan < 1 || !Number.isInteger(props.colSpan)) {
        errors.push('Table Cell "colSpan" must be a positive integer (>= 1).');
      }
    }
    if (props.rowSpan !== undefined && !isVariableBinding(props.rowSpan)) {
      if (typeof props.rowSpan !== 'number' || props.rowSpan < 1 || !Number.isInteger(props.rowSpan)) {
        errors.push('Table Cell "rowSpan" must be a positive integer (>= 1).');
      }
    }
    if (props.text !== undefined && typeof props.text !== 'string' && !isVariableBinding(props.text)) {
      errors.push('Table Cell "text" must be a string when provided.');
    }
    return errors.length > 0 ? errors : true;
  },
  defaultStyles: {
    base: {
      padding: '8px 12px',
      borderWidth: '1px',
      borderColor: '#e2e8f0',
      borderStyle: 'solid',
      textAlign: 'left',
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
  paragraphDefinition,
  linkDefinition,
  blockquoteDefinition,
  badgeDefinition,
  codeBlockDefinition,
  imageDefinition,
  buttonDefinition,
  collectionDefinition,
  listDefinition,
  listItemDefinition,
  tableDefinition,
  tableRowDefinition,
  tableCellDefinition,
];

export function createDefaultComponentRegistry(): ComponentRegistry {
  const registry = new ComponentRegistry();
  for (const def of coreComponentDefinitions) {
    registry.register(def);
  }
  return registry;
}

