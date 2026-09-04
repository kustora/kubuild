import { isVariableBinding } from '@kubuild/schema';
import { ComponentDefinition } from '../../registry';
import {
  ariaLabelTrait,
  defaultCheckedTrait,
  disabledTrait,
  fieldNameTrait,
  helperTextTrait,
  idTrait,
  indeterminateTrait,
  labelTextTrait,
  requiredTrait,
  valueTrait,
} from '../../traits';

export const checkboxDefinition: ComponentDefinition = {
  type: 'checkbox',
  label: 'Checkbox',
  category: 'form',
  icon: 'checkbox',
  acceptsChildren: false,
  disallowedParents: ['page'],
  defaultProps: {
    name: 'checkbox_field',
    label: 'I agree to the terms and conditions',
    value: 'yes',
    defaultChecked: false,
    indeterminate: false,
    required: false,
    disabled: false,
    helperText: '',
  },
  propFields: [
    { name: 'name', label: 'Field Name', type: 'string', defaultValue: 'checkbox_field' },
    { name: 'label', label: 'Label Text', type: 'string', defaultValue: 'I agree to the terms and conditions' },
    { name: 'value', label: 'Checked Value', type: 'string', defaultValue: 'yes' },
    { name: 'defaultChecked', label: 'Default Checked', type: 'boolean', defaultValue: false },
    { name: 'indeterminate', label: 'Indeterminate', type: 'boolean', defaultValue: false },
    { name: 'required', label: 'Required', type: 'boolean', defaultValue: false },
    { name: 'disabled', label: 'Disabled', type: 'boolean', defaultValue: false },
    { name: 'helperText', label: 'Helper Text', type: 'string' },
  ],
  traits: [
    fieldNameTrait({ defaultValue: 'checkbox_field' }),
    labelTextTrait({ defaultValue: 'I agree to the terms and conditions' }),
    valueTrait({ defaultValue: 'yes' }),
    defaultCheckedTrait(),
    indeterminateTrait(),
    helperTextTrait(),
    requiredTrait(),
    disabledTrait(),
    idTrait(),
    ariaLabelTrait(),
  ],
  validateProps: (props) => {
    const errors: string[] = [];
    if (props.label !== undefined && typeof props.label !== 'string' && !isVariableBinding(props.label)) {
      errors.push('Checkbox "label" must be a string when provided.');
    }
    if (props.name !== undefined && typeof props.name !== 'string' && !isVariableBinding(props.name)) {
      errors.push('Checkbox "name" must be a string when provided.');
    }
    if (props.value !== undefined && typeof props.value !== 'string' && !isVariableBinding(props.value)) {
      errors.push('Checkbox "value" must be a string when provided.');
    }
    if (props.defaultChecked !== undefined && typeof props.defaultChecked !== 'boolean' && !isVariableBinding(props.defaultChecked)) {
      errors.push('Checkbox "defaultChecked" must be a boolean when provided.');
    }
    if (props.indeterminate !== undefined && typeof props.indeterminate !== 'boolean' && !isVariableBinding(props.indeterminate)) {
      errors.push('Checkbox "indeterminate" must be a boolean when provided.');
    }
    if (props.required !== undefined && typeof props.required !== 'boolean' && !isVariableBinding(props.required)) {
      errors.push('Checkbox "required" must be a boolean when provided.');
    }
    if (props.disabled !== undefined && typeof props.disabled !== 'boolean' && !isVariableBinding(props.disabled)) {
      errors.push('Checkbox "disabled" must be a boolean when provided.');
    }
    if (props.helperText !== undefined && typeof props.helperText !== 'string' && !isVariableBinding(props.helperText)) {
      errors.push('Checkbox "helperText" must be a string when provided.');
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
