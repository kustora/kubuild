import { ComponentDefinition, ComponentRegistry } from '../registry.js';
import {
  columnsDefinition,
  containerDefinition,
  flexDefinition,
  gridDefinition,
  pageDefinition,
  sectionDefinition,
} from './layout/index.js';
import {
  badgeDefinition,
  blockquoteDefinition,
  codeBlockDefinition,
  headingDefinition,
  linkDefinition,
  paragraphDefinition,
  textDefinition,
} from './typography/index.js';
import {
  htmlEmbedDefinition,
  iconDefinition,
  imageDefinition,
  videoDefinition,
} from './media/index.js';
import {
  collectionDefinition,
  listDefinition,
  listItemDefinition,
  tableCellDefinition,
  tableDefinition,
  tableRowDefinition,
} from './data/index.js';
import {
  buttonDefinition,
  buttonSubmitDefinition,
  checkboxDefinition,
  fileUploadDefinition,
  formDefinition,
  inputDefinition,
  radioDefinition,
  radioGroupDefinition,
  radioItemDefinition,
  selectDefinition,
  switchDefinition,
  textareaDefinition,
} from './form/index.js';

export * from './constants.js';
export * from './types.js';
export * from './layout/index.js';
export * from './typography/index.js';
export * from './media/index.js';
export * from './data/index.js';
export * from './form/index.js';
export * from './interactive/index.js';
export * from './conversion/index.js';

import {
  modalDefinition,
  drawerDefinition,
  collapsibleDefinition,
} from './interactive/index.js';
import {
  accordionDefinition,
  accordionItemDefinition,
  carouselDefinition,
  countdownDefinition,
  dividerDefinition,
  ratingDefinition,
  spacerDefinition,
  tabPanelDefinition,
  tabsDefinition,
} from './conversion/index.js';

export const coreComponentDefinitions: ComponentDefinition[] = [
  pageDefinition,
  sectionDefinition,
  containerDefinition,
  columnsDefinition,
  flexDefinition,
  gridDefinition,
  headingDefinition,
  textDefinition,
  paragraphDefinition,
  linkDefinition,
  blockquoteDefinition,
  badgeDefinition,
  codeBlockDefinition,
  imageDefinition,
  videoDefinition,
  iconDefinition,
  htmlEmbedDefinition,
  buttonDefinition,
  buttonSubmitDefinition,
  formDefinition,
  inputDefinition,
  textareaDefinition,
  selectDefinition,
  checkboxDefinition,
  switchDefinition,
  radioGroupDefinition,
  radioDefinition,
  radioItemDefinition,
  fileUploadDefinition,
  collectionDefinition,
  listDefinition,
  listItemDefinition,
  tableDefinition,
  tableRowDefinition,
  tableCellDefinition,
  modalDefinition,
  drawerDefinition,
  collapsibleDefinition,
  // Conversion components (Epic 60)
  countdownDefinition,
  accordionDefinition,
  accordionItemDefinition,
  tabsDefinition,
  tabPanelDefinition,
  carouselDefinition,
  ratingDefinition,
  dividerDefinition,
  spacerDefinition,
];

export function createDefaultComponentRegistry(): ComponentRegistry {
  const registry = new ComponentRegistry();
  for (const def of coreComponentDefinitions) {
    registry.register(def);
  }
  return registry;
}

