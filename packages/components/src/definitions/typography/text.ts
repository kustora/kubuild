import { isVariableBinding } from '@kubuild/schema';
import { ComponentDefinition } from '../../registry';
import { ariaLabelTrait, idTrait, titleTrait } from '../../traits';

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
      lineHeight: '1.6'
    },
  },
};
