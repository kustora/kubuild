import { animateValue, hover, inView } from 'motion';
import { onScrollFrame, sourceProgress, type ScrollSource } from '@kubuild/effect-kit/dom';
import { easeCurve, scrollEasing, staggeredProgress, type AnimationEasing } from '../generator.js';
import { progressTransition, tween } from './transition.js';

export const ANIMATION_TRIGGERS = ['in-view', 'load', 'hover', 'scroll'] as const;
export type AnimationTrigger = (typeof ANIMATION_TRIGGERS)[number];

export interface DriveOptions {
  trigger: AnimationTrigger;
  /** Per piece, ms. */
  duration: number;
  delay: number;
  easing: AnimationEasing;
  /** Gap between consecutive pieces, ms. */
  stagger: number;
  /** in-view: play only the first time; otherwise reset on leave. */
  once: boolean;
  threshold: number;
  /** Extra plays after the first (time triggers); `Infinity` loops. */
  repeat: number;
  /** Repeats run back and forth instead of restarting. */
  alternate: boolean;
  /** scroll: the window of scroll progress (0..1) that maps to the whole animation. */
  scrollStart: number;
  scrollEnd: number;
  scrollSource: ScrollSource;
}

export const DRIVE_DEFAULTS: DriveOptions = {
  trigger: 'in-view',
  duration: 600,
  delay: 0,
  easing: 'ease-out',
  stagger: 0,
  once: true,
  threshold: 0.2,
  repeat: 0,
  alternate: false,
  scrollStart: 0,
  scrollEnd: 0.5,
  scrollSource: 'self',
};

type Playing = { stop(): void };

/**
 * Turns a trigger into progress for `count` pieces: `apply(index, t)` receives each piece's
 * progress (0 = start pose, 1 = end pose; springs overshoot past 1). Every animation plugin
 * renders poses from progress and leaves *when* and *how fast* to this one driver, so all of
 * them support the same triggers, stagger and repeat semantics.
 *
 * - `load` plays once mounted; `in-view` when `threshold` of `element` is visible;
 * - `hover` plays forward while hovered and back from wherever it is when the pointer leaves;
 * - `scroll` maps scroll progress between `scrollStart` and `scrollEnd` straight to progress
 *   (no time involved), splitting it across pieces in proportion to duration and stagger.
 */
export function drive(
  element: HTMLElement,
  count: number,
  options: DriveOptions,
  apply: (index: number, t: number) => void,
): () => void {
  const indexes = Array.from({ length: Math.max(1, count) }, (_, i) => i);
  let running: Playing[] = [];
  const stopAll = (): void => {
    for (const animation of running.splice(0)) animation.stop();
  };
  const reset = (): void => {
    stopAll();
    for (const i of indexes) apply(i, 0);
  };

  if (options.trigger === 'scroll') {
    const span = options.scrollEnd - options.scrollStart;
    const curve = scrollEasing(options.easing);
    const stopScroll = onScrollFrame(element, (scrollParent) => {
      const raw = sourceProgress(element, scrollParent, options.scrollSource);
      const progress =
        span > 0 ? (raw - options.scrollStart) / span : raw >= options.scrollEnd ? 1 : 0;
      for (const i of indexes) {
        const local = staggeredProgress(
          progress,
          i,
          indexes.length,
          options.duration,
          options.stagger,
        );
        apply(i, easeCurve(curve, local));
      }
    });
    return stopScroll;
  }

  if (options.trigger === 'hover') {
    const progress = indexes.map(() => 0);
    const toward = (target: number): void => {
      stopAll();
      running = indexes.map((i) =>
        tween(
          progress[i],
          target,
          progressTransition(
            options.easing,
            options.duration,
            target === 1 ? i * options.stagger : 0,
          ),
          (t) => {
            progress[i] = t;
            apply(i, t);
          },
        ),
      );
    };
    reset();
    const stopListening = hover(element, () => {
      toward(1);
      return () => toward(0);
    });
    return () => {
      stopListening();
      stopAll();
    };
  }

  const play = (): void => {
    stopAll();
    running = indexes.map((i) =>
      animateValue<number>({
        ...progressTransition(
          options.easing,
          options.duration,
          options.delay + i * options.stagger,
        ),
        keyframes: [0, 1],
        repeat: options.repeat,
        repeatType: options.alternate ? 'mirror' : 'loop',
        onUpdate: (t) => apply(i, t),
      }),
    );
  };

  reset();
  if (options.trigger === 'load') {
    play();
    return stopAll;
  }

  let stopWatching: (() => void) | null = null;
  stopWatching = inView(
    element,
    () => {
      play();
      if (options.once) {
        stopWatching?.();
        return;
      }
      return reset;
    },
    { amount: options.threshold },
  );
  return () => {
    stopWatching?.();
    stopAll();
  };
}
