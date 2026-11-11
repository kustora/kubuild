import { z } from 'zod';
import { defineEffectPlugin } from '@kubuild/core';
import { toConfigJsonSchema, zodParser } from '@kubuild/effect-kit';
import { scrollPinRuntime, type ScrollPinConfig } from './scroll-pin.runtime.js';

const schema = z.object({
  length: z.number().min(0.25).max(10).default(2),
  offset: z.number().min(0).max(400).default(0),
  fullHeight: z.boolean().default(true),
  disableOnMobile: z.boolean().default(false),
});

export const scrollPin = defineEffectPlugin<ScrollPinConfig>({
  id: 'scroll-pin',
  label: 'Scroll pin',
  description:
    'Holds the section’s content on screen while the page scrolls on, so scroll-scrubbed animations inside can play out — the "sticky storytelling" pattern.',
  category: 'Scroll',
  defaults: schema.parse({}),
  configJsonSchema: toConfigJsonSchema(schema),
  fields: [
    {
      key: 'length',
      label: 'Pinned for',
      type: 'number',
      min: 0.25,
      max: 6,
      step: 0.25,
      unit: 'vh×',
      description: 'Extra scroll the content stays pinned, in screen heights.',
    },
    {
      key: 'offset',
      label: 'Top offset',
      type: 'number',
      min: 0,
      max: 200,
      step: 1,
      unit: 'px',
      description: 'Room for a fixed header.',
    },
    { key: 'fullHeight', label: 'Full-screen content', type: 'boolean' },
    { key: 'disableOnMobile', label: 'Disable on mobile', type: 'boolean' },
  ],
  parse: zodParser(schema),
  ai: {
    guidance:
      'Put on a section whose content is wrapped in ONE container (the first child gets pinned). Then give elements inside animate-timeline / animate-text / animate-counter / animate-draw with trigger "scroll" and scrollSource "pinned-section", each with its own scrollStart/scrollEnd window (e.g. 0-0.3, 0.3-0.6, 0.6-1) so they play in sequence while the section is held. length 2-3 is typical. Sticky does not work if an ancestor clips overflow.',
    examples: [
      {
        when: 'Feature story that plays while the section is held for two screens',
        config: { length: 2 },
      },
    ],
  },
  reducedMotion: scrollPinRuntime.reducedMotion,
  mount: scrollPinRuntime.mount,
});
