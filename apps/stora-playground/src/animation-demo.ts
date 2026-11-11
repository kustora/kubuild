import {
  CURRENT_SCHEMA_VERSION,
  type Node,
  type PageDocument,
  type StyleDefinition,
} from '@kubuild/schema';

/**
 * Playground page exercising the `@kubuild/plugin-animation` generator: entrance presets
 * (including a staggered grid), loops, hover states, text splitting, counters, SVG line
 * drawing, keyframe timelines and a pinned scroll-scrubbed story. Open it, hit Preview (or Export
 * HTML) and scroll; hover the cards and the button.
 */

const text = (id: string, content: string, base: StyleDefinition): Node => ({
  id,
  type: 'text',
  props: { content },
  styles: { base },
  children: [],
});

const heading = (
  id: string,
  content: string,
  base: StyleDefinition,
  effects?: Node['effects'],
): Node => ({
  id,
  type: 'heading',
  props: { text: content, level: 2 },
  styles: { base: { fontSize: '40px', fontWeight: '800', textAlign: 'center', ...base } },
  effects,
  children: [],
});

const card = (id: string, title: string, body: string, accent: string): Node => ({
  id,
  type: 'container',
  props: {},
  styles: {
    base: {
      backgroundColor: '#ffffff',
      borderRadius: '16px',
      padding: '28px',
      borderTop: `4px solid ${accent}`,
      boxShadow: '0 10px 30px -12px rgba(15, 23, 42, 0.25)',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
    },
  },
  effects: [
    { plugin: 'animate-hover', enabled: true, config: { preset: 'lift', easing: 'spring' } },
  ],
  children: [
    {
      id: `${id}-title`,
      type: 'heading',
      props: { text: title, level: 3 },
      styles: { base: { fontSize: '20px', fontWeight: '700', color: '#0f172a' } },
      children: [],
    },
    text(`${id}-body`, body, { fontSize: '15px', color: '#475569', lineHeight: '1.6' }),
  ],
});

const presetTile = (preset: string, index: number): Node => ({
  id: `an-tile-${preset}`,
  type: 'container',
  props: {},
  styles: {
    base: {
      backgroundColor: index % 2 === 0 ? '#eff6ff' : '#f5f3ff',
      borderRadius: '12px',
      padding: '32px 16px',
      textAlign: 'center',
      fontWeight: '600',
      color: '#1e293b',
    },
  },
  effects: [
    { plugin: 'animate-entrance', enabled: true, config: { preset, once: false, threshold: 0.5 } },
  ],
  children: [text(`an-tile-${preset}-label`, preset, { fontSize: '15px' })],
});

const withEffects = (node: Node, effects: Node['effects']): Node => ({ ...node, effects });

const stat = (id: string, value: string, label: string, delay: number): Node => ({
  id,
  type: 'container',
  props: {},
  styles: { base: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' } },
  children: [
    {
      id: `${id}-value`,
      type: 'heading',
      props: { text: value, level: 3 },
      styles: { base: { fontSize: '44px', fontWeight: '800', color: '#2563eb' } },
      effects: [{ plugin: 'animate-counter', enabled: true, config: { duration: 1800, delay } }],
      children: [],
    },
    text(`${id}-label`, label, { fontSize: '14px', color: '#64748b' }),
  ],
});

const SQUIGGLE_SVG = `<svg viewBox="0 0 600 120" width="100%" height="120" fill="none" stroke="#7c3aed" stroke-width="6" stroke-linecap="round">
  <path d="M10 80 C 80 10, 140 10, 200 70 S 320 130, 390 60 S 520 0, 590 60"/>
  <circle cx="300" cy="60" r="40" stroke="#f59e0b"/>
</svg>`;

const storyStep = (
  id: string,
  content: string,
  window: [number, number],
  steps: unknown[],
): Node => ({
  id,
  type: 'heading',
  props: { text: content, level: 3 },
  styles: { base: { fontSize: '30px', fontWeight: '800', color: '#ffffff', textAlign: 'center' } },
  effects: [
    {
      plugin: 'animate-timeline',
      enabled: true,
      config: {
        trigger: 'scroll',
        scrollSource: 'pinned-section',
        scrollStart: window[0],
        scrollEnd: window[1],
        steps,
      },
    },
  ],
  children: [],
});

export const animationDemoDocument: PageDocument = {
  schema: 'stora.page',
  version: CURRENT_SCHEMA_VERSION,
  metadata: {
    title: 'Animation Demo',
    description: 'Every preset family from @kubuild/plugin-animation on one page',
    author: 'KUBUILD Team',
    tags: ['effects', 'animation'],
    category: 'demo',
    version: '1.0.0',
  },
  document: {
    id: 'animation-root',
    type: 'page',
    props: { title: 'Animation Demo' },
    styles: {
      base: { backgroundColor: '#f8fafc', fontFamily: 'Inter, sans-serif', color: '#0f172a' },
    },
    children: [
      {
        id: 'an-hero',
        type: 'section',
        props: {},
        styles: {
          base: {
            minHeight: '600px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '20px',
            padding: '96px 24px',
            textAlign: 'center',
            backgroundImage: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 50%, #7c3aed 100%)',
          },
        },
        effects: [
          {
            plugin: 'animate-entrance',
            enabled: true,
            config: { preset: 'fade-up', stagger: 120, distance: 30 },
          },
        ],
        children: [
          {
            id: 'an-hero-badge',
            type: 'container',
            props: {},
            styles: {
              base: {
                width: '72px',
                height: '72px',
                borderRadius: '20px',
                backgroundColor: '#facc15',
              },
            },
            effects: [
              {
                plugin: 'animate-loop',
                enabled: true,
                config: { preset: 'float', duration: 3500 },
              },
            ],
            children: [],
          },
          {
            id: 'an-hero-title',
            type: 'heading',
            props: { text: 'Animation generator', level: 1 },
            styles: { base: { fontSize: '60px', fontWeight: '800', color: '#ffffff' } },
            children: [],
          },
          text(
            'an-hero-sub',
            'Pick a preset, tune duration, easing and stagger — the generator writes the keyframes, Motion plays them.',
            {
              fontSize: '18px',
              color: 'rgba(255,255,255,0.85)',
              maxWidth: '560px',
            },
          ),
          {
            id: 'an-hero-cta',
            type: 'button',
            props: { label: 'Hover me', variant: 'primary' },
            styles: { base: { backgroundColor: '#ffffff', color: '#1e3a8a', fontWeight: '700' } },
            effects: [
              {
                plugin: 'animate-hover',
                enabled: true,
                config: { preset: 'grow', easing: 'bouncy', intensity: 1.5 },
              },
              {
                plugin: 'animate-loop',
                enabled: true,
                config: { preset: 'pulse', duration: 2000, delay: 1500 },
              },
            ],
            children: [],
          },
        ],
      },
      {
        id: 'an-features',
        type: 'section',
        props: {},
        styles: { base: { padding: '120px 24px 60px', maxWidth: '1080px', margin: '0 auto' } },
        children: [
          heading('an-features-title', 'Staggered grid', { marginBottom: '40px' }, [
            {
              plugin: 'animate-entrance',
              enabled: true,
              config: { preset: 'zoom-in', easing: 'spring' },
            },
          ]),
          {
            id: 'an-features-grid',
            type: 'container',
            props: {},
            styles: {
              base: {
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                gap: '24px',
              },
            },
            effects: [
              {
                plugin: 'animate-entrance',
                enabled: true,
                config: { preset: 'fade-up', stagger: 110, distance: 50 },
              },
            ],
            children: [
              card(
                'an-card-1',
                'Entrance',
                'Fade, slide, zoom, pop or rotate in when scrolled into view.',
                '#2563eb',
              ),
              card(
                'an-card-2',
                'Loop',
                'Float, pulse, spin, wiggle and more, paused while off-screen.',
                '#7c3aed',
              ),
              card(
                'an-card-3',
                'Hover',
                'Lift, grow, tilt or push — springs reverse smoothly mid-way.',
                '#db2777',
              ),
            ],
          },
        ],
      },
      {
        id: 'an-text',
        type: 'section',
        props: {},
        styles: {
          base: { padding: '100px 24px', maxWidth: '900px', margin: '0 auto', textAlign: 'center' },
        },
        children: [
          {
            id: 'an-text-words',
            type: 'heading',
            props: { text: 'Words arrive one by one, like a sentence being spoken', level: 2 },
            styles: { base: { fontSize: '44px', fontWeight: '800', lineHeight: '1.15' } },
            effects: [
              {
                plugin: 'animate-text',
                enabled: true,
                config: { split: 'word', preset: 'fade-up', stagger: 80 },
              },
            ],
            children: [],
          },
          {
            id: 'an-text-letters',
            type: 'heading',
            props: { text: 'Letters pop!', level: 2 },
            styles: {
              base: { fontSize: '56px', fontWeight: '900', color: '#db2777', marginTop: '40px' },
            },
            effects: [
              {
                plugin: 'animate-text',
                enabled: true,
                config: { split: 'char', preset: 'pop', easing: 'bouncy', stagger: 40 },
              },
            ],
            children: [],
          },
          withEffects(
            text('an-text-typed', 'npm install @kubuild/plugin-animation', {
              fontFamily: 'ui-monospace, monospace',
              fontSize: '18px',
              color: '#0f172a',
              backgroundColor: '#e2e8f0',
              display: 'inline-block',
              padding: '10px 16px',
              borderRadius: '8px',
              marginTop: '32px',
            }),
            [
              {
                plugin: 'animate-text',
                enabled: true,
                config: { split: 'char', preset: 'typewriter', stagger: 45 },
              },
            ],
          ),
        ],
      },
      {
        id: 'an-stats',
        type: 'section',
        props: {},
        styles: {
          base: {
            padding: '80px 24px',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '24px',
            maxWidth: '960px',
            margin: '0 auto',
          },
        },
        children: [
          stat('an-stat-1', '12,500+', 'Customers', 0),
          stat('an-stat-2', '98.6%', 'Uptime', 150),
          stat('an-stat-3', 'Rp 1.250.000', 'Average order', 300),
        ],
      },
      {
        id: 'an-draw',
        type: 'section',
        props: {},
        styles: { base: { padding: '60px 24px', maxWidth: '900px', margin: '0 auto' } },
        children: [
          heading('an-draw-title', 'Lines draw themselves', {
            fontSize: '28px',
            marginBottom: '16px',
          }),
          {
            id: 'an-draw-svg',
            type: 'html-embed',
            props: { html: SQUIGGLE_SVG },
            styles: { base: {} },
            effects: [
              { plugin: 'animate-draw', enabled: true, config: { duration: 1600, stagger: 500 } },
            ],
            children: [],
          },
          {
            id: 'an-timeline-logo',
            type: 'container',
            props: {},
            styles: {
              base: {
                width: '96px',
                height: '96px',
                margin: '48px auto 0',
                borderRadius: '24px',
                backgroundImage: 'linear-gradient(135deg, #2563eb, #7c3aed)',
              },
            },
            effects: [
              {
                plugin: 'animate-timeline',
                enabled: true,
                config: { once: false, threshold: 0.6 },
              },
            ],
            children: [],
          },
        ],
      },
      {
        id: 'an-story',
        type: 'section',
        props: {},
        styles: { base: { backgroundColor: '#0f172a' } },
        effects: [{ plugin: 'scroll-pin', enabled: true, config: { length: 2.5 } }],
        children: [
          {
            id: 'an-story-stage',
            type: 'container',
            props: {},
            styles: {
              base: {
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '28px',
                padding: '40px 24px',
                overflow: 'hidden',
              },
            },
            children: [
              storyStep(
                'an-story-1',
                'Pinned while you scroll',
                [0, 0.3],
                [
                  { at: 0, y: 60, opacity: 0 },
                  { at: 1, ease: 'ease-out' },
                ],
              ),
              {
                id: 'an-story-orb',
                type: 'container',
                props: {},
                styles: {
                  base: {
                    width: '140px',
                    height: '140px',
                    borderRadius: '9999px',
                    backgroundImage: 'radial-gradient(circle at 30% 30%, #facc15, #f97316)',
                  },
                },
                effects: [
                  {
                    plugin: 'animate-timeline',
                    enabled: true,
                    config: {
                      trigger: 'scroll',
                      scrollSource: 'pinned-section',
                      scrollStart: 0.15,
                      scrollEnd: 0.85,
                      steps: [
                        { at: 0, x: -300, scale: 0.4, rotate: -90 },
                        { at: 0.5, x: 0, scale: 1.3, rotate: 0, ease: 'ease-out' },
                        { at: 1, x: 300, scale: 0.6, rotate: 120, opacity: 0.4, ease: 'ease-in' },
                      ],
                    },
                  },
                ],
                children: [],
              },
              storyStep(
                'an-story-2',
                'Every step is scrubbed by the scrollbar',
                [0.4, 0.65],
                [
                  { at: 0, scale: 0.7, opacity: 0 },
                  { at: 1, ease: 'back-out' },
                ],
              ),
              storyStep(
                'an-story-3',
                'Then the section lets go.',
                [0.7, 0.95],
                [
                  { at: 0, x: 120, opacity: 0 },
                  { at: 1, ease: 'ease-out' },
                ],
              ),
            ],
          },
        ],
      },
      {
        id: 'an-after',
        type: 'section',
        props: {},
        styles: { base: { padding: '120px 24px', textAlign: 'center' } },
        children: [
          heading('an-after-title', 'Normal scrolling resumes here', { fontSize: '28px' }),
        ],
      },
      {
        id: 'an-presets',
        type: 'section',
        props: {},
        styles: { base: { padding: '60px 24px 160px', maxWidth: '1080px', margin: '0 auto' } },
        children: [
          heading('an-presets-title', 'Every entrance preset (replays on scroll)', {
            fontSize: '28px',
            marginBottom: '32px',
          }),
          {
            id: 'an-presets-grid',
            type: 'container',
            props: {},
            styles: {
              base: {
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                gap: '16px',
              },
            },
            children: [
              'fade',
              'fade-up',
              'fade-down',
              'fade-left',
              'fade-right',
              'slide-up',
              'zoom-in',
              'zoom-out',
              'pop',
              'rotate-in',
            ].map(presetTile),
          },
        ],
      },
    ],
  },
};
