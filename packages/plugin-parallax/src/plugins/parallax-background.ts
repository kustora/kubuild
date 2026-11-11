import { z } from 'zod';
import { defineEffectPlugin } from '@kubuild/core';
import { toConfigJsonSchema, zodParser } from '../runtime/config.js';
import { parallaxBackgroundRuntime, type ParallaxBackgroundConfig } from './parallax-background.runtime.js';

const schema = z.object({
  speed: z.number().min(-1).max(1).default(0.5),
  disableOnMobile: z.boolean().default(false),
});

export const parallaxBackground = defineEffectPlugin<ParallaxBackgroundConfig>({
  id: 'parallax-background',
  label: 'Parallax background',
  description: "Slides the element's background image vertically as the section scrolls through the viewport.",
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
      description: 'How much of the image overflow is travelled. Needs a background image taller than the section (e.g. size: cover on a wide section).',
    },
    { key: 'disableOnMobile', label: 'Disable on mobile', type: 'boolean' },
  ],
  parse: zodParser(schema),
  ai: {
    guidance:
      'Use on full-width sections that have a background image with background-size cover. Has no visible effect without a background image.',
    examples: [{ when: 'Hero section with a photo background', config: { speed: 0.5 } }],
  },
  reducedMotion: parallaxBackgroundRuntime.reducedMotion,
  mount: parallaxBackgroundRuntime.mount,
});
