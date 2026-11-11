/**
 * Browser-only entry (`@kubuild/plugin-parallax/dom`): the effect runtimes without their zod
 * parsers, editor fields or AI text. This is what a static page bundle imports.
 */
import type { AnyEffectRuntime } from '@kubuild/core';
import { parallaxScrollRuntime } from './plugins/parallax-scroll.runtime.js';
import { parallaxBackgroundRuntime } from './plugins/parallax-background.runtime.js';
import { scrollTransformRuntime } from './plugins/scroll-transform.runtime.js';
import { pointerParallaxRuntime } from './plugins/pointer-parallax.runtime.js';

export { parallaxScrollRuntime, parallaxBackgroundRuntime, scrollTransformRuntime, pointerParallaxRuntime };
export type { ParallaxScrollConfig } from './plugins/parallax-scroll.runtime.js';
export type { ParallaxBackgroundConfig } from './plugins/parallax-background.runtime.js';
export type { ScrollTransformConfig } from './plugins/scroll-transform.runtime.js';
export type { PointerParallaxConfig } from './plugins/pointer-parallax.runtime.js';

export const parallaxRuntimes: readonly AnyEffectRuntime[] = [
  parallaxScrollRuntime,
  parallaxBackgroundRuntime,
  scrollTransformRuntime,
  pointerParallaxRuntime,
];
