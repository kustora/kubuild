import type { EffectRuntime } from '@kubuild/core';
import {
  MOBILE_QUERY,
  PIN_ATTRIBUTE,
  findScrollParent,
  getView,
  matchesMedia,
  renderScale,
  viewportBox,
} from '@kubuild/effect-kit/dom';

export type ScrollPinConfig = {
  /** Extra scroll the content stays pinned for, in viewport heights. */
  length: number;
  /** Sticky top offset (e.g. below a fixed header), CSS px. */
  offset: number;
  /** Make the pinned content at least one viewport tall. */
  fullHeight: boolean;
  disableOnMobile: boolean;
};

/**
 * Pins the section's first child while the section scrolls past: the child becomes
 * `position: sticky`, and the section grows by `length` viewports so there is room to hold
 * it. Scroll-linked animations inside with `scrollSource: 'pinned-section'` follow the pin's
 * progress (0 when it sticks, 1 when it lets go), which is how scroll-scrubbed sequences are
 * built. Nothing is inserted into the DOM; every inline style is restored on cleanup.
 */
export const scrollPinRuntime: EffectRuntime<ScrollPinConfig> = {
  id: 'scroll-pin',
  reducedMotion: 'skip',
  mount(element, config) {
    if (config.disableOnMobile && matchesMedia(element, MOBILE_QUERY)) return;
    const pinned = element.firstElementChild as HTMLElement | null;
    const view = getView(element);
    if (!pinned || !('style' in pinned) || !view) return;

    const original = {
      minHeight: element.style.minHeight,
      position: pinned.style.position,
      top: pinned.style.top,
      marginBottom: pinned.style.marginBottom,
      pinnedMinHeight: pinned.style.minHeight,
      attribute: element.getAttribute(PIN_ATTRIBUTE),
    };
    element.setAttribute(PIN_ATTRIBUTE, String(config.offset));
    pinned.style.position = 'sticky';
    pinned.style.top = `${config.offset}px`;
    // In a flex column that centers its content, an auto bottom margin keeps the pinned
    // child at the top of the taller section, so the pin starts where the section does.
    pinned.style.marginBottom = 'auto';

    const scrollParent = findScrollParent(element);
    const layout = (): void => {
      const scale = renderScale(element);
      const viewportHeight = viewportBox(element, scrollParent).height / scale;
      if (config.fullHeight)
        pinned.style.minHeight = `${Math.max(0, viewportHeight - config.offset)}px`;
      element.style.minHeight = original.minHeight;
      const natural = element.getBoundingClientRect().height / scale;
      element.style.minHeight = `${Math.round(natural + config.length * viewportHeight)}px`;
    };
    layout();

    view.addEventListener('resize', layout, { passive: true });
    const observer =
      scrollParent && typeof view.ResizeObserver === 'function'
        ? new view.ResizeObserver(() => layout())
        : null;
    observer?.observe(scrollParent!);

    return () => {
      view.removeEventListener('resize', layout);
      observer?.disconnect();
      element.style.minHeight = original.minHeight;
      pinned.style.position = original.position;
      pinned.style.top = original.top;
      pinned.style.marginBottom = original.marginBottom;
      pinned.style.minHeight = original.pinnedMinHeight;
      if (original.attribute === null) element.removeAttribute(PIN_ATTRIBUTE);
      else element.setAttribute(PIN_ATTRIBUTE, original.attribute);
    };
  },
};
