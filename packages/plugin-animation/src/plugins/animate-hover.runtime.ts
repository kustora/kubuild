import { hover } from 'motion';
import type { EffectRuntime } from '@kubuild/core';
import { createMotionChannel } from '@kubuild/effect-kit/dom';
import {
  hoverFrames,
  restlessPart,
  sampleFrames,
  type AnimationEasing,
  type HoverPreset,
} from '../generator.js';
import { progressTransition, tween } from '../runtime/transition.js';

export type AnimateHoverConfig = {
  preset: HoverPreset;
  /** Amplitude multiplier; 1 is the preset's default size. */
  intensity: number;
  duration: number;
  easing: AnimationEasing;
};

export const animateHoverRuntime: EffectRuntime<AnimateHoverConfig> = {
  id: 'animate-hover',
  reducedMotion: 'skip',
  mount(element, config) {
    const frames = hoverFrames(config.preset, config.intensity);
    const channel = createMotionChannel(element);
    let progress = 0;
    let animation: { stop(): void } | null = null;

    // Tween from wherever the last tween left off, so a quick in-out reverses smoothly.
    const to = (target: number): void => {
      animation?.stop();
      animation = tween(
        progress,
        target,
        progressTransition(config.easing, config.duration, 0),
        (t) => {
          progress = t;
          channel.set(restlessPart(sampleFrames(frames, t)));
        },
      );
    };

    // `hover` ignores touch "hovers", so taps on mobile don't leave elements stuck lifted.
    const stopListening = hover(element, () => {
      to(1);
      return () => to(0);
    });

    return () => {
      stopListening();
      animation?.stop();
      channel.release();
    };
  },
};
