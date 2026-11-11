// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { recorded } from './motion-mock.js';

vi.mock('motion', () => import('./motion-mock.js'));

const {
  animateTimeline,
  animateText,
  animateCounter,
  animateDraw,
  scrollPin,
  sampleTimeline,
  staggeredProgress,
  easeCurve,
  parseCounterText,
  formatCounter,
} = await import('../src/index.js');
const { normalizeSteps } = await import('../src/plugins/animate-timeline.runtime.js');
const { PIN_ATTRIBUTE } = await import('@kubuild/effect-kit/dom');

const ctx = { nodeId: 'n', mode: 'runtime' as const, reducedMotion: false };
const progress = (index: number, t: number): void =>
  recorded.animations[index].options.onUpdate!(t);
const html = (markup: string): HTMLElement => {
  const host = document.createElement('div');
  host.innerHTML = markup;
  document.body.appendChild(host);
  return host.firstElementChild as HTMLElement;
};
/** happy-dom does no layout; give an element the box a browser would. */
const box = (el: Element, rect: { top: number; height: number }) => {
  el.getBoundingClientRect = () =>
    ({
      ...rect,
      left: 0,
      width: 300,
      bottom: rect.top + rect.height,
      right: 300,
      x: 0,
      y: rect.top,
      toJSON() {},
    }) as DOMRect;
};

beforeEach(() => {
  recorded.reset();
  document.body.innerHTML = '';
  Object.defineProperty(window, 'innerHeight', { value: 1000, configurable: true });
});

describe('timeline generator', () => {
  const steps = [
    { at: 0, y: 100, opacity: 0 },
    { at: 0.5, y: 0, opacity: 1, ease: 'ease-out' as const },
    { at: 1, x: 50, ease: 'hold' as const },
  ];

  it('samples each segment with the arriving step’s easing', () => {
    expect(sampleTimeline(steps, 0)).toMatchObject({ y: 100, opacity: 0 });
    expect(sampleTimeline(steps, 0.25).y).toBeCloseTo(100 * (1 - easeCurve('ease-out', 0.5)));
    expect(sampleTimeline(steps, 0.9)).toMatchObject({ x: 0, y: 0 }); // hold until the step
    expect(sampleTimeline(steps, 1)).toMatchObject({ x: 50, y: 0, opacity: 1 });
  });

  it('holds outside its steps but lets a spring overshoot past the end', () => {
    const late = [
      { at: 0.2, scale: 0.5 },
      { at: 1, scale: 1 },
    ];
    expect(sampleTimeline(late, 0).scale).toBe(0.5);
    expect(sampleTimeline(late, 1.1).scale).toBeCloseTo(1.0625);
  });

  it('splits scroll progress across staggered pieces', () => {
    // 3 pieces of 100 ms, 50 ms apart → total 200 ms; piece 1 runs 0.25..0.75.
    expect(staggeredProgress(0.25, 1, 3, 100, 50)).toBe(0);
    expect(staggeredProgress(0.5, 1, 3, 100, 50)).toBe(0.5);
    expect(staggeredProgress(1, 2, 3, 100, 50)).toBe(1);
  });

  it('drops malformed steps from an untrusted manifest', () => {
    expect(
      normalizeSteps([{ at: 2, x: 'evil' }, null, { at: 0.1, ease: 'bogus', y: 5 }, 'x']),
    ).toEqual([{ at: 0.1, y: 5 }, { at: 1 }]);
  });
});

describe('animate-timeline', () => {
  it('validates steps, sorts them and describes the keyframes field', () => {
    const parsed = animateTimeline.parse({
      steps: [
        { at: 1, x: 10 },
        { at: 0, x: 0 },
      ],
    });
    expect(parsed.success && parsed.config.steps.map((s) => s.at)).toEqual([0, 1]);
    expect(animateTimeline.parse({ steps: [{ at: 0 }] }).success).toBe(false);
    expect(animateTimeline.fields.find((f) => f.key === 'steps')).toMatchObject({
      type: 'keyframes',
      minSteps: 2,
    });
  });

  it('plays the timeline in view, looping back and forth when asked', () => {
    const el = html('<div></div>');
    const cleanup = animateTimeline.mount!(
      el,
      { ...animateTimeline.defaults, loop: true, alternate: true },
      ctx,
    ) as () => void;
    expect(el.style.opacity).toBe('0');
    recorded.inView[0].onStart();
    expect(recorded.animations[0].options).toMatchObject({
      repeat: Infinity,
      repeatType: 'mirror',
      ease: 'linear',
      duration: 1200,
    });
    progress(0, 0.5);
    expect(el.style.translate).toBe('');
    expect(el.style.scale).toBe('1.08');
    cleanup();
    expect(el.style.scale).toBe('');
  });

  it('scrubs with scroll inside a pinned section', () => {
    const section = html('<section><div><p>a</p></div></section>');
    const content = section.firstElementChild as HTMLElement;
    const child = content.firstElementChild as HTMLElement;
    box(section, { top: -500, height: 3000 });
    box(content, { top: 0, height: 1000 });
    box(child, { top: 100, height: 100 });
    section.setAttribute(PIN_ATTRIBUTE, '0');
    // Pin progress = 500 / (3000 - 1000) = 0.25; the timeline window 0..0.5 → t = 0.5.
    animateTimeline.mount!(
      child,
      {
        ...animateTimeline.defaults,
        trigger: 'scroll',
        scrollSource: 'pinned-section',
        scrollStart: 0,
        scrollEnd: 0.5,
        steps: [
          { at: 0, x: 0 },
          { at: 1, x: 200 },
        ],
      },
      ctx,
    );
    expect(child.style.translate).toBe('100px 0px');
  });
});

describe('animate-text', () => {
  it('splits words into hidden pieces, reads the full text to screen readers and restores the same nodes', () => {
    const el = html('<h2>Hello <strong>big</strong> world</h2>');
    const strongText = el.querySelector('strong')!.firstChild;
    const cleanup = animateText.mount!(el, animateText.defaults, ctx) as () => void;

    const pieces = el.querySelectorAll('span[aria-hidden="true"]');
    expect(pieces).toHaveLength(3);
    expect(el.firstElementChild!.textContent).toBe('Hello big world');
    expect((pieces[0] as HTMLElement).style.opacity).toBe('0');

    recorded.inView[0].onStart();
    expect(recorded.animations.map((a) => a.options.delay)).toEqual([0, 60, 120]);
    progress(1, 1);
    expect((pieces[1] as HTMLElement).style.opacity).toBe('');

    cleanup();
    expect(el.innerHTML).toBe('Hello <strong>big</strong> world');
    expect(el.querySelector('strong')!.firstChild).toBe(strongText);
  });

  it('types letter by letter, keeping words unbreakable', () => {
    const el = html('<p>Hi you</p>');
    animateText.mount!(
      el,
      {
        ...animateText.defaults,
        split: 'char',
        preset: 'typewriter',
        trigger: 'load',
        stagger: 50,
      },
      ctx,
    );
    const letters = Array.from(el.querySelectorAll('span[aria-hidden] > span')) as HTMLElement[];
    expect(letters.map((l) => l.textContent)).toEqual(['H', 'i', 'y', 'o', 'u']);
    expect(recorded.animations.map((a) => a.options.delay)).toEqual([0, 50, 100, 150, 200]);
    progress(2, 0.01);
    expect(letters[2].style.opacity).toBe('');
    expect(letters[3].style.opacity).toBe('0');
  });
});

describe('animate-counter', () => {
  it.each([
    ['12,500+', 0.5, '6,250+'],
    ['Rp 1.250.000', 0.5, 'Rp 625.000'],
    ['98.6%', 0.5, '49.3%'],
    ['4,8/5', 1, '4,8/5'],
    ['$1,234.56', 0.25, '$308.64'],
    ['Top 10 20', 0.5, 'Top 5 20'],
  ])('counts %s', (text, t, expected) => {
    const format = parseCounterText(text)!;
    expect(formatCounter(format.value * t, format)).toBe(expected);
  });

  it('leaves text without digits alone', () => {
    expect(parseCounterText('Many happy users')).toBeNull();
    const el = html('<p>Many</p>');
    expect(animateCounter.mount!(el, animateCounter.defaults, ctx)).toBeUndefined();
  });

  it('counts the text node in place and restores it', () => {
    const el = html('<div><span>12,500+</span> users</div>');
    const cleanup = animateCounter.mount!(el, animateCounter.defaults, ctx) as () => void;
    expect(el.textContent).toBe('0+ users');
    expect(el.querySelector('span')!.style.fontVariantNumeric).toBe('tabular-nums');
    recorded.inView[0].onStart();
    progress(0, 0.5);
    expect(el.textContent).toBe('6,250+ users');
    cleanup();
    expect(el.textContent).toBe('12,500+ users');
    expect(el.querySelector('span')!.style.fontVariantNumeric).toBe('');
  });
});

describe('animate-draw', () => {
  it('draws each stroke by its length and restores the dash styles', () => {
    const el = html(
      '<div><svg><path d="M0 0L100 0"/><line x1="0" y1="0" x2="0" y2="40" pathLength="1"/></svg></div>',
    );
    const [path, line] = Array.from(
      el.querySelectorAll('path, line'),
    ) as unknown as Array<SVGGeometryElement>;
    path.getTotalLength = () => 100;
    line.getTotalLength = () => 40;
    const cleanup = animateDraw.mount!(
      el,
      { ...animateDraw.defaults, stagger: 200 },
      ctx,
    ) as () => void;
    expect(path.style.strokeDasharray).toBe('100 100');
    expect(line.style.strokeDasharray).toBe('1 1'); // declared pathLength wins
    expect(path.style.strokeDashoffset).toBe('100');
    recorded.inView[0].onStart();
    expect(recorded.animations.map((a) => a.options.delay)).toEqual([0, 200]);
    progress(0, 0.25);
    expect(path.style.strokeDashoffset).toBe('75');
    cleanup();
    expect(path.style.strokeDasharray).toBe('');
    expect(path.style.strokeDashoffset).toBe('');
  });

  it('finds shapes rendered into an open shadow root', () => {
    const host = html('<div></div>');
    host.attachShadow({ mode: 'open' }).innerHTML = '<svg><path d="M0 0L10 0"/></svg>';
    const path = host.shadowRoot!.querySelector('path') as unknown as SVGGeometryElement;
    path.getTotalLength = () => 10;
    animateDraw.mount!(host, animateDraw.defaults, ctx);
    expect(path.style.strokeDashoffset).toBe('10');
  });
});

describe('scroll-pin', () => {
  it('makes the first child sticky inside a section grown by the pin length, then restores', () => {
    const section = html(
      '<section style="min-height: 10px"><div>content</div><p>more</p></section>',
    );
    const content = section.firstElementChild as HTMLElement;
    box(section, { top: 0, height: 800 });
    const cleanup = scrollPin.mount!(
      section,
      { ...scrollPin.defaults, length: 2, offset: 64 },
      ctx,
    ) as () => void;
    expect(content.style.position).toBe('sticky');
    expect(content.style.top).toBe('64px');
    expect(content.style.minHeight).toBe('936px');
    expect(section.style.minHeight).toBe('2800px');
    expect(section.getAttribute(PIN_ATTRIBUTE)).toBe('64');
    cleanup();
    expect(section.style.minHeight).toBe('10px');
    expect(content.getAttribute('style') ?? '').toBe('');
    expect(section.hasAttribute(PIN_ATTRIBUTE)).toBe(false);
  });
});
