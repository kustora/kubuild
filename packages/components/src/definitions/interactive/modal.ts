import { ComponentDefinition } from '../../registry';
import { idTrait, ariaLabelTrait, titleTrait } from '../../traits';

export const modalDefinition: ComponentDefinition = {
  type: 'modal',
  label: 'Modal',
  category: 'interactive',
  icon: 'layout',
  description: 'Pop-up overlay dialog container with backdrop and close controls.',
  acceptsChildren: true,
  allowedChildren: ['*'],
  defaultProps: {
    modalId: 'modal-dialog',
    title: 'Modal Title',
    backdrop: true,
    closeOnBackdrop: true,
    closeOnEscape: true,
    size: 'md',
    showCloseButton: true,
  },
  propFields: [
    {
      name: 'modalId',
      label: 'Modal Target ID',
      type: 'string',
      defaultValue: 'modal-dialog',
      description: 'Unique identifier targeted by open_modal and close_modal actions.',
    },
    {
      name: 'title',
      label: 'Modal Title',
      type: 'string',
      defaultValue: 'Modal Title',
      description: 'Header title text displayed at the top of the dialog.',
    },
    {
      name: 'size',
      label: 'Size',
      type: 'select',
      defaultValue: 'md',
      options: [
        { label: 'Small (400px)', value: 'sm' },
        { label: 'Medium (560px)', value: 'md' },
        { label: 'Large (768px)', value: 'lg' },
        { label: 'Full Screen', value: 'fullscreen' },
      ],
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
    ariaLabelTrait({ description: 'Accessible name for the modal dialog.' }),
  ],
  defaultStyles: {
    base: {
      backgroundColor: '#ffffff',
      borderRadius: '12px',
      boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
      padding: '24px',
      maxWidth: '560px',
      width: '100%',
    },
  },
};
