import { ComponentDefinition } from '../../registry';
import { ariaLabelTrait, idTrait } from '../../traits';

/**
 * CSS Grid Component Definition (STORA-111)
 * Visual CSS Grid container with default 3 equal columns and 16px gap.
 */
export const gridDefinition: ComponentDefinition = {
  type: 'grid',
  label: 'Grid',
  category: 'layout',
  icon: 'grid',
  acceptsChildren: true,
  allowedChildren: ['*'],
  disallowedParents: ['page'],
  defaultProps: {
    columns: 3,
    gap: '16px',
  },
  traits: [
    idTrait(),
    ariaLabelTrait({ description: 'Accessible name for the grid container.' }),
  ],
  defaultStyles: {
    base: {
      display: 'grid',
      gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
      gap: '16px',
    },
    tablet: {
      gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
      gap: '16px',
    },
    mobile: {
      gridTemplateColumns: 'repeat(1, minmax(0, 1fr))',
      gap: '16px',
    },
  },
};
