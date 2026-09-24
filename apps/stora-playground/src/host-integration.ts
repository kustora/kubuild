/**
 * Host-side integration demo (STORA-535 / STORA-536): a block library and page templates
 * supplied by the host app instead of being built into KUBUILD.
 */
import type { BlockDefinition } from '@kubuild/components';
import { defaultGenId } from '@kubuild/components';
import { createBlankDocument } from '@kubuild/core';
import { TemplateRecordSchema, starterPageFixture } from '@kubuild/schema';
import type { PageDocument, TemplateRecord } from '@kubuild/schema';

const TESTIMONIAL_THUMBNAIL = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 48">
  <rect width="120" height="48" rx="4" fill="#f1f5f9"/>
  <rect x="8" y="8" width="32" height="32" rx="4" fill="#dbeafe" stroke="#93c5fd"/>
  <circle cx="24" cy="20" r="5" fill="#60a5fa"/>
  <rect x="14" y="30" width="20" height="3" rx="1.5" fill="#93c5fd"/>
  <rect x="44" y="8" width="32" height="32" rx="4" fill="#dbeafe" stroke="#93c5fd"/>
  <circle cx="60" cy="20" r="5" fill="#60a5fa"/>
  <rect x="50" y="30" width="20" height="3" rx="1.5" fill="#93c5fd"/>
  <rect x="80" y="8" width="32" height="32" rx="4" fill="#dbeafe" stroke="#93c5fd"/>
  <circle cx="96" cy="20" r="5" fill="#60a5fa"/>
  <rect x="86" y="30" width="20" height="3" rx="1.5" fill="#93c5fd"/>
</svg>`;

/** A host "section library" entry — shows up under its own category in the Blocks tab. */
export const HOST_BLOCKS: BlockDefinition[] = [
  {
    id: 'host-testimonials',
    name: 'Customer Testimonials',
    category: 'host-sales',
    categoryLabel: 'Host: Sales Sections',
    description: 'Three testimonial cards supplied by the host app.',
    thumbnailSvg: TESTIMONIAL_THUMBNAIL,
    createNodeTree: (gen = defaultGenId) => ({
      id: gen('section'),
      type: 'section',
      props: {},
      styles: {
        base: { paddingTop: '56px', paddingBottom: '56px', paddingLeft: '24px', paddingRight: '24px', backgroundColor: '#f8fafc' },
      },
      children: [
        {
          id: gen('heading'),
          type: 'heading',
          props: { text: 'What our customers say', level: 2 },
          styles: { base: { textAlign: 'center', fontSize: '32px', fontWeight: '700', marginBottom: '32px' } },
        },
        {
          id: gen('columns'),
          type: 'columns',
          props: { columns: 3, gap: '24px' },
          styles: { base: { display: 'flex', gap: '24px', width: '100%', maxWidth: '1100px', margin: '0 auto' } },
          children: ['“Setup took five minutes.”', '“Our conversion rate doubled.”', '“Support is fantastic.”'].map(
            (quote, i) => ({
              id: gen('container'),
              type: 'container',
              props: { tag: 'div' },
              styles: {
                base: { flex: '1 1 0%', minWidth: '0', padding: '24px', backgroundColor: '#ffffff', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' },
              },
              children: [
                { id: gen('paragraph'), type: 'paragraph', props: { content: quote } },
                {
                  id: gen('text'),
                  type: 'text',
                  props: { content: ['Ayu, Jakarta', 'Budi, Bandung', 'Citra, Surabaya'][i] },
                  styles: { base: { fontWeight: '600', color: '#475569', marginTop: '12px' } },
                },
              ],
            }),
          ),
        },
      ],
    }),
  },
];

function thankYouDocument(): PageDocument {
  const doc = createBlankDocument('Thank You');
  doc.document.children = [
    {
      id: 'thanks-section',
      type: 'section',
      props: {},
      styles: { base: { paddingTop: '96px', paddingBottom: '96px', textAlign: 'center' } },
      children: [
        { id: 'thanks-heading', type: 'heading', props: { text: 'Thank you for your order!', level: 1 } },
        {
          id: 'thanks-text',
          type: 'paragraph',
          props: { content: 'A confirmation email is on its way. See you soon.' },
          styles: { base: { color: '#475569', marginTop: '16px' } },
        },
      ],
    },
  ];
  return doc;
}

/** Page templates for the toolbar "Templates" action and the "New page" flow. */
export const PLAYGROUND_TEMPLATES: TemplateRecord[] = [
  TemplateRecordSchema.parse({
    id: 'tpl-starter-landing',
    name: 'Starter Landing',
    description: 'Hero, features and call to action.',
    category: 'landing',
    tags: ['hero', 'features'],
    document: starterPageFixture,
  }),
  TemplateRecordSchema.parse({
    id: 'tpl-thank-you',
    name: 'Thank You',
    description: 'Post-checkout confirmation page.',
    category: 'thank-you',
    tags: ['funnel'],
    document: thankYouDocument(),
  }),
  TemplateRecordSchema.parse({
    id: 'tpl-host-checkout',
    name: 'Checkout (needs host component)',
    description: 'Demonstrates a template whose required component is not registered.',
    category: 'checkout',
    tags: ['funnel'],
    document: createBlankDocument('Checkout'),
    requirements: { requiredComponents: ['host-order-form'], requiredCapabilities: [] },
  }),
];
