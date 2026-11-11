/**
 * Just enough window/document/element surface for the runtimes: rects, inline styles,
 * matchMedia, rAF and listeners. `getBoundingClientRect` adds the element's current inline
 * `translate`, like a real browser, so the runtimes' untransformed measuring is exercised.
 */
type Listener = (event: unknown) => void;

function listenerTarget() {
  const listeners = new Map<string, Set<Listener>>();
  return {
    addEventListener(type: string, fn: Listener) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)!.add(fn);
    },
    removeEventListener(type: string, fn: Listener) {
      listeners.get(type)?.delete(fn);
    },
    dispatch(type: string, event: unknown = {}) {
      for (const fn of listeners.get(type) ?? []) fn(event);
    },
    count(type: string) {
      return listeners.get(type)?.size ?? 0;
    },
  };
}

export function createFakeDom(options: { innerWidth?: number; innerHeight?: number; media?: string[] } = {}) {
  const media = new Set(options.media ?? []);
  let frames: Array<() => void> = [];
  const view = {
    ...listenerTarget(),
    innerWidth: options.innerWidth ?? 1200,
    innerHeight: options.innerHeight ?? 1000,
    matchMedia: (query: string) => ({ matches: media.has(query) }),
    requestAnimationFrame(cb: () => void) {
      frames.push(cb);
      return frames.length;
    },
    cancelAnimationFrame() {},
    getComputedStyle: () => ({ overflowX: 'visible', overflowY: 'visible' }),
  };
  const documentElement = listenerTarget();
  const doc = { defaultView: view, body: {}, documentElement };

  function element(layout: { top: number; height: number; left?: number; width?: number }) {
    const style = { translate: '', scale: '', rotate: '', opacity: '', backgroundPositionY: '' };
    const el = {
      layout,
      style,
      ownerDocument: doc,
      parentElement: null,
      getBoundingClientRect() {
        const [x = '0', y = '0'] = style.translate ? style.translate.split(/\s+/) : [];
        return {
          top: layout.top + (parseFloat(y) || 0),
          height: layout.height,
          left: (layout.left ?? 0) + (parseFloat(x) || 0),
          width: layout.width ?? 300,
        };
      },
    };
    return el as typeof el & HTMLElement;
  }

  return {
    view,
    documentElement,
    element,
    /** Runs the frames queued so far. */
    flush() {
      const pending = frames;
      frames = [];
      pending.forEach((cb) => cb());
    },
    /** Moves the element and fires a scroll, like the user scrolling the page. */
    scrollTo(el: { layout: { top: number } }, top: number) {
      el.layout.top = top;
      view.dispatch('scroll');
      this.flush();
    },
  };
}
