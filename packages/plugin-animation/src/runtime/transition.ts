import { animateValue, type ValueAnimationOptions } from 'motion';
import type { AnimationEasing } from '../generator.js';

export type ProgressTiming = Omit<ValueAnimationOptions<number>, 'keyframes'>;

/**
 * Motion options for a progress tween. This feeds Motion's low-level `animateValue`, which
 * — unlike `animate` — takes `duration` and `delay` in milliseconds, the unit the configs
 * already use; only a spring's `visualDuration` is in seconds. Springs use it so a spring
 * and a curve with the same `duration` feel equally fast; their overshoot (progress > 1)
 * is what `sampleFrames` extrapolates into a visible bounce.
 */
export function progressTransition(
  easing: AnimationEasing,
  durationMs: number,
  delayMs: number,
): ProgressTiming {
  const timing = { delay: delayMs };
  switch (easing) {
    case 'spring':
      return { ...timing, type: 'spring', visualDuration: durationMs / 1000, bounce: 0.25 };
    case 'bouncy':
      return { ...timing, type: 'spring', visualDuration: durationMs / 1000, bounce: 0.55 };
    case 'ease-out':
      return { ...timing, duration: durationMs, ease: 'easeOut' };
    case 'ease-in-out':
      return { ...timing, duration: durationMs, ease: 'easeInOut' };
    case 'ease-in':
      return { ...timing, duration: durationMs, ease: 'easeIn' };
    case 'back-out':
      return { ...timing, duration: durationMs, ease: 'backOut' };
    case 'linear':
      return { ...timing, duration: durationMs, ease: 'linear' };
  }
}

/**
 * Tweens a number from `from` to `to`, calling `onUpdate` every frame. `animateValue` is the
 * engine under Motion's `animate` without its element/sequence machinery, which keeps the
 * static-page runtime ~18 KB lighter; values reach the element through the motion
 * compositor rather than Motion's own style writer.
 */
export function tween(
  from: number,
  to: number,
  timing: ProgressTiming,
  onUpdate: (value: number) => void,
) {
  return animateValue<number>({ ...timing, keyframes: [from, to], onUpdate });
}
