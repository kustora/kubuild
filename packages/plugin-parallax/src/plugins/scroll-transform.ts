import { z } from 'zod';
import { defineEffectPlugin, type EffectFieldDescriptor } from '@kubuild/core';
import { toConfigJsonSchema, zodParser } from '@kubuild/effect-kit';
import { scrollTransformRuntime, type ScrollTransformConfig } from './scroll-transform.runtime.js';

const offset = (fallback: number) => z.number().min(-2000).max(2000).default(fallback);
const scale = (fallback: number) => z.number().min(0).max(5).default(fallback);
const rotate = (fallback: number) => z.number().min(-720).max(720).default(fallback);
const opacity = (fallback: number) => z.number().min(0).max(1).default(fallback);

// Defaults: the common "fade up while entering" reveal, done by the time the element is centered.
const schema = z.object({
  start: z.number().min(0).max(1).default(0),
  end: z.number().min(0).max(1).default(0.5),
  easing: z.enum(['linear', 'ease-in', 'ease-out', 'ease-in-out']).default('ease-out'),
  fromX: offset(0),
  fromY: offset(60),
  fromScale: scale(1),
  fromRotate: rotate(0),
  fromOpacity: opacity(0),
  toX: offset(0),
  toY: offset(0),
  toScale: scale(1),
  toRotate: rotate(0),
  toOpacity: opacity(1),
  disableOnMobile: z.boolean().default(false),
});

const endpointFields = (prefix: 'from' | 'to', label: string): EffectFieldDescriptor[] => [
  { key: `${prefix}X`, label: `${label} X`, type: 'number', min: -500, max: 500, step: 1, unit: 'px' },
  { key: `${prefix}Y`, label: `${label} Y`, type: 'number', min: -500, max: 500, step: 1, unit: 'px' },
  { key: `${prefix}Scale`, label: `${label} scale`, type: 'number', min: 0, max: 3, step: 0.05 },
  { key: `${prefix}Rotate`, label: `${label} rotate`, type: 'number', min: -360, max: 360, step: 1, unit: 'deg' },
  { key: `${prefix}Opacity`, label: `${label} opacity`, type: 'number', min: 0, max: 1, step: 0.05 },
];

export const scrollTransform = defineEffectPlugin<ScrollTransformConfig>({
  id: 'scroll-transform',
  label: 'Scroll transform',
  description: 'Interpolates position, scale, rotation and opacity from one state to another as the element scrolls through the viewport.',
  category: 'Scroll',
  defaults: schema.parse({}),
  configJsonSchema: toConfigJsonSchema(schema),
  fields: [
    {
      key: 'start',
      label: 'Start',
      type: 'number',
      min: 0,
      max: 1,
      step: 0.05,
      description: '0 = element just entering at the bottom, 0.5 = centered, 1 = just left at the top.',
    },
    { key: 'end', label: 'End', type: 'number', min: 0, max: 1, step: 0.05 },
    {
      key: 'easing',
      label: 'Easing',
      type: 'select',
      options: [
        { value: 'linear', label: 'Linear' },
        { value: 'ease-in', label: 'Ease in' },
        { value: 'ease-out', label: 'Ease out' },
        { value: 'ease-in-out', label: 'Ease in-out' },
      ],
    },
    ...endpointFields('from', 'From'),
    ...endpointFields('to', 'To'),
    { key: 'disableOnMobile', label: 'Disable on mobile', type: 'boolean' },
  ],
  parse: zodParser(schema),
  ai: {
    guidance:
      'Use for scroll-driven reveals and zooms on cards, images and headings. Only set the from*/to* fields that should change; the rest default to identity. Keep end > start.',
    examples: [
      { when: 'Card fades and slides up while entering', config: { fromY: 60, fromOpacity: 0, end: 0.4 } },
      { when: 'Image zooms out as the section scrolls past', config: { fromOpacity: 1, fromY: 0, fromScale: 1.2, toScale: 1, start: 0, end: 1, easing: 'linear' } },
    ],
  },
  reducedMotion: scrollTransformRuntime.reducedMotion,
  mount: scrollTransformRuntime.mount,
});
