import { ComponentDefinition } from '../../registry';
import { idTrait } from '../../traits';
import { CONTENT_CHILD_TYPES } from '../constants';

export const columnsDefinition: ComponentDefinition = {
  type: 'columns',
  label: 'Columns',
  category: 'layout',
  icon: 'columns',
  acceptsChildren: true,
  allowedChildren: ['container', 'flex', 'grid', ...CONTENT_CHILD_TYPES],
  defaultProps: { columns: 2, gap: '16px' },
  traits: [
    idTrait(),
  ],
  defaultStyles: {
    base: {
      display: 'grid',
      gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
      gap: '16px',
    },
    tablet: {
      gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
      gap: '12px',
    },
    mobile: {
      gridTemplateColumns: 'repeat(1, minmax(0, 1fr))',
      gap: '12px',
    },
  },
};

