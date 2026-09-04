import { isVariableBinding } from '@kubuild/schema';
import { ComponentDefinition } from '../../registry';
import { ariaLabelTrait, idTrait, titleTrait } from '../../traits';

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
