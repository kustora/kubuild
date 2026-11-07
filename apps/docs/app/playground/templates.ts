import {
  TemplateRecordSchema,
  type PageDocument,
  type TemplateRecord,
} from '@kubuild/schema';

export const SAAS_LANDING_DOC: PageDocument = {
  schema: 'stora.page',
  version: '1.3.0',
  metadata: {
    title: 'SaaS Landing Page',
    description: 'Modern SaaS landing page template with hero, features, and call-to-action.',
    author: 'KUBUILD Team',
    tags: ['saas', 'landing', 'marketing'],
    category: 'landing',
    version: '1.0.0',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  document: {
    id: 'root-page',
    type: 'page',
    props: { title: 'KUBUILD Cloud Platform' },
    styles: {
      base: {
        backgroundColor: '#090a0f',
        fontFamily: 'Inter, system-ui, sans-serif',
        color: '#f8fafc',
        minHeight: '100vh',
      },
    },
    children: [
      {
        id: 'hero-section',
        type: 'section',
        props: {},
        styles: {
          base: {
            paddingTop: '80px',
            paddingBottom: '80px',
            paddingLeft: '24px',
            paddingRight: '24px',
            backgroundColor: 'transparent',
          },
        },
        children: [
          {
            id: 'hero-container',
            type: 'container',
            props: { maxWidth: '1100px' },
            styles: {
              base: {
                margin: '0 auto',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                gap: '20px',
              },
            },
            children: [
              {
                id: 'hero-badge',
                type: 'badge',
                props: { text: '⚡️ Next-Gen Visual Web Builder' },
                styles: {
                  base: {
                    backgroundColor: 'rgba(99, 102, 241, 0.15)',
                    color: '#818cf8',
                    border: '1px solid rgba(99, 102, 241, 0.3)',
                    paddingTop: '6px',
                    paddingBottom: '6px',
                    paddingLeft: '14px',
                    paddingRight: '14px',
                    borderRadius: '9999px',
                    fontSize: '13px',
                    fontWeight: '600',
                  },
                },
              },
              {
                id: 'hero-heading',
                type: 'heading',
                props: { text: 'Ship Web Applications at The Speed of Thought', level: 1 },
                styles: {
                  base: {
                    fontSize: '52px',
                    fontWeight: '800',
                    lineHeight: '1.15',
                    letterSpacing: '-0.03em',
                    color: '#ffffff',
                    maxWidth: '840px',
                  },
                },
              },
              {
                id: 'hero-desc',
                type: 'paragraph',
                props: {
                  text: 'KUBUILD gives engineering teams portable, JSON-driven visual builders with zero vendor lock-in. Compile to clean React components or render on the edge.',
                },
                styles: {
                  base: {
                    fontSize: '18px',
                    lineHeight: '1.6',
                    color: '#94a3b8',
                    maxWidth: '680px',
                  },
                },
              },
              {
                id: 'hero-actions',
                type: 'container',
                props: {},
                styles: {
                  base: {
                    display: 'flex',
                    gap: '16px',
                    marginTop: '12px',
                    alignItems: 'center',
                    justifyContent: 'center',
                  },
                },
                children: [
                  {
                    id: 'hero-btn-primary',
                    type: 'button',
                    props: { text: 'Start Building Free', variant: 'primary' },
                    styles: {
                      base: {
                        backgroundColor: '#6366f1',
                        color: '#ffffff',
                        paddingTop: '12px',
                        paddingBottom: '12px',
                        paddingLeft: '28px',
                        paddingRight: '28px',
                        borderRadius: '10px',
                        fontWeight: '600',
                        fontSize: '15px',
                        border: 'none',
                        cursor: 'pointer',
                      },
                    },
                  },
                  {
                    id: 'hero-btn-secondary',
                    type: 'button',
                    props: { text: 'Read Documentation', variant: 'secondary' },
                    styles: {
                      base: {
                        backgroundColor: 'rgba(255, 255, 255, 0.08)',
                        color: '#e2e8f0',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        paddingTop: '12px',
                        paddingBottom: '12px',
                        paddingLeft: '24px',
                        paddingRight: '24px',
                        borderRadius: '10px',
                        fontWeight: '600',
                        fontSize: '15px',
                        cursor: 'pointer',
                      },
                    },
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        id: 'features-section',
        type: 'section',
        props: {},
        styles: {
          base: {
            paddingTop: '64px',
            paddingBottom: '80px',
            paddingLeft: '24px',
            paddingRight: '24px',
            backgroundColor: 'rgba(255, 255, 255, 0.02)',
            borderTop: '1px solid rgba(255, 255, 255, 0.06)',
          },
        },
        children: [
          {
            id: 'features-container',
            type: 'container',
            props: { maxWidth: '1100px' },
            styles: {
              base: {
                margin: '0 auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '40px',
              },
            },
            children: [
              {
                id: 'features-heading',
                type: 'heading',
                props: { text: 'Engineered for Modern Stacks', level: 2 },
                styles: {
                  base: {
                    textAlign: 'center',
                    fontSize: '32px',
                    fontWeight: '700',
                    color: '#ffffff',
                  },
                },
              },
              {
                id: 'features-columns',
                type: 'columns',
                props: { columns: 3, gap: '24px' },
                styles: {
                  base: {
                    display: 'flex',
                    gap: '24px',
                    width: '100%',
                  },
                },
                children: [
                  {
                    id: 'card-1',
                    type: 'container',
                    props: {},
                    styles: {
                      base: {
                        flex: '1 1 0%',
                        padding: '24px',
                        backgroundColor: '#11131a',
                        borderRadius: '14px',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px',
                      },
                    },
                    children: [
                      {
                        id: 'card-1-title',
                        type: 'heading',
                        props: { text: 'Open .stora Format', level: 3 },
                        styles: { base: { fontSize: '18px', fontWeight: '600', color: '#ffffff' } },
                      },
                      {
                        id: 'card-1-text',
                        type: 'paragraph',
                        props: {
                          text: 'Store layouts as human-readable JSON. Version control your pages with Git like normal code.',
                        },
                        styles: { base: { fontSize: '14px', color: '#94a3b8', lineHeight: '1.5' } },
                      },
                    ],
                  },
                  {
                    id: 'card-2',
                    type: 'container',
                    props: {},
                    styles: {
                      base: {
                        flex: '1 1 0%',
                        padding: '24px',
                        backgroundColor: '#11131a',
                        borderRadius: '14px',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px',
                      },
                    },
                    children: [
                      {
                        id: 'card-2-title',
                        type: 'heading',
                        props: { text: 'Zero SSR Lock-In', level: 3 },
                        styles: { base: { fontSize: '18px', fontWeight: '600', color: '#ffffff' } },
                      },
                      {
                        id: 'card-2-text',
                        type: 'paragraph',
                        props: {
                          text: 'Clean hydration in Next.js, Remix, Astro, or plain HTML string export for headless emails.',
                        },
                        styles: { base: { fontSize: '14px', color: '#94a3b8', lineHeight: '1.5' } },
                      },
                    ],
                  },
                  {
                    id: 'card-3',
                    type: 'container',
                    props: {},
                    styles: {
                      base: {
                        flex: '1 1 0%',
                        padding: '24px',
                        backgroundColor: '#11131a',
                        borderRadius: '14px',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px',
                      },
                    },
                    children: [
                      {
                        id: 'card-3-title',
                        type: 'heading',
                        props: { text: 'Custom Component Slots', level: 3 },
                        styles: { base: { fontSize: '18px', fontWeight: '600', color: '#ffffff' } },
                      },
                      {
                        id: 'card-3-text',
                        type: 'paragraph',
                        props: {
                          text: 'Bring your own Design System components directly into the builder canvas effortlessly.',
                        },
                        styles: { base: { fontSize: '14px', color: '#94a3b8', lineHeight: '1.5' } },
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
};

export const CREATOR_BIO_DOC: PageDocument = {
  schema: 'stora.page',
  version: '1.3.0',
  metadata: {
    title: 'Creator Link-in-Bio',
    description: 'Clean and compact personal link tree for creators, developers, and founders.',
    author: 'KUBUILD Team',
    tags: ['bio', 'links', 'creator', 'mobile'],
    category: 'bio',
    version: '1.0.0',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  document: {
    id: 'root-page',
    type: 'page',
    props: { title: 'Alex Vance | Links' },
    styles: {
      base: {
        backgroundColor: '#0f172a',
        fontFamily: 'Inter, system-ui, sans-serif',
        color: '#f8fafc',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-start',
      },
    },
    children: [
      {
        id: 'bio-section',
        type: 'section',
        props: {},
        styles: {
          base: {
            width: '100%',
            maxWidth: '480px',
            paddingTop: '64px',
            paddingBottom: '48px',
            paddingLeft: '20px',
            paddingRight: '20px',
            margin: '0 auto',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '24px',
          },
        },
        children: [
          {
            id: 'avatar-container',
            type: 'container',
            props: {},
            styles: {
              base: {
                width: '96px',
                height: '96px',
                borderRadius: '9999px',
                backgroundColor: 'rgba(99, 102, 241, 0.2)',
                border: '2px solid #818cf8',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '32px',
                boxShadow: '0 8px 24px rgba(99, 102, 241, 0.25)',
              },
            },
            children: [
              {
                id: 'avatar-text',
                type: 'text',
                props: { text: '🚀' },
              },
            ],
          },
          {
            id: 'creator-info',
            type: 'container',
            props: {},
            styles: {
              base: {
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                gap: '6px',
              },
            },
            children: [
              {
                id: 'creator-name',
                type: 'heading',
                props: { text: 'Alex Vance', level: 1 },
                styles: { base: { fontSize: '24px', fontWeight: '700', color: '#ffffff' } },
              },
              {
                id: 'creator-tag',
                type: 'paragraph',
                props: { text: 'Senior Fullstack Engineer & Indie Hacker' },
                styles: { base: { fontSize: '14px', color: '#94a3b8' } },
              },
              {
                id: 'creator-bio',
                type: 'paragraph',
                props: { text: 'Sharing tutorials on TypeScript, Next.js, and web architecture.' },
                styles: { base: { fontSize: '13px', color: '#64748b', maxWidth: '340px' } },
              },
            ],
          },
          {
            id: 'links-stack',
            type: 'container',
            props: {},
            styles: {
              base: {
                width: '100%',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
                marginTop: '12px',
              },
            },
            children: [
              {
                id: 'link-youtube',
                type: 'button',
                props: { text: '📺 Watch My Latest YouTube Video', variant: 'secondary' },
                styles: {
                  base: {
                    width: '100%',
                    paddingTop: '16px',
                    paddingBottom: '16px',
                    paddingLeft: '20px',
                    paddingRight: '20px',
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '12px',
                    color: '#ffffff',
                    fontWeight: '600',
                    fontSize: '15px',
                    textAlign: 'center',
                    cursor: 'pointer',
                  },
                },
              },
              {
                id: 'link-newsletter',
                type: 'button',
                props: { text: '💌 Join 12,000+ Readers Newsletter', variant: 'secondary' },
                styles: {
                  base: {
                    width: '100%',
                    paddingTop: '16px',
                    paddingBottom: '16px',
                    paddingLeft: '20px',
                    paddingRight: '20px',
                    backgroundColor: 'rgba(99, 102, 241, 0.1)',
                    border: '1px solid rgba(99, 102, 241, 0.3)',
                    borderRadius: '12px',
                    color: '#a5b4fc',
                    fontWeight: '600',
                    fontSize: '15px',
                    textAlign: 'center',
                    cursor: 'pointer',
                  },
                },
              },
              {
                id: 'link-github',
                type: 'button',
                props: { text: '💻 Explore My Open Source Projects', variant: 'secondary' },
                styles: {
                  base: {
                    width: '100%',
                    paddingTop: '16px',
                    paddingBottom: '16px',
                    paddingLeft: '20px',
                    paddingRight: '20px',
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '12px',
                    color: '#ffffff',
                    fontWeight: '600',
                    fontSize: '15px',
                    textAlign: 'center',
                    cursor: 'pointer',
                  },
                },
              },
              {
                id: 'link-discord',
                type: 'button',
                props: { text: '💬 Join Discord Community', variant: 'secondary' },
                styles: {
                  base: {
                    width: '100%',
                    paddingTop: '16px',
                    paddingBottom: '16px',
                    paddingLeft: '20px',
                    paddingRight: '20px',
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '12px',
                    color: '#ffffff',
                    fontWeight: '600',
                    fontSize: '15px',
                    textAlign: 'center',
                    cursor: 'pointer',
                  },
                },
              },
            ],
          },
        ],
      },
    ],
  },
};

export const MINIMAL_PORTFOLIO_DOC: PageDocument = {
  schema: 'stora.page',
  version: '1.3.0',
  metadata: {
    title: 'Minimal Portfolio',
    description: 'Clean and typographic portfolio for designers, architects, and creative technologists.',
    author: 'KUBUILD Team',
    tags: ['portfolio', 'design', 'minimal'],
    category: 'portfolio',
    version: '1.0.0',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  document: {
    id: 'root-page',
    type: 'page',
    props: { title: 'Elena Rossi — Portfolio' },
    styles: {
      base: {
        backgroundColor: '#ffffff',
        fontFamily: 'Inter, system-ui, sans-serif',
        color: '#18181b',
        minHeight: '100vh',
      },
    },
    children: [
      {
        id: 'portfolio-header',
        type: 'section',
        props: {},
        styles: {
          base: {
            paddingTop: '96px',
            paddingBottom: '56px',
            paddingLeft: '32px',
            paddingRight: '32px',
            backgroundColor: '#ffffff',
          },
        },
        children: [
          {
            id: 'portfolio-header-container',
            type: 'container',
            props: { maxWidth: '960px' },
            styles: {
              base: {
                margin: '0 auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '24px',
              },
            },
            children: [
              {
                id: 'portfolio-subtitle',
                type: 'text',
                props: { text: 'PRODUCT DESIGNER & CREATIVE ENGINEER' },
                styles: {
                  base: {
                    fontSize: '12px',
                    fontWeight: '700',
                    letterSpacing: '0.12em',
                    color: '#71717a',
                  },
                },
              },
              {
                id: 'portfolio-title',
                type: 'heading',
                props: { text: 'Crafting expressive digital interfaces and design systems.', level: 1 },
                styles: {
                  base: {
                    fontSize: '44px',
                    fontWeight: '800',
                    lineHeight: '1.18',
                    letterSpacing: '-0.03em',
                    color: '#09090b',
                    maxWidth: '720px',
                  },
                },
              },
              {
                id: 'portfolio-intro',
                type: 'paragraph',
                props: {
                  text: 'Previously design lead at Linear. Currently exploring generative design tools, portable document runtimes, and typography.',
                },
                styles: {
                  base: {
                    fontSize: '18px',
                    lineHeight: '1.65',
                    color: '#52525b',
                    maxWidth: '680px',
                  },
                },
              },
            ],
          },
        ],
      },
      {
        id: 'portfolio-work-section',
        type: 'section',
        props: {},
        styles: {
          base: {
            paddingTop: '32px',
            paddingBottom: '96px',
            paddingLeft: '32px',
            paddingRight: '32px',
            borderTop: '1px solid #f4f4f5',
          },
        },
        children: [
          {
            id: 'work-container',
            type: 'container',
            props: { maxWidth: '960px' },
            styles: {
              base: {
                margin: '0 auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '32px',
              },
            },
            children: [
              {
                id: 'work-header',
                type: 'heading',
                props: { text: 'Selected Projects', level: 2 },
                styles: { base: { fontSize: '24px', fontWeight: '700', color: '#18181b' } },
              },
              {
                id: 'project-grid',
                type: 'columns',
                props: { columns: 2, gap: '24px' },
                styles: {
                  base: {
                    display: 'flex',
                    gap: '24px',
                    width: '100%',
                  },
                },
                children: [
                  {
                    id: 'proj-1',
                    type: 'container',
                    props: {},
                    styles: {
                      base: {
                        flex: '1 1 0%',
                        padding: '32px',
                        backgroundColor: '#fafafa',
                        borderRadius: '16px',
                        border: '1px solid #e4e4e7',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px',
                      },
                    },
                    children: [
                      {
                        id: 'proj-1-tag',
                        type: 'text',
                        props: { text: 'DESIGN SYSTEM • 2026' },
                        styles: { base: { fontSize: '11px', fontWeight: '700', color: '#a1a1aa' } },
                      },
                      {
                        id: 'proj-1-title',
                        type: 'heading',
                        props: { text: 'Aura UI Framework', level: 3 },
                        styles: { base: { fontSize: '20px', fontWeight: '700', color: '#18181b' } },
                      },
                      {
                        id: 'proj-1-desc',
                        type: 'paragraph',
                        props: {
                          text: 'High-density design token pipeline and accessible component tokens for enterprise dashboards.',
                        },
                        styles: { base: { fontSize: '14px', color: '#71717a', lineHeight: '1.5' } },
                      },
                    ],
                  },
                  {
                    id: 'proj-2',
                    type: 'container',
                    props: {},
                    styles: {
                      base: {
                        flex: '1 1 0%',
                        padding: '32px',
                        backgroundColor: '#fafafa',
                        borderRadius: '16px',
                        border: '1px solid #e4e4e7',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px',
                      },
                    },
                    children: [
                      {
                        id: 'proj-2-tag',
                        type: 'text',
                        props: { text: 'MOBILE APP • 2025' },
                        styles: { base: { fontSize: '11px', fontWeight: '700', color: '#a1a1aa' } },
                      },
                      {
                        id: 'proj-2-title',
                        type: 'heading',
                        props: { text: 'Vesper Audio Journal', level: 3 },
                        styles: { base: { fontSize: '20px', fontWeight: '700', color: '#18181b' } },
                      },
                      {
                        id: 'proj-2-desc',
                        type: 'paragraph',
                        props: {
                          text: 'Voice-first reflection tool with AI transcription, soundscapes, and gesture navigation.',
                        },
                        styles: { base: { fontSize: '14px', color: '#71717a', lineHeight: '1.5' } },
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
};

export const PLAYGROUND_TEMPLATES: TemplateRecord[] = [
  TemplateRecordSchema.parse({
    id: 'saas-landing',
    name: 'SaaS Landing Page',
    description: 'High-converting SaaS landing page with dark theme, badge, and features grid.',
    category: 'landing',
    tags: ['saas', 'landing', 'marketing'],
    author: 'KUBUILD Team',
    version: '1.0.0',
    document: SAAS_LANDING_DOC,
  }),
  TemplateRecordSchema.parse({
    id: 'creator-link-in-bio',
    name: 'Creator Link-in-Bio',
    description: 'Personal mobile-optimized link page for creators and social media bios.',
    category: 'bio',
    tags: ['creator', 'links', 'social'],
    author: 'KUBUILD Team',
    version: '1.0.0',
    document: CREATOR_BIO_DOC,
  }),
  TemplateRecordSchema.parse({
    id: 'minimal-portfolio',
    name: 'Minimal Portfolio',
    description: 'Clean typographic portfolio showcasing projects and design work.',
    category: 'portfolio',
    tags: ['portfolio', 'minimal', 'designer'],
    author: 'KUBUILD Team',
    version: '1.0.0',
    document: MINIMAL_PORTFOLIO_DOC,
  }),
];
