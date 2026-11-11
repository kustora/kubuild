import type { AnyEffectPlugin } from '@kubuild/core';
import { parallaxScroll } from './plugins/parallax-scroll.js';
import { parallaxBackground } from './plugins/parallax-background.js';
import { scrollTransform } from './plugins/scroll-transform.js';
import { pointerParallax } from './plugins/pointer-parallax.js';

export { parallaxScroll, parallaxBackground, scrollTransform, pointerParallax };
export * from './dom.js';

/** Every plugin in this package, ready for `createEffectRegistry(parallaxPlugins)`. */
export const parallaxPlugins: readonly AnyEffectPlugin[] = [
  parallaxScroll,
  parallaxBackground,
  scrollTransform,
  pointerParallax,
];
