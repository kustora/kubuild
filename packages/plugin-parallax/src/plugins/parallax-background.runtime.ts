import type { EffectRuntime } from '@kubuild/core';
import { MOBILE_QUERY, matchesMedia, onScrollFrame, renderScale, untransformedBox, viewportBox } from '../runtime/dom.js';
import { backgroundPositionPercent, scrollProgress } from '../runtime/math.js';

export type ParallaxBackgroundConfig = {
  speed: number;
  disableOnMobile: boolean;
};

export const parallaxBackgroundRuntime: EffectRuntime<ParallaxBackgroundConfig> = {
  id: 'parallax-background',
  reducedMotion: 'skip',
  mount(element, config) {
    const original = element.style.backgroundPositionY;
    const stop = onScrollFrame(element, (scrollParent) => {
      if (config.disableOnMobile && matchesMedia(element, MOBILE_QUERY)) {
        element.style.backgroundPositionY = original;
        return;
      }
      const progress = scrollProgress(untransformedBox(element, renderScale(element)), viewportBox(element, scrollParent));
      const percent = backgroundPositionPercent(progress, config.speed);
      element.style.backgroundPositionY = `${Math.round(percent * 100) / 100}%`;
    });
    return () => {
      stop();
      element.style.backgroundPositionY = original;
    };
  },
};
