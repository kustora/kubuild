import type { EffectRuntime } from '@kubuild/core';
import {
  MOBILE_QUERY,
  createMotionChannel,
  matchesMedia,
  type ScrollSource,
} from '@kubuild/effect-kit/dom';
import {
  entranceFrames,
  restlessPart,
  sampleFrames,
  type AnimationEasing,
  type EntrancePreset,
} from '../generator.js';
import { drive, type AnimationTrigger } from '../runtime/drive.js';
import { splitText, type SplitMode } from '../runtime/split-text.js';

export type TextPreset = EntrancePreset | 'typewriter';

export type AnimateTextConfig = {
  split: SplitMode;
  preset: TextPreset;
  distance: number;
  /** Per word/character, ms. */
  duration: number;
  delay: number;
  easing: AnimationEasing;
  /** Gap between consecutive words/characters, ms. */
  stagger: number;
  trigger: AnimationTrigger;
  once: boolean;
  threshold: number;
  scrollStart: number;
  scrollEnd: number;
  scrollSource: ScrollSource;
  disableOnMobile: boolean;
};

export const animateTextRuntime: EffectRuntime<AnimateTextConfig> = {
  id: 'animate-text',
  reducedMotion: 'skip',
  mount(element, config) {
    if (config.disableOnMobile && matchesMedia(element, MOBILE_QUERY)) return;
    const split = splitText(element, config.split);
    if (split.pieces.length === 0) {
      split.restore();
      return;
    }

    const typewriter = config.preset === 'typewriter';
    const frames = entranceFrames(
      config.preset === 'typewriter' ? 'fade' : config.preset,
      config.distance,
    );
    const channels = split.pieces.map((piece) => createMotionChannel(piece));
    const stop = drive(
      element,
      channels.length,
      // A typewriter reveals each piece instantly; `stagger` alone sets the typing speed.
      typewriter
        ? { ...config, duration: 1, easing: 'linear', repeat: 0, alternate: false }
        : { ...config, repeat: 0, alternate: false },
      (index, t) =>
        channels[index].set(restlessPart(sampleFrames(frames, typewriter ? (t > 0 ? 1 : 0) : t))),
    );
    return () => {
      stop();
      for (const channel of channels) channel.release();
      split.restore();
    };
  },
};
