import { isActionBinding, isVariableBinding } from '@kubuild/schema';
import { ComponentDefinition } from '../../registry';
import {
  ariaLabelTrait,
  autoDisableOnSubmitTrait,
  buttonTypeTrait,
  disabledTrait,
  hrefTrait,
  idTrait,
  labelTextTrait,
  loadingTextTrait,
  prefixIconTrait,
  relTrait,
  showSpinnerTrait,
  suffixIconTrait,
  targetTrait,
  titleTrait,
} from '../../traits';

export const buttonDefinition: ComponentDefinition = {
  type: 'button',
  label: 'Button',
  category: 'interactive',
  icon: 'mouse-pointer',
  acceptsChildren: false,
  capabilities: ['actionRegistry'],
  defaultProps: {
    label: 'Click Me',
    variant: 'primary',
  },
  propFields: [
    { name: 'label', label: 'Label', type: 'string', defaultValue: 'Click Me' },
    { name: 'href', label: 'Link URL', type: 'string' },
    { name: 'action', label: 'Action', type: 'action' },
    { name: 'disabled', label: 'Disabled', type: 'boolean', defaultValue: false },
    {
      name: 'buttonType',
      label: 'Button Type',
      type: 'select',
      defaultValue: 'button',
      options: [
        { label: 'Button', value: 'button' },
        { label: 'Submit Form (submit)', value: 'submit' },
        { label: 'Reset Form (reset)', value: 'reset' },
      ],
    },
    {
      name: 'variant',
      label: 'Variant',
      type: 'select',
      defaultValue: 'primary',
      options: [
        { label: 'Primary', value: 'primary' },
        { label: 'Secondary', value: 'secondary' },
      ],
    },
  ],
  traits: [
    buttonTypeTrait(),
    disabledTrait(),
    hrefTrait({ description: 'Optional URL — when set, the button renders as an anchor styled like a button.' }),
    targetTrait({ description: 'Where to open the href URL (only used when href is set).' }),
    relTrait({ description: 'Relationship tokens (only used when href is set).' }),
    idTrait(),
    titleTrait(),
    ariaLabelTrait(),
  ],
  validateProps: (props) => {
    const errors: string[] = [];
    const hasLabel =
      (typeof props.label === 'string' && props.label.trim().length > 0) || isVariableBinding(props.label);
    if (!hasLabel) {
      errors.push('Button requires a non-empty "label".');
    }
    if (props.href !== undefined && typeof props.href !== 'string' && !isVariableBinding(props.href)) {
      errors.push('Button "href" must be a string when provided.');
    }
    if (props.buttonType !== undefined && !isVariableBinding(props.buttonType)) {
      if (!['button', 'submit', 'reset'].includes(props.buttonType as string)) {
        errors.push('Button "buttonType" must be one of: "button", "submit", "reset".');
      }
    }
    if (props.action !== undefined && !isActionBinding(props.action)) {
      errors.push('Button "action" must be a valid action binding when provided.');
    }
    if (props.disabled !== undefined && typeof props.disabled !== 'boolean' && !isVariableBinding(props.disabled)) {
      errors.push('Button "disabled" must be a boolean when provided.');
    }
    return errors.length > 0 ? errors : true;
  },
  defaultStyles: {
    base: {
      backgroundColor: '#2563eb',
      color: '#ffffff',
      paddingTop: '10px',
      paddingBottom: '10px',
      paddingLeft: '20px',
      paddingRight: '20px',
      borderRadius: '6px',
      fontWeight: '500',
      fontSize: '15px',
      border: 'none',
      cursor: 'pointer',
    },
  },
};

export const buttonSubmitDefinition: ComponentDefinition = {
  type: 'button-submit',
  label: 'Submit Button',
  category: 'form',
  icon: 'send',
  acceptsChildren: false,
  capabilities: ['actionRegistry'],
  disallowedParents: ['page'],
  defaultProps: {
    label: 'Submit',
    loadingText: 'Submitting...',
    showSpinner: true,
    autoDisableOnSubmit: true,
    variant: 'primary',
    disabled: false,
    buttonType: 'submit',
  },
  propFields: [
    { name: 'label', label: 'Label', type: 'string', defaultValue: 'Submit' },
    { name: 'loadingText', label: 'Loading Text', type: 'string', defaultValue: 'Submitting...' },
    { name: 'showSpinner', label: 'Show Loading Spinner', type: 'boolean', defaultValue: true },
    { name: 'autoDisableOnSubmit', label: 'Auto Disable on Submit', type: 'boolean', defaultValue: true },
    {
      name: 'buttonType',
      label: 'Button Type',
      type: 'select',
      defaultValue: 'submit',
      options: [
        { label: 'Submit Form (submit)', value: 'submit' },
        { label: 'Reset Form (reset)', value: 'reset' },
      ],
    },
    {
      name: 'variant',
      label: 'Variant',
      type: 'select',
      defaultValue: 'primary',
      options: [
        { label: 'Primary', value: 'primary' },
        { label: 'Secondary', value: 'secondary' },
      ],
    },
    { name: 'disabled', label: 'Disabled', type: 'boolean', defaultValue: false },
    { name: 'prefixIcon', label: 'Prefix Icon', type: 'string' },
    { name: 'suffixIcon', label: 'Suffix Icon', type: 'string' },
  ],
  traits: [
    buttonTypeTrait({
      defaultValue: 'submit',
      options: [
        { label: 'Submit Form (submit)', value: 'submit' },
        { label: 'Reset Form (reset)', value: 'reset' },
      ],
    }),
    labelTextTrait({ defaultValue: 'Submit', label: 'Label' }),
    loadingTextTrait(),
    showSpinnerTrait(),
    autoDisableOnSubmitTrait(),
    disabledTrait(),
    prefixIconTrait(),
    suffixIconTrait(),
    idTrait(),
    titleTrait(),
    ariaLabelTrait(),
  ],
  validateProps: (props) => {
    const errors: string[] = [];
    const hasLabel =
      (typeof props.label === 'string' && props.label.trim().length > 0) || isVariableBinding(props.label);
    if (!hasLabel) {
      errors.push('Submit Button requires a non-empty "label".');
    }
    if (props.loadingText !== undefined && typeof props.loadingText !== 'string' && !isVariableBinding(props.loadingText)) {
      errors.push('Submit Button "loadingText" must be a string when provided.');
    }
    if (props.showSpinner !== undefined && typeof props.showSpinner !== 'boolean' && !isVariableBinding(props.showSpinner)) {
      errors.push('Submit Button "showSpinner" must be a boolean when provided.');
    }
    if (props.autoDisableOnSubmit !== undefined && typeof props.autoDisableOnSubmit !== 'boolean' && !isVariableBinding(props.autoDisableOnSubmit)) {
      errors.push('Submit Button "autoDisableOnSubmit" must be a boolean when provided.');
    }
    if (props.buttonType !== undefined && !isVariableBinding(props.buttonType)) {
      if (!['submit', 'reset', 'button'].includes(props.buttonType as string)) {
        errors.push('Submit Button "buttonType" must be one of: "submit", "reset", "button".');
      }
    }
    if (props.disabled !== undefined && typeof props.disabled !== 'boolean' && !isVariableBinding(props.disabled)) {
      errors.push('Submit Button "disabled" must be a boolean when provided.');
    }
    return errors.length > 0 ? errors : true;
  },
  defaultStyles: {
    base: {
      backgroundColor: '#2563eb',
      color: '#ffffff',
      paddingTop: '10px',
      paddingBottom: '10px',
      paddingLeft: '20px',
      paddingRight: '20px',
      borderRadius: '6px',
      fontWeight: '500',
      fontSize: '15px',
      border: 'none',
      cursor: 'pointer',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '8px',
    },
  },
};
