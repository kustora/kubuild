import {
  CURRENT_SCHEMA_VERSION,
  type Node,
  type PageDocument,
  type StyleDefinition,
} from '@kubuild/schema';

/**
 * Playground page exercising the `@kubuild/plugin-animation` generator: entrance presets
 * (including a staggered grid), loops and hover states. Open it, hit Preview (or Export
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
