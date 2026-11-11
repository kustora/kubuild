import type { EffectRuntime } from '@kubuild/core';
import type { ScrollSource } from '@kubuild/effect-kit/dom';
import type { AnimationEasing } from '../generator.js';
import { drive, type AnimationTrigger } from '../runtime/drive.js';

export type AnimateDrawConfig = {
  duration: number;
  delay: number;
  easing: AnimationEasing;
  /** Gap between consecutive shapes, ms. */
  stagger: number;
  trigger: AnimationTrigger;
  once: boolean;
  threshold: number;
  scrollStart: number;
  scrollEnd: number;
  scrollSource: ScrollSource;
};

const SHAPES = 'path, line, polyline, polygon, circle, ellipse, rect';

type Shape = SVGGeometryElement;

/**
 * Shapes inside the element, including those rendered into open shadow roots (the HTML
 * embed component isolates its markup in one), in document order.
 */
function findShapes(root: Element): Element[] {
  if (root.matches?.(SHAPES)) return [root];
  const found: Element[] = [];
  const visit = (scope: Element | ShadowRoot): void => {
    for (const el of Array.from(scope.querySelectorAll?.('*') ?? [])) {
      if (el.matches(SHAPES)) found.push(el);
      if (el.shadowRoot) visit(el.shadowRoot);
    }
  };
  if (root.shadowRoot) visit(root.shadowRoot);
  visit(root);
  return found;
}

function strokeLength(shape: Shape): number {
  const declared = Number(shape.getAttribute('pathLength'));
  if (declared > 0) return declared;
  try {
    return shape.getTotalLength();
  } catch {
    return 0;
  }
}

/**
 * Draws the strokes of the SVG shapes inside the element (or of the element itself), in
 * document order, by animating `stroke-dashoffset`. Only stroked shapes show anything.
 */
export const animateDrawRuntime: EffectRuntime<AnimateDrawConfig> = {
  id: 'animate-draw',
  reducedMotion: 'skip',
  mount(element, config) {
    const shapes = findShapes(element)
      .filter((el): el is Shape => typeof (el as Shape).getTotalLength === 'function')
      .map((shape) => ({ shape, length: strokeLength(shape) }))
      .filter(({ length }) => length > 0);
    if (shapes.length === 0) return;

    const originals = shapes.map(({ shape }) => ({
      dasharray: shape.style.strokeDasharray,
      dashoffset: shape.style.strokeDashoffset,
    }));
    for (const { shape, length } of shapes) shape.style.strokeDasharray = `${length} ${length}`;

    const stop = drive(
      element,
      shapes.length,
      { ...config, repeat: 0, alternate: false },
      (index, t) => {
        const { shape, length } = shapes[index];
        shape.style.strokeDashoffset = String(
          Math.round(length * (1 - Math.min(1, Math.max(0, t))) * 100) / 100,
        );
      },
    );
    return () => {
      stop();
      shapes.forEach(({ shape }, i) => {
        shape.style.strokeDasharray = originals[i].dasharray;
        shape.style.strokeDashoffset = originals[i].dashoffset;
      });
    };
  },
};
