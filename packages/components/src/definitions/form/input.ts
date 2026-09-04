import { isVariableBinding } from '@kubuild/schema';
import { ComponentDefinition } from '../../registry';
import {
  ariaLabelTrait,
  defaultValueTrait,
  disabledTrait,
  fieldNameTrait,
  helperTextTrait,
  idTrait,
  inputTypeTrait,
  maxLengthTrait,
  minLengthTrait,
  patternTrait,
  placeholderTrait,
  readOnlyTrait,
  requiredTrait,
  prefixIconTrait,
  suffixIconTrait,
} from '../../traits';

export const inputDefinition: ComponentDefinition = {
  type: 'input',
  label: 'Input',
  category: 'form',
  icon: 'input',
  acceptsChildren: false,
  disallowedParents: ['page'],
  defaultProps: {
    name: 'input_field',
    type: 'text',
    placeholder: 'Enter text...',
    defaultValue: '',
    required: false,
    disabled: false,
    readOnly: false,
    pattern: '',
    minLength: undefined,
    maxLength: undefined,
    prefixIcon: '',
    suffixIcon: '',
    helperText: '',
  },
  propFields: [
    { name: 'name', label: 'Field Name', type: 'string', defaultValue: 'input_field' },
    {
      name: 'type',
      label: 'Input Type',
      type: 'select',
      defaultValue: 'text',
      options: [
        { label: 'Text', value: 'text' },
        { label: 'Email', value: 'email' },
        { label: 'Number', value: 'number' },
        { label: 'Password', value: 'password' },
        { label: 'Phone (tel)', value: 'tel' },
        { label: 'URL', value: 'url' },
        { label: 'Search', value: 'search' },
        { label: 'Date', value: 'date' },
      ],
    },
    { name: 'placeholder', label: 'Placeholder', type: 'string', defaultValue: 'Enter text...' },
    { name: 'defaultValue', label: 'Default Value', type: 'string' },
    { name: 'required', label: 'Required', type: 'boolean', defaultValue: false },
    { name: 'disabled', label: 'Disabled', type: 'boolean', defaultValue: false },
    { name: 'readOnly', label: 'Read Only', type: 'boolean', defaultValue: false },
    { name: 'pattern', label: 'Pattern (regex)', type: 'string' },
    { name: 'minLength', label: 'Min Length', type: 'number' },
    { name: 'maxLength', label: 'Max Length', type: 'number' },
    { name: 'prefixIcon', label: 'Prefix Icon', type: 'string' },
    { name: 'suffixIcon', label: 'Suffix Icon', type: 'string' },
    { name: 'helperText', label: 'Helper Text', type: 'string' },
  ],
  traits: [
    inputTypeTrait({ options: [
      { label: 'Text', value: 'text' },
      { label: 'Email', value: 'email' },
      { label: 'Number', value: 'number' },
      { label: 'Password', value: 'password' },
      { label: 'Phone (tel)', value: 'tel' },
      { label: 'URL', value: 'url' },
      { label: 'Search', value: 'search' },
      { label: 'Date', value: 'date' },
      { label: 'Hidden', value: 'hidden' },
    ]}),
    fieldNameTrait({ defaultValue: 'input_field' }),
    placeholderTrait({ defaultValue: 'Enter text...' }),
    defaultValueTrait(),
    requiredTrait(),
    patternTrait(),
    minLengthTrait(),
    maxLengthTrait(),
    prefixIconTrait(),
    suffixIconTrait(),
    helperTextTrait(),
    disabledTrait(),
    readOnlyTrait(),
    idTrait(),
    ariaLabelTrait(),
  ],
  validateProps: (props) => {
    const errors: string[] = [];
    if (props.name !== undefined && typeof props.name !== 'string' && !isVariableBinding(props.name)) {
      errors.push('Input "name" must be a string when provided.');
    }
    if (props.type !== undefined && !isVariableBinding(props.type)) {
      const validTypes = ['text', 'email', 'number', 'password', 'tel', 'url', 'search', 'date', 'hidden'];
      if (!validTypes.includes(props.type as string)) {
        errors.push(`Input "type" must be one of: ${validTypes.join(', ')}.`);
      }
    }
    if (props.placeholder !== undefined && typeof props.placeholder !== 'string' && !isVariableBinding(props.placeholder)) {
      errors.push('Input "placeholder" must be a string when provided.');
    }
    if (props.required !== undefined && typeof props.required !== 'boolean' && !isVariableBinding(props.required)) {
      errors.push('Input "required" must be a boolean when provided.');
    }
    if (props.disabled !== undefined && typeof props.disabled !== 'boolean' && !isVariableBinding(props.disabled)) {
      errors.push('Input "disabled" must be a boolean when provided.');
    }
    if (props.readOnly !== undefined && typeof props.readOnly !== 'boolean' && !isVariableBinding(props.readOnly)) {
      errors.push('Input "readOnly" must be a boolean when provided.');
    }
    if (props.pattern !== undefined && typeof props.pattern !== 'string' && !isVariableBinding(props.pattern)) {
      errors.push('Input "pattern" must be a string when provided.');
    }
    if (props.minLength !== undefined && !isVariableBinding(props.minLength)) {
      if (typeof props.minLength !== 'number' || props.minLength < 0 || !Number.isInteger(props.minLength)) {
        errors.push('Input "minLength" must be a non-negative integer when provided.');
      }
    }
    if (props.maxLength !== undefined && !isVariableBinding(props.maxLength)) {
      if (typeof props.maxLength !== 'number' || props.maxLength < 0 || !Number.isInteger(props.maxLength)) {
        errors.push('Input "maxLength" must be a non-negative integer when provided.');
      }
    }
    if (props.prefixIcon !== undefined && typeof props.prefixIcon !== 'string' && !isVariableBinding(props.prefixIcon)) {
      errors.push('Input "prefixIcon" must be a string when provided.');
    }
    if (props.suffixIcon !== undefined && typeof props.suffixIcon !== 'string' && !isVariableBinding(props.suffixIcon)) {
      errors.push('Input "suffixIcon" must be a string when provided.');
    }
    if (props.helperText !== undefined && typeof props.helperText !== 'string' && !isVariableBinding(props.helperText)) {
      errors.push('Input "helperText" must be a string when provided.');
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
