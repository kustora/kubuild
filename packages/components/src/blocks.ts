import { Node, ResponsiveStyles } from '@kubuild/schema';

export interface BlockDefinition {
  id: string;
  name: string;
  category: 'layout' | 'sections' | 'ui' | 'pricing' | 'cta' | 'forms' | string;
  categoryLabel?: string;
  description?: string;
  icon?: string;
  thumbnailSvg?: string;
  createNodeTree: (generateId?: (prefix?: string) => string) => Node;
}

let nextId = 1;
function defaultGenId(prefix = 'node'): string {
  return `${prefix}-${Date.now().toString(36)}-${(nextId++).toString(36)}`;
}

/**
 * Predefined Starter Layout Blocks (STORA-241) and Pre-composed UI Blocks (STORA-242).
 */
export const STARTER_BLOCKS: BlockDefinition[] = [
  // --- Layout Blocks (STORA-241) ---
  {
    id: 'layout-1-col',
    name: '1 Column',
    category: 'layout',
    categoryLabel: 'Layout Blocks',
    description: 'Full-width single column container inside a section',
    icon: 'layout',
    createNodeTree: (gen = defaultGenId) => ({
      id: gen('section'),
      type: 'section',
      styles: { base: { padding: '40px 20px', width: '100%' } },
      children: [
        {
          id: gen('container'),
          type: 'container',
          props: { tag: 'div' },
          styles: { base: { maxWidth: '1200px', margin: '0 auto', width: '100%' } },
          children: [],
        },
      ],
    }),
  },
  {
    id: 'layout-2-col-50-50',
    name: '2 Columns (50/50)',
    category: 'layout',
    categoryLabel: 'Layout Blocks',
    description: 'Two equal-width 50/50 columns with flexible layout',
    icon: 'columns',
    createNodeTree: (gen = defaultGenId) => ({
      id: gen('section'),
      type: 'section',
      styles: { base: { padding: '40px 20px', width: '100%' } },
      children: [
        {
          id: gen('columns'),
          type: 'columns',
          props: { columns: 2, gap: '24px' },
          styles: { base: { display: 'flex', gap: '24px', width: '100%', maxWidth: '1200px', margin: '0 auto' } },
          children: [
            {
              id: gen('container'),
              type: 'container',
              props: { tag: 'div' },
              styles: { base: { flex: '1 1 0%', minWidth: '0' } },
              children: [],
            },
            {
              id: gen('container'),
              type: 'container',
              props: { tag: 'div' },
              styles: { base: { flex: '1 1 0%', minWidth: '0' } },
              children: [],
            },
          ],
        },
      ],
    }),
  },
  {
    id: 'layout-2-col-30-70',
    name: '2 Columns (30/70)',
    category: 'layout',
    categoryLabel: 'Layout Blocks',
    description: 'Two asymmetric columns: 30% sidebar and 70% main area',
    icon: 'columns',
    createNodeTree: (gen = defaultGenId) => ({
      id: gen('section'),
      type: 'section',
      styles: { base: { padding: '40px 20px', width: '100%' } },
      children: [
        {
          id: gen('columns'),
          type: 'columns',
          props: { columns: 2, gap: '24px' },
          styles: { base: { display: 'flex', gap: '24px', width: '100%', maxWidth: '1200px', margin: '0 auto' } },
          children: [
            {
              id: gen('container'),
              type: 'container',
              props: { tag: 'div' },
              styles: { base: { flex: '0 0 30%', minWidth: '0' } },
              children: [],
            },
            {
              id: gen('container'),
              type: 'container',
              props: { tag: 'div' },
              styles: { base: { flex: '1 1 0%', minWidth: '0' } },
              children: [],
            },
          ],
        },
      ],
    }),
  },
  {
    id: 'layout-3-col',
    name: '3 Columns',
    category: 'layout',
    categoryLabel: 'Layout Blocks',
    description: 'Three equal-width columns for grid showcases or card groups',
    icon: 'grid',
    createNodeTree: (gen = defaultGenId) => ({
      id: gen('section'),
      type: 'section',
      styles: { base: { padding: '40px 20px', width: '100%' } },
      children: [
        {
          id: gen('columns'),
          type: 'columns',
          props: { columns: 3, gap: '24px' },
          styles: { base: { display: 'flex', gap: '24px', width: '100%', maxWidth: '1200px', margin: '0 auto' } },
          children: [
            {
              id: gen('container'),
              type: 'container',
              props: { tag: 'div' },
              styles: { base: { flex: '1 1 0%', minWidth: '0' } },
              children: [],
            },
            {
              id: gen('container'),
              type: 'container',
              props: { tag: 'div' },
              styles: { base: { flex: '1 1 0%', minWidth: '0' } },
              children: [],
            },
            {
              id: gen('container'),
              type: 'container',
              props: { tag: 'div' },
              styles: { base: { flex: '1 1 0%', minWidth: '0' } },
              children: [],
            },
          ],
        },
      ],
    }),
  },
  {
    id: 'layout-4-col',
    name: '4 Columns',
    category: 'layout',
    categoryLabel: 'Layout Blocks',
    description: 'Four equal columns for metric stats, logos, or compact feature cards',
    icon: 'grid',
    createNodeTree: (gen = defaultGenId) => ({
      id: gen('section'),
      type: 'section',
      styles: { base: { padding: '40px 20px', width: '100%' } },
      children: [
        {
          id: gen('columns'),
          type: 'columns',
          props: { columns: 4, gap: '16px' },
          styles: { base: { display: 'flex', gap: '16px', width: '100%', maxWidth: '1200px', margin: '0 auto' } },
          children: [
            {
              id: gen('container'),
              type: 'container',
              props: { tag: 'div' },
              styles: { base: { flex: '1 1 0%', minWidth: '0' } },
              children: [],
            },
            {
              id: gen('container'),
              type: 'container',
              props: { tag: 'div' },
              styles: { base: { flex: '1 1 0%', minWidth: '0' } },
              children: [],
            },
            {
              id: gen('container'),
              type: 'container',
              props: { tag: 'div' },
              styles: { base: { flex: '1 1 0%', minWidth: '0' } },
              children: [],
            },
            {
              id: gen('container'),
              type: 'container',
              props: { tag: 'div' },
              styles: { base: { flex: '1 1 0%', minWidth: '0' } },
              children: [],
            },
          ],
        },
      ],
    }),
  },

  // --- Pre-composed UI Blocks (STORA-242) ---
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

  // --- Starter Form Templates (STORA-350) ---
  {
    id: 'form-contact-us',
    name: 'Contact Us Form',
    category: 'forms',
    categoryLabel: 'Form Templates',
    description: 'Contact form with Name, Email, Subject, Message, and submit action pipeline with API request and toast notifications',
    icon: 'form',
    createNodeTree: (gen = defaultGenId) => ({
      id: gen('section'),
      type: 'section',
      styles: {
        base: {
          padding: '64px 20px',
          backgroundColor: '#f8fafc',
          width: '100%',
        },
      },
      children: [
        {
          id: gen('container'),
          type: 'container',
          props: { tag: 'div', maxWidth: '640px' },
          styles: {
            base: {
              maxWidth: '640px',
              margin: '0 auto',
              width: '100%',
              backgroundColor: '#ffffff',
              padding: '36px',
              borderRadius: '16px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05)',
              border: '1px solid #e2e8f0',
            },
          },
          children: [
            {
              id: gen('heading'),
              type: 'heading',
              props: { text: 'Contact Us', level: 2 },
              styles: {
                base: {
                  fontSize: '28px',
                  fontWeight: '700',
                  color: '#0f172a',
                  marginBottom: '8px',
                  textAlign: 'center',
                },
              },
            },
            {
              id: gen('paragraph'),
              type: 'paragraph',
              props: {
                content: 'Have questions or need assistance? Fill out the form below and we will get back to you shortly.',
              },
              styles: {
                base: {
                  fontSize: '15px',
                  color: '#64748b',
                  marginBottom: '28px',
                  textAlign: 'center',
                  lineHeight: '1.5',
                },
              },
            },
            {
              id: gen('form'),
              type: 'form',
              props: {
                name: 'contact_us_form',
                method: 'POST',
                preventDefault: true,
                scrollToFirstError: true,
                resetOnSubmit: true,
              },
              styles: {
                base: {
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '20px',
                  width: '100%',
                },
              },
              actions: [
                {
                  id: gen('pipeline'),
                  trigger: 'submit',
                  label: 'Submit Contact Form',
                  enabled: true,
                  steps: [
                    {
                      id: gen('step'),
                      type: 'api_request',
                      label: 'Send Contact Message',
                      payload: {
                        url: '/api/mock/submit-lead',
                        method: 'POST',
                        bodyFormat: 'json',
                      },
                      onSuccess: [
                        {
                          id: gen('step'),
                          type: 'show_toast',
                          label: 'Show Success Toast',
                          payload: {
                            message: 'Thank you! Your message has been sent successfully.',
                            type: 'success',
                            title: 'Message Sent',
                            duration: 4000,
                          },
                        },
                        {
                          id: gen('step'),
                          type: 'reset_form',
                          label: 'Reset Form',
                          payload: {},
                        },
                      ],
                      onError: [
                        {
                          id: gen('step'),
                          type: 'show_toast',
                          label: 'Show Error Toast',
                          payload: {
                            message: 'Failed to send message. Please check your connection and try again.',
                            type: 'error',
                            title: 'Submission Failed',
                            duration: 5000,
                          },
                        },
                      ],
                    },
                  ],
                },
              ],
              children: [
                {
                  id: gen('input'),
                  type: 'input',
                  props: {
                    name: 'name',
                    label: 'Your Name',
                    type: 'text',
                    placeholder: 'Jane Doe',
                    required: true,
                    rules: [
                      { type: 'required', message: 'Please enter your name' },
                      { type: 'min_length', value: 2, message: 'Name must be at least 2 characters' },
                    ],
                  },
                  styles: {
                    base: {
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '14px',
                    },
                  },
                },
                {
                  id: gen('input'),
                  type: 'input',
                  props: {
                    name: 'email',
                    label: 'Email Address',
                    type: 'email',
                    placeholder: 'jane@example.com',
                    required: true,
                    rules: [
                      { type: 'required', message: 'Please enter your email' },
                      { type: 'email', message: 'Please enter a valid email address' },
                    ],
                  },
                  styles: {
                    base: {
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '14px',
                    },
                  },
                },
                {
                  id: gen('input'),
                  type: 'input',
                  props: {
                    name: 'subject',
                    label: 'Subject',
                    type: 'text',
                    placeholder: 'How can we help you?',
                    required: true,
                    rules: [
                      { type: 'required', message: 'Please enter a subject' },
                    ],
                  },
                  styles: {
                    base: {
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '14px',
                    },
                  },
                },
                {
                  id: gen('textarea'),
                  type: 'textarea',
                  props: {
                    name: 'message',
                    label: 'Message',
                    placeholder: 'Write your message here...',
                    rows: 4,
                    required: true,
                    rules: [
                      { type: 'required', message: 'Please enter your message' },
                      { type: 'min_length', value: 10, message: 'Message must be at least 10 characters' },
                    ],
                  },
                  styles: {
                    base: {
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '14px',
                    },
                  },
                },
                {
                  id: gen('button'),
                  type: 'button',
                  props: {
                    label: 'Send Message',
                    variant: 'primary',
                    buttonType: 'submit',
                  },
                  styles: {
                    base: {
                      width: '100%',
                      backgroundColor: '#2563eb',
                      color: '#ffffff',
                      padding: '12px',
                      borderRadius: '8px',
                      fontWeight: '600',
                      fontSize: '15px',
                      display: 'inline-block',
                      textAlign: 'center',
                    },
                    states: {
                      ':hover': { backgroundColor: '#1d4ed8' },
                    },
                  } as unknown as ResponsiveStyles,
                },
              ],
            },
          ],
        },
      ],
    }),
  },
  {
    id: 'form-newsletter',
    name: 'Newsletter Subscribe Form',
    category: 'forms',
    categoryLabel: 'Form Templates',
    description: 'Inline email newsletter subscription form with real-time feedback',
    icon: 'mail',
    createNodeTree: (gen = defaultGenId) => ({
      id: gen('section'),
      type: 'section',
      styles: {
        base: {
          padding: '48px 20px',
          backgroundColor: '#f1f5f9',
          width: '100%',
        },
      },
      children: [
        {
          id: gen('container'),
          type: 'container',
          props: { tag: 'div', maxWidth: '580px' },
          styles: {
            base: {
              maxWidth: '580px',
              margin: '0 auto',
              width: '100%',
              textAlign: 'center',
            },
          },
          children: [
            {
              id: gen('heading'),
              type: 'heading',
              props: { text: 'Stay in the Loop', level: 3 },
              styles: {
                base: {
                  fontSize: '26px',
                  fontWeight: '700',
                  color: '#0f172a',
                  marginBottom: '8px',
                },
              },
            },
            {
              id: gen('paragraph'),
              type: 'paragraph',
              props: {
                content: 'Subscribe to our newsletter for weekly curated insights, updates, and best practices.',
              },
              styles: {
                base: {
                  fontSize: '15px',
                  color: '#64748b',
                  marginBottom: '24px',
                  lineHeight: '1.5',
                },
              },
            },
            {
              id: gen('form'),
              type: 'form',
              props: {
                name: 'newsletter_form',
                method: 'POST',
                preventDefault: true,
                resetOnSubmit: true,
              },
              styles: {
                base: {
                  display: 'flex',
                  flexDirection: 'row',
                  gap: '8px',
                  alignItems: 'center',
                  width: '100%',
                },
                mobile: {
                  flexDirection: 'column',
                },
              },
              actions: [
                {
                  id: gen('pipeline'),
                  trigger: 'submit',
                  label: 'Subscribe to Newsletter',
                  enabled: true,
                  steps: [
                    {
                      id: gen('step'),
                      type: 'api_request',
                      label: 'Submit Subscription',
                      payload: {
                        url: '/api/mock/submit-lead',
                        method: 'POST',
                        bodyFormat: 'json',
                      },
                      onSuccess: [
                        {
                          id: gen('step'),
                          type: 'show_toast',
                          label: 'Show Success Toast',
                          payload: {
                            message: 'Thank you for subscribing to our newsletter!',
                            type: 'success',
                            title: 'Subscription Confirmed',
                            duration: 4000,
                          },
                        },
                        {
                          id: gen('step'),
                          type: 'reset_form',
                          label: 'Reset Form',
                          payload: {},
                        },
                      ],
                      onError: [
                        {
                          id: gen('step'),
                          type: 'show_toast',
                          label: 'Show Error Toast',
                          payload: {
                            message: 'Unable to subscribe right now. Please try again later.',
                            type: 'error',
                            title: 'Error',
                            duration: 5000,
                          },
                        },
                      ],
                    },
                  ],
                },
              ],
              children: [
                {
                  id: gen('input'),
                  type: 'input',
                  props: {
                    name: 'email',
                    type: 'email',
                    placeholder: 'Enter your email address...',
                    required: true,
                    rules: [
                      { type: 'required', message: 'Email address is required' },
                      { type: 'email', message: 'Please enter a valid email address' },
                    ],
                  },
                  styles: {
                    base: {
                      flex: '1 1 0%',
                      minWidth: '0',
                      padding: '12px 16px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      backgroundColor: '#ffffff',
                      fontSize: '14px',
                    },
                  },
                },
                {
                  id: gen('button'),
                  type: 'button',
                  props: {
                    label: 'Subscribe',
                    variant: 'primary',
                    buttonType: 'submit',
                  },
                  styles: {
                    base: {
                      backgroundColor: '#2563eb',
                      color: '#ffffff',
                      padding: '12px 24px',
                      borderRadius: '8px',
                      fontWeight: '600',
                      fontSize: '14px',
                      whiteSpace: 'nowrap',
                    },
                    states: {
                      ':hover': { backgroundColor: '#1d4ed8' },
                    },
                  } as unknown as ResponsiveStyles,
                },
              ],
            },
          ],
        },
      ],
    }),
  },
  {
    id: 'form-lead-gen',
    name: 'Lead Generation Form',
    category: 'forms',
    categoryLabel: 'Form Templates',
    description: 'Multi-field lead generation form with phone validation, interest dropdown, and API submission pipeline',
    icon: 'users',
    createNodeTree: (gen = defaultGenId) => ({
      id: gen('section'),
      type: 'section',
      styles: {
        base: {
          padding: '64px 20px',
          backgroundColor: '#ffffff',
          width: '100%',
        },
      },
      children: [
        {
          id: gen('container'),
          type: 'container',
          props: { tag: 'div', maxWidth: '640px' },
          styles: {
            base: {
              maxWidth: '640px',
              margin: '0 auto',
              width: '100%',
              backgroundColor: '#ffffff',
              padding: '36px',
              borderRadius: '16px',
              border: '1px solid #e2e8f0',
              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.05)',
            },
          },
          children: [
            {
              id: gen('badge'),
              type: 'badge',
              props: { label: 'FREE CONSULTATION', variant: 'primary' },
              styles: { base: { marginBottom: '12px', display: 'inline-block' } },
            },
            {
              id: gen('heading'),
              type: 'heading',
              props: { text: 'Schedule a Consultation', level: 2 },
              styles: {
                base: {
                  fontSize: '28px',
                  fontWeight: '700',
                  color: '#0f172a',
                  marginBottom: '8px',
                },
              },
            },
            {
              id: gen('paragraph'),
              type: 'paragraph',
              props: {
                content: 'Share your project details with our solutions team. We will analyze your needs and provide a personalized roadmap.',
              },
              styles: {
                base: {
                  fontSize: '15px',
                  color: '#64748b',
                  marginBottom: '28px',
                  lineHeight: '1.5',
                },
              },
            },
            {
              id: gen('form'),
              type: 'form',
              props: {
                name: 'lead_generation_form',
                method: 'POST',
                preventDefault: true,
                scrollToFirstError: true,
                resetOnSubmit: true,
              },
              styles: {
                base: {
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '18px',
                  width: '100%',
                },
              },
              actions: [
                {
                  id: gen('pipeline'),
                  trigger: 'submit',
                  label: 'Submit Lead Form',
                  enabled: true,
                  steps: [
                    {
                      id: gen('step'),
                      type: 'api_request',
                      label: 'Send Lead Data',
                      payload: {
                        url: '/api/mock/submit-lead',
                        method: 'POST',
                        bodyFormat: 'json',
                      },
                      onSuccess: [
                        {
                          id: gen('step'),
                          type: 'show_toast',
                          label: 'Show Success Toast',
                          payload: {
                            message: 'Thank you! Your request has been received. Our team will contact you shortly.',
                            type: 'success',
                            title: 'Request Submitted',
                            duration: 4000,
                          },
                        },
                        {
                          id: gen('step'),
                          type: 'reset_form',
                          label: 'Reset Form',
                          payload: {},
                        },
                      ],
                      onError: [
                        {
                          id: gen('step'),
                          type: 'show_toast',
                          label: 'Show Error Toast',
                          payload: {
                            message: 'Submission failed. Please verify your information and try again.',
                            type: 'error',
                            title: 'Submission Error',
                            duration: 5000,
                          },
                        },
                      ],
                    },
                  ],
                },
              ],
              children: [
                {
                  id: gen('input'),
                  type: 'input',
                  props: {
                    name: 'full_name',
                    label: 'Full Name',
                    type: 'text',
                    placeholder: 'Alex Morgan',
                    required: true,
                    rules: [
                      { type: 'required', message: 'Full name is required' },
                      { type: 'min_length', value: 2, message: 'Name must be at least 2 characters' },
                    ],
                  },
                  styles: {
                    base: {
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '14px',
                    },
                  },
                },
                {
                  id: gen('input'),
                  type: 'input',
                  props: {
                    name: 'email',
                    label: 'Business Email',
                    type: 'email',
                    placeholder: 'alex@company.com',
                    required: true,
                    rules: [
                      { type: 'required', message: 'Business email is required' },
                      { type: 'email', message: 'Please enter a valid email address' },
                    ],
                  },
                  styles: {
                    base: {
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '14px',
                    },
                  },
                },
                {
                  id: gen('input'),
                  type: 'input',
                  props: {
                    name: 'phone',
                    label: 'Phone Number',
                    type: 'tel',
                    placeholder: '+62 812-3456-7890',
                    required: true,
                    rules: [
                      { type: 'required', message: 'Phone number is required' },
                      {
                        type: 'custom_regex',
                        value: '^[+]?[0-9\\s-()]{8,20}$',
                        message: 'Please enter a valid phone number (min 8 digits)',
                      },
                    ],
                  },
                  styles: {
                    base: {
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '14px',
                    },
                  },
                },
                {
                  id: gen('select'),
                  type: 'select',
                  props: {
                    name: 'interest',
                    label: 'Area of Interest',
                    placeholder: 'Select your interest / service...',
                    required: true,
                    defaultValue: '',
                    options: [
                      { label: 'Web Platform Development', value: 'web_platform' },
                      { label: 'Mobile Application', value: 'mobile_app' },
                      { label: 'Cloud Architecture & DevOps', value: 'cloud_devops' },
                      { label: 'UI/UX Product Design', value: 'product_design' },
                      { label: 'General Inquiry', value: 'general' },
                    ],
                    rules: [
                      { type: 'required', message: 'Please select an area of interest' },
                    ],
                  },
                  styles: {
                    base: {
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '14px',
                      backgroundColor: '#ffffff',
                    },
                  },
                },
                {
                  id: gen('input'),
                  type: 'input',
                  props: {
                    name: 'company',
                    label: 'Company Name (Optional)',
                    type: 'text',
                    placeholder: 'Company / Organization',
                  },
                  styles: {
                    base: {
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '14px',
                    },
                  },
                },
                {
                  id: gen('button'),
                  type: 'button',
                  props: {
                    label: 'Request Consultation',
                    variant: 'primary',
                    buttonType: 'submit',
                  },
                  styles: {
                    base: {
                      width: '100%',
                      backgroundColor: '#2563eb',
                      color: '#ffffff',
                      padding: '12px 24px',
                      borderRadius: '8px',
                      fontWeight: '600',
                      fontSize: '15px',
                      marginTop: '4px',
                    },
                    states: {
                      ':hover': { backgroundColor: '#1d4ed8' },
                    },
                  } as unknown as ResponsiveStyles,
                },
              ],
            },
          ],
        },
      ],
    }),
  },
];
