import { ComponentDefinition, ComponentRegistry } from '../registry';
import {
  columnsDefinition,
  containerDefinition,
  pageDefinition,
  sectionDefinition,
} from './layout';
import {
  badgeDefinition,
  blockquoteDefinition,
  codeBlockDefinition,
  headingDefinition,
  linkDefinition,
  paragraphDefinition,
  textDefinition,
} from './typography';
import {
  htmlEmbedDefinition,
  iconDefinition,
  imageDefinition,
  videoDefinition,
} from './media';
import {
  collectionDefinition,
  listDefinition,
  listItemDefinition,
  tableCellDefinition,
  tableDefinition,
  tableRowDefinition,
} from './data';
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
} from './form';

export * from './constants';
export * from './types';
export * from './layout';
export * from './typography';
export * from './media';
export * from './data';
export * from './form';

export const coreComponentDefinitions: ComponentDefinition[] = [
  pageDefinition,
  sectionDefinition,
  containerDefinition,
  columnsDefinition,
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
];

export function createDefaultComponentRegistry(): ComponentRegistry {
  const registry = new ComponentRegistry();
  for (const def of coreComponentDefinitions) {
    registry.register(def);
  }
  return registry;
}
