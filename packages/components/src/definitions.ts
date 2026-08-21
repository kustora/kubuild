import { ComponentDefinition, ComponentRegistry } from './registry';

export const pageDefinition: ComponentDefinition = {
  type: 'page',
  label: 'Page',
  category: 'layout',
  acceptsChildren: true,
  allowedChildren: ['section', 'custom'],
  defaultProps: { title: 'New Page' },
  defaultStyles: { base: { minHeight: '100vh', backgroundColor: '#ffffff' } },
};

export const sectionDefinition: ComponentDefinition = {
  type: 'section',
  label: 'Section',
  category: 'layout',
  acceptsChildren: true,
  allowedChildren: ['container', 'columns', 'heading', 'text', 'image', 'button', 'collection', 'custom'],
  defaultProps: {},
  defaultStyles: {
    base: {
      paddingTop: '48px',
      paddingBottom: '48px',
      paddingLeft: '16px',
      paddingRight: '16px',
    },
  },
};

export const containerDefinition: ComponentDefinition = {
  type: 'container',
  label: 'Container',
  category: 'layout',
  acceptsChildren: true,
  defaultProps: { maxWidth: '1200px' },
  defaultStyles: {
    base: {
      maxWidth: '1200px',
      margin: '0 auto',
      width: '100%',
    },
  },
};

export const columnsDefinition: ComponentDefinition = {
  type: 'columns',
  label: 'Columns',
  category: 'layout',
  acceptsChildren: true,
  defaultProps: { columns: 2, gap: '16px' },
  defaultStyles: {
    base: {
      display: 'grid',
      gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
      gap: '16px',
    },
  },
};

export const headingDefinition: ComponentDefinition = {
  type: 'heading',
  label: 'Heading',
  category: 'typography',
  acceptsChildren: false,
  defaultProps: { text: 'Heading Text', level: 2 },
  defaultStyles: {
    base: {
      fontSize: '32px',
      fontWeight: '700',
      color: '#111827',
      margin: '0 0 16px 0',
    },
  },
};

export const textDefinition: ComponentDefinition = {
  type: 'text',
  label: 'Text',
  category: 'typography',
  acceptsChildren: false,
  defaultProps: { content: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.' },
  defaultStyles: {
    base: {
      fontSize: '16px',
      color: '#4b5563',
      lineHeight: '1.6',
    },
  },
};

export const imageDefinition: ComponentDefinition = {
  type: 'image',
  label: 'Image',
  category: 'media',
  acceptsChildren: false,
  defaultProps: {
    src: 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=800&auto=format&fit=crop&q=80',
    alt: 'Default image',
    width: 600,
    height: 400,
  },
  defaultStyles: {
    base: {
      maxWidth: '100%',
      height: 'auto',
      borderRadius: '8px',
    },
  },
};

export const buttonDefinition: ComponentDefinition = {
  type: 'button',
  label: 'Button',
  category: 'interactive',
  acceptsChildren: false,
  defaultProps: {
    label: 'Click Me',
    variant: 'primary',
  },
  defaultStyles: {
    base: {
      backgroundColor: '#2563eb',
      color: '#ffffff',
      paddingTop: '10px',
      paddingBottom: '10px',
      paddingLeft: '20px',
      paddingRight: '20px',
      borderRadius: '6px',
      fontWeight: '500',
      fontSize: '15px',
      border: 'none',
      cursor: 'pointer',
    },
  },
};

export const collectionDefinition: ComponentDefinition = {
  type: 'collection',
  label: 'Collection',
  category: 'data',
  acceptsChildren: true,
  defaultProps: {
    sourceKey: 'items',
    itemAlias: 'item',
  },
};

export const coreComponentDefinitions: ComponentDefinition[] = [
  pageDefinition,
  sectionDefinition,
  containerDefinition,
  columnsDefinition,
  headingDefinition,
  textDefinition,
  imageDefinition,
  buttonDefinition,
  collectionDefinition,
];

export function createDefaultComponentRegistry(): ComponentRegistry {
  const registry = new ComponentRegistry();
  for (const def of coreComponentDefinitions) {
    registry.register(def);
  }
  return registry;
}
