import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { createMotionChannel, matchesMedia, toConfigJsonSchema, zodParser } from '../src/index.js';

function fakeElement(media: string[] = []): HTMLElement {
  return {
    style: { translate: '', scale: '', rotate: '', opacity: '' },
    ownerDocument: { defaultView: { matchMedia: (q: string) => ({ matches: media.includes(q) }) } },
  } as unknown as HTMLElement;
}

describe('motion compositor', () => {
  it('adds translations and rotations, multiplies scales and opacities', () => {
    const el = fakeElement();
    const a = createMotionChannel(el);
    const b = createMotionChannel(el);
    a.set({ x: 10, y: 5, scale: 2, rotate: 10, opacity: 0.5 });
    b.set({ y: 5, scale: 1.5, rotate: -4, opacity: 0.5 });
    expect(el.style).toMatchObject({
      translate: '10px 10px',
      scale: '3',
      rotate: '6deg',
      opacity: '0.25',
    });
  });

  it('restores the original inline values once every channel is released', () => {
    const el = fakeElement();
    el.style.translate = '1px 2px';
    el.style.opacity = '0.8';
    const a = createMotionChannel(el);
    const b = createMotionChannel(el);
    a.set({ y: 20, opacity: 0 });
    b.set({ scale: 1.1 });
    a.release();
    expect(el.style).toMatchObject({ translate: '1px 2px', opacity: '0.8', scale: '1.1' });
    b.release();
    expect(el.style.scale).toBe('');
    // A fresh channel after full release captures the restored values again.
    createMotionChannel(el).set({});
    expect(el.style.translate).toBe('1px 2px');
  });
});

describe('config helpers', () => {
  const schema = z.object({
    speed: z.number().min(0).max(1).default(0.5),
    axis: z.enum(['x', 'y']).default('y'),
  });

  it('fills defaults and flattens issues into one message', () => {
    const parse = zodParser(schema);
    expect(parse(undefined)).toEqual({ success: true, config: { speed: 0.5, axis: 'y' } });
    const bad = parse({ speed: 2, axis: 'z' });
    expect(bad.success).toBe(false);
    if (!bad.success) expect(bad.error).toMatch(/^speed: .*; axis: /);
  });

  it('describes the input shape without $schema or required defaults', () => {
    const json = toConfigJsonSchema(schema);
    expect(json).not.toHaveProperty('$schema');
    expect((json as { required?: string[] }).required ?? []).toEqual([]);
  });
});

describe('media', () => {
  it('reads media queries through the element’s own window', () => {
    expect(matchesMedia(fakeElement(['(x)']), '(x)')).toBe(true);
    expect(matchesMedia({ ownerDocument: null } as unknown as HTMLElement, '(x)')).toBe(false);
  });
});
