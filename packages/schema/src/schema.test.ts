import { describe, it, expect } from 'vitest';
import { PageDocumentSchema } from './document';
import starterPage from './fixtures/starter-page.json';

describe('PageDocumentSchema', () => {
  it('successfully validates the starter page fixture', () => {
    const result = PageDocumentSchema.safeParse(starterPage);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.schema).toBe('stora.page');
      expect(result.data.document.type).toBe('page');
      expect(result.data.document.children?.length).toBeGreaterThan(0);
    }
  });

  it('rejects invalid document schemas', () => {
    const invalidDoc = {
      schema: 'wrong.schema',
      version: '1.0.0',
      document: {
        id: '1',
        type: 'page',
      },
    };
    const result = PageDocumentSchema.safeParse(invalidDoc);
    expect(result.success).toBe(false);
  });
});
