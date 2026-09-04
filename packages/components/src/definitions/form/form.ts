import { isVariableBinding } from '@kubuild/schema';
import { ComponentDefinition } from '../../registry';
import {
  actionTrait,
  ariaLabelTrait,
  autoCompleteTrait,
  fieldNameTrait,
  idTrait,
  methodTrait,
  preventDefaultTrait,
  resetOnSubmitTrait,
  scrollToFirstErrorTrait,
  targetTrait,
} from '../../traits';
import { CONTENT_CHILD_TYPES } from '../constants';

export const formDefinition: ComponentDefinition = {
  type: 'form',
  label: 'Form',
  category: 'form',
  icon: 'form',
  acceptsChildren: true,
  allowedChildren: [
    ...CONTENT_CHILD_TYPES,
    'container',
    'columns',
    'section',
  ],
  disallowedParents: ['page'],
  defaultProps: {
    name: 'contact_form',
    method: 'POST',
    action: '',
    target: '_self',
    autoComplete: 'on',
    preventDefault: true,
    scrollToFirstError: true,
    resetOnSubmit: false,
  },
  defaultChildren: [
    { type: 'input', props: { name: 'name', type: 'text', placeholder: 'Your Name', required: true } },
    { type: 'input', props: { name: 'email', type: 'email', placeholder: 'Your Email', required: true } },
    { type: 'textarea', props: { name: 'message', placeholder: 'Your Message', rows: 4, required: true } },
    { type: 'checkbox', props: { name: 'agree', label: 'I agree to the terms and privacy policy', required: true } },
    { type: 'button', props: { label: 'Send Message', variant: 'primary', buttonType: 'submit' } },
  ],
  propFields: [
    { name: 'name', label: 'Form Name', type: 'string', defaultValue: 'contact_form' },
    { name: 'action', label: 'Action URL', type: 'string' },
    {
      name: 'method',
      label: 'Method',
      type: 'select',
      defaultValue: 'POST',
      options: [
        { label: 'POST', value: 'POST' },
        { label: 'GET', value: 'GET' },
      ],
    },
    {
      name: 'target',
      label: 'Target',
      type: 'select',
      defaultValue: '_self',
      options: [
        { label: 'Same Window (_self)', value: '_self' },
        { label: 'New Tab (_blank)', value: '_blank' },
      ],
    },
    {
      name: 'autoComplete',
      label: 'Auto Complete',
      type: 'select',
      defaultValue: 'on',
      options: [
        { label: 'On', value: 'on' },
        { label: 'Off', value: 'off' },
      ],
    },
    { name: 'preventDefault', label: 'Prevent Default', type: 'boolean', defaultValue: true },
    { name: 'scrollToFirstError', label: 'Scroll to First Error', type: 'boolean', defaultValue: true },
    { name: 'resetOnSubmit', label: 'Reset on Submit', type: 'boolean', defaultValue: false },
  ],
  traits: [
    fieldNameTrait({ defaultValue: 'contact_form', required: false }),
    actionTrait(),
    methodTrait(),
    targetTrait({ options: [
      { label: 'Same Window (_self)', value: '_self' },
      { label: 'New Tab (_blank)', value: '_blank' },
      { label: 'Parent (_parent)', value: '_parent' },
      { label: 'Top (_top)', value: '_top' },
    ]}),
    autoCompleteTrait(),
    preventDefaultTrait(),
    scrollToFirstErrorTrait(),
    resetOnSubmitTrait(),
    idTrait(),
    ariaLabelTrait({ description: 'Accessible name for the form landmark.' }),
  ],
  validateProps: (props) => {
    const errors: string[] = [];
    if (props.name !== undefined && typeof props.name !== 'string' && !isVariableBinding(props.name)) {
      errors.push('Form "name" must be a string when provided.');
    }
    if (props.action !== undefined && typeof props.action !== 'string' && !isVariableBinding(props.action)) {
      errors.push('Form "action" must be a string when provided.');
    }
    if (props.method !== undefined && !isVariableBinding(props.method)) {
      if (!['GET', 'POST', 'get', 'post'].includes(props.method as string)) {
        errors.push('Form "method" must be either "GET" or "POST".');
      }
    }
    if (props.target !== undefined && !isVariableBinding(props.target)) {
      if (!['_self', '_blank', '_parent', '_top'].includes(props.target as string)) {
        errors.push('Form "target" must be one of: "_self", "_blank", "_parent", "_top".');
      }
    }
    if (props.autoComplete !== undefined && !isVariableBinding(props.autoComplete)) {
      if (!['on', 'off'].includes(props.autoComplete as string)) {
        errors.push('Form "autoComplete" must be either "on" or "off".');
      }
    }
    if (props.preventDefault !== undefined && typeof props.preventDefault !== 'boolean' && !isVariableBinding(props.preventDefault)) {
      errors.push('Form "preventDefault" must be a boolean when provided.');
    }
    if (props.scrollToFirstError !== undefined && typeof props.scrollToFirstError !== 'boolean' && !isVariableBinding(props.scrollToFirstError)) {
      errors.push('Form "scrollToFirstError" must be a boolean when provided.');
    }
    if (props.resetOnSubmit !== undefined && typeof props.resetOnSubmit !== 'boolean' && !isVariableBinding(props.resetOnSubmit)) {
      errors.push('Form "resetOnSubmit" must be a boolean when provided.');
    }
    return errors.length > 0 ? errors : true;
  },
  defaultStyles: {
    base: {
      width: '100%',
      display: 'flex',
      flexDirection: 'column',
      gap: '16px',
    },
  },
};

