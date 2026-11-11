/**
 * Scroll and layout plumbing shared by scroll-linked effects. Everything resolves the window
 * through the element's own document and follows the element's real scroll container, so
 * effects behave the same on a published page and inside the editor canvas.
 */
import { EFFECT_SCROLL_VIEWPORT_ATTRIBUTE } from '@kubuild/core/effect-manifest';
import { getView } from './media.js';

export interface Box {
  top: number;
  height: number;
  left?: number;
  width?: number;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * How far an element has travelled through the viewport: 0 while its top edge sits on the
 * viewport's bottom edge (just entering), 1 when its bottom edge reaches the viewport's top
 * edge (just left). Clamped outside that range.
 */
export function scrollProgress(element: Box, viewport: Box): number {
  const travel = viewport.height + element.height;
  if (travel <= 0) return 0;
  const viewportBottom = viewport.top + viewport.height;
  return clamp((viewportBottom - element.top) / travel, 0, 1);
}

const SCROLLABLE = /(auto|scroll|overlay)/;

/**
 * Nearest ancestor that actually scrolls (or is marked as the effects' viewport, see
 * `EFFECT_SCROLL_VIEWPORT_ATTRIBUTE`), or `null` for the window. The editor canvas moves
 * content inside a container rather than the page, and parallax must follow whichever one
 * moves the element.
 */
export function findScrollParent(element: HTMLElement): HTMLElement | null {
  const view = getView(element);
  if (!view) return null;
  let current = element.parentElement;
  while (
    current &&
    current !== element.ownerDocument.body &&
    current !== element.ownerDocument.documentElement
  ) {
    if (current.hasAttribute?.(EFFECT_SCROLL_VIEWPORT_ATTRIBUTE)) return current;
    const style = view.getComputedStyle(current);
    if (
      SCROLLABLE.test(style.overflowY + style.overflowX) &&
      current.scrollHeight > current.clientHeight
    ) {
      return current;
    }
    current = current.parentElement;
  }
  return null;
}

export function viewportBox(element: HTMLElement, scrollParent: HTMLElement | null): Box {
  if (scrollParent) {
    const rect = scrollParent.getBoundingClientRect();
    return { top: rect.top, height: rect.height, left: rect.left, width: rect.width };
  }
  const view = getView(element);
  return { top: 0, height: view?.innerHeight ?? 0, left: 0, width: view?.innerWidth ?? 0 };
}

/**
 * Screen pixels per CSS pixel around the element: 1 on a normal page, the zoom factor
 * inside a scaled container such as the editor canvas. Measured on the parent, because the
 * element's own `scale` (which effects may set) would distort it.
 */
export function renderScale(element: HTMLElement): number {
  const parent = element.parentElement;
  if (!parent || !(parent.offsetWidth > 0)) return 1;
  const scale = parent.getBoundingClientRect().width / parent.offsetWidth;
  return Number.isFinite(scale) && scale > 0 ? scale : 1;
}

/**
 * Measures the element's layout box without the transforms the effects themselves apply
 * (`translate`/`scale`/`rotate`), so parallax math doesn't feed back into itself.
 */
export function untransformedBox(element: HTMLElement, scale = 1): Box {
  const rect = element.getBoundingClientRect();
  const { translate } = element.style;
  let dx = 0;
  let dy = 0;
  if (translate && translate !== 'none') {
    const [x = '0', y = '0'] = translate.split(/\s+/);
    // The inline translate is in CSS px; on screen it is multiplied by any ancestor scale.
    dx = (parseFloat(x) || 0) * scale;
    dy = (parseFloat(y) || 0) * scale;
  }
  return { top: rect.top - dy, height: rect.height, left: rect.left - dx, width: rect.width };
}

/**
 * Calls `onFrame` at most once per animation frame while the element's scroll container
 * scrolls or the window resizes, plus once immediately. Returns the unsubscribe function.
 */
export function onScrollFrame(
  element: HTMLElement,
  onFrame: (scrollParent: HTMLElement | null) => void,
): () => void {
  const view = getView(element);
  if (!view) return () => {};
  const scrollParent = findScrollParent(element);
  const target: EventTarget = scrollParent ?? view;
  let frame = 0;

  const schedule = (): void => {
    if (frame) return;
    frame = view.requestAnimationFrame(() => {
      frame = 0;
      onFrame(scrollParent);
    });
  };

  target.addEventListener('scroll', schedule, { passive: true });
  view.addEventListener('resize', schedule, { passive: true });
  onFrame(scrollParent);

  return () => {
    target.removeEventListener('scroll', schedule);
    view.removeEventListener('resize', schedule);
    if (frame) view.cancelAnimationFrame(frame);
  };
}

/**
 * Marks a section pinned by a pin effect (`scroll-pin`): its first child sticks while the
 * section scrolls past. The value is the sticky top offset in CSS px. Scroll-linked effects
 * inside the section can follow the pin's progress instead of their own position, which no
 * longer changes while they are stuck.
 */
export const PIN_ATTRIBUTE = 'data-kb-pin';

/**
 * How far a pinned section has been scrolled through: 0 when its content first sticks, 1
 * when it is released. Measured from the section (the track) and its first child (the stuck
 * content), so it works whatever else moves inside.
 */
export function pinProgress(track: HTMLElement, viewport: Box): number {
  const pinned = track.firstElementChild as HTMLElement | null;
  if (!pinned) return 0;
  const offset = (parseFloat(track.getAttribute(PIN_ATTRIBUTE) ?? '') || 0) * renderScale(pinned);
  const trackRect = track.getBoundingClientRect();
  const travel = trackRect.height - pinned.getBoundingClientRect().height;
  if (travel <= 0) return 0;
  return clamp((viewport.top + offset - trackRect.top) / travel, 0, 1);
}

export type ScrollSource = 'self' | 'pinned-section';

/**
 * Scroll progress (0..1) driving a scroll-linked effect: the element's own trip through the
 * viewport (`scrollProgress`), or the progress of the pinned section it sits in. Falls back
 * to its own trip when there is no pinned ancestor.
 */
export function sourceProgress(
  element: HTMLElement,
  scrollParent: HTMLElement | null,
  source: ScrollSource,
): number {
  const viewport = viewportBox(element, scrollParent);
  if (source === 'pinned-section') {
    const track = element.closest?.(`[${PIN_ATTRIBUTE}]`) as HTMLElement | null;
    if (track) return pinProgress(track, viewport);
  }
  return scrollProgress(untransformedBox(element, renderScale(element)), viewport);
}
