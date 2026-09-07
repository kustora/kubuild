import { describe, it, expect } from 'vitest';
import { createBlankDocument, insertNode } from '@kubuild/core';
import { collectDocumentModals } from '../src/utils/document-scanner';

describe('collectDocumentModals', () => {
  it('resolves the modalId prop (not the structural Node ID) for modal/drawer/collapsible targets', () => {
    let doc = createBlankDocument('Scanner Test');

    doc = insertNode(doc, {
      parentId: 'root-page',
      node: {
        id: 'modal-node-1',
        type: 'modal',
        props: { modalId: 'contact-modal', title: 'Contact Us' },
        children: [],
      },
    }).document;

    doc = insertNode(doc, {
      parentId: 'root-page',
      node: {
        id: 'drawer-node-1',
        type: 'drawer',
        props: { modalId: 'cart-drawer', title: 'Your Cart' },
        children: [],
      },
    }).document;

    doc = insertNode(doc, {
      parentId: 'root-page',
      node: {
        id: 'collapse-node-1',
        type: 'collapsible',
        props: { modalId: 'faq-section' },
        children: [],
      },
    }).document;

    const modals = collectDocumentModals(doc);
    const ids = modals.map((m) => m.id);

    expect(ids).toContain('contact-modal');
    expect(ids).toContain('cart-drawer');
    expect(ids).toContain('faq-section');
    // The structural Node IDs must never be the resolved target — actions dispatch by modalId.
    expect(ids).not.toContain('modal-node-1');
    expect(ids).not.toContain('drawer-node-1');
    expect(ids).not.toContain('collapse-node-1');
  });

  it('falls back to the Node ID when a modal-like node has no modalId prop', () => {
    let doc = createBlankDocument('Scanner Fallback Test');
    doc = insertNode(doc, {
      parentId: 'root-page',
      node: { id: 'legacy-modal-1', type: 'modal', props: {}, children: [] },
    }).document;

    const modals = collectDocumentModals(doc);
    expect(modals.map((m) => m.id)).toContain('legacy-modal-1');
  });
});
