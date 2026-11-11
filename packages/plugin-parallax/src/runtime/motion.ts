/**
 * Per-element motion compositor.
 *
 * Several effects may move the same node (a section with both `parallax-scroll` and
 * `scroll-transform`), and the node's own styles may already use `transform`. Effects
 * therefore write only the individual transform properties (`translate`, `scale`, `rotate`)
 * plus `opacity`, and every effect contributes a *part* that is combined here — translations
 * add, scales and opacities multiply, rotations add. When the last part is released the
 * element's original inline values are restored exactly.
 */

export interface MotionPart {
  x?: number;
  y?: number;
  scale?: number;
  rotate?: number;
  opacity?: number;
}

interface MotionState {
  parts: Map<symbol, MotionPart>;
  original: { translate: string; scale: string; rotate: string; opacity: string };
}

const states = new WeakMap<HTMLElement, MotionState>();

function write(element: HTMLElement, state: MotionState): void {
  let x = 0;
  let y = 0;
  let scale = 1;
  let rotate = 0;
  let opacity: number | undefined;
  let moves = false;
  for (const part of state.parts.values()) {
    if (part.x !== undefined || part.y !== undefined) moves = true;
    x += part.x ?? 0;
    y += part.y ?? 0;
    if (part.scale !== undefined) scale *= part.scale;
    if (part.rotate !== undefined) rotate += part.rotate;
    if (part.opacity !== undefined) opacity = (opacity ?? 1) * part.opacity;
  }
  const round = (n: number): number => Math.round(n * 100) / 100;
  element.style.translate = moves ? `${round(x)}px ${round(y)}px` : state.original.translate;
  element.style.scale = scale !== 1 ? String(round(scale * 1000) / 1000) : state.original.scale;
  element.style.rotate = rotate !== 0 ? `${round(rotate)}deg` : state.original.rotate;
  element.style.opacity = opacity !== undefined ? String(round(opacity * 1000) / 1000) : state.original.opacity;
}

/** Registers one effect's channel on an element. `set` updates its part; `release` removes it. */
export function createMotionChannel(element: HTMLElement): {
  set(part: MotionPart): void;
  release(): void;
} {
  const key = Symbol('motion-part');
  let state = states.get(element);
  if (!state) {
    state = {
      parts: new Map(),
      original: {
        translate: element.style.translate,
        scale: element.style.scale,
        rotate: element.style.rotate,
        opacity: element.style.opacity,
      },
    };
    states.set(element, state);
  }
  const owned = state;
  owned.parts.set(key, {});

  return {
    set(part) {
      owned.parts.set(key, part);
      write(element, owned);
    },
    release() {
      owned.parts.delete(key);
      write(element, owned);
      if (owned.parts.size === 0) states.delete(element);
    },
  };
}
