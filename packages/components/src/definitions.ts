import { isActionBinding, isAssetReference, isVariableBinding } from '@kubuild/schema';
import { ComponentDefinition, ComponentRegistry } from './registry';
import {
  idTrait,
  titleTrait,
  hrefTrait,
  targetTrait,
  relTrait,
  srcTrait,
  altTrait,
  loadingTrait,
  posterTrait,
  controlsTrait,
  autoplayTrait,
  loopTrait,
  mutedTrait,
  ariaLabelTrait,
  fieldNameTrait,
  placeholderTrait,
  requiredTrait,
  disabledTrait,
  readOnlyTrait,
  valueTrait,
  defaultValueTrait,
  defaultCheckedTrait,
  rowsTrait,
  actionTrait,
  methodTrait,
  autoCompleteTrait,
  buttonTypeTrait,
  citeTrait,
  colSpanTrait,
  rowSpanTrait,
  tagTrait,
  inputTypeTrait,
  preventDefaultTrait,
  scrollToFirstErrorTrait,
  resetOnSubmitTrait,
  patternTrait,
  minLengthTrait,
  maxLengthTrait,
  prefixIconTrait,
  suffixIconTrait,
  helperTextTrait,
} from './traits';

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
  'video',
  'icon',
  'html-embed',
  'button',
  'form',
  'input',
  'textarea',
  'select',
  'checkbox',
  'radio',
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
  traits: [
    titleTrait({ defaultValue: 'New Page', description: 'The document title shown in the browser tab and search results.' }),
    idTrait(),
  ],
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
  traits: [
    idTrait(),
    ariaLabelTrait({ description: 'Accessible name for the section landmark.' }),
  ],
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
  traits: [
    idTrait(),
  ],
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
  traits: [
    idTrait(),
  ],
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
  traits: [
    idTrait(),
    titleTrait({ description: 'Advisory title shown when hovering the heading.' }),
    ariaLabelTrait(),
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
  traits: [
    idTrait(),
    titleTrait(),
    ariaLabelTrait(),
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
  traits: [
    srcTrait(),
    altTrait({ defaultValue: 'Default image' }),
    loadingTrait(),
    idTrait(),
    titleTrait(),
    ariaLabelTrait({ description: 'Override the alt text for assistive technology (rarely needed).' }),
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
      name: 'buttonType',
      label: 'Button Type',
      type: 'select',
      defaultValue: 'button',
      options: [
        { label: 'Button', value: 'button' },
        { label: 'Submit Form (submit)', value: 'submit' },
        { label: 'Reset Form (reset)', value: 'reset' },
      ],
    },
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
  traits: [
    buttonTypeTrait(),
    disabledTrait(),
    hrefTrait({ description: 'Optional URL — when set, the button renders as an anchor styled like a button.' }),
    targetTrait({ description: 'Where to open the href URL (only used when href is set).' }),
    relTrait({ description: 'Relationship tokens (only used when href is set).' }),
    idTrait(),
    titleTrait(),
    ariaLabelTrait(),
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
    if (props.buttonType !== undefined && !isVariableBinding(props.buttonType)) {
      if (!['button', 'submit', 'reset'].includes(props.buttonType as string)) {
        errors.push('Button "buttonType" must be one of: "button", "submit", "reset".');
      }
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
  traits: [
    idTrait(),
    ariaLabelTrait({ description: 'Accessible name summarizing the repeated collection (e.g. "Product list").' }),
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
  traits: [
    idTrait(),
    ariaLabelTrait({ description: 'Accessible name for the list (e.g. "Navigation menu", "Features").' }),
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
    'video',
    'icon',
    'html-embed',
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
  traits: [
    idTrait(),
    titleTrait(),
    ariaLabelTrait(),
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
  traits: [
    idTrait(),
    titleTrait(),
    ariaLabelTrait(),
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
  traits: [
    hrefTrait(),
    targetTrait(),
    relTrait(),
    idTrait(),
    titleTrait({ description: 'Advisory title shown when hovering the link.' }),
    ariaLabelTrait(),
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
    'video',
    'icon',
    'html-embed',
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
  traits: [
    citeTrait(),
    idTrait(),
    titleTrait(),
    ariaLabelTrait(),
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
  traits: [
    idTrait(),
    titleTrait(),
    ariaLabelTrait(),
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
  traits: [
    idTrait(),
    titleTrait(),
    ariaLabelTrait({ description: 'Accessible label describing what the code example shows.' }),
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

export const videoDefinition: ComponentDefinition = {
  type: 'video',
  label: 'Video',
  category: 'media',
  icon: 'video',
  acceptsChildren: false,
  defaultProps: {
    src: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    provider: 'auto',
    poster: '',
    controls: true,
    autoplay: false,
    loop: false,
    muted: false,
    aspectRatio: '16:9',
  },
  propFields: [
    {
      name: 'src',
      label: 'Video URL (HTML5, YouTube, Vimeo)',
      type: 'string',
      defaultValue: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    },
    {
      name: 'provider',
      label: 'Provider',
      type: 'select',
      defaultValue: 'auto',
      options: [
        { label: 'Auto Detect', value: 'auto' },
        { label: 'HTML5 Video', value: 'html5' },
        { label: 'YouTube Embed', value: 'youtube' },
        { label: 'Vimeo Embed', value: 'vimeo' },
      ],
    },
    { name: 'poster', label: 'Poster Image URL', type: 'string', defaultValue: '' },
    { name: 'controls', label: 'Show Controls', type: 'boolean', defaultValue: true },
    { name: 'autoplay', label: 'Autoplay', type: 'boolean', defaultValue: false },
    { name: 'loop', label: 'Loop', type: 'boolean', defaultValue: false },
    { name: 'muted', label: 'Muted', type: 'boolean', defaultValue: false },
    {
      name: 'aspectRatio',
      label: 'Aspect Ratio',
      type: 'select',
      defaultValue: '16:9',
      options: [
        { label: '16:9 (Widescreen)', value: '16:9' },
        { label: '4:3 (Standard)', value: '4:3' },
        { label: '1:1 (Square)', value: '1:1' },
        { label: '9:16 (Vertical)', value: '9:16' },
        { label: 'Auto', value: 'auto' },
      ],
    },
  ],
  traits: [
    srcTrait(),
    posterTrait(),
    controlsTrait(),
    autoplayTrait(),
    loopTrait(),
    mutedTrait(),
    idTrait(),
    titleTrait(),
    ariaLabelTrait({ description: 'Accessible name summarizing the video content.' }),
  ],
  validateProps: (props) => {
    const errors: string[] = [];
    if (props.src !== undefined && typeof props.src !== 'string' && !isVariableBinding(props.src)) {
      errors.push('Video "src" must be a string when provided.');
    }
    if (props.provider !== undefined && !isVariableBinding(props.provider)) {
      const allowed = ['auto', 'html5', 'youtube', 'vimeo'];
      if (typeof props.provider !== 'string' || !allowed.includes(props.provider)) {
        errors.push(`Video "provider" must be one of: ${allowed.join(', ')}.`);
      }
    }
    if (props.controls !== undefined && typeof props.controls !== 'boolean' && !isVariableBinding(props.controls)) {
      errors.push('Video "controls" must be a boolean.');
    }
    if (props.autoplay !== undefined && typeof props.autoplay !== 'boolean' && !isVariableBinding(props.autoplay)) {
      errors.push('Video "autoplay" must be a boolean.');
    }
    if (props.loop !== undefined && typeof props.loop !== 'boolean' && !isVariableBinding(props.loop)) {
      errors.push('Video "loop" must be a boolean.');
    }
    if (props.muted !== undefined && typeof props.muted !== 'boolean' && !isVariableBinding(props.muted)) {
      errors.push('Video "muted" must be a boolean.');
    }
    return errors.length > 0 ? errors : true;
  },
  defaultStyles: {
    base: {
      width: '100%',
      maxWidth: '800px',
      borderRadius: '8px',
      overflow: 'hidden',
      display: 'block',
      margin: '0 0 16px 0',
    },
  },
};

export const iconDefinition: ComponentDefinition = {
  type: 'icon',
  label: 'Icon',
  category: 'media',
  icon: 'sparkles',
  acceptsChildren: false,
  defaultProps: {
    name: 'star',
    size: 24,
    color: '#2563eb',
    strokeWidth: 2,
  },
  propFields: [
    { name: 'name', label: 'Icon Name (Lucide)', type: 'string', defaultValue: 'star' },
    { name: 'size', label: 'Size (px)', type: 'number', defaultValue: 24 },
    { name: 'color', label: 'Color', type: 'color', defaultValue: '#2563eb' },
    { name: 'strokeWidth', label: 'Stroke Width', type: 'number', defaultValue: 2 },
  ],
  traits: [
    idTrait(),
    titleTrait(),
    ariaLabelTrait({ required: true, description: 'Required: describes what the icon represents for screen readers.' }),
  ],
  validateProps: (props) => {
    const errors: string[] = [];
    if (
      props.name !== undefined &&
      !isVariableBinding(props.name) &&
      (typeof props.name !== 'string' || props.name.trim().length === 0)
    ) {
      errors.push('Icon requires a non-empty "name".');
    }
    if (props.size !== undefined && !isVariableBinding(props.size)) {
      if (typeof props.size !== 'number' || props.size < 0) {
        errors.push('Icon "size" must be a non-negative number.');
      }
    }
    if (props.strokeWidth !== undefined && !isVariableBinding(props.strokeWidth)) {
      if (typeof props.strokeWidth !== 'number' || props.strokeWidth < 0) {
        errors.push('Icon "strokeWidth" must be a non-negative number.');
      }
    }
    return errors.length > 0 ? errors : true;
  },
  defaultStyles: {
    base: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
    },
  },
};

export const htmlEmbedDefinition: ComponentDefinition = {
  type: 'html-embed',
  label: 'HTML Embed',
  category: 'custom',
  icon: 'code',
  acceptsChildren: false,
  defaultProps: {
    html: '<div style="padding: 16px; background: #f1f5f9; border-radius: 8px; text-align: center; font-family: sans-serif; color: #475569;">Custom HTML Embed Content</div>',
  },
  propFields: [
    {
      name: 'html',
      label: 'HTML / Embed Code',
      type: 'textarea',
      defaultValue: '<div style="padding: 16px; background: #f1f5f9; border-radius: 8px; text-align: center; font-family: sans-serif; color: #475569;">Custom HTML Embed Content</div>',
    },
  ],
  traits: [
    idTrait(),
    ariaLabelTrait(),
  ],
  validateProps: (props) => {
    const errors: string[] = [];
    if (props.html !== undefined && typeof props.html !== 'string' && !isVariableBinding(props.html)) {
      errors.push('HTML Embed "html" must be a string.');
    }
    return errors.length > 0 ? errors : true;
  },
  defaultStyles: {
    base: {
      width: '100%',
      margin: '0 0 16px 0',
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
  traits: [
    idTrait(),
    ariaLabelTrait({ description: 'Required: provides a caption summary for the table when no visible caption exists.' }),
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
  traits: [
    idTrait(),
    ariaLabelTrait(),
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
    'video',
    'icon',
    'html-embed',
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
  traits: [
    colSpanTrait(),
    rowSpanTrait(),
    idTrait(),
    ariaLabelTrait(),
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

export const formDefinition: ComponentDefinition = {
  type: 'form',
  label: 'Form',
  category: 'form',
  icon: 'form',
  acceptsChildren: true,
  allowedChildren: [
    ...CONTENT_CHILD_TYPES,
    'container',
    'columns',
    'section',
  ],
  disallowedParents: ['page'],
  defaultProps: {
    name: 'contact_form',
    method: 'POST',
    action: '',
    target: '_self',
    autoComplete: 'on',
    preventDefault: true,
    scrollToFirstError: true,
    resetOnSubmit: false,
  },
  defaultChildren: [
    { type: 'input', props: { name: 'name', type: 'text', placeholder: 'Your Name', required: true } },
    { type: 'input', props: { name: 'email', type: 'email', placeholder: 'Your Email', required: true } },
    { type: 'textarea', props: { name: 'message', placeholder: 'Your Message', rows: 4, required: true } },
    { type: 'checkbox', props: { name: 'agree', label: 'I agree to the terms and privacy policy', required: true } },
    { type: 'button', props: { label: 'Send Message', variant: 'primary', buttonType: 'submit' } },
  ],
  propFields: [
    { name: 'name', label: 'Form Name', type: 'string', defaultValue: 'contact_form' },
    { name: 'action', label: 'Action URL', type: 'string' },
    {
      name: 'method',
      label: 'Method',
      type: 'select',
      defaultValue: 'POST',
      options: [
        { label: 'POST', value: 'POST' },
        { label: 'GET', value: 'GET' },
      ],
    },
    {
      name: 'target',
      label: 'Target',
      type: 'select',
      defaultValue: '_self',
      options: [
        { label: 'Same Window (_self)', value: '_self' },
        { label: 'New Tab (_blank)', value: '_blank' },
      ],
    },
    {
      name: 'autoComplete',
      label: 'Auto Complete',
      type: 'select',
      defaultValue: 'on',
      options: [
        { label: 'On', value: 'on' },
        { label: 'Off', value: 'off' },
      ],
    },
    { name: 'preventDefault', label: 'Prevent Default', type: 'boolean', defaultValue: true },
    { name: 'scrollToFirstError', label: 'Scroll to First Error', type: 'boolean', defaultValue: true },
    { name: 'resetOnSubmit', label: 'Reset on Submit', type: 'boolean', defaultValue: false },
  ],
  traits: [
    fieldNameTrait({ defaultValue: 'contact_form', required: false }),
    actionTrait(),
    methodTrait(),
    targetTrait({ options: [
      { label: 'Same Window (_self)', value: '_self' },
      { label: 'New Tab (_blank)', value: '_blank' },
      { label: 'Parent (_parent)', value: '_parent' },
      { label: 'Top (_top)', value: '_top' },
    ]}),
    autoCompleteTrait(),
    preventDefaultTrait(),
    scrollToFirstErrorTrait(),
    resetOnSubmitTrait(),
    idTrait(),
    ariaLabelTrait({ description: 'Accessible name for the form landmark.' }),
  ],
  validateProps: (props) => {
    const errors: string[] = [];
    if (props.name !== undefined && typeof props.name !== 'string' && !isVariableBinding(props.name)) {
      errors.push('Form "name" must be a string when provided.');
    }
    if (props.action !== undefined && typeof props.action !== 'string' && !isVariableBinding(props.action)) {
      errors.push('Form "action" must be a string when provided.');
    }
    if (props.method !== undefined && !isVariableBinding(props.method)) {
      if (!['GET', 'POST', 'get', 'post'].includes(props.method as string)) {
        errors.push('Form "method" must be either "GET" or "POST".');
      }
    }
    if (props.target !== undefined && !isVariableBinding(props.target)) {
      if (!['_self', '_blank', '_parent', '_top'].includes(props.target as string)) {
        errors.push('Form "target" must be one of: "_self", "_blank", "_parent", "_top".');
      }
    }
    if (props.autoComplete !== undefined && !isVariableBinding(props.autoComplete)) {
      if (!['on', 'off'].includes(props.autoComplete as string)) {
        errors.push('Form "autoComplete" must be either "on" or "off".');
      }
    }
    if (props.preventDefault !== undefined && typeof props.preventDefault !== 'boolean' && !isVariableBinding(props.preventDefault)) {
      errors.push('Form "preventDefault" must be a boolean when provided.');
    }
    if (props.scrollToFirstError !== undefined && typeof props.scrollToFirstError !== 'boolean' && !isVariableBinding(props.scrollToFirstError)) {
      errors.push('Form "scrollToFirstError" must be a boolean when provided.');
    }
    if (props.resetOnSubmit !== undefined && typeof props.resetOnSubmit !== 'boolean' && !isVariableBinding(props.resetOnSubmit)) {
      errors.push('Form "resetOnSubmit" must be a boolean when provided.');
    }
    return errors.length > 0 ? errors : true;
  },
  defaultStyles: {
    base: {
      width: '100%',
      display: 'flex',
      flexDirection: 'column',
      gap: '16px',
    },
  },
};

export const inputDefinition: ComponentDefinition = {
  type: 'input',
  label: 'Input',
  category: 'form',
  icon: 'input',
  acceptsChildren: false,
  disallowedParents: ['page'],
  defaultProps: {
    name: 'input_field',
    type: 'text',
    placeholder: 'Enter text...',
    defaultValue: '',
    required: false,
    disabled: false,
    readOnly: false,
    pattern: '',
    minLength: undefined,
    maxLength: undefined,
    prefixIcon: '',
    suffixIcon: '',
    helperText: '',
  },
  propFields: [
    { name: 'name', label: 'Field Name', type: 'string', defaultValue: 'input_field' },
    {
      name: 'type',
      label: 'Input Type',
      type: 'select',
      defaultValue: 'text',
      options: [
        { label: 'Text', value: 'text' },
        { label: 'Email', value: 'email' },
        { label: 'Number', value: 'number' },
        { label: 'Password', value: 'password' },
        { label: 'Phone (tel)', value: 'tel' },
        { label: 'URL', value: 'url' },
        { label: 'Search', value: 'search' },
        { label: 'Date', value: 'date' },
      ],
    },
    { name: 'placeholder', label: 'Placeholder', type: 'string', defaultValue: 'Enter text...' },
    { name: 'defaultValue', label: 'Default Value', type: 'string' },
    { name: 'required', label: 'Required', type: 'boolean', defaultValue: false },
    { name: 'disabled', label: 'Disabled', type: 'boolean', defaultValue: false },
    { name: 'readOnly', label: 'Read Only', type: 'boolean', defaultValue: false },
    { name: 'pattern', label: 'Pattern (regex)', type: 'string' },
    { name: 'minLength', label: 'Min Length', type: 'number' },
    { name: 'maxLength', label: 'Max Length', type: 'number' },
    { name: 'prefixIcon', label: 'Prefix Icon', type: 'string' },
    { name: 'suffixIcon', label: 'Suffix Icon', type: 'string' },
    { name: 'helperText', label: 'Helper Text', type: 'string' },
  ],
  traits: [
    inputTypeTrait({ options: [
      { label: 'Text', value: 'text' },
      { label: 'Email', value: 'email' },
      { label: 'Number', value: 'number' },
      { label: 'Password', value: 'password' },
      { label: 'Phone (tel)', value: 'tel' },
      { label: 'URL', value: 'url' },
      { label: 'Search', value: 'search' },
      { label: 'Date', value: 'date' },
      { label: 'Hidden', value: 'hidden' },
    ]}),
    fieldNameTrait({ defaultValue: 'input_field' }),
    placeholderTrait({ defaultValue: 'Enter text...' }),
    defaultValueTrait(),
    requiredTrait(),
    patternTrait(),
    minLengthTrait(),
    maxLengthTrait(),
    prefixIconTrait(),
    suffixIconTrait(),
    helperTextTrait(),
    disabledTrait(),
    readOnlyTrait(),
    idTrait(),
    ariaLabelTrait(),
  ],
  validateProps: (props) => {
    const errors: string[] = [];
    if (props.name !== undefined && typeof props.name !== 'string' && !isVariableBinding(props.name)) {
      errors.push('Input "name" must be a string when provided.');
    }
    if (props.type !== undefined && !isVariableBinding(props.type)) {
      const validTypes = ['text', 'email', 'number', 'password', 'tel', 'url', 'search', 'date', 'hidden'];
      if (!validTypes.includes(props.type as string)) {
        errors.push(`Input "type" must be one of: ${validTypes.join(', ')}.`);
      }
    }
    if (props.placeholder !== undefined && typeof props.placeholder !== 'string' && !isVariableBinding(props.placeholder)) {
      errors.push('Input "placeholder" must be a string when provided.');
    }
    if (props.required !== undefined && typeof props.required !== 'boolean' && !isVariableBinding(props.required)) {
      errors.push('Input "required" must be a boolean when provided.');
    }
    if (props.disabled !== undefined && typeof props.disabled !== 'boolean' && !isVariableBinding(props.disabled)) {
      errors.push('Input "disabled" must be a boolean when provided.');
    }
    if (props.readOnly !== undefined && typeof props.readOnly !== 'boolean' && !isVariableBinding(props.readOnly)) {
      errors.push('Input "readOnly" must be a boolean when provided.');
    }
    if (props.pattern !== undefined && typeof props.pattern !== 'string' && !isVariableBinding(props.pattern)) {
      errors.push('Input "pattern" must be a string when provided.');
    }
    if (props.minLength !== undefined && !isVariableBinding(props.minLength)) {
      if (typeof props.minLength !== 'number' || props.minLength < 0 || !Number.isInteger(props.minLength)) {
        errors.push('Input "minLength" must be a non-negative integer when provided.');
      }
    }
    if (props.maxLength !== undefined && !isVariableBinding(props.maxLength)) {
      if (typeof props.maxLength !== 'number' || props.maxLength < 0 || !Number.isInteger(props.maxLength)) {
        errors.push('Input "maxLength" must be a non-negative integer when provided.');
      }
    }
    if (props.prefixIcon !== undefined && typeof props.prefixIcon !== 'string' && !isVariableBinding(props.prefixIcon)) {
      errors.push('Input "prefixIcon" must be a string when provided.');
    }
    if (props.suffixIcon !== undefined && typeof props.suffixIcon !== 'string' && !isVariableBinding(props.suffixIcon)) {
      errors.push('Input "suffixIcon" must be a string when provided.');
    }
    if (props.helperText !== undefined && typeof props.helperText !== 'string' && !isVariableBinding(props.helperText)) {
      errors.push('Input "helperText" must be a string when provided.');
    }
    return errors.length > 0 ? errors : true;
  },
  defaultStyles: {
    base: {
      width: '100%',
      paddingTop: '10px',
      paddingBottom: '10px',
      paddingLeft: '14px',
      paddingRight: '14px',
      borderRadius: '6px',
      borderWidth: '1px',
      borderStyle: 'solid',
      borderColor: '#cbd5e1',
      fontSize: '14px',
      backgroundColor: '#ffffff',
      color: '#1e293b',
      boxSizing: 'border-box',
    },
  },
};

export const textareaDefinition: ComponentDefinition = {
  type: 'textarea',
  label: 'Textarea',
  category: 'form',
  icon: 'textarea',
  acceptsChildren: false,
  disallowedParents: ['page'],
  defaultProps: {
    name: 'message',
    placeholder: 'Enter your message...',
    defaultValue: '',
    rows: 4,
    required: false,
    disabled: false,
    readOnly: false,
  },
  propFields: [
    { name: 'name', label: 'Field Name', type: 'string', defaultValue: 'message' },
    { name: 'placeholder', label: 'Placeholder', type: 'string', defaultValue: 'Enter your message...' },
    { name: 'defaultValue', label: 'Default Value', type: 'textarea' },
    { name: 'rows', label: 'Rows', type: 'number', defaultValue: 4 },
    { name: 'required', label: 'Required', type: 'boolean', defaultValue: false },
    { name: 'disabled', label: 'Disabled', type: 'boolean', defaultValue: false },
    { name: 'readOnly', label: 'Read Only', type: 'boolean', defaultValue: false },
  ],
  traits: [
    fieldNameTrait({ defaultValue: 'message' }),
    placeholderTrait({ defaultValue: 'Enter your message...' }),
    defaultValueTrait(),
    rowsTrait(),
    requiredTrait(),
    disabledTrait(),
    readOnlyTrait(),
    idTrait(),
    ariaLabelTrait(),
  ],
  validateProps: (props) => {
    const errors: string[] = [];
    if (props.name !== undefined && typeof props.name !== 'string' && !isVariableBinding(props.name)) {
      errors.push('Textarea "name" must be a string when provided.');
    }
    if (props.rows !== undefined && !isVariableBinding(props.rows)) {
      if (typeof props.rows !== 'number' || props.rows < 1 || !Number.isInteger(props.rows)) {
        errors.push('Textarea "rows" must be a positive integer (>= 1).');
      }
    }
    if (props.placeholder !== undefined && typeof props.placeholder !== 'string' && !isVariableBinding(props.placeholder)) {
      errors.push('Textarea "placeholder" must be a string when provided.');
    }
    if (props.required !== undefined && typeof props.required !== 'boolean' && !isVariableBinding(props.required)) {
      errors.push('Textarea "required" must be a boolean when provided.');
    }
    if (props.disabled !== undefined && typeof props.disabled !== 'boolean' && !isVariableBinding(props.disabled)) {
      errors.push('Textarea "disabled" must be a boolean when provided.');
    }
    if (props.readOnly !== undefined && typeof props.readOnly !== 'boolean' && !isVariableBinding(props.readOnly)) {
      errors.push('Textarea "readOnly" must be a boolean when provided.');
    }
    return errors.length > 0 ? errors : true;
  },
  defaultStyles: {
    base: {
      width: '100%',
      paddingTop: '10px',
      paddingBottom: '10px',
      paddingLeft: '14px',
      paddingRight: '14px',
      borderRadius: '6px',
      borderWidth: '1px',
      borderStyle: 'solid',
      borderColor: '#cbd5e1',
      fontSize: '14px',
      backgroundColor: '#ffffff',
      color: '#1e293b',
      boxSizing: 'border-box',
    },
  },
};

export const selectDefinition: ComponentDefinition = {
  type: 'select',
  label: 'Select',
  category: 'form',
  icon: 'select',
  acceptsChildren: false,
  disallowedParents: ['page'],
  defaultProps: {
    name: 'select_field',
    placeholder: 'Select an option...',
    options: [
      { label: 'Option 1', value: 'option1' },
      { label: 'Option 2', value: 'option2' },
      { label: 'Option 3', value: 'option3' },
    ],
    defaultValue: '',
    required: false,
    disabled: false,
  },
  propFields: [
    { name: 'name', label: 'Field Name', type: 'string', defaultValue: 'select_field' },
    { name: 'placeholder', label: 'Placeholder', type: 'string', defaultValue: 'Select an option...' },
    {
      name: 'options',
      label: 'Options (JSON list)',
      type: 'json',
      defaultValue: [
        { label: 'Option 1', value: 'option1' },
        { label: 'Option 2', value: 'option2' },
        { label: 'Option 3', value: 'option3' },
      ],
    },
    { name: 'defaultValue', label: 'Default Selected Value', type: 'string' },
    { name: 'required', label: 'Required', type: 'boolean', defaultValue: false },
    { name: 'disabled', label: 'Disabled', type: 'boolean', defaultValue: false },
  ],
  traits: [
    fieldNameTrait({ defaultValue: 'select_field' }),
    placeholderTrait({ defaultValue: 'Select an option...' }),
    defaultValueTrait({ description: 'The initially selected option value (must match one of the option values).' }),
    requiredTrait(),
    disabledTrait(),
    idTrait(),
    ariaLabelTrait(),
  ],
  validateProps: (props) => {
    const errors: string[] = [];
    if (props.name !== undefined && typeof props.name !== 'string' && !isVariableBinding(props.name)) {
      errors.push('Select "name" must be a string when provided.');
    }
    if (props.options !== undefined && !isVariableBinding(props.options)) {
      if (!Array.isArray(props.options) && typeof props.options !== 'string') {
        errors.push('Select "options" must be an array of option objects or a JSON string.');
      }
    }
    if (props.required !== undefined && typeof props.required !== 'boolean' && !isVariableBinding(props.required)) {
      errors.push('Select "required" must be a boolean when provided.');
    }
    if (props.disabled !== undefined && typeof props.disabled !== 'boolean' && !isVariableBinding(props.disabled)) {
      errors.push('Select "disabled" must be a boolean when provided.');
    }
    return errors.length > 0 ? errors : true;
  },
  defaultStyles: {
    base: {
      width: '100%',
      paddingTop: '10px',
      paddingBottom: '10px',
      paddingLeft: '14px',
      paddingRight: '14px',
      borderRadius: '6px',
      borderWidth: '1px',
      borderStyle: 'solid',
      borderColor: '#cbd5e1',
      fontSize: '14px',
      backgroundColor: '#ffffff',
      color: '#1e293b',
      boxSizing: 'border-box',
    },
  },
};

export const checkboxDefinition: ComponentDefinition = {
  type: 'checkbox',
  label: 'Checkbox',
  category: 'form',
  icon: 'checkbox',
  acceptsChildren: false,
  disallowedParents: ['page'],
  defaultProps: {
    name: 'checkbox_field',
    label: 'I agree to the terms and conditions',
    value: 'yes',
    defaultChecked: false,
    required: false,
    disabled: false,
  },
  propFields: [
    { name: 'name', label: 'Field Name', type: 'string', defaultValue: 'checkbox_field' },
    { name: 'label', label: 'Label Text', type: 'string', defaultValue: 'I agree to the terms and conditions' },
    { name: 'value', label: 'Checked Value', type: 'string', defaultValue: 'yes' },
    { name: 'defaultChecked', label: 'Default Checked', type: 'boolean', defaultValue: false },
    { name: 'required', label: 'Required', type: 'boolean', defaultValue: false },
    { name: 'disabled', label: 'Disabled', type: 'boolean', defaultValue: false },
  ],
  traits: [
    fieldNameTrait({ defaultValue: 'checkbox_field' }),
    valueTrait({ defaultValue: 'yes' }),
    defaultCheckedTrait(),
    requiredTrait(),
    disabledTrait(),
    idTrait(),
    ariaLabelTrait(),
  ],
  validateProps: (props) => {
    const errors: string[] = [];
    if (props.label !== undefined && typeof props.label !== 'string' && !isVariableBinding(props.label)) {
      errors.push('Checkbox "label" must be a string when provided.');
    }
    if (props.name !== undefined && typeof props.name !== 'string' && !isVariableBinding(props.name)) {
      errors.push('Checkbox "name" must be a string when provided.');
    }
    if (props.value !== undefined && typeof props.value !== 'string' && !isVariableBinding(props.value)) {
      errors.push('Checkbox "value" must be a string when provided.');
    }
    if (props.defaultChecked !== undefined && typeof props.defaultChecked !== 'boolean' && !isVariableBinding(props.defaultChecked)) {
      errors.push('Checkbox "defaultChecked" must be a boolean when provided.');
    }
    if (props.required !== undefined && typeof props.required !== 'boolean' && !isVariableBinding(props.required)) {
      errors.push('Checkbox "required" must be a boolean when provided.');
    }
    if (props.disabled !== undefined && typeof props.disabled !== 'boolean' && !isVariableBinding(props.disabled)) {
      errors.push('Checkbox "disabled" must be a boolean when provided.');
    }
    return errors.length > 0 ? errors : true;
  },
  defaultStyles: {
    base: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '8px',
      fontSize: '14px',
      color: '#1e293b',
      cursor: 'pointer',
      userSelect: 'none',
    },
  },
};

export const radioDefinition: ComponentDefinition = {
  type: 'radio',
  label: 'Radio',
  category: 'form',
  icon: 'radio',
  acceptsChildren: false,
  disallowedParents: ['page'],
  defaultProps: {
    name: 'radio_group',
    label: 'Option 1',
    value: 'option1',
    defaultChecked: false,
    required: false,
    disabled: false,
  },
  propFields: [
    { name: 'name', label: 'Group Name', type: 'string', defaultValue: 'radio_group' },
    { name: 'label', label: 'Label Text', type: 'string', defaultValue: 'Option 1' },
    { name: 'value', label: 'Radio Value', type: 'string', defaultValue: 'option1' },
    { name: 'defaultChecked', label: 'Default Selected', type: 'boolean', defaultValue: false },
    { name: 'required', label: 'Required', type: 'boolean', defaultValue: false },
    { name: 'disabled', label: 'Disabled', type: 'boolean', defaultValue: false },
  ],
  traits: [
    fieldNameTrait({ defaultValue: 'radio_group', label: 'Group Name' }),
    valueTrait({ defaultValue: 'option1' }),
    defaultCheckedTrait(),
    requiredTrait(),
    disabledTrait(),
    idTrait(),
    ariaLabelTrait(),
  ],
  validateProps: (props) => {
    const errors: string[] = [];
    if (props.label !== undefined && typeof props.label !== 'string' && !isVariableBinding(props.label)) {
      errors.push('Radio "label" must be a string when provided.');
    }
    if (props.name !== undefined && typeof props.name !== 'string' && !isVariableBinding(props.name)) {
      errors.push('Radio "name" must be a string when provided.');
    }
    if (props.value !== undefined && typeof props.value !== 'string' && !isVariableBinding(props.value)) {
      errors.push('Radio "value" must be a string when provided.');
    }
    if (props.defaultChecked !== undefined && typeof props.defaultChecked !== 'boolean' && !isVariableBinding(props.defaultChecked)) {
      errors.push('Radio "defaultChecked" must be a boolean when provided.');
    }
    if (props.required !== undefined && typeof props.required !== 'boolean' && !isVariableBinding(props.required)) {
      errors.push('Radio "required" must be a boolean when provided.');
    }
    if (props.disabled !== undefined && typeof props.disabled !== 'boolean' && !isVariableBinding(props.disabled)) {
      errors.push('Radio "disabled" must be a boolean when provided.');
    }
    return errors.length > 0 ? errors : true;
  },
  defaultStyles: {
    base: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '8px',
      fontSize: '14px',
      color: '#1e293b',
      cursor: 'pointer',
      userSelect: 'none',
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
  videoDefinition,
  iconDefinition,
  htmlEmbedDefinition,
  buttonDefinition,
  formDefinition,
  inputDefinition,
  textareaDefinition,
  selectDefinition,
  checkboxDefinition,
  radioDefinition,
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

