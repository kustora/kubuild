import type { EffectRuntime } from '@kubuild/core';
import type { ScrollSource } from '@kubuild/effect-kit/dom';
import { formatCounter, parseCounterText } from '../counter-format.js';
import type { AnimationEasing } from '../generator.js';
import { drive, type AnimationTrigger } from '../runtime/drive.js';

export type AnimateCounterConfig = {
  /** Value the count starts from; it ends at the number written in the text. */
  from: number;
  duration: number;
  delay: number;
  easing: AnimationEasing;
  trigger: AnimationTrigger;
  once: boolean;
  threshold: number;
  scrollStart: number;
  scrollEnd: number;
  scrollSource: ScrollSource;
};

function findNumberText(root: HTMLElement): Text | null {
  const stack: Node[] = [root];
  while (stack.length > 0) {
    const node = stack.shift()!;
    if (node.nodeType === 3 && /\d/.test((node as Text).data)) return node as Text;
    stack.unshift(...Array.from(node.childNodes));
  }
  return null;
}

/**
 * Counts the first number in the element's text up from `from`, keeping its prefix,
 * suffix, decimals and digit grouping ("Rp 1.250.000", "98.6%", "12,500+"). It edits the
 * text node in place and restores its exact text on cleanup.
 */
export const animateCounterRuntime: EffectRuntime<AnimateCounterConfig> = {
  id: 'animate-counter',
  reducedMotion: 'skip',
  mount(element, config) {
    const text = findNumberText(element);
    const format = text ? parseCounterText(text.data) : null;
    if (!text || !format) return;

    const original = text.data;
    const holder = text.parentElement;
    const originalNumeric = holder?.style.fontVariantNumeric ?? '';
    // Equal-width digits, so the text doesn't wobble while it counts.
    if (holder) holder.style.fontVariantNumeric = 'tabular-nums';

    const stop = drive(
      element,
      1,
      { ...config, stagger: 0, repeat: 0, alternate: false },
      (_index, t) => {
        text.data = formatCounter(config.from + (format.value - config.from) * t, format);
      },
    );
    return () => {
      stop();
      text.data = original;
      if (holder) holder.style.fontVariantNumeric = originalNumeric;
    };
  },
};
