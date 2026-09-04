import { BlockDefinition } from './types';
import { LAYOUT_STARTER_BLOCKS } from './layout';
import { UI_STARTER_BLOCKS } from './sections';
import { FORM_STARTER_BLOCKS } from './forms';

export * from './types';
export * from './layout';
export * from './sections';
export * from './forms';

/**
 * Predefined Starter Layout Blocks (STORA-241), Pre-composed UI Blocks (STORA-242),
 * and Pre-composed Form Templates (STORA-350).
 */
export const STARTER_BLOCKS: BlockDefinition[] = [
  ...LAYOUT_STARTER_BLOCKS,
  ...UI_STARTER_BLOCKS,
  ...FORM_STARTER_BLOCKS,
];

