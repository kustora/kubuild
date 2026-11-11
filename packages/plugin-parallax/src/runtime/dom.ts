import type { Box } from './math.js';

/**
 * DOM plumbing shared by the plugins. Everything resolves the window through the element's
 * own document, so effects keep working when the editor renders the canvas in an iframe.
 */

export function getView(element: HTMLElement): (Window & typeof globalThis) | null {
  return (element.ownerDocument?.defaultView as (Window & typeof globalThis) | null) ?? null;
}

export function matchesMedia(element: HTMLElement, query: string): boolean {
  const view = getView(element);
  return typeof view?.matchMedia === 'function' ? view.matchMedia(query).matches : false;
}

export const MOBILE_QUERY = '(max-width: 767px)';
export const COARSE_POINTER_QUERY = '(hover: none), (pointer: coarse)';

const SCROLLABLE = /(auto|scroll|overlay)/;

/**
 * Nearest ancestor that actually scrolls, or `null` for the window. The editor canvas
 * scrolls inside a container rather than the page, and parallax must follow whichever one
 * moves the element.
 */
export function findScrollParent(element: HTMLElement): HTMLElement | null {
  const view = getView(element);
  if (!view) return null;
  let current = element.parentElement;
  while (current && current !== element.ownerDocument.body && current !== element.ownerDocument.documentElement) {
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
 * Measures the element's layout box without the transforms the effects themselves apply
 * (`translate`/`scale`/`rotate`), so parallax math doesn't feed back into itself.
 */
export function untransformedBox(element: HTMLElement): Box {
  const rect = element.getBoundingClientRect();
  const { translate } = element.style;
  let dx = 0;
  let dy = 0;
  if (translate && translate !== 'none') {
    const [x = '0', y = '0'] = translate.split(/\s+/);
    dx = parseFloat(x) || 0;
    dy = parseFloat(y) || 0;
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
