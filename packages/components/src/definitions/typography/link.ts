import { isVariableBinding } from '@kubuild/schema';
import { ComponentDefinition } from '../../registry';
import { ariaLabelTrait, hrefTrait, idTrait, relTrait, targetTrait, titleTrait } from '../../traits';

export const linkDefinition: ComponentDefinition = {
  type: 'link',
  label: 'Link',
  category: 'typography',
  icon: 'link',
  acceptsChildren: false,
  defaultProps: {
    text: 'Click here',
    href: '#',
    target: '_self',
    rel: '',
  },
  propFields: [
    { name: 'text', label: 'Link Text', type: 'string', defaultValue: 'Click here' },
    { name: 'href', label: 'URL (href)', type: 'string', defaultValue: '#' },
    {
      name: 'target',
      label: 'Target',
      type: 'select',
      defaultValue: '_self',
      options: [
        { label: 'Same tab (_self)', value: '_self' },
        { label: 'New tab (_blank)', value: '_blank' },
        { label: 'Parent (_parent)', value: '_parent' },
        { label: 'Top (_top)', value: '_top' },
      ],
    },
    { name: 'rel', label: 'Relationship (rel)', type: 'string', defaultValue: '' },
  ],
  traits: [
    hrefTrait(),
    targetTrait(),
    relTrait(),
    idTrait(),
    titleTrait({ description: 'Advisory title shown when hovering the link.' }),
    ariaLabelTrait(),
  ],
  validateProps: (props) => {
    const errors: string[] = [];
    if (
      props.text !== undefined &&
      !isVariableBinding(props.text) &&
      (typeof props.text !== 'string' || props.text.trim().length === 0)
    ) {
      errors.push('Link requires a non-empty "text".');
    }
    if (props.href !== undefined && typeof props.href !== 'string' && !isVariableBinding(props.href)) {
      errors.push('Link "href" must be a string when provided.');
    }
    if (props.target !== undefined && !isVariableBinding(props.target)) {
      const allowedTargets = ['_self', '_blank', '_parent', '_top'];
      if (typeof props.target !== 'string' || !allowedTargets.includes(props.target)) {
        errors.push(`Link "target" must be one of: ${allowedTargets.join(', ')}.`);
      }
    }
    if (props.rel !== undefined && typeof props.rel !== 'string' && !isVariableBinding(props.rel)) {
      errors.push('Link "rel" must be a string when provided.');
    }
    return errors.length > 0 ? errors : true;
  },
  defaultStyles: {
    base: {
      color: '#2563eb',
      textDecoration: 'underline',
      cursor: 'pointer',
    },
  },
};
