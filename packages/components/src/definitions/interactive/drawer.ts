import { ComponentDefinition } from '../../registry';
import { idTrait, ariaLabelTrait, titleTrait } from '../../traits';

export const drawerDefinition: ComponentDefinition = {
  type: 'drawer',
  label: 'Drawer',
  category: 'interactive',
  icon: 'sidebar',
  description: 'Off-canvas slide-over panel container, ideal for mobile navigation and side sheets.',
  acceptsChildren: true,
  allowedChildren: ['*'],
  defaultProps: {
    modalId: 'mobile-drawer',
    title: 'Navigation Menu',
    placement: 'right',
    backdrop: true,
    closeOnBackdrop: true,
    closeOnEscape: true,
    showCloseButton: true,
  },
  propFields: [
    {
      name: 'modalId',
      label: 'Drawer Target ID',
      type: 'string',
      defaultValue: 'mobile-drawer',
      description: 'Unique identifier targeted by open_modal and close_modal actions.',
    },
    {
      name: 'placement',
      label: 'Placement',
      type: 'select',
      defaultValue: 'right',
      options: [
        { label: 'Slide from Right', value: 'right' },
        { label: 'Slide from Left', value: 'left' },
        { label: 'Slide from Top (Dropdown)', value: 'top' },
        { label: 'Slide from Bottom', value: 'bottom' },
      ],
    },
    {
      name: 'title',
      label: 'Drawer Title',
      type: 'string',
      defaultValue: 'Navigation Menu',
      description: 'Header title text displayed at the top of the drawer.',
    },
    {
      name: 'backdrop',
      label: 'Show Backdrop',
      type: 'boolean',
      defaultValue: true,
    },
    {
      name: 'closeOnBackdrop',
      label: 'Close on Backdrop Click',
      type: 'boolean',
      defaultValue: true,
    },
    {
      name: 'closeOnEscape',
      label: 'Close on Escape Key',
      type: 'boolean',
      defaultValue: true,
    },
    {
      name: 'showCloseButton',
      label: 'Show Close Button',
      type: 'boolean',
      defaultValue: true,
    },
  ],
  traits: [
    idTrait(),
    titleTrait(),
    ariaLabelTrait({ description: 'Accessible name for the off-canvas drawer.' }),
  ],
  defaultStyles: {
    base: {
      backgroundColor: '#ffffff',
      boxShadow: '-4px 0 24px rgba(0, 0, 0, 0.15)',
      padding: '24px',
      width: '320px',
      maxWidth: '100%',
    },
    mobile: {
      width: '100%',
    },
  },
};
