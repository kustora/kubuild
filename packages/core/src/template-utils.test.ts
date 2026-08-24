import { describe, it, expect } from 'vitest';
import {
  validateTemplate,
  extractTemplateRequirements,
  createTemplateRecord,
} from './template-utils';
import { starterPageFixture } from '@kubuild/schema';

describe('Template Utilities in @kubuild/core', () => {
  describe('validateTemplate', () => {
    it('returns valid: true for conforming template record', () => {
      const result = validateTemplate({
        id: 'tmpl_1',
        name: 'Starter Template',
        description: 'A basic landing page starter',
        category: 'landing',
        tags: ['starter', 'clean'],
        thumbnail: 'https://example.com/thumb.jpg',
        author: 'Kustora',
        version: '1.0.0',
        document: starterPageFixture,
      });

      expect(result.valid).toBe(true);
      expect(result.data?.id).toBe('tmpl_1');
      expect(result.errors).toBeUndefined();
    });

    it('returns valid: false with structured error path and message for invalid record', () => {
      const result = validateTemplate({
        id: '',
        name: '',
        thumbnail: 'javascript:alert(1)',
      });

      expect(result.valid).toBe(false);
      expect(result.data).toBeUndefined();
      expect(result.errors).toBeDefined();
      expect(result.errors?.length).toBeGreaterThanOrEqual(2);

      const paths = result.errors?.map((e) => e.path);
      expect(paths).toContain('/id');
      expect(paths).toContain('/name');
      expect(paths).toContain('/thumbnail');
    });
  });

  describe('extractTemplateRequirements', () => {
    it('returns empty requiredComponents for standard built-in components', () => {
      const reqs = extractTemplateRequirements(starterPageFixture);
      expect(reqs.requiredComponents).toEqual([]);
      expect(reqs.requiredCapabilities).toEqual([]);
    });

    it('detects and lists custom component types used in the document', () => {
      const docWithCustomComponents = {
        ...starterPageFixture,
        document: {
          ...starterPageFixture.document,
          children: [
            {
              id: 'custom_node_1',
              type: 'custom.product-card',
              props: {},
              children: [
                {
                  id: 'custom_node_2',
                  type: 'custom.rating-stars',
                  props: {},
                },
              ],
            },
            {
              id: 'section_1',
              type: 'section',
              children: [
                {
                  id: 'custom_node_3',
                  type: 'custom.pricing-table',
                  props: {},
                },
              ],
            },
          ],
        },
      };

      const reqs = extractTemplateRequirements(docWithCustomComponents);
      expect(reqs.requiredComponents).toEqual([
        'custom.pricing-table',
        'custom.product-card',
        'custom.rating-stars',
      ]);
    });
  });

  describe('createTemplateRecord', () => {
    it('creates a validated template record and sets timestamps', () => {
      const record = createTemplateRecord({
        id: 'tmpl_new',
        name: 'New SaaS Template',
        document: starterPageFixture,
      });

      expect(record.id).toBe('tmpl_new');
      expect(record.name).toBe('New SaaS Template');
      expect(record.category).toBe('general');
      expect(record.tags).toEqual([]);
      expect(record.version).toBe('1.0.0');
      expect(record.createdAt).toBeDefined();
      expect(record.updatedAt).toBeDefined();
      expect(record.requirements.requiredComponents).toEqual([]);
    });

    it('automatically extracts custom requirements when document has custom components', () => {
      const docWithCustom = {
        ...starterPageFixture,
        document: {
          ...starterPageFixture.document,
          children: [
            {
              id: 'card_1',
              type: 'custom.feature-grid',
            },
          ],
        },
      };

      const record = createTemplateRecord({
        id: 'tmpl_custom',
        name: 'Custom Component Template',
        document: docWithCustom,
      });

      expect(record.requirements.requiredComponents).toContain('custom.feature-grid');
    });

    it('throws an error if required fields are missing or invalid', () => {
      expect(() =>
        createTemplateRecord({
          id: '',
          name: '',
        })
      ).toThrow('Invalid template record');
    });
  });
});
