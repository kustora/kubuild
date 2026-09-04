import { isVariableBinding } from '@kubuild/schema';
import { ComponentDefinition } from '../../registry';
import {
  ariaLabelTrait,
  defaultValueTrait,
  disabledTrait,
  fieldNameTrait,
  helperTextTrait,
  idTrait,
  optionsListTrait,
  placeholderTrait,
  requiredTrait,
} from '../../traits';

export const selectDefinition: ComponentDefinition = {
  type: 'select',
  label: 'Select',
  category: 'form',
  icon: 'select',
  acceptsChildren: false,
  disallowedParents: ['page'],
  defaultProps: {
    name: 'select_field',
    placeholder: 'Select an option...',
    options: [
      { label: 'Option 1', value: 'option1' },
      { label: 'Option 2', value: 'option2' },
      { label: 'Option 3', value: 'option3' },
    ],
    defaultValue: '',
    required: false,
    disabled: false,
    helperText: '',
  },
  propFields: [
    { name: 'name', label: 'Field Name', type: 'string', defaultValue: 'select_field' },
    { name: 'placeholder', label: 'Placeholder', type: 'string', defaultValue: 'Select an option...' },
    {
      name: 'options',
      label: 'Options (JSON list)',
      type: 'json',
      defaultValue: [
        { label: 'Option 1', value: 'option1' },
        { label: 'Option 2', value: 'option2' },
        { label: 'Option 3', value: 'option3' },
      ],
    },
    { name: 'defaultValue', label: 'Default Selected Value', type: 'string' },
    { name: 'required', label: 'Required', type: 'boolean', defaultValue: false },
    { name: 'disabled', label: 'Disabled', type: 'boolean', defaultValue: false },
    { name: 'helperText', label: 'Helper Text', type: 'string' },
  ],
  traits: [
    fieldNameTrait({ defaultValue: 'select_field' }),
    placeholderTrait({ defaultValue: 'Select an option...' }),
    optionsListTrait({ description: 'The list of dropdown choices (label + value pairs). Editable via the inspector trait panel.' }),
    defaultValueTrait({ description: 'The initially selected option value (must match one of the option values).' }),
    helperTextTrait(),
    requiredTrait(),
    disabledTrait(),
    idTrait(),
    ariaLabelTrait(),
  ],
  validateProps: (props) => {
    const errors: string[] = [];
    if (props.name !== undefined && typeof props.name !== 'string' && !isVariableBinding(props.name)) {
      errors.push('Select "name" must be a string when provided.');
    }
    if (props.options !== undefined && !isVariableBinding(props.options)) {
      if (!Array.isArray(props.options) && typeof props.options !== 'string') {
        errors.push('Select "options" must be an array of option objects or a JSON string.');
      }
    }
    if (props.required !== undefined && typeof props.required !== 'boolean' && !isVariableBinding(props.required)) {
      errors.push('Select "required" must be a boolean when provided.');
    }
    if (props.disabled !== undefined && typeof props.disabled !== 'boolean' && !isVariableBinding(props.disabled)) {
      errors.push('Select "disabled" must be a boolean when provided.');
    }
    if (props.helperText !== undefined && typeof props.helperText !== 'string' && !isVariableBinding(props.helperText)) {
      errors.push('Select "helperText" must be a string when provided.');
    }
    return errors.length > 0 ? errors : true;
  },
  defaultStyles: {
    base: {
      width: '100%',
      paddingTop: '10px',
      paddingBottom: '10px',
      paddingLeft: '14px',
      paddingRight: '14px',
      borderRadius: '6px',
      borderWidth: '1px',
      borderStyle: 'solid',
      borderColor: '#cbd5e1',
      fontSize: '14px',
      backgroundColor: '#ffffff',
      color: '#1e293b',
      boxSizing: 'border-box',
    },
  },
};
