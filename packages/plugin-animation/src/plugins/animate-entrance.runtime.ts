import { inView } from 'motion';
import type { EffectRuntime } from '@kubuild/core';
import { MOBILE_QUERY, createMotionChannel, matchesMedia } from '@kubuild/effect-kit/dom';
import {
  entranceFrames,
  restlessPart,
  sampleFrames,
  type AnimationEasing,
  type EntrancePreset,
} from '../generator.js';
import { progressTransition, tween } from '../runtime/transition.js';

export type AnimateEntranceConfig = {
  preset: EntrancePreset;
  /** Travel of the slide/fade-direction presets, in px. */
  distance: number;
  duration: number;
  delay: number;
  easing: AnimationEasing;
  /** Play only the first time the element enters; otherwise reset whenever it leaves. */
  once: boolean;
  /** Fraction of the element that must be visible before it plays. */
  threshold: number;
  /** > 0 animates the element's children one after another, this many ms apart. */
  stagger: number;
  disableOnMobile: boolean;
};

export const animateEntranceRuntime: EffectRuntime<AnimateEntranceConfig> = {
  id: 'animate-entrance',
  reducedMotion: 'skip',
  mount(element, config) {
    if (config.disableOnMobile && matchesMedia(element, MOBILE_QUERY)) return;

    const children =
      config.stagger > 0
        ? Array.from(element.children).filter((child): child is HTMLElement => 'style' in child)
        : [];
    const targets = children.length > 0 ? children : [element];
    const frames = entranceFrames(config.preset, config.distance);
    const channels = targets.map((target) => createMotionChannel(target));
    let running: Array<{ stop(): void }> = [];

    const stopAll = (): void => {
      for (const animation of running.splice(0)) animation.stop();
    };
    const hide = (): void => {
      stopAll();
      for (const channel of channels) channel.set(restlessPart(sampleFrames(frames, 0)));
    };
    const play = (): void => {
      stopAll();
      running = channels.map((channel, index) =>
        tween(
          0,
          1,
          progressTransition(config.easing, config.duration, config.delay + index * config.stagger),
          (t) => channel.set(restlessPart(sampleFrames(frames, t))),
        ),
      );
    };

    hide();
    let stopWatching: (() => void) | null = null;
    stopWatching = inView(
      element,
      () => {
        play();
        if (config.once) {
          stopWatching?.();
          return;
        }
        return hide;
      },
      { amount: config.threshold },
    );

    return () => {
      stopWatching?.();
      stopAll();
      for (const channel of channels) channel.release();
    };
  },
};
