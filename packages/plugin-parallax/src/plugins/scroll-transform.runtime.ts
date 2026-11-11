import type { EffectRuntime } from '@kubuild/core';
import { MOBILE_QUERY, matchesMedia, onScrollFrame, renderScale, untransformedBox, viewportBox } from '../runtime/dom.js';
import { lerp, scrollProgress, windowedProgress, type EasingName } from '../runtime/math.js';
import { createMotionChannel } from '../runtime/motion.js';

export type ScrollTransformConfig = {
  /** Scroll progress (0 = entering from below, 1 = gone above) where the motion starts. */
  start: number;
  /** Scroll progress where the motion ends; past it the `to*` values hold. */
  end: number;
  easing: EasingName;
  fromX: number;
  fromY: number;
  fromScale: number;
  fromRotate: number;
  fromOpacity: number;
  toX: number;
  toY: number;
  toScale: number;
  toRotate: number;
  toOpacity: number;
  disableOnMobile: boolean;
};

export const scrollTransformRuntime: EffectRuntime<ScrollTransformConfig> = {
  id: 'scroll-transform',
  reducedMotion: 'skip',
  mount(element, config) {
    const channel = createMotionChannel(element);
    const stop = onScrollFrame(element, (scrollParent) => {
      if (config.disableOnMobile && matchesMedia(element, MOBILE_QUERY)) {
        channel.set({});
        return;
      }
      const progress = scrollProgress(untransformedBox(element, renderScale(element)), viewportBox(element, scrollParent));
      const t = windowedProgress(progress, config.start, config.end, config.easing);
      channel.set({
        x: lerp(config.fromX, config.toX, t),
        y: lerp(config.fromY, config.toY, t),
        scale: lerp(config.fromScale, config.toScale, t),
        rotate: lerp(config.fromRotate, config.toRotate, t),
        opacity: lerp(config.fromOpacity, config.toOpacity, t),
      });
    });
    return () => {
      stop();
      channel.release();
    };
  },
};
