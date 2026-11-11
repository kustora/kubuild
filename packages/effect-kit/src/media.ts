/**
 * Window lookups shared by effect runtimes. Everything resolves the window through the
 * element's own document, so effects keep working when the editor renders the canvas in an
 * iframe.
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
