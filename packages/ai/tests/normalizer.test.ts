import { describe, it, expect } from 'vitest';
import {
  extractJsonFromResponse,
  normalizeNodeTree,
  normalizeAndValidatePageDocument,
  normalizeAndValidateSectionNode,
  normalizeAndValidateRefactoredNode,
} from '../src/core/normalizer';

describe('normalizer', () => {
  describe('extractJsonFromResponse', () => {
    it('parses direct JSON string', () => {
      const input = '{"hello": "world"}';
      expect(extractJsonFromResponse(input)).toEqual({ hello: 'world' });
    });

    it('strips markdown code blocks', () => {
      const input = '```json\n{"foo": 123}\n```';
      expect(extractJsonFromResponse(input)).toEqual({ foo: 123 });
    });

    it('extracts JSON surrounded by conversation chatter', () => {
      const input = 'Here is your generated web page:\n{"schema": "stora.page", "version": "1.0.0"}\nHope you like it!';
      expect(extractJsonFromResponse(input)).toEqual({ schema: 'stora.page', version: '1.0.0' });
    });

    it('throws when text contains no valid JSON', () => {
      expect(() => extractJsonFromResponse('No JSON here at all')).toThrow();
    });
  });

  describe('normalizeNodeTree', () => {
    it('assigns unique deterministic IDs when missing or duplicated', () => {
      const rawTree = {
        type: 'page',
        children: [
          { type: 'section' },
          { type: 'section' },
          { id: 'custom-btn', type: 'button' },
          { id: 'custom-btn', type: 'button' }, // duplicate ID
        ],
      };

      const normalized = normalizeNodeTree(rawTree);
      expect(normalized.id).toBe('page-1');
      expect(normalized.children?.[0].id).toBe('section-1');
      expect(normalized.children?.[1].id).toBe('section-2');
      expect(normalized.children?.[2].id).toBe('custom-btn');
      expect(normalized.children?.[3].id).toBe('button-1');
    });
  });

  describe('normalizeAndValidatePageDocument', () => {
    it('validates a complete valid PageDocument', () => {
      const validDoc = {
        schema: 'stora.page',
        version: '1.0.0',
        metadata: {
          title: 'Test Page',
        },
        document: {
          id: 'root-page',
          type: 'page',
          styles: {
            base: {
              backgroundColor: '#ffffff',
            },
          },
          children: [
            {
              id: 'sec-1',
              type: 'section',
              children: [],
            },
          ],
        },
      };

      const normalized = normalizeAndValidatePageDocument(validDoc);
      expect(normalized.schema).toBe('stora.page');
      expect(normalized.document.id).toBe('root-page');
      expect(normalized.document.children?.[0].id).toBe('sec-1');
    });

    it('auto-wraps bare page node into PageDocument', () => {
      const bareNode = {
        type: 'page',
        props: { title: 'Auto Wrapped' },
        children: [{ type: 'section' }],
      };

      const normalized = normalizeAndValidatePageDocument(bareNode);
      expect(normalized.schema).toBe('stora.page');
      expect(normalized.version).toBe('1.0.0');
      expect(normalized.document.type).toBe('page');
      expect(normalized.document.children?.[0].type).toBe('section');
    });

    it('rejects document with dangerous style value (XSS prevention)', () => {
      const maliciousDoc = {
        schema: 'stora.page',
        version: '1.0.0',
        document: {
          id: 'root-page',
          type: 'page',
          styles: {
            base: {
              backgroundImage: 'url(javascript:alert(1))',
            },
          },
          children: [],
        },
      };

      expect(() => normalizeAndValidatePageDocument(maliciousDoc)).toThrow();
    });
  });

  describe('normalizeAndValidateSectionNode', () => {
    it('enforces section type and returns valid node', () => {
      const raw = {
        type: 'container', // AI might incorrectly say container at root
        children: [{ id: 'btn', type: 'button' }],
      };

      const section = normalizeAndValidateSectionNode(raw);
      expect(section.type).toBe('section');
      expect(section.children?.[0].id).toBe('btn');
    });
  });

  describe('normalizeAndValidateRefactoredNode', () => {
    it('preserves original node id and type', () => {
      const original = {
        id: 'orig-id-123',
        type: 'button',
        props: { label: 'Old' },
      };

      const rawAiOutput = {
        id: 'ai-hallucinated-id',
        type: 'link', // AI changed type
        props: { label: 'New Label', variant: 'primary' },
      };

      const refactored = normalizeAndValidateRefactoredNode(rawAiOutput, original);
      expect(refactored.id).toBe('orig-id-123');
      expect(refactored.type).toBe('button');
      expect(refactored.props?.label).toBe('New Label');
    });
  });
});
