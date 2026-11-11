import type { AnyEffectPlugin } from '@kubuild/core';
import { animateEntrance } from './plugins/animate-entrance.js';
import { animateLoop } from './plugins/animate-loop.js';
import { animateHover } from './plugins/animate-hover.js';
import { animateTimeline } from './plugins/animate-timeline.js';
import { animateText } from './plugins/animate-text.js';
import { animateCounter } from './plugins/animate-counter.js';
import { animateDraw } from './plugins/animate-draw.js';
import { scrollPin } from './plugins/scroll-pin.js';

export {
  animateEntrance,
  animateLoop,
  animateHover,
  animateTimeline,
  animateText,
  animateCounter,
  animateDraw,
  scrollPin,
};
export * from './generator.js';
export * from './counter-format.js';
export {
  drive,
  DRIVE_DEFAULTS,
  ANIMATION_TRIGGERS,
  type AnimationTrigger,
  type DriveOptions,
} from './runtime/drive.js';
export * from './dom.js';

/** Every plugin in this package, ready for `createEffectRegistry(animationPlugins)`. */
export const animationPlugins: readonly AnyEffectPlugin[] = [
  animateEntrance,
  animateLoop,
  animateHover,
  animateTimeline,
  animateText,
  animateCounter,
  animateDraw,
  scrollPin,
];
