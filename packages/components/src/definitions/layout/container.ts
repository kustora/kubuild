import { ComponentDefinition } from '../../registry';
import { idTrait } from '../../traits';
import { CONTENT_CHILD_TYPES } from '../constants';

export const containerDefinition: ComponentDefinition = {
  type: 'container',
  label: 'Container',
  category: 'layout',
  icon: 'box',
  acceptsChildren: true,
  allowedChildren: ['columns', ...CONTENT_CHILD_TYPES],
  defaultProps: { maxWidth: '1200px' },
  traits: [
    idTrait(),
  ],
  defaultStyles: {
    base: {
      maxWidth: '1200px',
      margin: '0 auto',
      width: '100%',
    },
    tablet: {
      maxWidth: '720px',
    },
    mobile: {
      maxWidth: '100%',
      paddingLeft: '16px',
      paddingRight: '16px',
    },
  },
};

