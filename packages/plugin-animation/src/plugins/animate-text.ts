import { z } from 'zod';
import { defineEffectPlugin } from '@kubuild/core';
import { toConfigJsonSchema, zodParser } from '@kubuild/effect-kit';
import { ENTRANCE_PRESETS, presetOptions } from '../generator.js';
import { animateTextRuntime, type AnimateTextConfig } from './animate-text.runtime.js';
import { driveSchema, triggerFields } from './drive-fields.js';
import {
  delayField,
  delaySchema,
  durationField,
  durationSchema,
  easingField,
  easingSchema,
} from './shared-fields.js';

const TEXT_PRESETS = [...ENTRANCE_PRESETS, 'typewriter'] as const;
const TRIGGERS = ['in-view', 'load', 'scroll'] as const;

const schema = z.object({
  split: z.enum(['word', 'char']).default('word'),
  preset: z.enum(TEXT_PRESETS).default('fade-up'),
  distance: z.number().min(0).max(1000).default(24),
  duration: durationSchema(500),
  delay: delaySchema,
  easing: easingSchema('ease-out'),
  stagger: z.number().min(0).max(1000).default(60),
  ...driveSchema(TRIGGERS, 'in-view'),
  disableOnMobile: z.boolean().default(false),
});

export const animateText = defineEffectPlugin<AnimateTextConfig>({
  id: 'animate-text',
  label: 'Text animation',
  description:
    'Splits the text into words or letters and reveals them one after another (fade, slide, pop, typewriter, ...).',
  category: 'Animation',
  defaults: schema.parse({}),
  configJsonSchema: toConfigJsonSchema(schema),
  fields: [
    {
      key: 'split',
      label: 'Split by',
      type: 'select',
      options: [
        { value: 'word', label: 'Words' },
        { value: 'char', label: 'Letters' },
      ],
    },
    {
      key: 'preset',
      label: 'Preset',
      type: 'select',
      options: [...presetOptions(ENTRANCE_PRESETS), { value: 'typewriter', label: 'Typewriter' }],
    },
    { key: 'distance', label: 'Distance', type: 'number', min: 0, max: 200, step: 1, unit: 'px' },
    { ...durationField(2000), description: 'Per word or letter. Ignored by Typewriter.' },
    {
      key: 'stagger',
      label: 'Stagger',
      type: 'number',
      min: 0,
      max: 300,
      step: 5,
      unit: 'ms',
      description: 'Gap between words/letters — the typing speed for Typewriter.',
    },
    delayField,
    easingField,
    ...triggerFields(TRIGGERS),
    { key: 'disableOnMobile', label: 'Disable on mobile', type: 'boolean' },
  ],
  parse: zodParser(schema),
  ai: {
    guidance:
      'Use on hero headings and short taglines, not paragraphs. Words with fade-up and stagger 60-90 is elegant; letters with pop and stagger 25-40 is playful; typewriter with stagger 40-60 suits a tech tone. Text keeps its styles; screen readers read the whole text.',
    examples: [
      {
        when: 'Hero heading reveals word by word',
        config: { split: 'word', preset: 'fade-up', stagger: 80 },
      },
      {
        when: 'Tagline types itself out',
        config: { split: 'char', preset: 'typewriter', stagger: 45, trigger: 'load' },
      },
    ],
  },
  reducedMotion: animateTextRuntime.reducedMotion,
  mount: animateTextRuntime.mount,
});
