/**
 * Browser-only entry (`@kubuild/plugin-animation/dom`): the animation runtimes without their
 * zod parsers, editor fields or AI text. This is what a static page bundle imports.
 */
import type { AnyEffectRuntime } from '@kubuild/core';
import { animateEntranceRuntime } from './plugins/animate-entrance.runtime.js';
import { animateLoopRuntime } from './plugins/animate-loop.runtime.js';
import { animateHoverRuntime } from './plugins/animate-hover.runtime.js';

export { animateEntranceRuntime, animateLoopRuntime, animateHoverRuntime };
export type { AnimateEntranceConfig } from './plugins/animate-entrance.runtime.js';
export type { AnimateLoopConfig } from './plugins/animate-loop.runtime.js';
export type { AnimateHoverConfig } from './plugins/animate-hover.runtime.js';

export const animationRuntimes: readonly AnyEffectRuntime[] = [
  animateEntranceRuntime,
  animateLoopRuntime,
  animateHoverRuntime,
];
