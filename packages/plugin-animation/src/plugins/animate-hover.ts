import { z } from 'zod';
import { defineEffectPlugin } from '@kubuild/core';
import { toConfigJsonSchema, zodParser } from '@kubuild/effect-kit';
import { HOVER_PRESETS, presetOptions } from '../generator.js';
import { animateHoverRuntime, type AnimateHoverConfig } from './animate-hover.runtime.js';
import {
  durationField,
  durationSchema,
  easingField,
  easingSchema,
  intensityField,
  intensitySchema,
} from './shared-fields.js';

const schema = z.object({
  preset: z.enum(HOVER_PRESETS).default('lift'),
  intensity: intensitySchema,
  duration: durationSchema(250),
  easing: easingSchema('ease-out'),
});

export const animateHover = defineEffectPlugin<AnimateHoverConfig>({
  id: 'animate-hover',
  label: 'Hover animation',
  description:
    'Animates the element into a preset state (lift, grow, tilt, ...) while the pointer is over it, and back when it leaves.',
  category: 'Animation',
  defaults: schema.parse({}),
  configJsonSchema: toConfigJsonSchema(schema),
  fields: [
    { key: 'preset', label: 'Preset', type: 'select', options: presetOptions(HOVER_PRESETS) },
    intensityField,
    durationField(1000),
    easingField,
  ],
  parse: zodParser(schema),
  ai: {
    guidance:
      'Use on interactive things: cards that link somewhere, buttons, thumbnails. lift or grow suit cards, push suits buttons. Keep duration 150-350 ms; spring easing gives a tactile feel. Does nothing on touch screens.',
    examples: [
      { when: 'Pricing card lifts when hovered', config: { preset: 'lift' } },
      { when: 'Button squishes playfully', config: { preset: 'push', easing: 'spring' } },
    ],
  },
  reducedMotion: animateHoverRuntime.reducedMotion,
  mount: animateHoverRuntime.mount,
});
