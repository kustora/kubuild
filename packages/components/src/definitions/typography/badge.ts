import { isVariableBinding } from '@kubuild/schema';
import { ComponentDefinition } from '../../registry';
import { ariaLabelTrait, idTrait, titleTrait } from '../../traits';

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

