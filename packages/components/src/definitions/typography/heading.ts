import { isVariableBinding } from '@kubuild/schema';
import { ComponentDefinition } from '../../registry';
import { ariaLabelTrait, idTrait, titleTrait } from '../../traits';

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

