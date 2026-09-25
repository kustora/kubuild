import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import type { Node, PageDocument } from '@kubuild/schema';
import { ActionPipelineSchema } from '@kubuild/schema';
import { createDefaultComponentRegistry, SALES_STARTER_BLOCKS } from '@kubuild/components';
import { createBlankDocument } from '@kubuild/core';
import {
  KubuildRenderer,
  splitCountdown,
  formatCountdown,
  resolveFixedDeadline,
  resolveEvergreenDeadline,
  resetCountdownMemoryStore,
  fireCountdownExpire,
  toggleAccordionIndex,
  buildFaqJsonLd,
  serializeJsonForScript,
  clampTabIndex,
  stepCarouselIndex,
  swipeDirection,
  normalizeRating,
  ratingStarFills,
  formatRatingLabel,
  type RenderNodeContentOptions,
} from '../src/index';

const registry = createDefaultComponentRegistry();

function docWith(children: Node[]): PageDocument {
  const doc = createBlankDocument('Conversion Components');
  doc.document.children = [{ id: 'sec', type: 'section', children }];
  return doc;
}

function render(children: Node[], mode: 'editor' | 'runtime' = 'runtime', selectedNodeId?: string) {
  return renderToString(
    <KubuildRenderer
      document={docWith(children)}
      registry={registry}
      mode={mode}
      showToastContainer={false}
      selectedNodeId={selectedNodeId}
    />,
  );
}

describe('STORA-543: countdown', () => {
  beforeEach(() => resetCountdownMemoryStore());

  it('splits and formats durations in every supported format', () => {
    const ms = ((2 * 24 + 3) * 3600 + 4 * 60 + 5) * 1000; // 2d 3h 4m 5s
    expect(splitCountdown(ms)).toMatchObject({ days: 2, hours: 3, minutes: 4, seconds: 5 });
    expect(formatCountdown(ms, 'hh:mm:ss')).toBe('51:04:05');
    expect(formatCountdown(ms, 'mm:ss')).toBe('3064:05');
    expect(formatCountdown(ms, 'd h m s')).toBe('2d 03h 04m 05s');
    expect(formatCountdown(-1000, 'mm:ss')).toBe('00:00');
  });

  it('resolves fixed deadlines in the given timezone (and honours explicit offsets)', () => {
    expect(resolveFixedDeadline('2026-12-31T23:59', 'UTC')).toBe(Date.UTC(2026, 11, 31, 23, 59));
    // Asia/Jakarta is UTC+7 with no DST.
    expect(resolveFixedDeadline('2026-12-31T23:59', 'Asia/Jakarta')).toBe(
      Date.UTC(2026, 11, 31, 16, 59),
    );
    // New York in July is UTC-4 (EDT), in January UTC-5 (EST).
    expect(resolveFixedDeadline('2026-07-01T12:00', 'America/New_York')).toBe(
      Date.UTC(2026, 6, 1, 16, 0),
    );
    expect(resolveFixedDeadline('2026-01-15T12:00', 'America/New_York')).toBe(
      Date.UTC(2026, 0, 15, 17, 0),
    );
    expect(resolveFixedDeadline('2026-12-31T23:59:00+07:00', 'UTC')).toBe(
      Date.UTC(2026, 11, 31, 16, 59),
    );
    // Invalid timezone falls back to UTC; garbage yields null.
    expect(resolveFixedDeadline('2026-12-31T23:59', 'Not/AZone')).toBe(
      Date.UTC(2026, 11, 31, 23, 59),
    );
    expect(resolveFixedDeadline('', 'UTC')).toBeNull();
    expect(resolveFixedDeadline('next friday', 'UTC')).toBeNull();
  });

  it('persists the evergreen deadline and reuses it on the next visit', () => {
    const store = new Map<string, string>();
    const storage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    };
    const first = resolveEvergreenDeadline({ key: 'k', durationMs: 60_000, now: 1_000, storage });
    expect(first).toBe(61_000);
    const second = resolveEvergreenDeadline({ key: 'k', durationMs: 60_000, now: 30_000, storage });
    expect(second).toBe(61_000);
    // Changing the duration restarts the timer.
    const third = resolveEvergreenDeadline({ key: 'k', durationMs: 120_000, now: 30_000, storage });
    expect(third).toBe(150_000);
  });

  it('falls back to memory when storage throws', () => {
    const throwing = {
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    };
    const first = resolveEvergreenDeadline({
      key: 'x',
      durationMs: 60_000,
      now: 0,
      storage: throwing,
    });
    const second = resolveEvergreenDeadline({
      key: 'x',
      durationMs: 60_000,
      now: 10_000,
      storage: throwing,
    });
    expect(first).toBe(60_000);
    expect(second).toBe(60_000);
    expect(resolveEvergreenDeadline({ key: 'y', durationMs: 5_000, now: 0, storage: null })).toBe(
      5_000,
    );
  });

  it('renders an accessible timer showing the full duration (SSR-deterministic)', () => {
    const html = render([
      {
        id: 'cd',
        type: 'countdown',
        props: { mode: 'evergreen', durationMinutes: 90, format: 'hh:mm:ss', label: 'Ends in' },
      },
    ]);
    expect(html).toContain('role="timer"');
    expect(html).toContain('aria-label="Ends in"');
    expect(html).toContain('01:30:00');
    expect(html).toContain('data-kubuild-countdown-state="running"');
  });

  it('is frozen in editor mode, even for a fixed deadline in the past', () => {
    const evergreen = render(
      [
        {
          id: 'cd',
          type: 'countdown',
          props: { mode: 'evergreen', durationMinutes: 15, format: 'mm:ss' },
        },
      ],
      'editor',
    );
    expect(evergreen).toContain('15:00');
    expect(evergreen).toContain('data-kubuild-countdown-state="frozen"');

    const past = render(
      [
        {
          id: 'cd2',
          type: 'countdown',
          props: {
            mode: 'fixed',
            targetDate: '2000-01-01T00:00',
            expireBehavior: 'hide',
            format: 'mm:ss',
          },
        },
      ],
      'editor',
    );
    expect(past).toContain('role="timer"');
    expect(past).toContain('00:00');
    expect(past).not.toContain('display:none');
  });

  it('renders placeholder text for fixed mode until the client clock is known', () => {
    const html = render([
      {
        id: 'cd',
        type: 'countdown',
        props: { mode: 'fixed', targetDate: '2099-01-01T00:00', format: 'd h m s' },
      },
    ]);
    expect(html).toContain('data-kubuild-countdown-unit="days"');
    expect(html).toContain('--');
    expect(html).toContain('Days');
  });

  it('accepts the new "expire" trigger and fires only expire pipelines', async () => {
    const pipeline = {
      id: 'p-expire',
      trigger: 'expire',
      steps: [{ id: 's1', type: 'open_modal', payload: { modalId: 'offer-ended-test' } }],
    };
    expect(ActionPipelineSchema.safeParse(pipeline).success).toBe(true);

    const node: Node = {
      id: 'cd',
      type: 'countdown',
      props: {},
      actions: [
        pipeline as never,
        {
          id: 'p-click',
          trigger: 'click',
          steps: [{ id: 's2', type: 'close_modal', payload: {} }],
        } as never,
      ],
    };
    const onActionDispatch = vi.fn();
    await fireCountdownExpire({
      node,
      document: docWith([node]),
      context: {},
      onActionDispatch,
    } as unknown as RenderNodeContentOptions);
    expect(onActionDispatch).toHaveBeenCalledTimes(1);
    expect(onActionDispatch).toHaveBeenCalledWith(
      'open_modal',
      { modalId: 'offer-ended-test' },
      'cd',
    );
  });
});

describe('STORA-544: accordion', () => {
  const faq: Node = {
    id: 'acc',
    type: 'accordion',
    props: { allowMultiple: false, defaultOpenIndex: 1, faqSchema: true },
    children: [
      {
        id: 'i1',
        type: 'accordion-item',
        props: { title: 'Q1?' },
        children: [{ id: 'p1', type: 'paragraph', props: { text: 'Answer one' } }],
      },
      {
        id: 'i2',
        type: 'accordion-item',
        props: { title: 'Q2?' },
        children: [{ id: 'p2', type: 'paragraph', props: { text: 'Answer </script> two' } }],
      },
    ],
  };

  it('keeps a single item open unless allowMultiple', () => {
    const one = toggleAccordionIndex(new Set([0]), 1, false);
    expect([...one]).toEqual([1]);
    expect([...toggleAccordionIndex(one, 1, false)]).toEqual([]);
    const many = toggleAccordionIndex(new Set([0]), 1, true);
    expect([...many].sort()).toEqual([0, 1]);
  });

  it('renders ARIA wiring with only the default item expanded', () => {
    const html = render([faq]);
    expect(html).toContain('id="i1-header" aria-expanded="false" aria-controls="i1-panel"');
    expect(html).toContain('id="i2-header" aria-expanded="true" aria-controls="i2-panel"');
    expect(html).toMatch(/id="i1-panel" role="region" aria-labelledby="i1-header"[^>]*hidden/);
    expect(html).not.toMatch(/id="i2-panel"[^>]*hidden/);
    expect(html).toContain('data-kubuild-accordion-trigger="acc"');
  });

  it('emits escaped FAQPage JSON-LD at runtime only', () => {
    const runtime = render([faq]);
    expect(runtime).toContain('type="application/ld+json"');
    expect(runtime).toContain('"@type":"FAQPage"');
    expect(runtime).not.toContain('</script> two');
    expect(runtime).toContain('\\u003c/script\\u003e two');
    expect(render([faq], 'editor')).not.toContain('application/ld+json');

    const ld = buildFaqJsonLd(faq) as {
      mainEntity: Array<{ name: string; acceptedAnswer: { text: string } }>;
    };
    expect(ld.mainEntity).toHaveLength(2);
    expect(ld.mainEntity[0]).toMatchObject({ name: 'Q1?', acceptedAnswer: { text: 'Answer one' } });
    expect(serializeJsonForScript({ a: '<b>&' })).toBe('{"a":"\\u003cb\\u003e\\u0026"}');
  });

  it('opens an item in the editor when a node inside it is selected', () => {
    const html = render([{ ...faq, props: { defaultOpenIndex: -1 } }], 'editor', 'p1');
    expect(html).toContain('id="i1-header" aria-expanded="true"');
    expect(html).toContain('id="i2-header" aria-expanded="false"');
  });
});

describe('STORA-545: tabs', () => {
  const tabs: Node = {
    id: 'tabs',
    type: 'tabs',
    props: { activeIndex: 1, ariaLabel: 'Billing' },
    children: [
      {
        id: 'tp1',
        type: 'tab-panel',
        props: { label: 'Monthly' },
        children: [{ id: 't1', type: 'text', props: { text: 'Monthly body' } }],
      },
      {
        id: 'tp2',
        type: 'tab-panel',
        props: { label: 'Yearly' },
        children: [{ id: 't2', type: 'text', props: { text: 'Yearly body' } }],
      },
    ],
  };

  it('renders the ARIA tabs pattern with the configured active tab', () => {
    const html = render([tabs]);
    expect(html).toContain('role="tablist" aria-label="Billing"');
    expect(html).toContain(
      'role="tab" id="tabs-tab-0" aria-selected="false" aria-controls="tp1" tabindex="-1"',
    );
    expect(html).toContain(
      'role="tab" id="tabs-tab-1" aria-selected="true" aria-controls="tp2" tabindex="0"',
    );
    expect(html).toMatch(/id="tp1"[^>]*role="tabpanel" aria-labelledby="tabs-tab-0"[^>]*hidden/);
    expect(html).not.toMatch(/id="tp2"[^>]*hidden/);
  });

  it('shows the panel containing the selected node in the editor', () => {
    const html = render([tabs], 'editor', 't1');
    expect(html).toContain('id="tabs-tab-0" aria-selected="true"');
  });

  it('clamps the active index', () => {
    expect(clampTabIndex(5, 2)).toBe(1);
    expect(clampTabIndex(-3, 2)).toBe(0);
    expect(clampTabIndex(1, 0)).toBe(0);
  });
});

describe('STORA-546: carousel', () => {
  const carousel: Node = {
    id: 'car',
    type: 'carousel',
    props: { autoplay: true, showDots: true, showArrows: true, ariaLabel: 'Testimonials' },
    children: [
      { id: 's1', type: 'text', props: { text: 'Slide A' } },
      { id: 's2', type: 'text', props: { text: 'Slide B' } },
      { id: 's3', type: 'text', props: { text: 'Slide C' } },
    ],
  };

  it('renders children as slides with carousel semantics and controls', () => {
    const html = render([carousel]);
    expect(html).toContain('aria-roledescription="carousel"');
    expect(html).toContain('aria-label="Testimonials"');
    expect(html.match(/aria-roledescription="slide"/g)).toHaveLength(3);
    expect(html).toContain('aria-label="1 of 3"');
    expect(html).toContain('aria-label="Previous slide"');
    expect(html).toContain('aria-label="Go to slide 3"');
    expect(html).toContain('transform:translateX(-0%)');
    // Autoplaying region is not announced on every slide change.
    expect(html).toContain('aria-live="off"');
  });

  it('reveals the slide containing the selected node in the editor', () => {
    const html = render([carousel], 'editor', 's3');
    expect(html).toContain('transform:translateX(-200%)');
  });

  it('steps with and without looping and detects swipes', () => {
    expect(stepCarouselIndex(2, 1, 3, true)).toBe(0);
    expect(stepCarouselIndex(0, -1, 3, true)).toBe(2);
    expect(stepCarouselIndex(2, 1, 3, false)).toBe(2);
    expect(stepCarouselIndex(0, -1, 3, false)).toBe(0);
    expect(swipeDirection(200, 100)).toBe(-1);
    expect(swipeDirection(100, 200)).toBe(1);
    expect(swipeDirection(100, 120)).toBe(0);
  });
});

describe('STORA-547: rating', () => {
  it('supports half stars and clamps inputs', () => {
    expect(ratingStarFills(3.5, 5)).toEqual([1, 1, 1, 0.5, 0]);
    expect(ratingStarFills(4.3, 5)).toEqual([1, 1, 1, 1, 0.5]);
    expect(normalizeRating(9, 5)).toEqual({ value: 5, max: 5 });
    expect(normalizeRating(2, 50).max).toBe(10);
    expect(formatRatingLabel('{value} dari {max}', 4.5, 5)).toBe('4.5 dari 5');
  });

  it('renders an accessible image with the configured size and color', () => {
    const html = render([
      { id: 'r', type: 'rating', props: { value: 4.5, max: 5, size: 18, color: '#ff0000' } },
    ]);
    expect(html).toContain('role="img" aria-label="4.5 out of 5"');
    expect(html.match(/data-kubuild-rating-star=/g)).toHaveLength(5);
    expect(html).toContain('data-kubuild-rating-star="0.5"');
    expect(html).toContain('fill="#ff0000"');
    expect(html).toContain('width="18"');
  });
});

describe('STORA-548: divider & spacer', () => {
  it('renders a plain rule or a labelled separator', () => {
    const plain = render([
      { id: 'd', type: 'divider', props: { lineStyle: 'dashed', thickness: 2, color: '#333333' } },
    ]);
    expect(plain).toContain('<hr id="d"');
    expect(plain).toContain('border-top:2px dashed #333333');

    const labelled = render([{ id: 'd2', type: 'divider', props: { label: 'OR' } }]);
    expect(labelled).toContain('role="separator"');
    expect(labelled).toContain('aria-label="OR"');
    expect(labelled).toContain('>OR<');
  });

  it('uses the per-breakpoint height for the spacer', () => {
    const spacer: Node = {
      id: 'sp',
      type: 'spacer',
      styles: { base: { height: '48px' }, mobile: { height: '12px' } },
    };
    const doc = docWith([spacer]);
    const desktop = renderToString(
      <KubuildRenderer
        document={doc}
        registry={registry}
        viewport="desktop"
        showToastContainer={false}
      />,
    );
    const mobile = renderToString(
      <KubuildRenderer
        document={doc}
        registry={registry}
        viewport="mobile"
        showToastContainer={false}
      />,
    );
    expect(desktop).toContain('height:48px');
    expect(mobile).toContain('height:12px');
    expect(desktop).toContain('aria-hidden="true"');
  });
});

describe('STORA-549: sales blocks render without unknown-component fallbacks', () => {
  it.each(SALES_STARTER_BLOCKS.map((b) => [b.id, b] as const))('%s', (_id, block) => {
    const doc = createBlankDocument('Sales');
    doc.document.children = [block.createNodeTree()];
    const html = renderToString(
      <KubuildRenderer
        document={doc}
        registry={registry}
        mode="editor"
        showToastContainer={false}
      />,
    );
    expect(html).not.toContain('data-kubuild-unknown');
    expect(html).not.toContain('data-kubuild-error');
  });
});
