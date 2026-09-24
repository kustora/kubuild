import { describe, it, expect } from 'vitest';
import type { Node } from '@kubuild/schema';
import {
  createDefaultComponentRegistry,
  STARTER_BLOCKS,
  SALES_STARTER_BLOCKS,
  CONTENT_CHILD_TYPES,
  countdownDefinition,
  accordionDefinition,
  tabsDefinition,
  carouselDefinition,
  ratingDefinition,
  dividerDefinition,
  spacerDefinition,
  type ComponentDefaultChildSpec,
} from '../src/index';
import { validateDocument, createBlankDocument, insertNode } from '@kubuild/core';

const registry = createDefaultComponentRegistry();

function validateTree(tree: Node) {
  let doc = createBlankDocument('Conversion Test');
  doc = insertNode(doc, { parentId: doc.document.id, node: tree }).document;
  return validateDocument(doc, { componentRegistry: registry, strictChildPolicy: true });
}

let specCounter = 0;
function specToNode(spec: ComponentDefaultChildSpec): Node {
  const def = registry.get(spec.type);
  const children = spec.children ?? def?.defaultChildren;
  return {
    id: `${spec.type}-${++specCounter}`,
    type: spec.type,
    props: spec.props ?? def?.defaultProps ?? {},
    ...(children ? { children: children.map(specToNode) } : {}),
  };
}

describe('Epic 60 conversion component definitions', () => {
  const types = [
    'countdown',
    'accordion',
    'accordion-item',
    'tabs',
    'tab-panel',
    'carousel',
    'rating',
    'divider',
    'spacer',
  ];

  it('registers every conversion component in the default registry', () => {
    for (const type of types) {
      expect(registry.has(type), type).toBe(true);
    }
  });

  it('allows top-level conversion components inside sections/containers but keeps item types scoped', () => {
    for (const type of ['countdown', 'accordion', 'tabs', 'carousel', 'rating', 'divider', 'spacer']) {
      expect(CONTENT_CHILD_TYPES).toContain(type);
      expect(registry.canInsertChild('section', type).valid, type).toBe(true);
      expect(registry.canInsertChild('container', type).valid, type).toBe(true);
    }
    expect(registry.canInsertChild('accordion', 'accordion-item').valid).toBe(true);
    expect(registry.canInsertChild('accordion', 'paragraph').valid).toBe(false);
    expect(registry.canInsertChild('tabs', 'tab-panel').valid).toBe(true);
    expect(registry.canInsertChild('tabs', 'heading').valid).toBe(false);
    expect(registry.canInsertChild('accordion-item', 'paragraph').valid).toBe(true);
    expect(registry.canInsertChild('tab-panel', 'columns').valid).toBe(true);
    expect(registry.canInsertChild('carousel', 'container').valid).toBe(true);
    expect(registry.canInsertChild('accordion-item', 'page').valid).toBe(false);
    expect(registry.canInsertChild('countdown', 'text').valid).toBe(false);
    expect(registry.canInsertChild('spacer', 'text').valid).toBe(false);
  });

  it('produces default subtrees that pass strict validation', () => {
    for (const def of [accordionDefinition, tabsDefinition, carouselDefinition]) {
      const node = specToNode({ type: def.type });
      const result = validateTree({ id: `section-${def.type}`, type: 'section', children: [node] });
      expect(result.errors, def.type).toEqual([]);
      expect(result.valid).toBe(true);
    }
  });

  it('validates countdown props', () => {
    expect(countdownDefinition.validateProps?.(countdownDefinition.defaultProps!)).toEqual([]);
    expect(countdownDefinition.validateProps?.({ mode: 'weekly' })).toHaveLength(1);
    expect(countdownDefinition.validateProps?.({ format: 'hh:mm' })).toHaveLength(1);
    expect(countdownDefinition.validateProps?.({ expireBehavior: 'explode' })).toHaveLength(1);
    expect(countdownDefinition.validateProps?.({ durationMinutes: -5 })).toHaveLength(1);
    expect(countdownDefinition.validateProps?.({ format: 'd h m s', mode: 'fixed' })).toEqual([]);
  });

  it('validates rating, divider, tabs and carousel props', () => {
    expect(ratingDefinition.validateProps?.({ value: 4.5, max: 5 })).toEqual([]);
    expect(ratingDefinition.validateProps?.({ value: -1 })).toHaveLength(1);
    expect(dividerDefinition.validateProps?.({ lineStyle: 'dashed' })).toEqual([]);
    expect(dividerDefinition.validateProps?.({ lineStyle: 'wavy' })).toHaveLength(1);
    expect(tabsDefinition.validateProps?.({ activeIndex: 1 })).toEqual([]);
    expect(tabsDefinition.validateProps?.({ activeIndex: -1 })).toHaveLength(1);
    expect(carouselDefinition.validateProps?.({ interval: 0 })).toHaveLength(1);
  });

  it('gives spacer a per-breakpoint responsive height', () => {
    expect(spacerDefinition.acceptsChildren).toBe(false);
    expect(spacerDefinition.defaultStyles?.base?.height).toBe('48px');
    expect(spacerDefinition.defaultStyles?.tablet?.height).toBe('32px');
    expect(spacerDefinition.defaultStyles?.mobile?.height).toBe('24px');
  });
});

describe('STORA-549: sales starter blocks', () => {
  it('registers six blocks in a new "sales" category', () => {
    const sales = STARTER_BLOCKS.filter((b) => b.category === 'sales');
    expect(sales.map((b) => b.id)).toEqual([
      'sales-faq',
      'sales-testimonials',
      'sales-countdown-banner',
      'sales-guarantee',
      'sales-trust-badges',
      'sales-plan-comparison',
    ]);
    expect(sales).toEqual(SALES_STARTER_BLOCKS);
    for (const block of sales) {
      expect(block.categoryLabel).toBe('Sales & Conversion');
      expect(block.description!.length).toBeGreaterThan(10);
    }
  });

  it.each(SALES_STARTER_BLOCKS.map((b) => [b.id, b] as const))(
    '%s is valid under validateDocument with strictChildPolicy',
    (_id, block) => {
      const result = validateTree(block.createNodeTree());
      expect(result.errors).toEqual([]);
      expect(result.valid).toBe(true);
    },
  );

  it('uses the Epic 60 components it advertises', () => {
    const typesIn = (node: Node): string[] => [node.type, ...(node.children ?? []).flatMap(typesIn)];
    const byId = (id: string) => typesIn(SALES_STARTER_BLOCKS.find((b) => b.id === id)!.createNodeTree());
    expect(byId('sales-faq')).toContain('accordion-item');
    expect(byId('sales-testimonials')).toEqual(expect.arrayContaining(['carousel', 'rating']));
    expect(byId('sales-countdown-banner')).toContain('countdown');
    expect(byId('sales-plan-comparison')).toEqual(expect.arrayContaining(['tabs', 'tab-panel']));
    expect(byId('sales-trust-badges')).toContain('divider');
  });

  it('generates unique node ids within each block', () => {
    for (const block of SALES_STARTER_BLOCKS) {
      const ids: string[] = [];
      const walk = (n: Node) => {
        ids.push(n.id);
        n.children?.forEach(walk);
      };
      walk(block.createNodeTree());
      expect(new Set(ids).size, block.id).toBe(ids.length);
    }
  });
});
