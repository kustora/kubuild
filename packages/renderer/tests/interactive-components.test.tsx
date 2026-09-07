import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { KubuildRenderer } from '../src/renderer';
import { modalManager } from '../src/action-runners';
import { createDefaultComponentRegistry } from '@kubuild/components';
import { createBlankDocument } from '@kubuild/core';

describe('Interactive Component Renderers (modal, drawer, collapsible)', () => {
  const registry = createDefaultComponentRegistry();

  describe('modal component', () => {
    it('is hidden when closed in runtime mode, and renders overlay dialog when opened', () => {
      const doc = createBlankDocument('Modal Test');
      doc.document.children = [
        {
          id: 'test-modal-1',
          type: 'modal',
          props: {
            modalId: 'auth-modal',
            title: 'Welcome Back',
            size: 'md',
            backdrop: true,
            showCloseButton: true,
          },
          children: [
            { id: 'modal-text', type: 'text', props: { content: 'Please sign in to continue' } },
          ],
        },
      ];

      modalManager.closeModal('auth-modal');

      // 1. Closed in runtime mode: renders nothing (null)
      const htmlClosed = renderToString(
        <KubuildRenderer document={doc} registry={registry} mode="runtime" />
      );
      expect(htmlClosed).not.toContain('Please sign in to continue');
      expect(htmlClosed).not.toContain('data-kubuild-overlay="auth-modal"');

      // 2. Open in runtime mode: renders full dialog overlay
      modalManager.openModal('auth-modal');
      const htmlOpen = renderToString(
        <KubuildRenderer document={doc} registry={registry} mode="runtime" />
      );
      expect(htmlOpen).toContain('data-kubuild-overlay="auth-modal"');
      expect(htmlOpen).toContain('Welcome Back');
      expect(htmlOpen).toContain('Please sign in to continue');
      expect(htmlOpen).toContain('role="dialog"');
      expect(htmlOpen).toContain('aria-modal="true"');
      expect(htmlOpen).toContain('✕');

      modalManager.closeModal('auth-modal');
    });

    it('stays fully visible and selectable in editor mode even when closed', () => {
      const doc = createBlankDocument('Modal Editor Test');
      doc.document.children = [
        {
          id: 'test-modal-editor',
          type: 'modal',
          props: { modalId: 'editor-modal', title: 'Editor Modal' },
          children: [
            { id: 'modal-editor-text', type: 'text', props: { content: 'Editable modal body' } },
          ],
        },
      ];

      modalManager.closeModal('editor-modal');

      const html = renderToString(
        <KubuildRenderer document={doc} registry={registry} mode="editor" />
      );
      expect(html).toContain('Editable modal body');
      expect(html).toContain('data-kubuild-overlay="editor-modal"');
      expect(html).not.toContain('display:none');
    });
  });

  describe('drawer component', () => {
    it('is hidden when closed in runtime mode, and renders off-canvas drawer when opened', () => {
      const doc = createBlankDocument('Drawer Test');
      doc.document.children = [
        {
          id: 'test-drawer-1',
          type: 'drawer',
          props: {
            modalId: 'cart-drawer',
            title: 'Your Cart',
            placement: 'right',
          },
          children: [
            { id: 'drawer-item', type: 'text', props: { content: 'Item 1 in Cart' } },
          ],
        },
      ];

      modalManager.closeModal('cart-drawer');

      // 1. Closed state
      const htmlClosed = renderToString(
        <KubuildRenderer document={doc} registry={registry} mode="runtime" />
      );
      expect(htmlClosed).not.toContain('Item 1 in Cart');

      // 2. Open state
      modalManager.openModal('cart-drawer');
      const htmlOpen = renderToString(
        <KubuildRenderer document={doc} registry={registry} mode="runtime" />
      );
      expect(htmlOpen).toContain('data-kubuild-overlay="cart-drawer"');
      expect(htmlOpen).toContain('Your Cart');
      expect(htmlOpen).toContain('Item 1 in Cart');
      expect(htmlOpen).toContain('role="region"');

      modalManager.closeModal('cart-drawer');
    });

    it('stays fully visible in editor mode even when closed', () => {
      const doc = createBlankDocument('Drawer Editor Test');
      doc.document.children = [
        {
          id: 'test-drawer-editor',
          type: 'drawer',
          props: { modalId: 'editor-drawer', title: 'Editor Drawer' },
          children: [
            { id: 'drawer-editor-text', type: 'text', props: { content: 'Editable drawer body' } },
          ],
        },
      ];

      modalManager.closeModal('editor-drawer');

      const html = renderToString(
        <KubuildRenderer document={doc} registry={registry} mode="editor" />
      );
      expect(html).toContain('Editable drawer body');
      expect(html).toContain('data-kubuild-overlay="editor-drawer"');
      expect(html).not.toContain('display:none');
    });
  });

  describe('collapsible component', () => {
    it('toggles in-flow display between none and block/flex', () => {
      const doc = createBlankDocument('Collapsible Test');
      doc.document.children = [
        {
          id: 'test-collapse-1',
          type: 'collapsible',
          props: {
            modalId: 'faq-section',
          },
          children: [
            { id: 'faq-answer', type: 'text', props: { content: 'Here is the detailed answer' } },
          ],
        },
      ];

      modalManager.closeModal('faq-section');

      // 1. Closed: display is none
      const htmlClosed = renderToString(
        <KubuildRenderer document={doc} registry={registry} mode="runtime" />
      );
      expect(htmlClosed).toContain('display:none');

      // 2. Open: display is visible
      modalManager.openModal('faq-section');
      const htmlOpen = renderToString(
        <KubuildRenderer document={doc} registry={registry} mode="runtime" />
      );
      expect(htmlOpen).not.toContain('display:none');
      expect(htmlOpen).toContain('Here is the detailed answer');

      modalManager.closeModal('faq-section');
    });

    it('stays fully visible in editor mode even when closed', () => {
      const doc = createBlankDocument('Collapsible Editor Test');
      doc.document.children = [
        {
          id: 'test-collapse-editor',
          type: 'collapsible',
          props: { modalId: 'faq-section-editor' },
          children: [
            { id: 'faq-answer-editor', type: 'text', props: { content: 'Editable collapsible body' } },
          ],
        },
      ];

      modalManager.closeModal('faq-section-editor');

      const html = renderToString(
        <KubuildRenderer document={doc} registry={registry} mode="editor" />
      );
      expect(html).not.toContain('display:none');
      expect(html).toContain('Editable collapsible body');
    });

    it('honors defaultOpen on first render when the modal id was never explicitly toggled', () => {
      const doc = createBlankDocument('Collapsible Default Open Test');
      doc.document.children = [
        {
          id: 'test-collapse-default-open',
          type: 'collapsible',
          props: { modalId: 'fresh-untouched-section', defaultOpen: true },
          children: [
            { id: 'default-open-answer', type: 'text', props: { content: 'Shown by default' } },
          ],
        },
      ];

      // Deliberately never call openModal/closeModal on 'fresh-untouched-section' here —
      // this asserts the defaultOpen prop fallback, not the explicit-toggle path.
      const html = renderToString(
        <KubuildRenderer document={doc} registry={registry} mode="runtime" />
      );
      expect(html).not.toContain('display:none');
      expect(html).toContain('Shown by default');
    });
  });
});
