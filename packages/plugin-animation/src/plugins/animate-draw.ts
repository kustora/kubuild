import { z } from 'zod';
import { defineEffectPlugin } from '@kubuild/core';
import { toConfigJsonSchema, zodParser } from '@kubuild/effect-kit';
import { animateDrawRuntime, type AnimateDrawConfig } from './animate-draw.runtime.js';
import { driveSchema, triggerFields } from './drive-fields.js';
import {
  delayField,
  delaySchema,
  durationField,
  durationSchema,
  easingField,
  easingSchema,
} from './shared-fields.js';

const TRIGGERS = ['in-view', 'load', 'scroll'] as const;

const schema = z.object({
  duration: durationSchema(1500),
  delay: delaySchema,
  easing: easingSchema('ease-in-out'),
  stagger: z.number().min(0).max(2000).default(0),
  ...driveSchema(TRIGGERS, 'in-view'),
});

export const animateDraw = defineEffectPlugin<AnimateDrawConfig>({
  id: 'animate-draw',
  label: 'SVG line draw',
  description:
    'Draws the strokes of the SVG lines and paths inside the element, as if sketched by hand.',
  category: 'Animation',
  defaults: schema.parse({}),
  configJsonSchema: toConfigJsonSchema(schema),
  fields: [
    durationField(6000),
    delayField,
    easingField,
    {
      key: 'stagger',
      label: 'Stagger shapes',
      type: 'number',
      min: 0,
      max: 1000,
      step: 10,
      unit: 'ms',
      description: 'Above 0 draws each line one after another.',
    },
    ...triggerFields(TRIGGERS),
  ],
  parse: zodParser(schema),
  ai: {
    guidance:
      'Use on icons, illustrations, underlines or signatures made of stroked SVG paths (filled shapes show no effect). Scrubbing with scroll works well for a line that connects sections.',
    examples: [
      {
        when: 'Hand-drawn underline appears under a heading',
        config: { duration: 900, trigger: 'in-view' },
      },
    ],
  },
  reducedMotion: animateDrawRuntime.reducedMotion,
  mount: animateDrawRuntime.mount,
});
