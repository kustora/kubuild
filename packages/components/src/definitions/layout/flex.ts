import { ComponentDefinition } from '../../registry.js';
import { ariaLabelTrait, idTrait } from '../../traits/index.js';

/**
 * Flex Frame Component Definition (STORA-102)
 * Auto Layout Flexbox container supporting any child with default column direction and 16px gap.
 */
export const flexDefinition: ComponentDefinition = {
  type: 'flex',
  label: 'Flex',
  category: 'layout',
  icon: 'flex',
  acceptsChildren: true,
  allowedChildren: ['*'],
  disallowedParents: ['page'],
  defaultProps: {},
  traits: [
    idTrait(),
    ariaLabelTrait({ description: 'Accessible name for the flex container.' }),
  ],
  defaultStyles: {
    base: {
      display: 'flex',
      flexDirection: 'column',
      gap: '16px',
    },
  },
};
