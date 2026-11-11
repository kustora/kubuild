import { z } from 'zod';
import { defineEffectPlugin } from '@kubuild/core';
import { toConfigJsonSchema, zodParser } from '@kubuild/effect-kit';
import { pointerParallaxRuntime, type PointerParallaxConfig } from './pointer-parallax.runtime.js';

const schema = z.object({
  strength: z.number().min(0).max(200).default(20),
  invert: z.boolean().default(false),
});

export const pointerParallax = defineEffectPlugin<PointerParallaxConfig>({
  id: 'pointer-parallax',
  label: 'Pointer parallax',
  description: 'Shifts the element slightly as the mouse moves across the window. Inactive on touch screens.',
  category: 'Pointer',
  defaults: schema.parse({}),
  configJsonSchema: toConfigJsonSchema(schema),
  fields: [
    { key: 'strength', label: 'Strength', type: 'number', min: 0, max: 100, step: 1, unit: 'px' },
    {
      key: 'invert',
      label: 'Move away from pointer',
      type: 'boolean',
      description: 'Makes the element read as a background layer.',
    },
  ],
  parse: zodParser(schema),
  ai: {
    guidance:
      'Use on decorative layers in a hero. Give layers different strengths (e.g. 10, 25, 40) for depth. Keep strength under 40 for anything containing text.',
    examples: [{ when: 'Background shape that should feel deep', config: { strength: 15, invert: true } }],
  },
  reducedMotion: pointerParallaxRuntime.reducedMotion,
  mount: pointerParallaxRuntime.mount,
});
