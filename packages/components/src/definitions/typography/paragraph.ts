import { isVariableBinding } from '@kubuild/schema';
import { ComponentDefinition } from '../../registry';
import { ariaLabelTrait, idTrait, titleTrait } from '../../traits';

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

