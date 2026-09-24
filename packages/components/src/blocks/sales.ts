import { Node, ResponsiveStyles } from '@kubuild/schema';
import { BlockDefinition, defaultGenId } from './types';

type Gen = (prefix?: string) => string;

const SALES_CATEGORY = 'sales';
const SALES_CATEGORY_LABEL = 'Sales & Conversion';

/** Full-width section wrapping a centered, max-width container. */
function sectionShell(gen: Gen, children: Node[], sectionStyles: ResponsiveStyles = {}, maxWidth = '960px'): Node {
  return {
    id: gen('section'),
    type: 'section',
    styles: {
      ...sectionStyles,
      base: {
        paddingTop: '64px',
        paddingBottom: '64px',
        paddingLeft: '24px',
        paddingRight: '24px',
        width: '100%',
        ...(sectionStyles.base ?? {}),
      },
      mobile: {
        paddingTop: '40px',
        paddingBottom: '40px',
        paddingLeft: '16px',
        paddingRight: '16px',
        ...(sectionStyles.mobile ?? {}),
      },
    },
    children: [
      {
        id: gen('container'),
        type: 'container',
        props: { tag: 'div' },
        styles: {
          base: {
            maxWidth,
            margin: '0 auto',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            gap: '24px',
          },
        },
        children,
      },
    ],
  };
}

function sectionHeading(gen: Gen, text: string, subtitle?: string, color = '#0f172a'): Node[] {
  const nodes: Node[] = [
    {
      id: gen('heading'),
      type: 'heading',
      props: { text, level: 2 },
      styles: {
        base: { fontSize: '32px', fontWeight: '800', color, textAlign: 'center', margin: '0' },
        mobile: { fontSize: '26px' },
      },
    },
  ];
  if (subtitle) {
    nodes.push({
      id: gen('paragraph'),
      type: 'paragraph',
      props: { text: subtitle },
      styles: { base: { fontSize: '16px', color: '#64748b', textAlign: 'center', margin: '0' } },
    });
  }
  return nodes;
}

function faqItem(gen: Gen, question: string, answer: string): Node {
  return {
    id: gen('accordion-item'),
    type: 'accordion-item',
    props: { title: question },
    styles: { base: { borderBottom: '1px solid #e2e8f0' } },
    children: [
      {
        id: gen('paragraph'),
        type: 'paragraph',
        props: { text: answer },
        styles: { base: { fontSize: '15px', color: '#475569', margin: '0', lineHeight: '1.6' } },
      },
    ],
  };
}

function testimonialSlide(gen: Gen, quote: string, name: string, role: string, rating: number): Node {
  return {
    id: gen('flex'),
    type: 'flex',
    styles: {
      base: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '16px',
        padding: '32px 48px',
        textAlign: 'center',
      },
      mobile: { padding: '24px 40px' },
    },
    children: [
      {
        id: gen('rating'),
        type: 'rating',
        props: { value: rating, max: 5, size: 20, color: '#f59e0b' },
      },
      {
        id: gen('blockquote'),
        type: 'blockquote',
        props: { text: quote },
        styles: {
          base: { fontSize: '18px', color: '#0f172a', fontStyle: 'italic', margin: '0', lineHeight: '1.6' },
        },
      },
      {
        id: gen('text'),
        type: 'text',
        props: { text: `${name} — ${role}` },
        styles: { base: { fontSize: '14px', fontWeight: '600', color: '#64748b' } },
      },
    ],
  };
}

function badgeItem(gen: Gen, iconName: string, label: string): Node {
  return {
    id: gen('flex'),
    type: 'flex',
    styles: {
      base: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '8px',
        padding: '16px',
        textAlign: 'center',
      },
    },
    children: [
      {
        id: gen('icon'),
        type: 'icon',
        props: { name: iconName, size: 28, color: '#16a34a', ariaLabel: label },
      },
      {
        id: gen('text'),
        type: 'text',
        props: { text: label },
        styles: { base: { fontSize: '14px', fontWeight: '600', color: '#334155' } },
      },
    ],
  };
}

function planCard(gen: Gen, name: string, price: string, features: string[], highlighted: boolean): Node {
  return {
    id: gen('container'),
    type: 'container',
    props: { tag: 'div' },
    styles: {
      base: {
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        padding: '28px 24px',
        backgroundColor: '#ffffff',
        borderRadius: '16px',
        border: highlighted ? '2px solid #2563eb' : '1px solid #e2e8f0',
      },
    },
    children: [
      {
        id: gen('heading'),
        type: 'heading',
        props: { text: name, level: 3 },
        styles: { base: { fontSize: '20px', fontWeight: '700', color: '#0f172a', margin: '0' } },
      },
      {
        id: gen('heading'),
        type: 'heading',
        props: { text: price, level: 4 },
        styles: { base: { fontSize: '32px', fontWeight: '800', color: '#2563eb', margin: '0' } },
      },
      {
        id: gen('list'),
        type: 'list',
        props: { tag: 'ul', listStyleType: 'disc' },
        styles: { base: { fontSize: '14px', color: '#475569', paddingLeft: '20px', margin: '0' } },
        children: features.map((feature) => ({
          id: gen('list-item'),
          type: 'list-item',
          props: { text: feature },
        })),
      },
      {
        id: gen('button'),
        type: 'button',
        props: { label: `Choose ${name}`, href: '#checkout', variant: highlighted ? 'primary' : 'secondary' },
        styles: {
          base: {
            width: '100%',
            padding: '12px',
            borderRadius: '8px',
            fontWeight: '600',
            marginTop: '8px',
          },
        },
      },
    ],
  };
}

function planColumns(gen: Gen, plans: Array<[string, string, string[], boolean]>): Node {
  return {
    id: gen('columns'),
    type: 'columns',
    props: { columns: plans.length, gap: '16px' },
    styles: {
      base: {
        display: 'grid',
        gridTemplateColumns: `repeat(${plans.length}, minmax(0, 1fr))`,
        gap: '16px',
      },
      mobile: { gridTemplateColumns: 'repeat(1, minmax(0, 1fr))' },
    },
    children: plans.map(([name, price, features, highlighted]) => planCard(gen, name, price, features, highlighted)),
  };
}

/**
 * Sales / funnel section blocks (STORA-549) built on the Epic 60 conversion
 * components. Every tree is valid under `validateDocument` with `strictChildPolicy`.
 */
export const SALES_STARTER_BLOCKS: BlockDefinition[] = [
  {
    id: 'sales-faq',
    name: 'FAQ',
    category: SALES_CATEGORY,
    categoryLabel: SALES_CATEGORY_LABEL,
    description: 'Frequently asked questions accordion with FAQPage structured data for SEO',
    icon: 'chevron-down',
    createNodeTree: (gen = defaultGenId) =>
      sectionShell(
        gen,
        [
          ...sectionHeading(gen, 'Frequently Asked Questions', 'Everything you need to know before you buy.'),
          {
            id: gen('accordion'),
            type: 'accordion',
            props: { allowMultiple: false, defaultOpenIndex: 0, icon: 'chevron', faqSchema: true },
            styles: { base: { display: 'flex', flexDirection: 'column', width: '100%', borderTop: '1px solid #e2e8f0' } },
            children: [
              faqItem(gen, 'What exactly do I get?', 'Instant access to the full program, all bonuses, and every future update.'),
              faqItem(gen, 'How long do I have access?', 'Lifetime access — learn at your own pace, on any device.'),
              faqItem(gen, 'Is there a money-back guarantee?', 'Yes. If you are not satisfied within 30 days, we refund you in full.'),
              faqItem(gen, 'How do I pay?', 'We accept cards, bank transfer, and e-wallets through a secure checkout.'),
            ],
          },
        ],
        {},
        '760px',
      ),
  },
  {
    id: 'sales-testimonials',
    name: 'Testimonials Carousel',
    category: SALES_CATEGORY,
    categoryLabel: SALES_CATEGORY_LABEL,
    description: 'Customer testimonial slider with star ratings',
    icon: 'star',
    createNodeTree: (gen = defaultGenId) =>
      sectionShell(
        gen,
        [
          ...sectionHeading(gen, 'What Our Customers Say'),
          {
            id: gen('carousel'),
            type: 'carousel',
            props: { autoplay: true, interval: 6000, loop: true, showDots: true, showArrows: true, ariaLabel: 'Testimonials' },
            styles: {
              base: {
                position: 'relative',
                width: '100%',
                overflow: 'hidden',
                backgroundColor: '#f8fafc',
                borderRadius: '16px',
              },
            },
            children: [
              testimonialSlide(gen, 'This completely changed how I run my business. Worth every cent.', 'Sarah K.', 'Founder', 5),
              testimonialSlide(gen, 'Clear, practical, and easy to follow. I saw results in the first week.', 'Budi S.', 'Marketing Lead', 4.5),
              testimonialSlide(gen, 'The support team is amazing and the material is top-notch.', 'Aisha R.', 'Freelancer', 5),
            ],
          },
        ],
        { base: { backgroundColor: '#ffffff' } },
        '760px',
      ),
  },
  {
    id: 'sales-countdown-banner',
    name: 'Countdown Banner',
    category: SALES_CATEGORY,
    categoryLabel: SALES_CATEGORY_LABEL,
    description: 'Limited-time offer banner with an evergreen countdown timer and CTA',
    icon: 'clock',
    createNodeTree: (gen = defaultGenId) =>
      sectionShell(
        gen,
        [
          ...sectionHeading(gen, 'Special Launch Price Ends Soon', undefined, '#ffffff'),
          {
            id: gen('countdown'),
            type: 'countdown',
            props: {
              mode: 'evergreen',
              durationMinutes: 30,
              format: 'd h m s',
              labelDays: 'Days',
              labelHours: 'Hours',
              labelMinutes: 'Minutes',
              labelSeconds: 'Seconds',
              expireBehavior: 'text',
              expiredText: 'The special price has ended.',
              storage: 'session',
              ariaLabel: 'Offer ends in',
            },
            styles: {
              base: {
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '16px',
                fontSize: '36px',
                fontWeight: '800',
                color: '#ffffff',
                fontVariantNumeric: 'tabular-nums',
              },
              mobile: { fontSize: '28px', gap: '8px' },
            },
          },
          {
            id: gen('button'),
            type: 'button',
            props: { label: 'Claim the Offer', href: '#checkout' },
            styles: {
              base: {
                alignSelf: 'center',
                backgroundColor: '#f59e0b',
                color: '#0f172a',
                padding: '14px 32px',
                borderRadius: '9999px',
                fontSize: '16px',
                fontWeight: '700',
              },
            },
          },
        ],
        { base: { backgroundColor: '#0f172a' } },
      ),
  },
  {
    id: 'sales-guarantee',
    name: 'Money-Back Guarantee',
    category: SALES_CATEGORY,
    categoryLabel: SALES_CATEGORY_LABEL,
    description: 'Risk-reversal guarantee section with shield icon',
    icon: 'badge',
    createNodeTree: (gen = defaultGenId) =>
      sectionShell(
        gen,
        [
          {
            id: gen('flex'),
            type: 'flex',
            styles: {
              base: {
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                gap: '24px',
                padding: '32px',
                backgroundColor: '#f0fdf4',
                border: '2px dashed #16a34a',
                borderRadius: '16px',
              },
              mobile: { flexDirection: 'column', textAlign: 'center', padding: '24px' },
            },
            children: [
              {
                id: gen('icon'),
                type: 'icon',
                props: { name: 'shield-check', size: 64, color: '#16a34a', ariaLabel: 'Guarantee' },
              },
              {
                id: gen('flex'),
                type: 'flex',
                styles: { base: { display: 'flex', flexDirection: 'column', gap: '8px' } },
                children: [
                  {
                    id: gen('heading'),
                    type: 'heading',
                    props: { text: '30-Day Money-Back Guarantee', level: 3 },
                    styles: { base: { fontSize: '22px', fontWeight: '800', color: '#14532d', margin: '0' } },
                  },
                  {
                    id: gen('paragraph'),
                    type: 'paragraph',
                    props: {
                      text: 'Try it risk-free. If it is not right for you, email us within 30 days and we will refund every cent — no questions asked.',
                    },
                    styles: { base: { fontSize: '15px', color: '#166534', margin: '0', lineHeight: '1.6' } },
                  },
                ],
              },
            ],
          },
        ],
        {},
        '760px',
      ),
  },
  {
    id: 'sales-trust-badges',
    name: 'Trust Badges',
    category: SALES_CATEGORY,
    categoryLabel: SALES_CATEGORY_LABEL,
    description: 'Row of trust signals: secure payment, guarantee, support, and delivery',
    icon: 'grid',
    createNodeTree: (gen = defaultGenId) =>
      sectionShell(
        gen,
        [
          {
            id: gen('grid'),
            type: 'grid',
            styles: {
              base: {
                display: 'grid',
                gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
                gap: '16px',
              },
              mobile: { gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' },
            },
            children: [
              badgeItem(gen, 'lock', 'Secure Payment'),
              badgeItem(gen, 'shield-check', 'Money-Back Guarantee'),
              badgeItem(gen, 'headphones', '24/7 Support'),
              badgeItem(gen, 'zap', 'Instant Access'),
            ],
          },
          {
            id: gen('divider'),
            type: 'divider',
            props: { lineStyle: 'solid', thickness: 1, color: '#e2e8f0', label: '' },
          },
          {
            id: gen('paragraph'),
            type: 'paragraph',
            props: { text: 'Trusted by 10,000+ customers.' },
            styles: { base: { fontSize: '14px', color: '#64748b', textAlign: 'center', margin: '0' } },
          },
        ],
        { base: { paddingTop: '32px', paddingBottom: '32px' } },
      ),
  },
  {
    id: 'sales-plan-comparison',
    name: 'Plan Comparison',
    category: SALES_CATEGORY,
    categoryLabel: SALES_CATEGORY_LABEL,
    description: 'Monthly/yearly tabs comparing pricing plans side by side',
    icon: 'columns',
    createNodeTree: (gen = defaultGenId) =>
      sectionShell(
        gen,
        [
          ...sectionHeading(gen, 'Choose Your Plan', 'Switch between monthly and yearly billing.'),
          {
            id: gen('tabs'),
            type: 'tabs',
            props: { activeIndex: 0, ariaLabel: 'Billing period' },
            styles: { base: { display: 'flex', flexDirection: 'column', width: '100%' } },
            children: [
              {
                id: gen('tab-panel'),
                type: 'tab-panel',
                props: { label: 'Monthly' },
                styles: { base: { paddingTop: '24px' } },
                children: [
                  planColumns(gen, [
                    ['Basic', '$19 / mo', ['1 project', 'Email support', 'Core features'], false],
                    ['Pro', '$49 / mo', ['Unlimited projects', 'Priority support', 'All features'], true],
                  ]),
                ],
              },
              {
                id: gen('tab-panel'),
                type: 'tab-panel',
                props: { label: 'Yearly' },
                styles: { base: { paddingTop: '24px' } },
                children: [
                  planColumns(gen, [
                    ['Basic', '$190 / yr', ['1 project', 'Email support', 'Core features', '2 months free'], false],
                    ['Pro', '$490 / yr', ['Unlimited projects', 'Priority support', 'All features', '2 months free'], true],
                  ]),
                ],
              },
            ],
          },
          {
            id: gen('spacer'),
            type: 'spacer',
            styles: { base: { width: '100%', height: '16px' }, mobile: { height: '8px' } },
          },
        ],
      ),
  },
];
