import { describe, it, expect } from 'vitest';
import {
  createDefaultComponentRegistry,
  modalDefinition,
  drawerDefinition,
  collapsibleDefinition,
} from '../src/index';
import { validateDocument, createBlankDocument, insertNode } from '@kubuild/core';

describe('Interactive Components (modal, drawer, collapsible)', () => {
  it('registers modal, drawer, and collapsible in default ComponentRegistry', () => {
    const registry = createDefaultComponentRegistry();

    expect(registry.has('modal')).toBe(true);
    expect(registry.has('drawer')).toBe(true);
    expect(registry.has('collapsible')).toBe(true);

    const modal = registry.get('modal');
    expect(modal?.category).toBe('interactive');
    expect(modal?.acceptsChildren).toBe(true);
    expect(modal?.defaultProps?.modalId).toBe('modal-dialog');

    const drawer = registry.get('drawer');
    expect(drawer?.category).toBe('interactive');
    expect(drawer?.acceptsChildren).toBe(true);
    expect(drawer?.defaultProps?.placement).toBe('right');

    const collapsible = registry.get('collapsible');
    expect(collapsible?.category).toBe('interactive');
    expect(collapsible?.acceptsChildren).toBe(true);
  });

  it('validates document trees containing modal, drawer, and collapsible', () => {
    const registry = createDefaultComponentRegistry();
    let doc = createBlankDocument('Interactive Document Test');

    // 1. Insert section
    doc = insertNode(doc, {
      parentId: 'root-page',
      node: { id: 'sec-1', type: 'section', props: {}, children: [] },
    }).document;

    // 2. Insert modal
    doc = insertNode(doc, {
      parentId: 'sec-1',
      node: {
        id: 'modal-1',
        type: 'modal',
        props: { modalId: 'demo-modal', title: 'Demo Modal' },
        children: [{ id: 'text-1', type: 'text', props: { content: 'Modal Body' } }],
      },
    }).document;

    // 3. Insert drawer
    doc = insertNode(doc, {
      parentId: 'sec-1',
      node: {
        id: 'drawer-1',
        type: 'drawer',
        props: { modalId: 'demo-drawer', placement: 'right' },
        children: [{ id: 'text-2', type: 'text', props: { content: 'Drawer Body' } }],
      },
    }).document;

    // 4. Insert collapsible
    doc = insertNode(doc, {
      parentId: 'sec-1',
      node: {
        id: 'collapse-1',
        type: 'collapsible',
        props: { modalId: 'demo-collapse' },
        children: [{ id: 'text-3', type: 'text', props: { content: 'Collapsible Body' } }],
      },
    }).document;

    const result = validateDocument(doc, { componentRegistry: registry });
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });
});
