import { ComponentDefinition } from '../../registry';
import { idTrait, ariaLabelTrait } from '../../traits';

export const collapsibleDefinition: ComponentDefinition = {
  type: 'collapsible',
  label: 'Collapsible',
  category: 'interactive',
  icon: 'chevron-down',
  description: 'In-flow expandable container that toggles visibility without a fullscreen overlay.',
  acceptsChildren: true,
  allowedChildren: ['*'],
  defaultProps: {
    modalId: 'collapsible-content',
    defaultOpen: false,
    animated: true,
  },
  propFields: [
    {
      name: 'modalId',
      label: 'Target ID',
      type: 'string',
      defaultValue: 'collapsible-content',
      description: 'Identifier targeted by Open Modal (with "Toggle" enabled) or Close Modal actions.',
    },
    {
      name: 'defaultOpen',
      label: 'Default Open',
      type: 'boolean',
      defaultValue: false,
      description: 'Whether the collapsible container starts expanded on initial render.',
    },
    {
      name: 'animated',
      label: 'Smooth Transition',
      type: 'boolean',
      defaultValue: true,
    },
  ],
  traits: [
    idTrait(),
    ariaLabelTrait({ description: 'Accessible name for the collapsible container.' }),
  ],
  defaultStyles: {
    base: {
      width: '100%',
      overflow: 'hidden',
    },
  },
};
