import { isVariableBinding } from '@kubuild/schema';
import { ComponentDefinition } from '../../registry';
import { ariaLabelTrait, idTrait } from '../../traits';
import { CONTENT_CHILD_TYPES } from '../constants';

/**
 * Accordion / FAQ group (STORA-544). Children are `accordion-item` nodes; the
 * runtime can optionally emit `FAQPage` JSON-LD built from item titles + answers.
 */
export const accordionDefinition: ComponentDefinition = {
  type: 'accordion',
  label: 'Accordion',
  category: 'interactive',
  icon: 'chevron-down',
  description: 'Group of expandable items (FAQ) with single- or multi-open behavior.',
  acceptsChildren: true,
  allowedChildren: ['accordion-item'],
  defaultProps: {
    allowMultiple: false,
    defaultOpenIndex: 0,
    icon: 'chevron',
    faqSchema: false,
  },
  defaultChildren: [
    {
      type: 'accordion-item',
      props: { title: 'What is included?' },
      children: [{ type: 'paragraph', props: { text: 'Everything you need to get started.' } }],
    },
    {
      type: 'accordion-item',
      props: { title: 'Can I get a refund?' },
      children: [{ type: 'paragraph', props: { text: 'Yes, within 30 days of purchase.' } }],
    },
    {
      type: 'accordion-item',
      props: { title: 'How do I get access?' },
      children: [
        { type: 'paragraph', props: { text: 'You receive an email right after checkout.' } },
      ],
    },
  ],
  propFields: [
    {
      name: 'allowMultiple',
      label: 'Allow Multiple Open',
      type: 'boolean',
      defaultValue: false,
      description: 'When off, opening an item closes the others.',
    },
    {
      name: 'defaultOpenIndex',
      label: 'Default Open Item',
      type: 'number',
      defaultValue: 0,
      description: 'Zero-based index of the item open on first render (-1 = all closed).',
    },
    {
      name: 'icon',
      label: 'Icon',
      type: 'select',
      defaultValue: 'chevron',
      options: [
        { label: 'Chevron', value: 'chevron' },
        { label: 'Plus / Minus', value: 'plus' },
        { label: 'None', value: 'none' },
      ],
    },
    {
      name: 'faqSchema',
      label: 'Output FAQPage JSON-LD',
      type: 'boolean',
      defaultValue: false,
      description: 'Emits schema.org FAQPage structured data on the published page for SEO.',
    },
  ],
  traits: [idTrait(), ariaLabelTrait({ description: 'Accessible name for the accordion group.' })],
  defaultStyles: {
    base: {
      display: 'flex',
      flexDirection: 'column',
      width: '100%',
      borderTop: '1px solid #e2e8f0',
    },
  },
  validateProps: (props) => {
    const errors: string[] = [];
    const idx = props.defaultOpenIndex;
    if (
      idx !== undefined &&
      !isVariableBinding(idx) &&
      (typeof idx !== 'number' || !Number.isInteger(idx))
    ) {
      errors.push('Accordion "defaultOpenIndex" must be an integer.');
    }
    return errors;
  },
};

export const accordionItemDefinition: ComponentDefinition = {
  type: 'accordion-item',
  label: 'Accordion Item',
  category: 'interactive',
  icon: 'chevron-right',
  description: 'One question/answer row of an accordion: a title header plus content children.',
  acceptsChildren: true,
  allowedChildren: ['container', 'columns', 'flex', 'grid', ...CONTENT_CHILD_TYPES],
  defaultProps: {
    title: 'Question',
  },
  defaultChildren: [{ type: 'paragraph', props: { text: 'Answer goes here.' } }],
  propFields: [{ name: 'title', label: 'Title', type: 'string', defaultValue: 'Question' }],
  traits: [idTrait()],
  defaultStyles: {
    base: {
      borderBottom: '1px solid #e2e8f0',
    },
  },
};
