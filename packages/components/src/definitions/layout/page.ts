import { ComponentDefinition } from '../../registry.js';
import { idTrait, titleTrait } from '../../traits/index.js';
import { CONTENT_CHILD_TYPES, LAYOUT_PARENTS } from '../constants.js';

export const pageDefinition: ComponentDefinition = {
  type: 'page',
  label: 'Page',
  category: 'layout',
  icon: 'layout',
  acceptsChildren: true,
  allowedChildren: ['section', 'custom'],
  disallowedParents: [...LAYOUT_PARENTS, ...CONTENT_CHILD_TYPES, 'list-item', 'table-row', 'table-cell'],
  defaultProps: { title: 'New Page' },
  traits: [
    titleTrait({ defaultValue: 'New Page', description: 'The document title shown in the browser tab and search results.' }),
    idTrait(),
  ],
  defaultStyles: { base: { minHeight: '100vh', backgroundColor: '#ffffff' } },
};

