import { isVariableBinding } from '@kubuild/schema';
import { ComponentDefinition } from '../../registry';
import { canonicalTextPropFields } from '../../canonical-props';
import { ariaLabelTrait, idTrait, titleTrait } from '../../traits';

export const textDefinition: ComponentDefinition = {
  type: 'text',
  label: 'Text',
  category: 'typography',
  icon: 'type',
  acceptsChildren: false,
  ...canonicalTextPropFields('text'),
  // `as: 'p'` keeps the block-level rendering the old `content` default produced (STORA-550).
  defaultProps: { text: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.', as: 'p' },
  propFields: [
    { name: 'text', label: 'Content', type: 'string', defaultValue: 'Lorem ipsum dolor sit amet.' },
  ],
  traits: [
    idTrait(),
    titleTrait(),
    ariaLabelTrait(),
  ],
  validateProps: (props) => {
    // `content` is a deprecated alias of `text`, still accepted until documents are migrated.
    const value = props.text ?? props.content;
    if (!isVariableBinding(value) && (typeof value !== 'string' || value.trim().length === 0)) {
      return ['Text requires a non-empty "text".'];
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

