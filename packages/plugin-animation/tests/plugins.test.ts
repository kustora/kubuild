import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createEffectRegistry } from '@kubuild/core';
import { createMotionChannel } from '@kubuild/effect-kit/dom';

/**
 * Motion is replaced by a recorder: each `animateValue` call is kept with its options so a test
 * can push progress through `onUpdate`, and `inView` / `hover` hand back their callbacks so
 * a test can play "scrolled into view" or "pointer entered".
 */
const motion = vi.hoisted(() => {
  type Recorded = {
    from: number;
    to: number;
    options: Record<string, unknown> & { onUpdate?: (t: number) => void };
    stopped: boolean;
    paused: boolean;
  };
  const state = {
    animations: [] as Recorded[],
    inView: [] as Array<{ onStart: () => void | (() => void); options: unknown; stopped: boolean }>,
    hover: [] as Array<{ onStart: () => void | (() => void); stopped: boolean }>,
  };
  return {
    state,
    reset() {
      state.animations = [];
      state.inView = [];
      state.hover = [];
    },
    animateValue({
      keyframes: [from, to],
      ...options
    }: Recorded['options'] & { keyframes: number[]; autoplay?: boolean }) {
      const record: Recorded = {
        from,
        to,
        options,
        stopped: false,
        paused: options.autoplay === false,
      };
      state.animations.push(record);
      return {
        stop: () => (record.stopped = true),
        pause: () => (record.paused = true),
        play: () => (record.paused = false),
      };
    },
    inView(_el: unknown, onStart: () => void | (() => void), options?: unknown) {
      const record = { onStart, options, stopped: false };
      state.inView.push(record);
      return () => (record.stopped = true);
    },
    hover(_el: unknown, onStart: () => void | (() => void)) {
      const record = { onStart, stopped: false };
      state.hover.push(record);
      return () => (record.stopped = true);
    },
  };
});

vi.mock('motion', () => ({
  animateValue: motion.animateValue,
  inView: motion.inView,
  hover: motion.hover,
}));

const { animationPlugins, animationRuntimes, animateEntrance, animateLoop, animateHover } =
  await import('../src/index.js');
const {
  entranceFrames,
  loopFrames,
  hoverFrames,
  sampleFrames,
  restlessPart,
  ENTRANCE_PRESETS,
  LOOP_PRESETS,
  HOVER_PRESETS,
} = await import('../src/generator.js');
const { progressTransition } = await import('../src/runtime/transition.js');

const ctx = { nodeId: 'n', mode: 'runtime' as const, reducedMotion: false };

function fakeElement(options: { media?: string[]; children?: HTMLElement[] } = {}): HTMLElement {
  const media = new Set(options.media ?? []);
  return {
    style: { translate: '', scale: '', rotate: '', opacity: '' },
    ownerDocument: { defaultView: { matchMedia: (q: string) => ({ matches: media.has(q) }) } },
    children: options.children ?? [],
  } as unknown as HTMLElement;
}

const progress = (index: number, t: number): void =>
  motion.state.animations[index].options.onUpdate!(t);

beforeEach(() => motion.reset());

describe('plugin definitions', () => {
  it('registers every plugin and exposes a matching runtime for each', () => {
    const registry = createEffectRegistry([...animationPlugins]);
    expect(registry.size).toBe(3);
    expect(animationRuntimes.map((r) => r.id)).toEqual(animationPlugins.map((p) => p.id));
    for (const plugin of animationPlugins) {
      expect(plugin.parse({})).toEqual({ success: true, config: plugin.defaults });
      expect(plugin.configJsonSchema).toMatchObject({ type: 'object' });
      for (const field of plugin.fields) expect(plugin.defaults).toHaveProperty(field.key);
    }
  });

  it('only accepts known presets and easings', () => {
    expect(animateEntrance.parse({ preset: 'explode' }).success).toBe(false);
    expect(animateHover.parse({ easing: 'cubic-bezier(0,0,1,1)' }).success).toBe(false);
    expect(animateLoop.parse({ preset: 'spin', duration: 1200 })).toMatchObject({
      success: true,
      config: { preset: 'spin', intensity: 1 },
    });
  });
});

describe('generator', () => {
  it('starts every entrance off-rest and ends at rest', () => {
    for (const preset of ENTRANCE_PRESETS) {
      const frames = entranceFrames(preset, 40);
      expect(restlessPart(sampleFrames(frames, 0))).not.toEqual({});
      expect(restlessPart(sampleFrames(frames, 1))).toEqual({});
    }
    expect(sampleFrames(entranceFrames('fade-left', 50), 0)).toMatchObject({ x: 50, opacity: 0 });
  });

  it('closes every loop so repeats are seamless', () => {
    for (const preset of LOOP_PRESETS) {
      const frames = loopFrames(preset, 1);
      const first = sampleFrames(frames, 0);
      const last = sampleFrames(frames, 1);
      // A full turn is the same pose as no turn.
      expect({ ...last, rotate: last.rotate % 360 }).toEqual(first);
    }
  });

  it('scales amplitude with intensity and rests at zero intensity', () => {
    expect(sampleFrames(loopFrames('float', 2), 0.5, { smooth: true }).y).toBe(-20);
    for (const preset of HOVER_PRESETS)
      expect(restlessPart(sampleFrames(hoverFrames(preset, 0), 1))).toEqual({});
  });

  it('extrapolates spring overshoot but keeps opacity and scale valid', () => {
    const frames = entranceFrames('pop', 0);
    const overshoot = sampleFrames(frames, 1.2);
    expect(overshoot.scale).toBeCloseTo(1.1);
    expect(overshoot.opacity).toBe(1);
    expect(sampleFrames(frames, -1).scale).toBe(0);
  });

  it('maps easings to Motion value-animation options (ms, spring visualDuration in s)', () => {
    expect(progressTransition('ease-out', 600, 100)).toEqual({
      delay: 100,
      duration: 600,
      ease: 'easeOut',
    });
    expect(progressTransition('bouncy', 500, 0)).toMatchObject({
      type: 'spring',
      visualDuration: 0.5,
    });
  });
});

describe('animate-entrance runtime', () => {
  it('hides the element until it is in view, then plays to rest and stops watching', () => {
    const el = fakeElement();
    const cleanup = animateEntrance.mount!(el, animateEntrance.defaults, ctx) as () => void;
    expect(el.style.opacity).toBe('0');
    expect(el.style.translate).toBe('0px 40px');
    expect(motion.state.inView[0].options).toEqual({ amount: 0.2 });

    motion.state.inView[0].onStart();
    expect(motion.state.inView[0].stopped).toBe(true); // once
    progress(0, 1);
    expect(el.style.opacity).toBe('');
    expect(el.style.translate).toBe('');

    cleanup();
    expect(motion.state.animations[0].stopped).toBe(true);
  });

  it('replays when not once, resetting as the element leaves', () => {
    const el = fakeElement();
    animateEntrance.mount!(el, { ...animateEntrance.defaults, once: false }, ctx);
    const onLeave = motion.state.inView[0].onStart() as () => void;
    progress(0, 1);
    expect(el.style.opacity).toBe('');
    onLeave();
    expect(motion.state.animations[0].stopped).toBe(true);
    expect(el.style.opacity).toBe('0');
  });

  it('staggers children with increasing delays', () => {
    const children = [fakeElement(), fakeElement(), fakeElement()];
    const parent = fakeElement({ children });
    animateEntrance.mount!(parent, { ...animateEntrance.defaults, stagger: 100, delay: 50 }, ctx);
    expect(parent.style.opacity).toBe('');
    expect(children.map((c) => c.style.opacity)).toEqual(['0', '0', '0']);
    motion.state.inView[0].onStart();
    expect(motion.state.animations.map((a) => a.options.delay)).toEqual([50, 150, 250]);
  });

  it('composes with another effect on the same element and restores it on cleanup', () => {
    const el = fakeElement();
    el.style.opacity = '0.9';
    const other = createMotionChannel(el);
    other.set({ y: 10 });
    const cleanup = animateEntrance.mount!(el, animateEntrance.defaults, ctx) as () => void;
    expect(el.style.translate).toBe('0px 50px');
    cleanup();
    expect(el.style.translate).toBe('0px 10px');
    other.release();
    expect(el.style.opacity).toBe('0.9');
  });

  it('stays put on mobile when asked', () => {
    const el = fakeElement({ media: ['(max-width: 767px)'] });
    animateEntrance.mount!(el, { ...animateEntrance.defaults, disableOnMobile: true }, ctx);
    expect(el.style.opacity).toBe('');
    expect(motion.state.inView).toHaveLength(0);
  });
});

describe('animate-loop runtime', () => {
  it('repeats forever, only while in view', () => {
    const el = fakeElement();
    const cleanup = animateLoop.mount!(
      el,
      { ...animateLoop.defaults, duration: 2000 },
      ctx,
    ) as () => void;
    const loop = motion.state.animations[0];
    expect(loop.options).toMatchObject({ duration: 2000, repeat: Infinity, ease: 'linear' });
    expect(loop.paused).toBe(true);

    const onLeave = motion.state.inView[0].onStart() as () => void;
    expect(loop.paused).toBe(false);
    progress(0, 0.5);
    expect(el.style.translate).toBe('0px -10px');
    onLeave();
    expect(loop.paused).toBe(true);

    cleanup();
    expect(loop.stopped).toBe(true);
    expect(el.style.translate).toBe('');
  });
});

describe('animate-hover runtime', () => {
  it('animates in on hover and reverses from the current progress on leave', () => {
    const el = fakeElement();
    const cleanup = animateHover.mount!(el, animateHover.defaults, ctx) as () => void;
    const onLeave = motion.state.hover[0].onStart() as () => void;
    progress(0, 0.5);
    expect(el.style.translate).toBe('0px -3px');

    onLeave();
    expect(motion.state.animations[0].stopped).toBe(true);
    expect(motion.state.animations[1]).toMatchObject({ from: 0.5, to: 0 });
    progress(1, 0);
    expect(el.style.translate).toBe('');

    cleanup();
    expect(motion.state.hover[0].stopped).toBe(true);
  });
});
