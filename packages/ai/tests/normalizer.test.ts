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

    it('normalizes nested :hover inside styles.base to styles.states', () => {
      const rawWithHoverInBase = {
        id: 'hero-section',
        type: 'section',
        children: [
          {
            id: 'cta-primary',
            type: 'button',
            props: { label: 'Click Me' },
            styles: {
              base: {
                backgroundColor: '#3b82f6',
                color: '#ffffff',
                ':hover': {
                  backgroundColor: '#2563eb',
                },
              },
            },
          },
        ],
      };

      const section = normalizeAndValidateSectionNode(rawWithHoverInBase);
      expect(section.type).toBe('section');
      const btn = section.children?.[0];
      expect(btn).toBeDefined();
      expect(btn?.styles?.base).toEqual({
        backgroundColor: '#3b82f6',
        color: '#ffffff',
      });
      expect(btn?.styles?.states?.[':hover']).toEqual({
        backgroundColor: '#2563eb',
      });
    });

    it('normalizes string heading level to number', () => {
      const rawWithHeading = {
        id: 'sec-head',
        type: 'section',
        children: [
          {
            id: 'h1',
            type: 'heading',
            props: { text: 'Title', level: '1' },
          },
        ],
      };

      const section = normalizeAndValidateSectionNode(rawWithHeading);
      const heading = section.children?.[0];
      expect(heading?.props?.level).toBe(1);
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

  // STORA-521 — `@kubuild/ai` must reuse `@kubuild/core`'s `validateDocumentSecurity`
  // (depth/node-count limits) for every AI output path, not just the editor's downstream
  // defense-in-depth reuse. These crafted payloads exercise that the *engine-facing*
  // normalize/validate helpers reject a deliberately deep/wide tree cleanly (a thrown,
  // descriptive error) instead of silently passing it through or hanging.
  describe('security limits on AI output (STORA-521)', () => {
    /** Builds a `container` chain nested `depth` levels deep — exceeds the default 32. */
    function buildDeepTree(depth: number): Record<string, unknown> {
      let node: Record<string, unknown> = { id: 'leaf', type: 'text', props: { text: 'x' } };
      for (let i = 0; i < depth; i++) {
        node = { id: `wrap-${i}`, type: 'container', children: [node] };
      }
      return node;
    }

    /** Builds a single node with `count` direct children — exceeds the default 1000. */
    function buildWideChildren(count: number): Record<string, unknown>[] {
      return Array.from({ length: count }, (_, i) => ({
        id: `child-${i}`,
        type: 'text',
        props: { text: `item ${i}` },
      }));
    }

    it('normalizeAndValidateSectionNode rejects a deliberately deep tree (MAX_TREE_DEPTH_EXCEEDED)', () => {
      const deepSection = {
        id: 'deep-section',
        type: 'section',
        children: [buildDeepTree(50)],
      };

      expect(() => normalizeAndValidateSectionNode(deepSection)).toThrow(/MAX_TREE_DEPTH_EXCEEDED/);
    });

    it('normalizeAndValidateSectionNode rejects a deliberately wide tree (MAX_CHILDREN_COUNT_EXCEEDED / MAX_NODE_COUNT_EXCEEDED)', () => {
      const wideSection = {
        id: 'wide-section',
        type: 'section',
        children: buildWideChildren(1500),
      };

      expect(() => normalizeAndValidateSectionNode(wideSection)).toThrow(
        /MAX_CHILDREN_COUNT_EXCEEDED|MAX_NODE_COUNT_EXCEEDED/,
      );
    });

    it('normalizeAndValidatePageDocument rejects a deliberately deep generated page tree', () => {
      const deepDoc = {
        schema: 'stora.page',
        version: '1.0.0',
        metadata: { title: 'Malicious Deep Page' },
        document: {
          id: 'root-page',
          type: 'page',
          children: [buildDeepTree(60)],
        },
      };

      // `normalizeAndValidatePageDocument` routes through `@kubuild/core`'s full
      // `validateDocument` (schema + security), which re-labels the security violation
      // code as `SECURITY_LIMIT_EXCEEDED` while preserving the underlying "nesting depth
      // exceeded" message — still the same shared `validateDocumentSecurity` check, just
      // wrapped with a document-level error code.
      expect(() => normalizeAndValidatePageDocument(deepDoc)).toThrow(
        /SECURITY_LIMIT_EXCEEDED.*nesting depth/,
      );
    });

    it('normalizeAndValidateRefactoredNode rejects an oversized refactor candidate the same way', () => {
      const original = { id: 'card-1', type: 'container', children: [] };
      const maliciousCandidate = {
        id: 'card-1',
        type: 'container',
        children: [buildDeepTree(50)],
      };

      expect(() => normalizeAndValidateRefactoredNode(maliciousCandidate, original)).toThrow(
        /MAX_TREE_DEPTH_EXCEEDED/,
      );
    });

    it('respects a custom (tighter) securityLimits override, not a hardcoded duplicate limit', () => {
      // A tree that is well within the *default* 32-depth limit, but exceeds a custom,
      // tighter limit passed by the caller — proves the same `DocumentSecurityLimits`
      // config threads all the way through, rather than a second hardcoded checker.
      const shallowButOverCustomLimit = {
        id: 'sec',
        type: 'section',
        children: [buildDeepTree(5)],
      };

      expect(() =>
        normalizeAndValidateSectionNode(shallowButOverCustomLimit, { maxTreeDepth: 3 }),
      ).toThrow(/MAX_TREE_DEPTH_EXCEEDED/);
    });
  });
});
