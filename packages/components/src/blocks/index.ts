import { BlockDefinition } from './types';
import { LAYOUT_STARTER_BLOCKS } from './layout';
import { UI_STARTER_BLOCKS } from './sections';
import { FORM_STARTER_BLOCKS } from './forms';
import { SALES_STARTER_BLOCKS } from './sales';

export * from './types';
export * from './layout';
export * from './sections';
export * from './forms';
export * from './sales';

/**
 * Predefined Starter Layout Blocks (STORA-241), Pre-composed UI Blocks (STORA-242),
 * Pre-composed Form Templates (STORA-350), and Sales / conversion sections (STORA-549).
 */
export const STARTER_BLOCKS: BlockDefinition[] = [
  ...LAYOUT_STARTER_BLOCKS,
  ...UI_STARTER_BLOCKS,
  ...FORM_STARTER_BLOCKS,
  ...SALES_STARTER_BLOCKS,
];

