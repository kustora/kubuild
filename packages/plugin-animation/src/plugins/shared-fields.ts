import { z } from 'zod';
import type { EffectFieldDescriptor } from '@kubuild/core';
import { ANIMATION_EASINGS, presetOptions } from '../generator.js';

export const durationSchema = (fallback: number) => z.number().min(50).max(10000).default(fallback);
export const delaySchema = z.number().min(0).max(10000).default(0);
export const intensitySchema = z.number().min(0).max(5).default(1);
export const easingSchema = (fallback: (typeof ANIMATION_EASINGS)[number]) =>
  z.enum(ANIMATION_EASINGS).default(fallback);

export const durationField = (max = 3000): EffectFieldDescriptor => ({
  key: 'duration',
  label: 'Duration',
  type: 'number',
  min: 50,
  max,
  step: 50,
  unit: 'ms',
});

export const delayField: EffectFieldDescriptor = {
  key: 'delay',
  label: 'Delay',
  type: 'number',
  min: 0,
  max: 3000,
  step: 50,
  unit: 'ms',
};

export const intensityField: EffectFieldDescriptor = {
  key: 'intensity',
  label: 'Intensity',
  type: 'number',
  min: 0,
  max: 3,
  step: 0.1,
  description: '1 is the preset as designed; 2 doubles the movement.',
};

export const easingField: EffectFieldDescriptor = {
  key: 'easing',
  label: 'Easing',
  type: 'select',
  options: presetOptions(ANIMATION_EASINGS),
};
