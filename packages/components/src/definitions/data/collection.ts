import { ComponentDefinition } from '../../registry';
import { ariaLabelTrait, idTrait } from '../../traits';

export const collectionDefinition: ComponentDefinition = {
  type: 'collection',
  label: 'Collection',
  category: 'data',
  icon: 'database',
  acceptsChildren: true,
  defaultProps: {
    sourceKey: 'items',
    itemAlias: 'item',
  },
  propFields: [
    { name: 'sourceKey', label: 'Source Variable', type: 'string', defaultValue: 'items' },
    { name: 'itemAlias', label: 'Item Alias', type: 'string', defaultValue: 'item' },
  ],
  traits: [
    idTrait(),
    ariaLabelTrait({ description: 'Accessible name summarizing the repeated collection (e.g. "Product list").' }),
  ],
};

