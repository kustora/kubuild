import { describe, it, expect } from 'vitest';
import { createEffectRegistry, resolveEffect } from '@kubuild/core';
import {
  parallaxPlugins,
  parallaxScroll,
  parallaxBackground,
  scrollTransform,
  pointerParallax,
  parallaxRuntimes,
} from '../src/index.js';
import { MOBILE_QUERY, COARSE_POINTER_QUERY } from '../src/runtime/dom.js';
import { createFakeDom } from './fake-dom.js';

const ctx = { nodeId: 'n', mode: 'runtime' as const, reducedMotion: false };

describe('plugin definitions', () => {
  it('registers every plugin and exposes a matching runtime for each', () => {
    const registry = createEffectRegistry([...parallaxPlugins]);
    expect(registry.size).toBe(4);
    expect(parallaxRuntimes.map((r) => r.id)).toEqual(parallaxPlugins.map((p) => p.id));
    for (const plugin of parallaxPlugins) {
      expect(plugin.mount).toBeTypeOf('function');
      expect(plugin.parse({})).toEqual({ success: true, config: plugin.defaults });
      expect(plugin.configJsonSchema).toMatchObject({ type: 'object' });
      for (const field of plugin.fields) expect(plugin.defaults).toHaveProperty(field.key);
    }
  });

  it('fills defaults and rejects out-of-range config', () => {
    expect(parallaxScroll.parse({ speed: 0.1 })).toEqual({
      success: true,
      config: { speed: 0.1, axis: 'vertical', disableOnMobile: false },
    });
    const bad = parallaxScroll.parse({ speed: 5 });
    expect(bad.success).toBe(false);
    if (!bad.success) expect(bad.error).toMatch(/^speed:/);
    expect(resolveEffect({ plugin: 'scroll-transform', enabled: true, config: { easing: 'bounce' } }, createEffectRegistry([scrollTransform])).status).toBe('invalid-config');
  });

  it('describes the input shape (defaults optional) for the AI', () => {
    expect(parallaxScroll.configJsonSchema).not.toHaveProperty('$schema');
    expect((parallaxScroll.configJsonSchema as { required?: string[] }).required ?? []).toEqual([]);
  });
});

describe('parallax-scroll runtime', () => {
  const config = parallaxScroll.defaults;

  it('offsets the element against its distance from the viewport center', () => {
    const dom = createFakeDom();
    const el = dom.element({ top: 600, height: 200 }); // center 700, viewport center 500
    const cleanup = parallaxScroll.mount!(el, config, ctx);
    expect(el.style.translate).toBe('0px -60px');

    dom.scrollTo(el, 300); // center 400 → +30, measured without our own translate
    expect(el.style.translate).toBe('0px 30px');

    (cleanup as () => void)();
    expect(el.style.translate).toBe('');
    expect(dom.view.count('scroll')).toBe(0);
  });

  it('can move horizontally and stays put on mobile when asked', () => {
    const dom = createFakeDom();
    const el = dom.element({ top: 600, height: 200 });
    parallaxScroll.mount!(el, { ...config, axis: 'horizontal' }, ctx);
    expect(el.style.translate).toBe('-60px 0px');

    const mobile = createFakeDom({ media: [MOBILE_QUERY] });
    const el2 = mobile.element({ top: 600, height: 200 });
    el2.style.translate = '5px 5px';
    parallaxScroll.mount!(el2, { ...config, disableOnMobile: true }, ctx);
    expect(el2.style.translate).toBe('5px 5px');
  });
});

describe('parallax-background runtime', () => {
  it('maps scroll progress to background-position-y and restores it', () => {
    const dom = createFakeDom();
    const el = dom.element({ top: 300, height: 400 }); // progress 0.5
    el.style.backgroundPositionY = 'top';
    const cleanup = parallaxBackground.mount!(el, parallaxBackground.defaults, ctx);
    expect(el.style.backgroundPositionY).toBe('50%');

    dom.scrollTo(el, 1000); // just entering → progress 0
    expect(el.style.backgroundPositionY).toBe('25%');

    (cleanup as () => void)();
    expect(el.style.backgroundPositionY).toBe('top');
  });
});

describe('scroll-transform runtime', () => {
  it('interpolates from the start state to the end state across the window', () => {
    const dom = createFakeDom();
    const el = dom.element({ top: 1000, height: 200 }); // progress 0
    scrollTransform.mount!(el, scrollTransform.defaults, ctx);
    expect(el.style.translate).toBe('0px 60px');
    expect(el.style.opacity).toBe('0');

    dom.scrollTo(el, 400); // progress 0.5 = window end
    expect(el.style.translate).toBe('0px 0px');
    expect(el.style.opacity).toBe('1');
  });
});

describe('pointer-parallax runtime', () => {
  it('follows the pointer, inverts on request and recenters when it leaves', () => {
    const dom = createFakeDom();
    const el = dom.element({ top: 0, height: 100 });
    const cleanup = pointerParallax.mount!(el, { strength: 20, invert: false }, ctx);

    dom.view.dispatch('pointermove', { clientX: 1200, clientY: 0 });
    dom.flush();
    expect(el.style.translate).toBe('20px -20px');

    dom.documentElement.dispatch('pointerleave');
    dom.flush();
    expect(el.style.translate).toBe('');

    (cleanup as () => void)();
    expect(dom.view.count('pointermove')).toBe(0);

    const inverted = dom.element({ top: 0, height: 100 });
    pointerParallax.mount!(inverted, { strength: 10, invert: true }, ctx);
    dom.view.dispatch('pointermove', { clientX: 0, clientY: 1000 });
    dom.flush();
    expect(inverted.style.translate).toBe('10px -10px');
  });

  it('does nothing on touch screens', () => {
    const dom = createFakeDom({ media: [COARSE_POINTER_QUERY] });
    const el = dom.element({ top: 0, height: 100 });
    expect(pointerParallax.mount!(el, pointerParallax.defaults, ctx)).toBeUndefined();
    expect(dom.view.count('pointermove')).toBe(0);
  });
});

describe('composition', () => {
  it('adds translations from several effects on one element and releases them independently', () => {
    const dom = createFakeDom();
    const el = dom.element({ top: 600, height: 200 });
    const stopScroll = parallaxScroll.mount!(el, parallaxScroll.defaults, ctx) as () => void;
    const stopPointer = pointerParallax.mount!(el, { strength: 20, invert: false }, ctx) as () => void;
    dom.view.dispatch('pointermove', { clientX: 1200, clientY: 0 });
    dom.flush();
    expect(el.style.translate).toBe('20px -80px');

    stopPointer();
    expect(el.style.translate).toBe('0px -60px');
    stopScroll();
    expect(el.style.translate).toBe('');
  });
});

describe('scroll viewport marker', () => {
  it('treats a marked, non-scrolling ancestor as the viewport and follows its scroll events', async () => {
    const { findScrollParent } = await import('../src/runtime/dom.js');
    const { EFFECT_SCROLL_VIEWPORT_ATTRIBUTE } = await import('@kubuild/core/effect-manifest');
    const dom = createFakeDom();
    const listeners = new Map<string, () => void>();
    const canvas = {
      hasAttribute: (name: string) => name === EFFECT_SCROLL_VIEWPORT_ATTRIBUTE,
      parentElement: null,
      getBoundingClientRect: () => ({ top: 100, height: 400, left: 0, width: 800 }),
      addEventListener: (type: string, fn: () => void) => listeners.set(type, fn),
      removeEventListener: (type: string) => listeners.delete(type),
    };
    const el = dom.element({ top: 250, height: 100 }); // center 300 = canvas center (100 + 400 / 2)
    Object.assign(el, { parentElement: canvas });
    expect(findScrollParent(el)).toBe(canvas);

    const cleanup = parallaxScroll.mount!(el, parallaxScroll.defaults, ctx) as () => void;
    expect(el.style.translate).toBe('0px 0px');
    el.layout.top = 150; // content moved up by 100 → center 200, 100 above the canvas center
    listeners.get('scroll')!();
    dom.flush();
    expect(el.style.translate).toBe('0px 30px');
    cleanup();
    expect(listeners.has('scroll')).toBe(false);
  });
});
