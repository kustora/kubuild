import type { AnyEffectPlugin } from '@kubuild/core';
import { animateEntrance } from './plugins/animate-entrance.js';
import { animateLoop } from './plugins/animate-loop.js';
import { animateHover } from './plugins/animate-hover.js';

export { animateEntrance, animateLoop, animateHover };
export * from './generator.js';
export * from './dom.js';

/** Every plugin in this package, ready for `createEffectRegistry(animationPlugins)`. */
export const animationPlugins: readonly AnyEffectPlugin[] = [
  animateEntrance,
  animateLoop,
  animateHover,
];
