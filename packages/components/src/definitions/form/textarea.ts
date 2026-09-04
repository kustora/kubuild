import { isVariableBinding } from '@kubuild/schema';
import { ComponentDefinition } from '../../registry';
import {
  ariaLabelTrait,
  autoGrowTrait,
  defaultValueTrait,
  disabledTrait,
  fieldNameTrait,
  helperTextTrait,
  idTrait,
  maxCharCountTrait,
  placeholderTrait,
  readOnlyTrait,
  requiredTrait,
  resizeTrait,
  rowsTrait,
} from '../../traits';

export const textareaDefinition: ComponentDefinition = {
  type: 'textarea',
  label: 'Textarea',
  category: 'form',
  icon: 'textarea',
  acceptsChildren: false,
  disallowedParents: ['page'],
  defaultProps: {
    name: 'message',
    placeholder: 'Enter your message...',
    defaultValue: '',
    rows: 4,
    required: false,
    disabled: false,
    readOnly: false,
    resize: 'vertical',
    autoGrow: false,
    maxCharCount: undefined,
    helperText: '',
  },
  propFields: [
    { name: 'name', label: 'Field Name', type: 'string', defaultValue: 'message' },
    { name: 'placeholder', label: 'Placeholder', type: 'string', defaultValue: 'Enter your message...' },
    { name: 'defaultValue', label: 'Default Value', type: 'textarea' },
    { name: 'rows', label: 'Rows', type: 'number', defaultValue: 4 },
    { name: 'required', label: 'Required', type: 'boolean', defaultValue: false },
    { name: 'disabled', label: 'Disabled', type: 'boolean', defaultValue: false },
    { name: 'readOnly', label: 'Read Only', type: 'boolean', defaultValue: false },
    {
      name: 'resize',
      label: 'Resize',
      type: 'select',
      defaultValue: 'vertical',
      options: [
        { label: 'Vertical only', value: 'vertical' },
        { label: 'Horizontal only', value: 'horizontal' },
        { label: 'Both', value: 'both' },
        { label: 'None', value: 'none' },
      ],
    },
    { name: 'autoGrow', label: 'Auto Grow', type: 'boolean', defaultValue: false },
    { name: 'maxCharCount', label: 'Max Character Count', type: 'number' },
    { name: 'helperText', label: 'Helper Text', type: 'string' },
  ],
  traits: [
    fieldNameTrait({ defaultValue: 'message' }),
    placeholderTrait({ defaultValue: 'Enter your message...' }),
    defaultValueTrait(),
    rowsTrait(),
    resizeTrait(),
    autoGrowTrait(),
    maxCharCountTrait(),
    helperTextTrait(),
    requiredTrait(),
    disabledTrait(),
    readOnlyTrait(),
    idTrait(),
    ariaLabelTrait(),
  ],
  validateProps: (props) => {
    const errors: string[] = [];
    if (props.name !== undefined && typeof props.name !== 'string' && !isVariableBinding(props.name)) {
      errors.push('Textarea "name" must be a string when provided.');
    }
    if (props.rows !== undefined && !isVariableBinding(props.rows)) {
      if (typeof props.rows !== 'number' || props.rows < 1 || !Number.isInteger(props.rows)) {
        errors.push('Textarea "rows" must be a positive integer (>= 1).');
      }
    }
    if (props.placeholder !== undefined && typeof props.placeholder !== 'string' && !isVariableBinding(props.placeholder)) {
      errors.push('Textarea "placeholder" must be a string when provided.');
    }
    if (props.required !== undefined && typeof props.required !== 'boolean' && !isVariableBinding(props.required)) {
      errors.push('Textarea "required" must be a boolean when provided.');
    }
    if (props.disabled !== undefined && typeof props.disabled !== 'boolean' && !isVariableBinding(props.disabled)) {
      errors.push('Textarea "disabled" must be a boolean when provided.');
    }
    if (props.readOnly !== undefined && typeof props.readOnly !== 'boolean' && !isVariableBinding(props.readOnly)) {
      errors.push('Textarea "readOnly" must be a boolean when provided.');
    }
    if (props.resize !== undefined && !isVariableBinding(props.resize)) {
      const allowedResize = ['vertical', 'horizontal', 'both', 'none'];
      if (typeof props.resize !== 'string' || !allowedResize.includes(props.resize)) {
        errors.push(`Textarea "resize" must be one of: ${allowedResize.join(', ')}.`);
      }
    }
    if (props.autoGrow !== undefined && typeof props.autoGrow !== 'boolean' && !isVariableBinding(props.autoGrow)) {
      errors.push('Textarea "autoGrow" must be a boolean when provided.');
    }
    if (props.maxCharCount !== undefined && !isVariableBinding(props.maxCharCount)) {
      if (typeof props.maxCharCount !== 'number' || props.maxCharCount < 1 || !Number.isInteger(props.maxCharCount)) {
        errors.push('Textarea "maxCharCount" must be a positive integer (>= 1) when provided.');
      }
    }
    if (props.helperText !== undefined && typeof props.helperText !== 'string' && !isVariableBinding(props.helperText)) {
      errors.push('Textarea "helperText" must be a string when provided.');
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

