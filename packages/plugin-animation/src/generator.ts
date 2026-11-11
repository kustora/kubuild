/**
 * The animation generator: turns a preset name plus a couple of knobs (distance,
 * intensity) into motion keyframes. Pure data — no DOM, no Motion — so the editor, the AI
 * and the tests see exactly the frames the runtime plays.
 *
 * Frames are `MotionPart`s, the vocabulary of the shared motion compositor, so generated
 * animations compose with every other effect on the same element (parallax, scroll
 * transforms, another animation).
 */
import type { MotionPart } from '@kubuild/effect-kit/dom';

export type Frames = readonly MotionPart[];

export const IDENTITY_FRAME: Required<MotionPart> = { x: 0, y: 0, scale: 1, rotate: 0, opacity: 1 };

export const ENTRANCE_PRESETS = [
  'fade',
  'fade-up',
  'fade-down',
  'fade-left',
  'fade-right',
  'slide-up',
  'slide-down',
  'slide-left',
  'slide-right',
  'zoom-in',
  'zoom-out',
  'pop',
  'rotate-in',
] as const;
export type EntrancePreset = (typeof ENTRANCE_PRESETS)[number];

export const LOOP_PRESETS = [
  'float',
  'bounce',
  'pulse',
  'breathe',
  'spin',
  'wiggle',
  'swing',
  'shake',
  'heartbeat',
  'blink',
] as const;
export type LoopPreset = (typeof LOOP_PRESETS)[number];

export const HOVER_PRESETS = ['lift', 'grow', 'shrink', 'tilt', 'push', 'nudge', 'dim'] as const;
export type HoverPreset = (typeof HOVER_PRESETS)[number];

export const ANIMATION_EASINGS = [
  'ease-out',
  'ease-in-out',
  'ease-in',
  'linear',
  'back-out',
  'spring',
  'bouncy',
] as const;
export type AnimationEasing = (typeof ANIMATION_EASINGS)[number];

/** Human labels for every preset and easing, shared by the editor fields and the AI catalog. */
export const PRESET_LABELS: Record<
  EntrancePreset | LoopPreset | HoverPreset | AnimationEasing,
  string
> = {
  fade: 'Fade',
  'fade-up': 'Fade up',
  'fade-down': 'Fade down',
  'fade-left': 'Fade left',
  'fade-right': 'Fade right',
  'slide-up': 'Slide up',
  'slide-down': 'Slide down',
  'slide-left': 'Slide left',
  'slide-right': 'Slide right',
  'zoom-in': 'Zoom in',
  'zoom-out': 'Zoom out',
  pop: 'Pop',
  'rotate-in': 'Rotate in',
  float: 'Float',
  bounce: 'Bounce',
  pulse: 'Pulse',
  breathe: 'Breathe',
  spin: 'Spin',
  wiggle: 'Wiggle',
  swing: 'Swing',
  shake: 'Shake',
  heartbeat: 'Heartbeat',
  blink: 'Blink',
  lift: 'Lift',
  grow: 'Grow',
  shrink: 'Shrink',
  tilt: 'Tilt',
  push: 'Push',
  nudge: 'Nudge',
  dim: 'Dim',
  'ease-out': 'Ease out',
  'ease-in-out': 'Ease in-out',
  'ease-in': 'Ease in',
  linear: 'Linear',
  'back-out': 'Back out (overshoot)',
  spring: 'Spring',
  bouncy: 'Bouncy spring',
};

export function presetOptions(
  values: readonly (keyof typeof PRESET_LABELS)[],
): Array<{ value: string; label: string }> {
  return values.map((value) => ({ value, label: PRESET_LABELS[value] }));
}

/**
 * Where an entrance starts; it always ends at rest (`IDENTITY_FRAME`). "Left"/"right" name
 * the direction of travel, so `fade-left` starts `distance` px to the right.
 */
export function entranceFrames(preset: EntrancePreset, distance: number): Frames {
  const from = ((): MotionPart => {
    switch (preset) {
      case 'fade':
        return { opacity: 0 };
      case 'fade-up':
        return { opacity: 0, y: distance };
      case 'fade-down':
        return { opacity: 0, y: -distance };
      case 'fade-left':
        return { opacity: 0, x: distance };
      case 'fade-right':
        return { opacity: 0, x: -distance };
      case 'slide-up':
        return { y: distance };
      case 'slide-down':
        return { y: -distance };
      case 'slide-left':
        return { x: distance };
      case 'slide-right':
        return { x: -distance };
      case 'zoom-in':
        return { opacity: 0, scale: 0.8 };
      case 'zoom-out':
        return { opacity: 0, scale: 1.2 };
      case 'pop':
        return { opacity: 0, scale: 0.5 };
      case 'rotate-in':
        return { opacity: 0, rotate: -12, scale: 0.9 };
    }
  })();
  return [{ ...IDENTITY_FRAME, ...from }, IDENTITY_FRAME];
}

/**
 * One cycle of a looping animation, evenly spaced, ending where it starts so repeats are
 * seamless. `intensity` scales the amplitude (1 = the tasteful default).
 */
export function loopFrames(preset: LoopPreset, intensity: number): Frames {
  const k = intensity;
  const frame = (part: MotionPart): MotionPart => ({ ...IDENTITY_FRAME, ...part });
  switch (preset) {
    case 'float':
      return [0, -10 * k, 0].map((y) => frame({ y }));
    case 'bounce':
      return [0, -20 * k, 0, -6 * k, 0].map((y) => frame({ y }));
    case 'pulse':
      return [1, 1 + 0.06 * k, 1].map((scale) => frame({ scale }));
    case 'breathe':
      return [
        frame({}),
        frame({ scale: 1 + 0.03 * k, opacity: Math.max(0, 1 - 0.15 * k) }),
        frame({}),
      ];
    case 'spin':
      return [0, 360].map((rotate) => frame({ rotate }));
    case 'wiggle':
      return [0, -6 * k, 6 * k, -6 * k, 6 * k, 0].map((rotate) => frame({ rotate }));
    case 'swing':
      return [0, 12 * k, 0, -12 * k, 0].map((rotate) => frame({ rotate }));
    case 'shake':
      return [0, -6 * k, 6 * k, -6 * k, 6 * k, 0].map((x) => frame({ x }));
    case 'heartbeat':
      return [1, 1 + 0.12 * k, 1, 1 + 0.12 * k, 1, 1, 1].map((scale) => frame({ scale }));
    case 'blink':
      return [1, Math.max(0, 1 - 0.7 * k), 1].map((opacity) => frame({ opacity }));
  }
}

/** Loops whose motion must not slow down between frames (a spin would stutter at 0°/360°). */
export function isLinearLoop(preset: LoopPreset): boolean {
  return preset === 'spin';
}

/** Rest → hovered. */
export function hoverFrames(preset: HoverPreset, intensity: number): Frames {
  const k = intensity;
  const to = ((): MotionPart => {
    switch (preset) {
      case 'lift':
        return { y: -6 * k };
      case 'grow':
        return { scale: 1 + 0.05 * k };
      case 'shrink':
        return { scale: Math.max(0, 1 - 0.05 * k) };
      case 'tilt':
        return { rotate: -3 * k };
      case 'push':
        return { y: 3 * k, scale: Math.max(0, 1 - 0.02 * k) };
      case 'nudge':
        return { x: 6 * k };
      case 'dim':
        return { opacity: Math.max(0, 1 - 0.25 * k) };
    }
  })();
  return [IDENTITY_FRAME, { ...IDENTITY_FRAME, ...to }];
}

function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * t;
}

function easeInOutSine(t: number): number {
  return -(Math.cos(Math.PI * t) - 1) / 2;
}

/**
 * The frame at progress `t` (0 = first frame, 1 = last). Values outside 0..1 extrapolate
 * along the first/last segment, which is how a spring's overshoot becomes visible motion;
 * opacity and scale are then clamped to what CSS accepts. `smooth` eases each segment so a
 * multi-frame loop driven at linear speed still slows into every turning point.
 */
export function sampleFrames(
  frames: Frames,
  t: number,
  options: { smooth?: boolean } = {},
): Required<MotionPart> {
  if (frames.length === 0) return { ...IDENTITY_FRAME };
  if (frames.length === 1) return { ...IDENTITY_FRAME, ...frames[0] };
  const segments = frames.length - 1;
  const position = t * segments;
  const index = Math.min(segments - 1, Math.max(0, Math.floor(position)));
  let local = position - index;
  if (options.smooth && local >= 0 && local <= 1) local = easeInOutSine(local);
  const a = { ...IDENTITY_FRAME, ...frames[index] };
  const b = { ...IDENTITY_FRAME, ...frames[index + 1] };
  return {
    x: lerp(a.x, b.x, local),
    y: lerp(a.y, b.y, local),
    scale: Math.max(0, lerp(a.scale, b.scale, local)),
    rotate: lerp(a.rotate, b.rotate, local),
    opacity: Math.min(1, Math.max(0, lerp(a.opacity, b.opacity, local))),
  };
}

/**
 * Drops the values that are at rest, so an animation that has settled contributes nothing to
 * the compositor and the node's own `translate`/`scale`/`rotate`/`opacity` styles show
 * through instead of being pinned to inline identity values.
 */
export function restlessPart(frame: Required<MotionPart>): MotionPart {
  const part: MotionPart = {};
  if (frame.x !== 0 || frame.y !== 0) {
    part.x = frame.x;
    part.y = frame.y;
  }
  if (frame.scale !== 1) part.scale = frame.scale;
  if (frame.rotate !== 0) part.rotate = frame.rotate;
  if (frame.opacity !== 1) part.opacity = frame.opacity;
  return part;
}

/** Per-segment curves for custom timelines (springs need time, so they're whole-tween only). */
export const STEP_EASINGS = [
  'linear',
  'ease-in',
  'ease-out',
  'ease-in-out',
  'back-out',
  'hold',
] as const;
export type StepEasing = (typeof STEP_EASINGS)[number];

export const STEP_EASING_LABELS: Record<StepEasing, string> = {
  linear: 'Linear',
  'ease-in': 'Ease in',
  'ease-out': 'Ease out',
  'ease-in-out': 'Ease in-out',
  'back-out': 'Back out',
  hold: 'Hold (jump)',
};

/** Shapes local progress `t` (0..1) of one segment. `hold` stays put, then jumps at the end. */
export function easeCurve(easing: StepEasing | undefined, t: number): number {
  switch (easing) {
    case 'ease-in':
      return t * t * t;
    case 'ease-out':
      return 1 - Math.pow(1 - t, 3);
    case 'ease-in-out':
      return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    case 'back-out': {
      const c1 = 1.70158;
      return 1 + (c1 + 1) * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
    }
    case 'hold':
      return t >= 1 ? 1 : 0;
    default:
      return t;
  }
}

/**
 * The curve a whole-animation easing has when progress comes from scroll position rather
 * than time: springs have no time to play out, so they map to their closest curve.
 */
export function scrollEasing(easing: AnimationEasing): StepEasing {
  switch (easing) {
    case 'spring':
      return 'ease-out';
    case 'bouncy':
      return 'back-out';
    default:
      return easing;
  }
}

/** One step of a custom timeline: a pose at position `at` (0..1); `ease` shapes its arrival. */
export interface TimelineStep extends MotionPart {
  at: number;
  ease?: StepEasing;
}

/**
 * The pose at timeline position `t`. Steps must be sorted by `at`. Between two steps the
 * arriving step's `ease` applies; outside the first/last step the nearest pose holds — except
 * past the end, where the last segment extrapolates so a spring driving the timeline shows
 * its overshoot.
 */
export function sampleTimeline(steps: readonly TimelineStep[], t: number): Required<MotionPart> {
  if (steps.length === 0) return { ...IDENTITY_FRAME };
  const first = steps[0];
  const last = steps[steps.length - 1];
  if (steps.length === 1 || t <= first.at) return { ...IDENTITY_FRAME, ...stripStep(first) };
  let index = steps.findIndex((step, i) => i > 0 && t <= step.at);
  if (index === -1) {
    if (t > 1 && last.at >= 1) index = steps.length - 1;
    else return { ...IDENTITY_FRAME, ...stripStep(last) };
  }
  const a = steps[index - 1];
  const b = steps[index];
  const span = b.at - a.at;
  const local = span > 0 ? (t - a.at) / span : 1;
  const eased = local <= 1 ? easeCurve(b.ease, local) : local;
  return sampleFrames([stripStep(a), stripStep(b)], eased);
}

function stripStep({ at: _at, ease: _ease, ...pose }: TimelineStep): MotionPart {
  return pose;
}

/**
 * Splits one 0..1 progress across `count` pieces animated one after another: each piece
 * takes `duration`, starts `stagger` after the previous one, and the whole run fits 0..1.
 * Used when scroll position (not time) drives a staggered effect.
 */
export function staggeredProgress(
  progress: number,
  index: number,
  count: number,
  duration: number,
  stagger: number,
): number {
  const total = duration + stagger * Math.max(0, count - 1);
  if (total <= 0) return progress >= 1 ? 1 : 0;
  const start = (index * stagger) / total;
  const length = duration / total;
  return Math.min(1, Math.max(0, (progress - start) / length));
}
