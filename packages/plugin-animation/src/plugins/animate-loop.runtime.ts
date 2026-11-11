import { animateValue, inView } from 'motion';
import type { EffectRuntime } from '@kubuild/core';
import { MOBILE_QUERY, createMotionChannel, matchesMedia } from '@kubuild/effect-kit/dom';
import {
  isLinearLoop,
  loopFrames,
  restlessPart,
  sampleFrames,
  type LoopPreset,
} from '../generator.js';

export type AnimateLoopConfig = {
  preset: LoopPreset;
  /** Amplitude multiplier; 1 is the preset's default size. */
  intensity: number;
  /** Length of one cycle, in ms. */
  duration: number;
  delay: number;
  disableOnMobile: boolean;
};

export const animateLoopRuntime: EffectRuntime<AnimateLoopConfig> = {
  id: 'animate-loop',
  reducedMotion: 'skip',
  mount(element, config) {
    if (config.disableOnMobile && matchesMedia(element, MOBILE_QUERY)) return;

    const frames = loopFrames(config.preset, config.intensity);
    const smooth = !isLinearLoop(config.preset);
    const channel = createMotionChannel(element);
    const animation = animateValue<number>({
      keyframes: [0, 1],
      duration: config.duration,
      delay: config.delay,
      ease: 'linear',
      repeat: Infinity,
      // Starts paused: off-screen loops only burn frames, so it plays while visible.
      autoplay: false,
      onUpdate: (t) => channel.set(restlessPart(sampleFrames(frames, t, { smooth }))),
    });
    const stopWatching = inView(element, () => {
      animation.play();
      return () => animation.pause();
    });

    return () => {
      stopWatching();
      animation.stop();
      channel.release();
    };
  },
};
