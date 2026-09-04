import { BlockDefinition, defaultGenId } from './types';

/**
 * Predefined Starter Layout Blocks (STORA-241).
 */
export const LAYOUT_STARTER_BLOCKS: BlockDefinition[] = [
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
];

