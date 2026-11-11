import type { EffectRuntime } from '@kubuild/core';
import { MOBILE_QUERY, matchesMedia, onScrollFrame, untransformedBox, viewportBox } from '../runtime/dom.js';
import { parallaxOffset } from '../runtime/math.js';
import { createMotionChannel } from '../runtime/motion.js';

export type ParallaxScrollConfig = {
  /** 0.3 lags 30% behind the scroll (feels further away); negative values lead it. */
  speed: number;
  axis: 'vertical' | 'horizontal';
  disableOnMobile: boolean;
};

export const parallaxScrollRuntime: EffectRuntime<ParallaxScrollConfig> = {
  id: 'parallax-scroll',
  reducedMotion: 'skip',
  mount(element, config) {
    const channel = createMotionChannel(element);
    const stop = onScrollFrame(element, (scrollParent) => {
      if (config.disableOnMobile && matchesMedia(element, MOBILE_QUERY)) {
        channel.set({});
        return;
      }
      const offset = parallaxOffset(untransformedBox(element), viewportBox(element, scrollParent), config.speed);
      channel.set(config.axis === 'horizontal' ? { x: offset } : { y: offset });
    });
    return () => {
      stop();
      channel.release();
    };
  },
};
