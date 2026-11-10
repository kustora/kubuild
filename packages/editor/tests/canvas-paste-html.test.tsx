import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { createDefaultComponentRegistry } from '@kubuild/components';
import { createBlankDocument } from '@kubuild/core';
import type { PageDocument } from '@kubuild/schema';
import { useEditorStore } from '../src/store';
import { handleCanvasPaste, isEditableTarget, type CanvasPasteEventLike } from '../src/components/canvas/canvas';

describe('STORA-617: Paste HTML to canvas as nodes', () => {
  const registry = createDefaultComponentRegistry();

  function createTestDoc(): PageDocument {
    const doc = createBlankDocument('Canvas Paste Test Page');
    doc.document.children = [
      {
        id: 'section-1',
        type: 'section',
        props: {},
        children: [
          {
            id: 'container-1',
            type: 'container',
            props: {},
            children: [
              {
                id: 'heading-1',
                type: 'heading',
                props: { text: 'Initial Title', level: 2 },
              },
              {
                id: 'text-1',
                type: 'text',
                props: { text: 'Initial paragraph' },
              },
            ],
          },
        ],
      },
    ];
    return doc;
  }

  beforeEach(() => {
    const doc = createTestDoc();
    useEditorStore.getState().setDocument(doc);
    useEditorStore.getState().selectNode(null);
  });

  describe('Clipboard paste event with HTML string', () => {
    it('parses via htmlToNodes and inserts into selected container', async () => {
      useEditorStore.getState().selectNode('container-1');

      const html = '<p>Pasted paragraph from web</p>';
      const preventDefault = vi.fn();
      const event: CanvasPasteEventLike = {
        target: { tagName: 'DIV' } as unknown as EventTarget,
        preventDefault,
        clipboardData: {
          getData: (type: string) => (type === 'text/html' ? html : ''),
          types: ['text/html'],
          files: [],
          items: [],
        },
      };

      const success = await handleCanvasPaste(event, registry);

      expect(success).toBe(true);
      expect(preventDefault).toHaveBeenCalled();

      const doc = useEditorStore.getState().document;
      const container = doc.document.children?.[0]?.children?.[0];
      expect(container?.id).toBe('container-1');
      expect(container?.children).toHaveLength(3);

      const pastedNode = container?.children?.[2];
      expect(pastedNode?.type).toBe('paragraph');
      expect(pastedNode?.props?.text).toBe('Pasted paragraph from web');

      // Selection: newly inserted node is selected
      expect(useEditorStore.getState().selectedNodeId).toBe(pastedNode?.id);
    });

    it('pastes multiple nodes into container and selects them all', async () => {
      useEditorStore.getState().selectNode('container-1');

      const html = '<h3>Title 1</h3><button>Click Here</button>';
      const preventDefault = vi.fn();
      const event: CanvasPasteEventLike = {
        target: { tagName: 'DIV' } as unknown as EventTarget,
        preventDefault,
        clipboardData: {
          getData: (type: string) => (type === 'text/html' ? html : ''),
          types: ['text/html'],
          files: [],
          items: [],
        },
      };

      const success = await handleCanvasPaste(event, registry);
      expect(success).toBe(true);
      expect(preventDefault).toHaveBeenCalled();

      const doc = useEditorStore.getState().document;
      const container = doc.document.children?.[0]?.children?.[0];
      expect(container?.children).toHaveLength(4);

      const insertedNodes = container?.children?.slice(2) ?? [];
      expect(insertedNodes[0].type).toBe('heading');
      expect(insertedNodes[1].type).toBe('button');

      const selectedIds = useEditorStore.getState().selectedNodeIds;
      expect(selectedIds).toEqual(insertedNodes.map((n) => n.id));
    });
  });

  describe('Target parent resolution', () => {
    it('pasting when a leaf node (heading) is selected inserts as sibling after it in parent container', async () => {
      // heading-1 does not accept children
      useEditorStore.getState().selectNode('heading-1');

      const html = '<button>Inserted Button</button>';
      const event: CanvasPasteEventLike = {
        target: { tagName: 'DIV' } as unknown as EventTarget,
        preventDefault: vi.fn(),
        clipboardData: {
          getData: (type: string) => (type === 'text/html' ? html : ''),
          types: ['text/html'],
          files: [],
          items: [],
        },
      };

      const success = await handleCanvasPaste(event, registry);
      expect(success).toBe(true);

      const doc = useEditorStore.getState().document;
      const container = doc.document.children?.[0]?.children?.[0];
      expect(container?.children).toHaveLength(3);

      // Verify sibling ordering: heading-1, then new button, then text-1
      expect(container?.children?.[0].id).toBe('heading-1');
      expect(container?.children?.[1].type).toBe('button');
      expect(container?.children?.[1].props?.label).toBe('Inserted Button');
      expect(container?.children?.[2].id).toBe('text-1');

      expect(useEditorStore.getState().selectedNodeId).toBe(container?.children?.[1].id);
    });

    it('falls back to root page node when no node is selected', async () => {
      useEditorStore.getState().selectNode(null);

      const html = '<section><h2>Fresh Section</h2></section>';
      const event: CanvasPasteEventLike = {
        target: { tagName: 'DIV' } as unknown as EventTarget,
        preventDefault: vi.fn(),
        clipboardData: {
          getData: (type: string) => (type === 'text/html' ? html : ''),
          types: ['text/html'],
          files: [],
          items: [],
        },
      };

      const success = await handleCanvasPaste(event, registry);
      expect(success).toBe(true);

      const doc = useEditorStore.getState().document;
      expect(doc.document.children).toHaveLength(2);
      const newSection = doc.document.children?.[1];
      expect(newSection?.type).toBe('section');
      expect(useEditorStore.getState().selectedNodeId).toBe(newSection?.id);
    });

    it('resolves nearest valid ancestor when parent does not accept children', async () => {
      // Construct a deeply nested leaf inside a non-accepting branch
      const doc = createBlankDocument('Ancestor Resolution');
      doc.document.children = [
        {
          id: 'section-outer',
          type: 'section',
          children: [
            {
              id: 'container-inner',
              type: 'container',
              children: [
                {
                  id: 'leaf-text',
                  type: 'text',
                  props: { text: 'Some Text' },
                },
              ],
            },
          ],
        },
      ];
      useEditorStore.getState().setDocument(doc);
      useEditorStore.getState().selectNode('leaf-text');

      const success = await useEditorStore
        .getState()
        .pasteHtmlNodes('<p>Ancestor Target</p>', registry);
      expect(success).toBe(true);

      const updated = useEditorStore.getState().document;
      const container = updated.document.children?.[0]?.children?.[0];
      expect(container?.children).toHaveLength(2);
      expect(container?.children?.[0].id).toBe('leaf-text');
      expect(container?.children?.[1].type).toBe('paragraph');
    });
  });

  describe('History transaction grouping (Undo in one step)', () => {
    it('reverts all nodes inserted from the paste operation in exactly ONE undo step', async () => {
      useEditorStore.getState().selectNode('container-1');
      const beforeDoc = useEditorStore.getState().document;

      // Paste HTML containing 3 distinct nodes
      const html = '<h1>Heading A</h1><p>Paragraph B</p><button>Button C</button>';
      const event: CanvasPasteEventLike = {
        target: { tagName: 'DIV' } as unknown as EventTarget,
        preventDefault: vi.fn(),
        clipboardData: {
          getData: (type: string) => (type === 'text/html' ? html : ''),
          types: ['text/html'],
          files: [],
          items: [],
        },
      };

      const success = await handleCanvasPaste(event, registry);
      expect(success).toBe(true);

      const docAfterPaste = useEditorStore.getState().document;
      const containerAfterPaste = docAfterPaste.document.children?.[0]?.children?.[0];
      // 2 initial + 3 pasted = 5
      expect(containerAfterPaste?.children).toHaveLength(5);
      expect(useEditorStore.getState().canUndo).toBe(true);

      // Execute undo in exactly ONE step
      useEditorStore.getState().undo();

      const docAfterUndo = useEditorStore.getState().document;
      const containerAfterUndo = docAfterUndo.document.children?.[0]?.children?.[0];
      expect(containerAfterUndo?.children).toHaveLength(2);
      expect(containerAfterUndo?.children?.[0].id).toBe('heading-1');
      expect(containerAfterUndo?.children?.[1].id).toBe('text-1');

      // Verify the entire document is restored to the before state
      expect(docAfterUndo).toEqual(beforeDoc);
    });
  });

  describe('Non-intercepted clipboard events', () => {
    it('does not intercept paste when event target is an <input> element', async () => {
      useEditorStore.getState().selectNode('container-1');
      const beforeDoc = useEditorStore.getState().document;
      const preventDefault = vi.fn();

      const event: CanvasPasteEventLike = {
        target: { tagName: 'INPUT' } as unknown as EventTarget,
        preventDefault,
        clipboardData: {
          getData: (type: string) => (type === 'text/html' ? '<p>Should not paste</p>' : ''),
          types: ['text/html'],
          files: [],
          items: [],
        },
      };

      const success = await handleCanvasPaste(event, registry);
      expect(success).toBe(false);
      expect(preventDefault).not.toHaveBeenCalled();
      expect(useEditorStore.getState().document).toEqual(beforeDoc);
    });

    it('does not intercept paste when event target is a <textarea> element', async () => {
      useEditorStore.getState().selectNode('container-1');
      const beforeDoc = useEditorStore.getState().document;
      const preventDefault = vi.fn();

      const event: CanvasPasteEventLike = {
        target: { tagName: 'TEXTAREA' } as unknown as EventTarget,
        preventDefault,
        clipboardData: {
          getData: (type: string) => (type === 'text/html' ? '<p>Should not paste</p>' : ''),
          types: ['text/html'],
          files: [],
          items: [],
        },
      };

      const success = await handleCanvasPaste(event, registry);
      expect(success).toBe(false);
      expect(preventDefault).not.toHaveBeenCalled();
      expect(useEditorStore.getState().document).toEqual(beforeDoc);
    });

    it('does not intercept paste when event target is contenteditable', async () => {
      useEditorStore.getState().selectNode('container-1');
      const beforeDoc = useEditorStore.getState().document;
      const preventDefault = vi.fn();

      const event: CanvasPasteEventLike = {
        target: {
          tagName: 'DIV',
          isContentEditable: true,
        } as unknown as EventTarget,
        preventDefault,
        clipboardData: {
          getData: (type: string) => (type === 'text/html' ? '<p>Should not paste</p>' : ''),
          types: ['text/html'],
          files: [],
          items: [],
        },
      };

      const success = await handleCanvasPaste(event, registry);
      expect(success).toBe(false);
      expect(preventDefault).not.toHaveBeenCalled();
      expect(useEditorStore.getState().document).toEqual(beforeDoc);
    });

    it('does not intercept paste when clipboard contains image files', async () => {
      useEditorStore.getState().selectNode('container-1');
      const beforeDoc = useEditorStore.getState().document;
      const preventDefault = vi.fn();
      const fakeImage = new File(['image-bytes'], 'screenshot.png', { type: 'image/png' });

      const event: CanvasPasteEventLike = {
        target: { tagName: 'DIV' } as unknown as EventTarget,
        preventDefault,
        clipboardData: {
          getData: (type: string) => (type === 'text/html' ? '<p>Ignored html</p>' : ''),
          types: ['text/html', 'Files'],
          files: [fakeImage],
          items: [],
        },
      };

      const success = await handleCanvasPaste(event, registry);
      expect(success).toBe(false);
      expect(preventDefault).not.toHaveBeenCalled();
      expect(useEditorStore.getState().document).toEqual(beforeDoc);
    });

    it('does not intercept paste when clipboard items contain image files', async () => {
      useEditorStore.getState().selectNode('container-1');
      const beforeDoc = useEditorStore.getState().document;
      const preventDefault = vi.fn();

      const event: CanvasPasteEventLike = {
        target: { tagName: 'DIV' } as unknown as EventTarget,
        preventDefault,
        clipboardData: {
          getData: (type: string) => (type === 'text/html' ? '<p>Ignored html</p>' : ''),
          types: ['text/html'],
          files: [],
          items: [{ kind: 'file', type: 'image/jpeg' }],
        },
      };

      const success = await handleCanvasPaste(event, registry);
      expect(success).toBe(false);
      expect(preventDefault).not.toHaveBeenCalled();
      expect(useEditorStore.getState().document).toEqual(beforeDoc);
    });

    it('does not intercept paste when clipboard contains internal KUBUILD payload', async () => {
      useEditorStore.getState().selectNode('container-1');
      const beforeDoc = useEditorStore.getState().document;
      const preventDefault = vi.fn();

      const event: CanvasPasteEventLike = {
        target: { tagName: 'DIV' } as unknown as EventTarget,
        preventDefault,
        clipboardData: {
          getData: (type: string) => {
            if (type === 'application/kubuild-node') return '{"id":"kubuild-1"}';
            if (type === 'text/html') return '<p>Some fallback HTML</p>';
            return '';
          },
          types: ['application/kubuild-node', 'text/html'],
          files: [],
          items: [],
        },
      };

      const success = await handleCanvasPaste(event, registry);
      expect(success).toBe(false);
      expect(useEditorStore.getState().document).toEqual(beforeDoc);
    });

    it('does not intercept paste when clipboard has no text/html', async () => {
      useEditorStore.getState().selectNode('container-1');
      const beforeDoc = useEditorStore.getState().document;
      const preventDefault = vi.fn();

      const event: CanvasPasteEventLike = {
        target: { tagName: 'DIV' } as unknown as EventTarget,
        preventDefault,
        clipboardData: {
          getData: (type: string) => (type === 'text/plain' ? 'Plain text only' : ''),
          types: ['text/plain'],
          files: [],
          items: [],
        },
      };

      const success = await handleCanvasPaste(event, registry);
      expect(success).toBe(false);
      expect(preventDefault).not.toHaveBeenCalled();
      expect(useEditorStore.getState().document).toEqual(beforeDoc);
    });
  });

  describe('isEditableTarget helper', () => {
    it('accurately identifies input, textarea, and contenteditable elements', () => {
      expect(isEditableTarget(null)).toBe(false);
      expect(isEditableTarget({ tagName: 'DIV' } as unknown as EventTarget)).toBe(false);
      expect(isEditableTarget({ tagName: 'INPUT' } as unknown as EventTarget)).toBe(true);
      expect(isEditableTarget({ tagName: 'TEXTAREA' } as unknown as EventTarget)).toBe(true);
      expect(isEditableTarget({ tagName: 'div', isContentEditable: true } as unknown as EventTarget)).toBe(true);
      expect(
        isEditableTarget({
          tagName: 'span',
          getAttribute: (attr: string) => (attr === 'contenteditable' ? 'true' : null),
        } as unknown as EventTarget),
      ).toBe(true);
    });
  });
});
