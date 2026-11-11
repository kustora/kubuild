import type { EffectRuntime } from '@kubuild/core';
import { COARSE_POINTER_QUERY, getView, matchesMedia } from '../runtime/dom.js';
import { normalizedPointer } from '../runtime/math.js';
import { createMotionChannel } from '../runtime/motion.js';

export type PointerParallaxConfig = {
  /** Maximum shift in px when the pointer reaches the edge of the window. */
  strength: number;
  /** Move away from the pointer instead of towards it (reads as a deeper layer). */
  invert: boolean;
};

export const pointerParallaxRuntime: EffectRuntime<PointerParallaxConfig> = {
  id: 'pointer-parallax',
  reducedMotion: 'skip',
  mount(element, config) {
    const view = getView(element);
    // Touch screens have no hover position to follow.
    if (!view || matchesMedia(element, COARSE_POINTER_QUERY)) return;

    const channel = createMotionChannel(element);
    const direction = config.invert ? -1 : 1;
    let frame = 0;
    let pointer: { x: number; y: number } | null = null;

    const apply = (): void => {
      frame = 0;
      if (!pointer) {
        channel.set({});
        return;
      }
      channel.set({ x: pointer.x * config.strength * direction, y: pointer.y * config.strength * direction });
    };
    const schedule = (): void => {
      if (!frame) frame = view.requestAnimationFrame(apply);
    };
    const onMove = (event: PointerEvent): void => {
      pointer = normalizedPointer(event.clientX, event.clientY, {
        left: 0,
        top: 0,
        width: view.innerWidth,
        height: view.innerHeight,
      });
      schedule();
    };
    const onLeave = (): void => {
      pointer = null;
      schedule();
    };

    const root = element.ownerDocument.documentElement;
    view.addEventListener('pointermove', onMove, { passive: true });
    root.addEventListener('pointerleave', onLeave);

    return () => {
      view.removeEventListener('pointermove', onMove);
      root.removeEventListener('pointerleave', onLeave);
      if (frame) view.cancelAnimationFrame(frame);
      channel.release();
    };
  },
};
