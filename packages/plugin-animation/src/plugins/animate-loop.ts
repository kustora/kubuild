import { z } from 'zod';
import { defineEffectPlugin } from '@kubuild/core';
import { toConfigJsonSchema, zodParser } from '@kubuild/effect-kit';
import { LOOP_PRESETS, presetOptions } from '../generator.js';
import { animateLoopRuntime, type AnimateLoopConfig } from './animate-loop.runtime.js';
import {
  delayField,
  delaySchema,
  durationField,
  durationSchema,
  intensityField,
  intensitySchema,
} from './shared-fields.js';

const schema = z.object({
  preset: z.enum(LOOP_PRESETS).default('float'),
  intensity: intensitySchema,
  duration: durationSchema(3000),
  delay: delaySchema,
  disableOnMobile: z.boolean().default(false),
});

export const animateLoop = defineEffectPlugin<AnimateLoopConfig>({
  id: 'animate-loop',
  label: 'Loop animation',
  description:
    'Repeats a preset motion (float, pulse, spin, wiggle, ...) forever while the element is on screen.',
  category: 'Animation',
  defaults: schema.parse({}),
  configJsonSchema: toConfigJsonSchema(schema),
  fields: [
    { key: 'preset', label: 'Preset', type: 'select', options: presetOptions(LOOP_PRESETS) },
    intensityField,
    { ...durationField(10000), label: 'Cycle length' },
    delayField,
    { key: 'disableOnMobile', label: 'Disable on mobile', type: 'boolean' },
  ],
  parse: zodParser(schema),
  ai: {
    guidance:
      'Use sparingly to draw the eye to one or two elements: a floating hero illustration, a pulsing CTA, a spinning loader icon. Never loop body text. Slow cycles (2000-4000 ms) feel calm; shake/wiggle should be short (600-1000 ms) and are best for attention cues.',
    examples: [
      { when: 'Hero illustration gently floats', config: { preset: 'float', duration: 4000 } },
      {
        when: 'Primary CTA pulses to attract attention',
        config: { preset: 'pulse', duration: 1800 },
      },
      { when: 'Loader icon spins', config: { preset: 'spin', duration: 1200 } },
    ],
  },
  reducedMotion: animateLoopRuntime.reducedMotion,
  mount: animateLoopRuntime.mount,
});
