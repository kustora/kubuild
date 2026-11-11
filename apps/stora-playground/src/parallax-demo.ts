import { CURRENT_SCHEMA_VERSION, type Node, type PageDocument, type StyleDefinition } from '@kubuild/schema';

/**
 * Playground page exercising every `@kubuild/plugin-parallax` effect. Open it, hit
 * Preview (or Export HTML) and scroll. Uses gradients instead of photos so it works
 * offline: a 100% x 220% gradient overflows vertically, which is what
 * `parallax-background` moves through.
 */

const blob = (id: string, base: StyleDefinition, effects: Node['effects']): Node => ({
  id,
  type: 'container',
  props: {},
  styles: {
    base: { position: 'absolute', borderRadius: '9999px', pointerEvents: 'none', ...base },
  },
  effects,
  children: [],
});

const text = (id: string, content: string, base: StyleDefinition): Node => ({
  id,
  type: 'text',
  props: { content },
  styles: { base },
  children: [],
});

const card = (id: string, title: string, body: string, fromX: number): Node => ({
  id,
  type: 'container',
  props: {},
  styles: {
    base: {
      backgroundColor: '#ffffff',
      borderRadius: '16px',
      padding: '28px',
      boxShadow: '0 10px 30px -12px rgba(15, 23, 42, 0.25)',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
    },
  },
  effects: [
    { plugin: 'scroll-transform', enabled: true, config: { fromX, fromY: 80, fromOpacity: 0, end: 0.45 } },
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

export const parallaxDemoDocument: PageDocument = {
  schema: 'stora.page',
  version: CURRENT_SCHEMA_VERSION,
  metadata: {
    title: 'Parallax Demo',
    description: 'Every effect from @kubuild/plugin-parallax on one page',
    author: 'KUBUILD Team',
    tags: ['effects', 'parallax'],
    category: 'demo',
    version: '1.0.0',
  },
  document: {
    id: 'parallax-root',
    type: 'page',
    props: { title: 'Parallax Demo' },
    styles: { base: { backgroundColor: '#f8fafc', fontFamily: 'Inter, sans-serif', color: '#0f172a' } },
    children: [
      {
        id: 'px-hero',
        type: 'section',
        props: {},
        styles: {
          base: {
            position: 'relative',
            overflow: 'hidden',
            minHeight: '640px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '16px',
            padding: '96px 24px',
            textAlign: 'center',
            backgroundImage: 'linear-gradient(180deg, #1e3a8a 0%, #2563eb 35%, #7c3aed 70%, #0f172a 100%)',
            backgroundSize: '100% 220%',
            backgroundRepeat: 'no-repeat',
          },
        },
        effects: [{ plugin: 'parallax-background', enabled: true, config: { speed: 0.8 } }],
        children: [
          blob('px-blob-far', { top: '12%', left: '8%', width: '220px', height: '220px', backgroundColor: 'rgba(255,255,255,0.10)' }, [
            { plugin: 'parallax-scroll', enabled: true, config: { speed: 0.45 } },
            { plugin: 'pointer-parallax', enabled: true, config: { strength: 12, invert: true } },
          ]),
          blob('px-blob-mid', { bottom: '10%', right: '10%', width: '160px', height: '160px', backgroundColor: 'rgba(250,204,21,0.35)' }, [
            { plugin: 'parallax-scroll', enabled: true, config: { speed: 0.25 } },
            { plugin: 'pointer-parallax', enabled: true, config: { strength: 28 } },
          ]),
          blob('px-blob-near', { top: '55%', left: '18%', width: '70px', height: '70px', backgroundColor: 'rgba(244,114,182,0.6)' }, [
            { plugin: 'parallax-scroll', enabled: true, config: { speed: -0.2 } },
            { plugin: 'pointer-parallax', enabled: true, config: { strength: 45 } },
          ]),
          {
            id: 'px-hero-title',
            type: 'heading',
            props: { text: 'Scroll me', level: 1 },
            styles: { base: { fontSize: '64px', fontWeight: '800', color: '#ffffff', position: 'relative' } },
            effects: [{ plugin: 'parallax-scroll', enabled: true, config: { speed: 0.15 } }],
            children: [],
          },
          text('px-hero-sub', 'Background, layers, cards and pointer effects — all plain document data, run by plugins.', {
            fontSize: '18px',
            color: 'rgba(255,255,255,0.85)',
            maxWidth: '560px',
            position: 'relative',
          }),
        ],
      },
      {
        id: 'px-cards',
        type: 'section',
        props: {},
        styles: {
          base: {
            padding: '120px 24px',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '24px',
            maxWidth: '1080px',
            margin: '0 auto',
          },
        },
        children: [
          card('px-card-1', 'parallax-background', 'Moves the hero gradient through its own overflow as the section scrolls.', -60),
          card('px-card-2', 'parallax-scroll', 'Layers lag or lead the scroll by their speed, so they read as near or far.', 0),
          card('px-card-3', 'scroll-transform', 'These cards slide and fade in between two states as they enter the viewport.', 60),
        ],
      },
      {
        id: 'px-zoom',
        type: 'section',
        props: {},
        styles: {
          base: {
            minHeight: '520px',
            margin: '0 24px 160px',
            borderRadius: '24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundImage: 'radial-gradient(circle at 30% 30%, #22d3ee, #0f172a 70%)',
          },
        },
        effects: [
          {
            plugin: 'scroll-transform',
            enabled: true,
            config: { fromY: 0, fromOpacity: 1, fromScale: 0.85, toScale: 1, start: 0, end: 0.5, easing: 'ease-in-out' },
          },
        ],
        children: [
          {
            id: 'px-zoom-title',
            type: 'heading',
            props: { text: 'Zoom on scroll', level: 2 },
            styles: { base: { fontSize: '44px', fontWeight: '800', color: '#ffffff' } },
            children: [],
          },
        ],
      },
    ],
  },
};
