import { isVariableBinding } from '@kubuild/schema';
import { ComponentDefinition } from '../../registry';
import { ariaLabelTrait, citeTrait, idTrait, titleTrait } from '../../traits';

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

