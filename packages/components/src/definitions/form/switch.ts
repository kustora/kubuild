import { isVariableBinding } from '@kubuild/schema';
import { ComponentDefinition } from '../../registry';
import {
  ariaLabelTrait,
  defaultCheckedTrait,
  disabledTrait,
  fieldNameTrait,
  helperTextTrait,
  idTrait,
  labelTextTrait,
  requiredTrait,
  switchSizeTrait,
  valueTrait,
} from '../../traits';

export const switchDefinition: ComponentDefinition = {
  type: 'switch',
  label: 'Switch',
  category: 'form',
  icon: 'switch',
  acceptsChildren: false,
  disallowedParents: ['page'],
  defaultProps: {
    name: 'switch_field',
    label: 'Enable feature',
    value: 'yes',
    defaultChecked: false,
    switchSize: 'md',
    required: false,
    disabled: false,
    helperText: '',
  },
  propFields: [
    { name: 'name', label: 'Field Name', type: 'string', defaultValue: 'switch_field' },
    { name: 'label', label: 'Label Text', type: 'string', defaultValue: 'Enable feature' },
    { name: 'value', label: 'Checked Value', type: 'string', defaultValue: 'yes' },
    { name: 'defaultChecked', label: 'Default Checked', type: 'boolean', defaultValue: false },
    {
      name: 'switchSize',
      label: 'Size',
      type: 'select',
      defaultValue: 'md',
      options: [
        { label: 'Small', value: 'sm' },
        { label: 'Medium', value: 'md' },
        { label: 'Large', value: 'lg' },
      ],
    },
    { name: 'required', label: 'Required', type: 'boolean', defaultValue: false },
    { name: 'disabled', label: 'Disabled', type: 'boolean', defaultValue: false },
    { name: 'helperText', label: 'Helper Text', type: 'string' },
  ],
  traits: [
    fieldNameTrait({ defaultValue: 'switch_field' }),
    labelTextTrait({ defaultValue: 'Enable feature' }),
    valueTrait({ defaultValue: 'yes' }),
    defaultCheckedTrait(),
    switchSizeTrait(),
    helperTextTrait(),
    requiredTrait(),
    disabledTrait(),
    idTrait(),
    ariaLabelTrait(),
  ],
  validateProps: (props) => {
    const errors: string[] = [];
    if (props.label !== undefined && typeof props.label !== 'string' && !isVariableBinding(props.label)) {
      errors.push('Switch "label" must be a string when provided.');
    }
    if (props.name !== undefined && typeof props.name !== 'string' && !isVariableBinding(props.name)) {
      errors.push('Switch "name" must be a string when provided.');
    }
    if (props.value !== undefined && typeof props.value !== 'string' && !isVariableBinding(props.value)) {
      errors.push('Switch "value" must be a string when provided.');
    }
    if (props.defaultChecked !== undefined && typeof props.defaultChecked !== 'boolean' && !isVariableBinding(props.defaultChecked)) {
      errors.push('Switch "defaultChecked" must be a boolean when provided.');
    }
    if (props.switchSize !== undefined && !isVariableBinding(props.switchSize)) {
      const allowedSizes = ['sm', 'md', 'lg'];
      if (typeof props.switchSize !== 'string' || !allowedSizes.includes(props.switchSize)) {
        errors.push(`Switch "switchSize" must be one of: ${allowedSizes.join(', ')}.`);
      }
    }
    if (props.required !== undefined && typeof props.required !== 'boolean' && !isVariableBinding(props.required)) {
      errors.push('Switch "required" must be a boolean when provided.');
    }
    if (props.disabled !== undefined && typeof props.disabled !== 'boolean' && !isVariableBinding(props.disabled)) {
      errors.push('Switch "disabled" must be a boolean when provided.');
    }
    if (props.helperText !== undefined && typeof props.helperText !== 'string' && !isVariableBinding(props.helperText)) {
      errors.push('Switch "helperText" must be a string when provided.');
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

