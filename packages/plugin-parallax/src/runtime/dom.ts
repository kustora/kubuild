/** Scroll and layout plumbing shared by the parallax plugins. */
import { EFFECT_SCROLL_VIEWPORT_ATTRIBUTE } from '@kubuild/core/effect-manifest';
import { getView } from '@kubuild/effect-kit/dom';
import type { Box } from './math.js';

export { getView, matchesMedia, MOBILE_QUERY, COARSE_POINTER_QUERY } from '@kubuild/effect-kit/dom';

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
  while (current && current !== element.ownerDocument.body && current !== element.ownerDocument.documentElement) {
    if (current.hasAttribute?.(EFFECT_SCROLL_VIEWPORT_ATTRIBUTE)) return current;
    const style = view.getComputedStyle(current);
    if (SCROLLABLE.test(style.overflowY + style.overflowX) && current.scrollHeight > current.clientHeight) {
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
