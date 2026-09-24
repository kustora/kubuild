import React from 'react';
import type { RenderNodeContentOptions } from '../render-node-content';
import { readNumber, readString } from './shared';

export const RATING_MAX_STARS = 10;

/** Normalizes rating inputs: `max` in [1, 10], `value` in [0, max] rounded to the nearest half. */
export function normalizeRating(value: number, max: number): { value: number; max: number } {
  const safeMax = Math.min(Math.max(Math.round(Number.isFinite(max) ? max : 5), 1), RATING_MAX_STARS);
  const clamped = Math.min(Math.max(Number.isFinite(value) ? value : 0, 0), safeMax);
  return { value: Math.round(clamped * 2) / 2, max: safeMax };
}

/** Fill fraction (0, 0.5 or 1) of each star, left to right. */
export function ratingStarFills(value: number, max: number): number[] {
  const n = normalizeRating(value, max);
  return Array.from({ length: n.max }, (_, i) => (n.value >= i + 1 ? 1 : n.value >= i + 0.5 ? 0.5 : 0));
}

/** Accessible label, e.g. `formatRatingLabel('{value} dari {max}', 4.5, 5)` → "4.5 dari 5". */
export function formatRatingLabel(template: string, value: number, max: number): string {
  const n = normalizeRating(value, max);
  return (template || '{value} out of {max}')
    .replace(/\{value\}/g, String(n.value))
    .replace(/\{max\}/g, String(n.max));
}

const STAR_POINTS = '12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2';

const Star: React.FC<{ size: number; fill: number; color: string; emptyColor: string }> = ({
  size,
  fill,
  color,
  emptyColor,
}) => (
  <span
    aria-hidden="true"
    data-kubuild-rating-star={fill}
    style={{ position: 'relative', display: 'inline-block', width: size, height: size, lineHeight: 0 }}
  >
    <svg width={size} height={size} viewBox="0 0 24 24" focusable="false">
      <polygon points={STAR_POINTS} fill={emptyColor} />
    </svg>
    {fill > 0 ? (
      <span
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: `${fill * 100}%`,
          height: '100%',
          overflow: 'hidden',
        }}
      >
        <svg width={size} height={size} viewBox="0 0 24 24" focusable="false">
          <polygon points={STAR_POINTS} fill={color} />
        </svg>
      </span>
    ) : null}
  </span>
);

export function renderRating(options: RenderNodeContentOptions): React.ReactElement {
  const { node, domId, styles, handleClick } = options;
  const { value, max } = normalizeRating(readNumber(options, 'value', 5), readNumber(options, 'max', 5));
  const size = Math.max(4, readNumber(options, 'size', 20));
  const color = readString(options, 'color', '#f59e0b') || '#f59e0b';
  const emptyColor = readString(options, 'emptyColor', '#e2e8f0') || '#e2e8f0';
  const label = formatRatingLabel(readString(options, 'labelTemplate', '{value} out of {max}'), value, max);

  return (
    <div
      id={domId}
      style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', ...styles }}
      onClick={handleClick}
      data-kubuild-node={node.id}
      role="img"
      aria-label={label}
    >
      {ratingStarFills(value, max).map((fill, i) => (
        <Star key={i} size={size} fill={fill} color={color} emptyColor={emptyColor} />
      ))}
    </div>
  );
}
