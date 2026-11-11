import type { EffectRuntime } from '@kubuild/core';
import {
  MOBILE_QUERY,
  createMotionChannel,
  matchesMedia,
  type ScrollSource,
} from '@kubuild/effect-kit/dom';
import {
  STEP_EASINGS,
  restlessPart,
  sampleTimeline,
  type AnimationEasing,
  type TimelineStep,
} from '../generator.js';
import { drive, type AnimationTrigger } from '../runtime/drive.js';

export type AnimateTimelineConfig = {
  steps: TimelineStep[];
  trigger: AnimationTrigger;
  /** Length of the whole timeline (per child when staggering), ms. */
  duration: number;
  delay: number;
  /** Easing of the timeline as a whole; per-step `ease` shapes each segment inside it. */
  easing: AnimationEasing;
  stagger: number;
  /** Extra plays after the first; ignored when `loop`. */
  repeat: number;
  loop: boolean;
  alternate: boolean;
  once: boolean;
  threshold: number;
  scrollStart: number;
  scrollEnd: number;
  scrollSource: ScrollSource;
  disableOnMobile: boolean;
};

const CHANNELS = ['x', 'y', 'scale', 'rotate', 'opacity'] as const;

/**
 * Steps arrive from a page manifest anyone can edit, so keep only well-formed numbers and
 * sort them; a broken step must not throw inside an animation frame.
 */
export function normalizeSteps(raw: unknown): TimelineStep[] {
  if (!Array.isArray(raw)) return [];
  const steps: TimelineStep[] = [];
  for (const item of raw) {
    if (typeof item !== 'object' || item === null) continue;
    const source = item as Record<string, unknown>;
    if (typeof source.at !== 'number' || !Number.isFinite(source.at)) continue;
    const step: TimelineStep = { at: Math.min(1, Math.max(0, source.at)) };
    for (const channel of CHANNELS) {
      const value = source[channel];
      if (typeof value === 'number' && Number.isFinite(value)) step[channel] = value;
    }
    if ((STEP_EASINGS as readonly unknown[]).includes(source.ease))
      step.ease = source.ease as TimelineStep['ease'];
    steps.push(step);
  }
  return steps.sort((a, b) => a.at - b.at);
}

export const animateTimelineRuntime: EffectRuntime<AnimateTimelineConfig> = {
  id: 'animate-timeline',
  reducedMotion: 'skip',
  mount(element, config) {
    if (config.disableOnMobile && matchesMedia(element, MOBILE_QUERY)) return;
    const steps = normalizeSteps(config.steps);
    if (steps.length === 0) return;

    const children =
      config.stagger > 0
        ? Array.from(element.children).filter((child): child is HTMLElement => 'style' in child)
        : [];
    const targets = children.length > 0 ? children : [element];
    const channels = targets.map((target) => createMotionChannel(target));

    const stop = drive(
      element,
      targets.length,
      { ...config, repeat: config.loop ? Infinity : config.repeat },
      (index, t) => channels[index].set(restlessPart(sampleTimeline(steps, t))),
    );
    return () => {
      stop();
      for (const channel of channels) channel.release();
    };
  },
};
