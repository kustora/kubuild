import { ComponentDefinition } from '../../registry';
import { ariaLabelTrait, idTrait } from '../../traits';
import { CONTENT_CHILD_TYPES } from '../constants';

export const sectionDefinition: ComponentDefinition = {
  type: 'section',
  label: 'Section',
  category: 'layout',
  icon: 'rows',
  acceptsChildren: true,
  allowedChildren: ['container', 'columns', 'flex', 'grid', ...CONTENT_CHILD_TYPES],
  defaultProps: {},
  traits: [
    idTrait(),
    ariaLabelTrait({ description: 'Accessible name for the section landmark.' }),
  ],
  defaultStyles: {
    base: {
      paddingTop: '48px',
      paddingBottom: '48px',
      paddingLeft: '16px',
      paddingRight: '16px',
    },
    tablet: {
      paddingTop: '32px',
      paddingBottom: '32px',
    },
    mobile: {
      paddingTop: '24px',
      paddingBottom: '24px',
      paddingLeft: '16px',
      paddingRight: '16px',
    },
  },
};

