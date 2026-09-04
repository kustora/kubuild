import { ResponsiveStyles } from '@kubuild/schema';
import { BlockDefinition, defaultGenId } from './types';

/**
 * Pre-composed UI Blocks (STORA-242).
 */
export const UI_STARTER_BLOCKS: BlockDefinition[] = [
  {
    id: 'hero-section',
    name: 'Hero Section',
    category: 'sections',
    categoryLabel: 'Hero & Headers',
    description: 'Engaging hero banner with headline, lead paragraph, and call-to-action button',
    icon: 'layout',
    createNodeTree: (gen = defaultGenId) => ({
      id: gen('section'),
      type: 'section',
      styles: {
        base: {
          padding: '80px 24px',
          backgroundColor: '#f8fafc',
          textAlign: 'center',
          width: '100%',
        },
      },
      children: [
        {
          id: gen('container'),
          type: 'container',
          props: { tag: 'div' },
          styles: { base: { maxWidth: '768px', margin: '0 auto' } },
          children: [
            {
              id: gen('heading'),
              type: 'heading',
              props: { text: 'Build Remarkable Experiences', level: 1 },
              styles: {
                base: {
                  fontSize: '44px',
                  fontWeight: '800',
                  color: '#0f172a',
                  marginBottom: '16px',
                  lineHeight: '1.2',
                },
              },
            },
            {
              id: gen('paragraph'),
              type: 'paragraph',
              props: {
                content:
                  'A visual builder designed for maximum craft, responsiveness, and performance.',
              },
              styles: {
                base: {
                  fontSize: '18px',
                  color: '#475569',
                  marginBottom: '32px',
                  lineHeight: '1.6',
                },
              },
            },
            {
              id: gen('button'),
              type: 'button',
              props: { label: 'Get Started Today', href: '#explore' },
              styles: {
                base: {
                  backgroundColor: '#2563eb',
                  color: '#ffffff',
                  padding: '12px 28px',
                  borderRadius: '8px',
                  fontWeight: '600',
                  display: 'inline-block',
                },
                states: {
                  ':hover': { backgroundColor: '#1d4ed8' },
                },
              } as unknown as ResponsiveStyles,
            },
          ],
        },
      ],
    }),
  },
  {
    id: 'feature-card',
    name: 'Feature Card',
    category: 'ui',
    categoryLabel: 'UI Blocks',
    description: 'Clean elevated feature card with badge, title, text, and action link',
    icon: 'box',
    createNodeTree: (gen = defaultGenId) => ({
      id: gen('container'),
      type: 'container',
      props: { tag: 'div' },
      styles: {
        base: {
          padding: '24px',
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
        },
      },
      children: [
        {
          id: gen('badge'),
          type: 'badge',
          props: { label: 'PRO FEATURE', variant: 'primary' },
          styles: { base: { marginBottom: '12px', display: 'inline-block' } },
        },
        {
          id: gen('heading'),
          type: 'heading',
          props: { text: 'Next-Gen Performance', level: 3 },
          styles: {
            base: { fontSize: '20px', fontWeight: '700', color: '#1e293b', marginBottom: '8px' },
          },
        },
        {
          id: gen('paragraph'),
          type: 'paragraph',
          props: {
            content: 'Engineered for sub-millisecond render updates and zero runtime overhead.',
          },
          styles: { base: { fontSize: '14px', color: '#64748b', lineHeight: '1.5' } },
        },
      ],
    }),
  },
  {
    id: 'media-object',
    name: 'Media Object',
    category: 'ui',
    categoryLabel: 'UI Blocks',
    description: 'Horizontal media layout with image beside text content',
    icon: 'image',
    createNodeTree: (gen = defaultGenId) => ({
      id: gen('container'),
      type: 'container',
      props: { tag: 'div' },
      styles: {
        base: {
          display: 'flex',
          gap: '16px',
          alignItems: 'flex-start',
          padding: '16px',
          backgroundColor: '#ffffff',
          borderRadius: '8px',
          border: '1px solid #e2e8f0',
        },
      },
      children: [
        {
          id: gen('image'),
          type: 'image',
          props: {
            src: 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=160&auto=format&fit=crop&q=80',
            alt: 'Visual preview',
          },
          styles: {
            base: {
              width: '80px',
              height: '80px',
              borderRadius: '8px',
              objectFit: 'cover',
              flexShrink: '0',
            },
          },
        },
        {
          id: gen('container'),
          type: 'container',
          props: { tag: 'div' },
          styles: { base: { flex: '1 1 0%' } },
          children: [
            {
              id: gen('heading'),
              type: 'heading',
              props: { text: 'Creative Studio Asset', level: 4 },
              styles: {
                base: { fontSize: '16px', fontWeight: '600', color: '#0f172a', marginBottom: '4px' },
              },
            },
            {
              id: gen('paragraph'),
              type: 'paragraph',
              props: { content: 'High dynamic range gradients crafted for modern presentations.' },
              styles: { base: { fontSize: '13px', color: '#64748b', lineHeight: '1.4' } },
            },
          ],
        },
      ],
    }),
  },
  {
    id: 'pricing-table',
    name: 'Pricing Table',
    category: 'pricing',
    categoryLabel: 'Pricing',
    description: 'Highlighted subscription pricing plan with price, feature list, and buy button',
    icon: 'table',
    createNodeTree: (gen = defaultGenId) => ({
      id: gen('container'),
      type: 'container',
      props: { tag: 'div' },
      styles: {
        base: {
          padding: '32px 24px',
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          border: '2px solid #3b82f6',
          boxShadow: '0 10px 15px -3px rgba(59, 130, 246, 0.1)',
          textAlign: 'center',
          maxWidth: '360px',
        },
      },
      children: [
        {
          id: gen('badge'),
          type: 'badge',
          props: { label: 'MOST POPULAR', variant: 'primary' },
          styles: { base: { marginBottom: '12px', display: 'inline-block' } },
        },
        {
          id: gen('heading'),
          type: 'heading',
          props: { text: 'Professional', level: 3 },
          styles: { base: { fontSize: '22px', fontWeight: '700', color: '#0f172a' } },
        },
        {
          id: gen('heading'),
          type: 'heading',
          props: { text: '$29 / mo', level: 2 },
          styles: {
            base: { fontSize: '36px', fontWeight: '800', color: '#2563eb', margin: '16px 0 24px 0' },
          },
        },
        {
          id: gen('paragraph'),
          type: 'paragraph',
          props: { content: 'Includes unlimited pages, custom domains, and team collaboration.' },
          styles: { base: { fontSize: '14px', color: '#64748b', marginBottom: '24px' } },
        },
        {
          id: gen('button'),
          type: 'button',
          props: { label: 'Upgrade to Pro', href: '#checkout' },
          styles: {
            base: {
              width: '100%',
              backgroundColor: '#2563eb',
              color: '#ffffff',
              padding: '12px',
              borderRadius: '8px',
              fontWeight: '600',
              display: 'block',
            },
            states: {
              ':hover': { backgroundColor: '#1d4ed8' },
            },
          } as unknown as ResponsiveStyles,
        },
      ],
    }),
  },
  {
    id: 'cta-banner',
    name: 'CTA Banner',
    category: 'cta',
    categoryLabel: 'Call to Action',
    description: 'High-contrast conversion banner with title and action button',
    icon: 'layout',
    createNodeTree: (gen = defaultGenId) => ({
      id: gen('section'),
      type: 'section',
      styles: {
        base: {
          padding: '60px 24px',
          backgroundColor: '#0f172a',
          color: '#ffffff',
          borderRadius: '16px',
          textAlign: 'center',
          width: '100%',
        },
      },
      children: [
        {
          id: gen('heading'),
          type: 'heading',
          props: { text: 'Ready to boost your workflow?', level: 2 },
          styles: {
            base: { fontSize: '32px', fontWeight: '700', color: '#ffffff', marginBottom: '12px' },
          },
        },
        {
          id: gen('paragraph'),
          type: 'paragraph',
          props: { content: 'Start building with zero installation and instant live preview.' },
          styles: {
            base: { fontSize: '16px', color: '#94a3b8', marginBottom: '24px', maxWidth: '600px', margin: '0 auto 24px auto' },
          },
        },
        {
          id: gen('button'),
          type: 'button',
          props: { label: 'Start Free Trial', href: '#signup' },
          styles: {
            base: {
              backgroundColor: '#ffffff',
              color: '#0f172a',
              padding: '12px 28px',
              borderRadius: '8px',
              fontWeight: '700',
              display: 'inline-block',
            },
            states: {
              ':hover': { backgroundColor: '#f1f5f9' },
            },
          } as unknown as ResponsiveStyles,
        },
      ],
    }),
  },
];

