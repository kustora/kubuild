import { z } from 'zod';
import { defineEffectPlugin } from '@kubuild/core';
import { toConfigJsonSchema, zodParser } from '../runtime/config.js';
import { parallaxScrollRuntime, type ParallaxScrollConfig } from './parallax-scroll.runtime.js';

const schema = z.object({
  speed: z.number().min(-1).max(1).default(0.3),
  axis: z.enum(['vertical', 'horizontal']).default('vertical'),
  disableOnMobile: z.boolean().default(false),
});

export const parallaxScroll = defineEffectPlugin<ParallaxScrollConfig>({
  id: 'parallax-scroll',
  label: 'Parallax scroll',
  description: 'Moves the element slower or faster than the page scroll so it appears to sit at a different depth.',
  category: 'Scroll',
  defaults: schema.parse({}),
  configJsonSchema: toConfigJsonSchema(schema),
  fields: [
    {
      key: 'speed',
      label: 'Speed',
      type: 'number',
      min: -1,
      max: 1,
      step: 0.05,
      description: 'Positive lags behind the scroll (further away), negative leads it (closer).',
    },
    {
      key: 'axis',
      label: 'Direction',
      type: 'select',
      options: [
        { value: 'vertical', label: 'Vertical' },
        { value: 'horizontal', label: 'Horizontal' },
      ],
    },
    { key: 'disableOnMobile', label: 'Disable on mobile', type: 'boolean' },
  ],
  parse: zodParser(schema),
  ai: {
    guidance:
      'Use on decorative images, shapes or headings inside a hero or feature section. Keep speed between 0.1 and 0.4; above 0.5 content drifts noticeably out of place. Avoid on body text and forms.',
    examples: [
      { when: 'Floating decorative image in a hero', config: { speed: 0.25 } },
      { when: 'Foreground element that should feel closer', config: { speed: -0.15 } },
    ],
  },
  reducedMotion: parallaxScrollRuntime.reducedMotion,
  mount: parallaxScrollRuntime.mount,
});
