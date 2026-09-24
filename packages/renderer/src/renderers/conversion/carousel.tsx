import React, { useEffect, useRef, useState } from 'react';
import type { RenderNodeContentOptions } from '../render-node-content';
import { childIndexContaining, readAriaLabel, readBoolean, readNumber } from './shared';

/** Minimum horizontal travel (px) for a touch gesture to count as a swipe. */
export const CAROUSEL_SWIPE_THRESHOLD = 40;

/**
 * Pure slide-index step (exported for tests). With `loop` the index wraps around;
 * without it, it stops at the first/last slide.
 */
export function stepCarouselIndex(current: number, delta: number, count: number, loop: boolean): number {
  if (count <= 0) return 0;
  const next = current + delta;
  if (loop) return ((next % count) + count) % count;
  return Math.min(Math.max(next, 0), count - 1);
}

/** Direction of a completed touch gesture: -1 (swipe left → next), 1 (swipe right → prev) or 0. */
export function swipeDirection(startX: number, endX: number, threshold = CAROUSEL_SWIPE_THRESHOLD): -1 | 0 | 1 {
  const dx = endX - startX;
  if (Math.abs(dx) < threshold) return 0;
  return dx < 0 ? -1 : 1;
}

function usePrefersReducedMotion(): boolean {
  // Always `false` on the first render (server and client alike) to avoid a hydration
  // mismatch; the real preference is read after mount.
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    let mql: MediaQueryList;
    try {
      mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    } catch {
      return;
    }
    const update = () => setReduced(mql.matches);
    update();
    if (typeof mql.addEventListener === 'function') {
      mql.addEventListener('change', update);
      return () => mql.removeEventListener('change', update);
    }
    return undefined;
  }, []);
  return reduced;
}

const arrowStyle = (side: 'left' | 'right'): React.CSSProperties => ({
  position: 'absolute',
  top: '50%',
  [side]: '8px',
  transform: 'translateY(-50%)',
  width: '36px',
  height: '36px',
  borderRadius: '9999px',
  border: '1px solid rgba(15, 23, 42, 0.1)',
  background: 'rgba(255, 255, 255, 0.9)',
  color: '#0f172a',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  fontSize: '18px',
  lineHeight: 1,
  zIndex: 1,
});

const CarouselView: React.FC<{ options: RenderNodeContentOptions }> = ({ options }) => {
  const { node, domId, styles, mode, handleClick, childrenElements, selectedNodeId } = options;
  const isRuntime = mode === 'runtime';
  const slides = React.Children.toArray(childrenElements);
  const count = slides.length;

  const autoplay = readBoolean(options, 'autoplay', false);
  const interval = Math.max(1000, readNumber(options, 'interval', 5000));
  const loop = readBoolean(options, 'loop', true);
  const showDots = readBoolean(options, 'showDots', true);
  const showArrows = readBoolean(options, 'showArrows', true);

  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const reducedMotion = usePrefersReducedMotion();
  const touchStartX = useRef<number | null>(null);

  // Editor: reveal the slide containing the selected node.
  const selectedSlide = mode === 'editor' ? childIndexContaining(node, selectedNodeId) : -1;
  const current = stepCarouselIndex(selectedSlide >= 0 ? selectedSlide : index, 0, count, false);

  const isAutoplaying = isRuntime && autoplay && !reducedMotion && !paused && count > 1;

  useEffect(() => {
    if (!isAutoplaying) return;
    const id = setInterval(() => {
      setIndex((i) => stepCarouselIndex(i, 1, count, true));
    }, interval);
    return () => clearInterval(id);
  }, [isAutoplaying, interval, count]);

  const go = (delta: number) => setIndex((i) => stepCarouselIndex(i, delta, count, loop));

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      go(-1);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      go(1);
    }
  };

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0]?.clientX ?? null;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touchStartX.current;
    touchStartX.current = null;
    const end = e.changedTouches[0]?.clientX;
    if (start === null || end === undefined) return;
    const dir = swipeDirection(start, end);
    if (dir !== 0) go(-dir);
  };

  const canPrev = loop || current > 0;
  const canNext = loop || current < count - 1;

  return (
    <div
      id={domId}
      style={{ position: 'relative', overflow: 'hidden', ...styles }}
      onClick={handleClick}
      data-kubuild-node={node.id}
      role="region"
      aria-roledescription="carousel"
      aria-label={readAriaLabel(options) || 'Carousel'}
      tabIndex={0}
      onKeyDown={onKeyDown}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <div
        data-kubuild-carousel-track=""
        aria-live={isAutoplaying ? 'off' : 'polite'}
        style={{
          display: 'flex',
          width: '100%',
          transform: `translateX(-${current * 100}%)`,
          transition: reducedMotion ? 'none' : 'transform 400ms ease',
        }}
      >
        {slides.map((slide, i) => (
          <div
            key={i}
            role="group"
            aria-roledescription="slide"
            aria-label={`${i + 1} of ${count}`}
            aria-hidden={isRuntime && i !== current ? true : undefined}
            data-kubuild-carousel-slide={i}
            style={{ flex: '0 0 100%', minWidth: 0, boxSizing: 'border-box' }}
          >
            {slide}
          </div>
        ))}
      </div>

      {showArrows && count > 1 ? (
        <>
          <button
            type="button"
            aria-label="Previous slide"
            disabled={!canPrev}
            onClick={() => go(-1)}
            style={{ ...arrowStyle('left'), opacity: canPrev ? 1 : 0.4 }}
          >
            <span aria-hidden="true">‹</span>
          </button>
          <button
            type="button"
            aria-label="Next slide"
            disabled={!canNext}
            onClick={() => go(1)}
            style={{ ...arrowStyle('right'), opacity: canNext ? 1 : 0.4 }}
          >
            <span aria-hidden="true">›</span>
          </button>
        </>
      ) : null}

      {showDots && count > 1 ? (
        <div
          role="group"
          aria-label="Choose slide"
          style={{ display: 'flex', justifyContent: 'center', gap: '8px', padding: '12px 0' }}
        >
          {slides.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Go to slide ${i + 1}`}
              aria-current={i === current ? 'true' : undefined}
              data-kubuild-carousel-dot={i}
              onClick={() => setIndex(i)}
              style={{
                width: '8px',
                height: '8px',
                padding: 0,
                borderRadius: '9999px',
                border: 'none',
                background: i === current ? '#0f172a' : '#cbd5e1',
                cursor: 'pointer',
              }}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
};

export function renderCarousel(options: RenderNodeContentOptions): React.ReactElement {
  return <CarouselView options={options} />;
}
