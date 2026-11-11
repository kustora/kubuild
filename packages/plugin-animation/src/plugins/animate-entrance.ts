import { z } from 'zod';
import { defineEffectPlugin } from '@kubuild/core';
import { toConfigJsonSchema, zodParser } from '@kubuild/effect-kit';
import { ENTRANCE_PRESETS, presetOptions } from '../generator.js';
import { animateEntranceRuntime, type AnimateEntranceConfig } from './animate-entrance.runtime.js';
import {
  delayField,
  delaySchema,
  durationField,
  durationSchema,
  easingField,
  easingSchema,
} from './shared-fields.js';

const schema = z.object({
  preset: z.enum(ENTRANCE_PRESETS).default('fade-up'),
  distance: z.number().min(0).max(1000).default(40),
  duration: durationSchema(600),
  delay: delaySchema,
  easing: easingSchema('ease-out'),
  once: z.boolean().default(true),
  threshold: z.number().min(0).max(1).default(0.2),
  stagger: z.number().min(0).max(2000).default(0),
  disableOnMobile: z.boolean().default(false),
});

export const animateEntrance = defineEffectPlugin<AnimateEntranceConfig>({
  id: 'animate-entrance',
  label: 'Entrance animation',
  description:
    'Plays a preset reveal (fade, slide, zoom, pop, ...) when the element scrolls into view, optionally staggering its children.',
  category: 'Animation',
  defaults: schema.parse({}),
  configJsonSchema: toConfigJsonSchema(schema),
  fields: [
    { key: 'preset', label: 'Preset', type: 'select', options: presetOptions(ENTRANCE_PRESETS) },
    {
      key: 'distance',
      label: 'Distance',
      type: 'number',
      min: 0,
      max: 300,
      step: 1,
      unit: 'px',
      description: 'How far fade-*/slide-* presets travel.',
    },
    durationField(),
    delayField,
    easingField,
    {
      key: 'stagger',
      label: 'Stagger children',
      type: 'number',
      min: 0,
      max: 500,
      step: 10,
      unit: 'ms',
      description:
        '0 animates the element itself; above 0 animates its children one after another.',
    },
    {
      key: 'threshold',
      label: 'Visible before playing',
      type: 'number',
      min: 0,
      max: 1,
      step: 0.05,
      description: 'Share of the element that must be on screen (0.2 = 20%).',
    },
    {
      key: 'once',
      label: 'Play once',
      type: 'boolean',
      description: 'Off: replays every time it scrolls back in.',
    },
    { key: 'disableOnMobile', label: 'Disable on mobile', type: 'boolean' },
  ],
  parse: zodParser(schema),
  ai: {
    guidance:
      'Use for reveals as content scrolls in: headings, cards, images, feature rows. fade-up is the safe default. For grids or lists put one effect on the parent with stagger 60-120 instead of one per child. Prefer spring/bouncy only with pop or zoom-in. Keep duration 400-900 and avoid animating every node on the page.',
    examples: [
      { when: 'Section heading fades up as it appears', config: { preset: 'fade-up' } },
      {
        when: 'Feature cards in a grid appear one by one',
        config: { preset: 'fade-up', stagger: 100, distance: 30 },
      },
      {
        when: 'Badge or CTA pops in playfully',
        config: { preset: 'pop', easing: 'bouncy', duration: 700 },
      },
    ],
  },
  reducedMotion: animateEntranceRuntime.reducedMotion,
  mount: animateEntranceRuntime.mount,
});
