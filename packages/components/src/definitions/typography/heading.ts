import { isVariableBinding } from '@kubuild/schema';
import { ComponentDefinition } from '../../registry';
import { canonicalTextPropFields } from '../../canonical-props';
import { ariaLabelTrait, idTrait, titleTrait } from '../../traits';

export const headingDefinition: ComponentDefinition = {
  type: 'heading',
  label: 'Heading',
  category: 'typography',
  icon: 'heading',
  acceptsChildren: false,
  ...canonicalTextPropFields('heading'),
  defaultProps: { text: 'Heading Text', level: 2 },
  propFields: [
    { name: 'text', label: 'Text', type: 'string', defaultValue: 'Heading Text' },
    {
      name: 'level',
      label: 'Title Size',
      type: 'select',
      defaultValue: 2,
      options: [
        { label: 'H1 - Main Title (Extra Large)', value: 1 },
        { label: 'H2 - Subtitle (Large)', value: 2 },
        { label: 'H3 - Section Title (Medium)', value: 3 },
        { label: 'H4 - Subsection Title (Small)', value: 4 },
        { label: 'H5 - Small Title (Extra Small)', value: 5 },
        { label: 'H6 - Micro Title (Smallest)', value: 6 },
      ],
    },
  ],
  traits: [
    idTrait(),
    titleTrait({ description: 'Advisory title shown when hovering the heading.' }),
    ariaLabelTrait(),
  ],
  validateProps: (props) => {
    const errors: string[] = [];
    const text = props.text ?? props.content; // `content` is a deprecated alias (STORA-550)
    if (!isVariableBinding(text) && (typeof text !== 'string' || text.trim().length === 0)) {
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

