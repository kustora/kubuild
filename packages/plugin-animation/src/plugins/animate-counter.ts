import { z } from 'zod';
import { defineEffectPlugin } from '@kubuild/core';
import { toConfigJsonSchema, zodParser } from '@kubuild/effect-kit';
import { animateCounterRuntime, type AnimateCounterConfig } from './animate-counter.runtime.js';
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
  from: z.number().min(-1e12).max(1e12).default(0),
  duration: durationSchema(1600),
  delay: delaySchema,
  easing: easingSchema('ease-out'),
  ...driveSchema(TRIGGERS, 'in-view'),
});

export const animateCounter = defineEffectPlugin<AnimateCounterConfig>({
  id: 'animate-counter',
  label: 'Number counter',
  description:
    'Counts the number in the text up from a start value (stats, prices, percentages), keeping its prefix, suffix and formatting.',
  category: 'Animation',
  defaults: schema.parse({}),
  configJsonSchema: toConfigJsonSchema(schema),
  fields: [
    { key: 'from', label: 'Count from', type: 'number', min: 0, max: 1000000, step: 1 },
    durationField(6000),
    delayField,
    easingField,
    ...triggerFields(TRIGGERS),
  ],
  parse: zodParser(schema),
  ai: {
    guidance:
      'Put on a text/heading whose content contains the final number ("12,500+", "Rp 2,4 M", "98%"). The text itself stays the source of truth — never change it to 0. ease-out over 1200-2000 ms reads best; for a row of stats use the same duration and stagger the delay by 100-150 ms.',
    examples: [
      { when: 'Stat "12,500+ customers" counts up when visible', config: { duration: 1800 } },
    ],
  },
  reducedMotion: animateCounterRuntime.reducedMotion,
  mount: animateCounterRuntime.mount,
});
