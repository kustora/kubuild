import { z } from 'zod';
import type { EffectFieldDescriptor } from '@kubuild/core';
import { ANIMATION_TRIGGERS, DRIVE_DEFAULTS, type AnimationTrigger } from '../runtime/drive.js';

/**
 * Schema + editor fields for the trigger options every driven animation shares (see
 * `drive`). Plugins pick the triggers that make sense for them.
 */
export function driveSchema(triggers: readonly AnimationTrigger[], fallback: AnimationTrigger) {
  return {
    trigger: z.enum(triggers as [AnimationTrigger, ...AnimationTrigger[]]).default(fallback),
    once: z.boolean().default(DRIVE_DEFAULTS.once),
    threshold: z.number().min(0).max(1).default(DRIVE_DEFAULTS.threshold),
    scrollStart: z.number().min(0).max(1).default(DRIVE_DEFAULTS.scrollStart),
    scrollEnd: z.number().min(0).max(1).default(DRIVE_DEFAULTS.scrollEnd),
    scrollSource: z.enum(['self', 'pinned-section']).default(DRIVE_DEFAULTS.scrollSource),
  };
}

const TRIGGER_LABELS: Record<AnimationTrigger, string> = {
  'in-view': 'When scrolled into view',
  load: 'On page load',
  hover: 'While hovered',
  scroll: 'Scrub with scroll',
};

export function triggerFields(
  triggers: readonly AnimationTrigger[] = ANIMATION_TRIGGERS,
): EffectFieldDescriptor[] {
  return [
    {
      key: 'trigger',
      label: 'Trigger',
      type: 'select',
      options: triggers.map((value) => ({ value, label: TRIGGER_LABELS[value] })),
    },
    {
      key: 'once',
      label: 'Play once',
      type: 'boolean',
      description: 'In view: off replays every time it scrolls back in.',
    },
    {
      key: 'threshold',
      label: 'Visible before playing',
      type: 'number',
      min: 0,
      max: 1,
      step: 0.05,
      description: 'In view: share of the element that must be on screen.',
    },
    {
      key: 'scrollStart',
      label: 'Scroll start',
      type: 'number',
      min: 0,
      max: 1,
      step: 0.05,
      description:
        'Scrub: 0 = entering at the bottom, 0.5 = centered, 1 = leaving at the top (or start/end of the pinned section).',
    },
    { key: 'scrollEnd', label: 'Scroll end', type: 'number', min: 0, max: 1, step: 0.05 },
    {
      key: 'scrollSource',
      label: 'Scroll follows',
      type: 'select',
      options: [
        { value: 'self', label: 'This element' },
        { value: 'pinned-section', label: 'Pinned section around it' },
      ],
      description:
        'Scrub: inside a "Scroll pin" section, follow the pin so the animation plays while the section is held.',
    },
  ];
}
