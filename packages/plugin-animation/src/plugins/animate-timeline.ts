import { z } from 'zod';
import { defineEffectPlugin } from '@kubuild/core';
import { toConfigJsonSchema, zodParser } from '@kubuild/effect-kit';
import { STEP_EASINGS, STEP_EASING_LABELS } from '../generator.js';
import { ANIMATION_TRIGGERS } from '../runtime/drive.js';
import { animateTimelineRuntime, type AnimateTimelineConfig } from './animate-timeline.runtime.js';
import { driveSchema, triggerFields } from './drive-fields.js';
import {
  delayField,
  delaySchema,
  durationField,
  durationSchema,
  easingField,
  easingSchema,
} from './shared-fields.js';

const stepSchema = z.object({
  at: z.number().min(0).max(1),
  x: z.number().min(-5000).max(5000).optional(),
  y: z.number().min(-5000).max(5000).optional(),
  scale: z.number().min(0).max(10).optional(),
  rotate: z.number().min(-3600).max(3600).optional(),
  opacity: z.number().min(0).max(1).optional(),
  ease: z.enum(STEP_EASINGS).optional(),
});

// Default: a "drop in, squash, settle" — something a preset can't express.
const DEFAULT_STEPS = [
  { at: 0, y: -80, opacity: 0 },
  { at: 0.5, y: 0, scale: 1.08, opacity: 1, ease: 'ease-in' as const },
  { at: 0.7, scale: 0.96, ease: 'ease-out' as const },
  { at: 1, ease: 'ease-out' as const },
];

const schema = z.object({
  steps: z
    .array(stepSchema)
    .min(2)
    .max(12)
    .default(DEFAULT_STEPS)
    .transform((steps) => [...steps].sort((a, b) => a.at - b.at)),
  ...driveSchema(ANIMATION_TRIGGERS, 'in-view'),
  duration: durationSchema(1200),
  delay: delaySchema,
  easing: easingSchema('linear'),
  stagger: z.number().min(0).max(2000).default(0),
  repeat: z.number().int().min(0).max(100).default(0),
  loop: z.boolean().default(false),
  alternate: z.boolean().default(false),
  disableOnMobile: z.boolean().default(false),
});

export const animateTimeline = defineEffectPlugin<AnimateTimelineConfig>({
  id: 'animate-timeline',
  label: 'Keyframe timeline',
  description:
    'Custom multi-step animation: a pose at each step (move, scale, rotate, fade) with its own easing, played on view, load, hover or scrubbed by scroll.',
  category: 'Animation',
  defaults: schema.parse({}) as AnimateTimelineConfig,
  configJsonSchema: toConfigJsonSchema(schema),
  fields: [
    {
      key: 'steps',
      label: 'Keyframes',
      type: 'keyframes',
      channels: ['x', 'y', 'scale', 'rotate', 'opacity'],
      easings: STEP_EASINGS.map((value) => ({ value, label: STEP_EASING_LABELS[value] })),
      minSteps: 2,
      maxSteps: 12,
      description:
        'x/y in px, rotate in degrees; blank = at rest. Easing shapes the move into that step.',
    },
    ...triggerFields(),
    {
      ...durationField(10000),
      description: 'Whole timeline; per child when staggering. Ignored when scrubbing.',
    },
    delayField,
    {
      ...easingField,
      label: 'Overall easing',
      description: 'Applied on top of per-step easing; Linear keeps the steps as drawn.',
    },
    {
      key: 'stagger',
      label: 'Stagger children',
      type: 'number',
      min: 0,
      max: 500,
      step: 10,
      unit: 'ms',
      description: 'Above 0 plays the timeline on each child, one after another.',
    },
    {
      key: 'repeat',
      label: 'Repeat',
      type: 'number',
      min: 0,
      max: 20,
      step: 1,
      description: 'Extra plays after the first.',
    },
    { key: 'loop', label: 'Loop forever', type: 'boolean' },
    {
      key: 'alternate',
      label: 'Alternate direction',
      type: 'boolean',
      description: 'Repeats play backwards and forwards.',
    },
    { key: 'disableOnMobile', label: 'Disable on mobile', type: 'boolean' },
  ],
  parse: zodParser(schema as unknown as z.ZodType<AnimateTimelineConfig>),
  ai: {
    guidance:
      'Use when no preset fits: multi-stage motion (drop + squash + settle), orbit-like paths, or scroll-scrubbed sequences. Give 2-6 steps with at from 0 to 1; only list channels that change (x/y px, rotate deg, scale and opacity multipliers). For scroll storytelling put trigger "scroll" with scrollSource "pinned-section" on children of a section that has scroll-pin, and give each child its own scrollStart/scrollEnd window so they play in sequence.',
    examples: [
      {
        when: 'Logo drops in and squashes on load',
        config: { trigger: 'load' },
      },
      {
        when: 'Product image rotates and scales through a pinned section',
        config: {
          trigger: 'scroll',
          scrollSource: 'pinned-section',
          scrollStart: 0,
          scrollEnd: 1,
          steps: [
            { at: 0, scale: 0.8, rotate: -20, opacity: 0 },
            { at: 0.3, scale: 1, rotate: 0, opacity: 1, ease: 'ease-out' },
            { at: 1, x: -200, scale: 0.9 },
          ],
        },
      },
    ],
  },
  reducedMotion: animateTimelineRuntime.reducedMotion,
  mount: animateTimelineRuntime.mount,
});
