import { describe, it, expect } from 'vitest';
import { createBlankDocument, validateDocument, findNodeById } from './document-utils';

describe('Core Document Utilities', () => {
  it('creates and validates a blank document', () => {
    const doc = createBlankDocument('Test Landing');
    expect(doc.metadata?.title).toBe('Test Landing');
    expect(doc.document.type).toBe('page');

    const validation = validateDocument(doc);
    expect(validation.success).toBe(true);
  });

  it('finds node by id correctly in nested tree', () => {
    const doc = createBlankDocument();
    doc.document.children = [
      {
        id: 'section-1',
        type: 'section',
        children: [
          {
            id: 'btn-1',
            type: 'button',
            props: { label: 'Click Me' },
          },
        ],
      },
    ];

    const found = findNodeById(doc.document, 'btn-1');
    expect(found).not.toBeNull();
    expect(found?.id).toBe('btn-1');
    expect(found?.props?.label).toBe('Click Me');

    const notFound = findNodeById(doc.document, 'non-existent');
    expect(notFound).toBeNull();
  });
});
