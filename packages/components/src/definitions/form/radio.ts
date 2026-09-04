import { isVariableBinding } from '@kubuild/schema';
import { ComponentDefinition } from '../../registry';
import {
  ariaLabelTrait,
  defaultCheckedTrait,
  defaultSelectedTrait,
  disabledTrait,
  fieldNameTrait,
  helperTextTrait,
  idTrait,
  labelTextTrait,
  orientationTrait,
  requiredTrait,
  valueTrait,
} from '../../traits';

export const radioGroupDefinition: ComponentDefinition = {
  type: 'radio-group',
  label: 'Radio Group',
  category: 'form',
  icon: 'radio-group',
  acceptsChildren: true,
  allowedChildren: ['radio', 'radio-item', 'custom'],
  disallowedParents: ['page'],
  defaultProps: {
    name: 'radio_group',
    defaultSelected: 'option1',
    orientation: 'vertical',
    required: false,
    disabled: false,
    helperText: '',
  },
  defaultChildren: [
    { type: 'radio', props: { name: 'radio_group', label: 'Option 1', value: 'option1', defaultChecked: true } },
    { type: 'radio', props: { name: 'radio_group', label: 'Option 2', value: 'option2', defaultChecked: false } },
    { type: 'radio', props: { name: 'radio_group', label: 'Option 3', value: 'option3', defaultChecked: false } },
  ],
  propFields: [
    { name: 'name', label: 'Group Name', type: 'string', defaultValue: 'radio_group' },
    { name: 'defaultSelected', label: 'Default Selected', type: 'string', defaultValue: 'option1' },
    {
      name: 'orientation',
      label: 'Orientation',
      type: 'select',
      defaultValue: 'vertical',
      options: [
        { label: 'Vertical', value: 'vertical' },
        { label: 'Horizontal', value: 'horizontal' },
      ],
    },
    { name: 'required', label: 'Required', type: 'boolean', defaultValue: false },
    { name: 'disabled', label: 'Disabled', type: 'boolean', defaultValue: false },
    { name: 'helperText', label: 'Helper Text', type: 'string' },
  ],
  traits: [
    fieldNameTrait({ defaultValue: 'radio_group', label: 'Group Name' }),
    defaultSelectedTrait({ defaultValue: 'option1' }),
    orientationTrait(),
    helperTextTrait(),
    requiredTrait(),
    disabledTrait(),
    idTrait(),
    ariaLabelTrait(),
  ],
  validateProps: (props) => {
    const errors: string[] = [];
    if (props.name !== undefined && typeof props.name !== 'string' && !isVariableBinding(props.name)) {
      errors.push('RadioGroup "name" must be a string when provided.');
    }
    if (props.defaultSelected !== undefined && typeof props.defaultSelected !== 'string' && !isVariableBinding(props.defaultSelected)) {
      errors.push('RadioGroup "defaultSelected" must be a string when provided.');
    }
    if (props.orientation !== undefined && !isVariableBinding(props.orientation)) {
      const allowedOrientations = ['vertical', 'horizontal'];
      if (typeof props.orientation !== 'string' || !allowedOrientations.includes(props.orientation)) {
        errors.push(`RadioGroup "orientation" must be one of: ${allowedOrientations.join(', ')}.`);
      }
    }
    if (props.required !== undefined && typeof props.required !== 'boolean' && !isVariableBinding(props.required)) {
      errors.push('RadioGroup "required" must be a boolean when provided.');
    }
    if (props.disabled !== undefined && typeof props.disabled !== 'boolean' && !isVariableBinding(props.disabled)) {
      errors.push('RadioGroup "disabled" must be a boolean when provided.');
    }
    if (props.helperText !== undefined && typeof props.helperText !== 'string' && !isVariableBinding(props.helperText)) {
      errors.push('RadioGroup "helperText" must be a string when provided.');
    }
    return errors.length > 0 ? errors : true;
  },
  defaultStyles: {
    base: {
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
    },
  },
};

export const radioDefinition: ComponentDefinition = {
  type: 'radio',
  label: 'Radio',
  category: 'form',
  icon: 'radio',
  acceptsChildren: false,
  disallowedParents: ['page'],
  defaultProps: {
    name: 'radio_group',
    label: 'Option 1',
    value: 'option1',
    defaultChecked: false,
    required: false,
    disabled: false,
    helperText: '',
  },
  propFields: [
    { name: 'name', label: 'Group Name', type: 'string', defaultValue: 'radio_group' },
    { name: 'label', label: 'Label Text', type: 'string', defaultValue: 'Option 1' },
    { name: 'value', label: 'Radio Value', type: 'string', defaultValue: 'option1' },
    { name: 'defaultChecked', label: 'Default Selected', type: 'boolean', defaultValue: false },
    { name: 'required', label: 'Required', type: 'boolean', defaultValue: false },
    { name: 'disabled', label: 'Disabled', type: 'boolean', defaultValue: false },
    { name: 'helperText', label: 'Helper Text', type: 'string' },
  ],
  traits: [
    fieldNameTrait({ defaultValue: 'radio_group', label: 'Group Name' }),
    labelTextTrait({ defaultValue: 'Option 1' }),
    valueTrait({ defaultValue: 'option1' }),
    defaultCheckedTrait(),
    helperTextTrait(),
    requiredTrait(),
    disabledTrait(),
    idTrait(),
    ariaLabelTrait(),
  ],
  validateProps: (props) => {
    const errors: string[] = [];
    if (props.label !== undefined && typeof props.label !== 'string' && !isVariableBinding(props.label)) {
      errors.push('Radio "label" must be a string when provided.');
    }
    if (props.name !== undefined && typeof props.name !== 'string' && !isVariableBinding(props.name)) {
      errors.push('Radio "name" must be a string when provided.');
    }
    if (props.value !== undefined && typeof props.value !== 'string' && !isVariableBinding(props.value)) {
      errors.push('Radio "value" must be a string when provided.');
    }
    if (props.defaultChecked !== undefined && typeof props.defaultChecked !== 'boolean' && !isVariableBinding(props.defaultChecked)) {
      errors.push('Radio "defaultChecked" must be a boolean when provided.');
    }
    if (props.required !== undefined && typeof props.required !== 'boolean' && !isVariableBinding(props.required)) {
      errors.push('Radio "required" must be a boolean when provided.');
    }
    if (props.disabled !== undefined && typeof props.disabled !== 'boolean' && !isVariableBinding(props.disabled)) {
      errors.push('Radio "disabled" must be a boolean when provided.');
    }
    if (props.helperText !== undefined && typeof props.helperText !== 'string' && !isVariableBinding(props.helperText)) {
      errors.push('Radio "helperText" must be a string when provided.');
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

export const radioItemDefinition: ComponentDefinition = {
  ...radioDefinition,
  type: 'radio-item',
  label: 'Radio Item',
};
