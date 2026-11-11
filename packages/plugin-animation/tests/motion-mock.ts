/**
 * Recorder standing in for Motion: `animateValue` calls are kept with their options so a test
 * can push progress through `onUpdate`; `inView` / `hover` hand back their callbacks so a
 * test can play "scrolled into view" or "pointer entered". Use with
 * `vi.mock('motion', () => import('./motion-mock.js'))`.
 */
type Options = Record<string, unknown> & { onUpdate?: (t: number) => void; autoplay?: boolean };
type Recorded = { from: number; to: number; options: Options; stopped: boolean; paused: boolean };

export const recorded = {
  animations: [] as Recorded[],
  inView: [] as Array<{ onStart: () => void | (() => void); options: unknown; stopped: boolean }>,
  hover: [] as Array<{ onStart: () => void | (() => void); stopped: boolean }>,
  reset() {
    this.animations = [];
    this.inView = [];
    this.hover = [];
  },
};

export function animateValue({
  keyframes: [from, to],
  ...options
}: Options & { keyframes: number[] }) {
  const record: Recorded = {
    from,
    to,
    options,
    stopped: false,
    paused: options.autoplay === false,
  };
  recorded.animations.push(record);
  return {
    stop: () => (record.stopped = true),
    pause: () => (record.paused = true),
    play: () => (record.paused = false),
  };
}

export function inView(_el: unknown, onStart: () => void | (() => void), options?: unknown) {
  const record = { onStart, options, stopped: false };
  recorded.inView.push(record);
  return () => (record.stopped = true);
}

export function hover(_el: unknown, onStart: () => void | (() => void)) {
  const record = { onStart, stopped: false };
  recorded.hover.push(record);
  return () => (record.stopped = true);
}
