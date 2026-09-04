import { isVariableBinding } from '@kubuild/schema';
import { ComponentDefinition } from '../../registry';
import { ariaLabelTrait, idTrait, titleTrait } from '../../traits';

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
