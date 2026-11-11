/**
 * Browser-only entry (`@kubuild/plugin-animation/dom`): the animation runtimes without their
 * zod parsers, editor fields or AI text. This is what a static page bundle imports.
 */
import type { AnyEffectRuntime } from '@kubuild/core';
import { animateEntranceRuntime } from './plugins/animate-entrance.runtime.js';
import { animateLoopRuntime } from './plugins/animate-loop.runtime.js';
import { animateHoverRuntime } from './plugins/animate-hover.runtime.js';
import { animateTimelineRuntime } from './plugins/animate-timeline.runtime.js';
import { animateTextRuntime } from './plugins/animate-text.runtime.js';
import { animateCounterRuntime } from './plugins/animate-counter.runtime.js';
import { animateDrawRuntime } from './plugins/animate-draw.runtime.js';
import { scrollPinRuntime } from './plugins/scroll-pin.runtime.js';

export {
  animateEntranceRuntime,
  animateLoopRuntime,
  animateHoverRuntime,
  animateTimelineRuntime,
  animateTextRuntime,
  animateCounterRuntime,
  animateDrawRuntime,
  scrollPinRuntime,
};
export type { AnimateEntranceConfig } from './plugins/animate-entrance.runtime.js';
export type { AnimateLoopConfig } from './plugins/animate-loop.runtime.js';
export type { AnimateHoverConfig } from './plugins/animate-hover.runtime.js';
export type { AnimateTimelineConfig } from './plugins/animate-timeline.runtime.js';
export type { AnimateTextConfig, TextPreset } from './plugins/animate-text.runtime.js';
export type { AnimateCounterConfig } from './plugins/animate-counter.runtime.js';
export type { AnimateDrawConfig } from './plugins/animate-draw.runtime.js';
export type { ScrollPinConfig } from './plugins/scroll-pin.runtime.js';

export const animationRuntimes: readonly AnyEffectRuntime[] = [
  animateEntranceRuntime,
  animateLoopRuntime,
  animateHoverRuntime,
  animateTimelineRuntime,
  animateTextRuntime,
  animateCounterRuntime,
  animateDrawRuntime,
  scrollPinRuntime,
];
