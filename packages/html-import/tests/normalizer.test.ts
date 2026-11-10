/**
 * @kubuild/html-import
 * Unit tests for tree normalization pipeline (STORA-612)
 */

import { describe, expect, it } from 'vitest';
import { PageDocumentSchema } from '@kubuild/schema';
import {
  createEmptyReport,
  htmlToNodes,
  importHtml,
  normalizeNodeTree,
  collapseRedundantWrappers,
  mergeConsecutiveTextNodes,
  stripRedundantStyles,
  assignDeterministicNodeIds,
  countTotalNodes,
  type PageNode,
} from '../src/index.js';

describe('Tree Normalization Pipeline (STORA-612)', () => {
  describe('1. Wrapper Div Collapsing', () => {
    it('collapses single-child unstyled container wrapper by promoting child', () => {
      const tree: PageNode[] = [
        {
          id: 'wrap',
          type: 'container',
          styles: {},
          children: [
            {
              id: 'child-p',
              type: 'paragraph',
              props: { text: 'Hello World' },
            },
          ],
        },
      ];

      const normalized = normalizeNodeTree(tree);
      expect(normalized).toHaveLength(1);
      expect(normalized[0].type).toBe('paragraph');
      expect(normalized[0].props?.text).toBe('Hello World');
    });

    it('collapses multi-level nested redundant wrappers down to innermost child', () => {
      const tree: PageNode[] = [
        {
          id: 'wrap-1',
          type: 'container',
          styles: { base: { display: 'block' } },
          children: [
            {
              id: 'wrap-2',
              type: 'flex',
              styles: { base: { display: 'flex' } },
              children: [
                {
                  id: 'wrap-3',
                  type: 'container',
                  styles: {},
                  children: [
                    {
                      id: 'leaf-text',
                      type: 'text',
                      props: { text: 'Deep leaf', as: 'span' },
                    },
                  ],
                },
              ],
            },
          ],
        },
      ];

      const normalized = normalizeNodeTree(tree);
      expect(normalized).toHaveLength(1);
      expect(normalized[0].type).toBe('text');
      expect(normalized[0].props?.text).toBe('Deep leaf');
    });

    it('collapses wrapper when styles contain only negligible properties (display, boxSizing)', () => {
      const tree: PageNode[] = [
        {
          id: 'w1',
          type: 'container',
          styles: {
            base: { display: 'block', boxSizing: 'border-box' },
          },
          children: [
            {
              id: 'h1',
              type: 'heading',
              props: { text: 'Title', level: 1 },
            },
          ],
        },
      ];

      const normalized = normalizeNodeTree(tree);
      expect(normalized).toHaveLength(1);
      expect(normalized[0].type).toBe('heading');
    });

    it('preserves structural container that has multiple children', () => {
      const tree: PageNode[] = [
        {
          id: 'container-struct',
          type: 'container',
          styles: {},
          children: [
            { id: 'c1', type: 'paragraph', props: { text: 'Item 1' } },
            { id: 'c2', type: 'paragraph', props: { text: 'Item 2' } },
          ],
        },
      ];

      const normalized = normalizeNodeTree(tree);
      expect(normalized).toHaveLength(1);
      expect(normalized[0].type).toBe('container');
      expect(normalized[0].children).toHaveLength(2);
      expect(normalized[0].children?.[0].props?.text).toBe('Item 1');
      expect(normalized[0].children?.[1].props?.text).toBe('Item 2');
    });

    it('preserves container that has distinct custom styling (background, padding, etc.)', () => {
      const styledNodes: PageNode[] = [
        {
          id: 'bg-container',
          type: 'container',
          styles: { base: { backgroundColor: '#ff0000' } },
          children: [{ id: 'p1', type: 'paragraph', props: { text: 'P1' } }],
        },
        {
          id: 'pad-container',
          type: 'container',
          styles: { base: { padding: '16px' } },
          children: [{ id: 'p2', type: 'paragraph', props: { text: 'P2' } }],
        },
        {
          id: 'w-container',
          type: 'container',
          styles: { base: { width: '500px' } },
          children: [{ id: 'p3', type: 'paragraph', props: { text: 'P3' } }],
        },
        {
          id: 'border-container',
          type: 'container',
          styles: { base: { border: '1px solid black' } },
          children: [{ id: 'p4', type: 'paragraph', props: { text: 'P4' } }],
        },
      ];

      const normalized = normalizeNodeTree(styledNodes);
      expect(normalized).toHaveLength(4);
      for (const node of normalized) {
        expect(node.type).toBe('container');
        expect(node.children).toHaveLength(1);
      }
    });

    it('preserves container with responsive breakpoint or pseudo-state styles', () => {
      const tree: PageNode[] = [
        {
          id: 'resp-container',
          type: 'container',
          styles: {
            mobile: { display: 'none' },
          },
          children: [{ id: 'p1', type: 'paragraph', props: { text: 'Mobile hidden' } }],
        },
        {
          id: 'state-container',
          type: 'container',
          styles: {
            states: {
              hover: { opacity: 0.8 },
            },
          },
          children: [{ id: 'p2', type: 'paragraph', props: { text: 'Hoverable' } }],
        },
      ];

      const normalized = normalizeNodeTree(tree);
      expect(normalized).toHaveLength(2);
      expect(normalized[0].type).toBe('container');
      expect(normalized[1].type).toBe('container');
    });

    it('preserves container with meaningful custom props (role, ariaLabel)', () => {
      const tree: PageNode[] = [
        {
          id: 'role-container',
          type: 'container',
          props: { role: 'navigation' },
          styles: {},
          children: [{ id: 'p1', type: 'paragraph', props: { text: 'Nav' } }],
        },
        {
          id: 'aria-container',
          type: 'container',
          props: { ariaLabel: 'Card wrapper' },
          styles: {},
          children: [{ id: 'p2', type: 'paragraph', props: { text: 'Card' } }],
        },
      ];

      const normalized = normalizeNodeTree(tree);
      expect(normalized).toHaveLength(2);
      expect(normalized[0].type).toBe('container');
      expect(normalized[1].type).toBe('container');
    });

    it('does not collapse non-container types like section, page, or link even with single child', () => {
      const tree: PageNode[] = [
        {
          id: 'sec',
          type: 'section',
          styles: {},
          children: [{ id: 'p1', type: 'paragraph', props: { text: 'P' } }],
        },
      ];

      const normalized = normalizeNodeTree(tree);
      expect(normalized).toHaveLength(1);
      expect(normalized[0].type).toBe('section');
    });
  });

  describe('2. Merging Consecutive Text Nodes', () => {
    it('merges consecutive text components with same tag and empty styles', () => {
      const tree: PageNode[] = [
        {
          id: 't1',
          type: 'text',
          props: { text: 'Hello ', as: 'span' },
          styles: {},
        },
        {
          id: 't2',
          type: 'text',
          props: { text: 'World', as: 'span' },
          styles: {},
        },
      ];

      const normalized = normalizeNodeTree(tree);
      expect(normalized).toHaveLength(1);
      expect(normalized[0].type).toBe('text');
      expect(normalized[0].props?.text).toBe('Hello World');
      expect(normalized[0].props?.as).toBe('span');
    });

    it('merges three consecutive text components into a single text component', () => {
      const tree: PageNode[] = [
        {
          id: 't1',
          type: 'text',
          props: { text: 'Foo', as: 'span' },
        },
        {
          id: 't2',
          type: 'text',
          props: { text: ' - ', as: 'span' },
        },
        {
          id: 't3',
          type: 'text',
          props: { text: 'Bar', as: 'span' },
        },
      ];

      const normalized = normalizeNodeTree(tree);
      expect(normalized).toHaveLength(1);
      expect(normalized[0].props?.text).toBe('Foo - Bar');
    });

    it('merges consecutive text nodes with identical non-empty styles', () => {
      const tree: PageNode[] = [
        {
          id: 't1',
          type: 'text',
          props: { text: 'Red ', as: 'span' },
          styles: { base: { color: '#ff0000', fontWeight: 'bold' } },
        },
        {
          id: 't2',
          type: 'text',
          props: { text: 'Text', as: 'span' },
          styles: { base: { color: '#ff0000', fontWeight: 'bold' } },
        },
      ];

      const normalized = normalizeNodeTree(tree);
      expect(normalized).toHaveLength(1);
      expect(normalized[0].props?.text).toBe('Red Text');
      expect(normalized[0].styles.base?.color).toBe('#ff0000');
    });

    it('does NOT merge consecutive text nodes with different tags (props.as)', () => {
      const tree: PageNode[] = [
        {
          id: 't1',
          type: 'text',
          props: { text: 'Span text ', as: 'span' },
        },
        {
          id: 't2',
          type: 'text',
          props: { text: 'Strong text', as: 'strong' },
        },
      ];

      const normalized = normalizeNodeTree(tree);
      expect(normalized).toHaveLength(2);
      expect(normalized[0].props?.text).toBe('Span text ');
      expect(normalized[1].props?.text).toBe('Strong text');
    });

    it('does NOT merge consecutive text nodes with different styles', () => {
      const tree: PageNode[] = [
        {
          id: 't1',
          type: 'text',
          props: { text: 'Red', as: 'span' },
          styles: { base: { color: 'red' } },
        },
        {
          id: 't2',
          type: 'text',
          props: { text: 'Blue', as: 'span' },
          styles: { base: { color: 'blue' } },
        },
      ];

      const normalized = normalizeNodeTree(tree);
      expect(normalized).toHaveLength(2);
      expect(normalized[0].props?.text).toBe('Red');
      expect(normalized[1].props?.text).toBe('Blue');
    });

    it('does NOT merge text nodes separated by a non-text component', () => {
      const tree: PageNode[] = [
        { id: 't1', type: 'text', props: { text: 'A', as: 'span' } },
        { id: 'p', type: 'paragraph', props: { text: 'Divider' } },
        { id: 't2', type: 'text', props: { text: 'B', as: 'span' } },
      ];

      const normalized = normalizeNodeTree(tree);
      expect(normalized).toHaveLength(3);
    });
  });

  describe('3. Stripping Redundant / Default Styles', () => {
    it('removes empty style objects from base, desktop, tablet, mobile, states', () => {
      const styles = stripRedundantStyles({
        base: {},
        desktop: {},
        tablet: {},
        mobile: {},
        states: {
          hover: {},
        },
      });

      expect(styles.base).toBeUndefined();
      expect(styles.desktop).toBeUndefined();
      expect(styles.tablet).toBeUndefined();
      expect(styles.mobile).toBeUndefined();
      expect(styles.states).toBeUndefined();
    });

    it('removes undefined, null, and empty string properties from style definitions', () => {
      const styles = stripRedundantStyles({
        base: {
          color: '#333',
          backgroundColor: '',
          margin: undefined as unknown as string,
          padding: null as unknown as string,
        },
      });

      expect(styles.base).toEqual({ color: '#333' });
    });

    it('strips empty states and removes states property entirely when all states are empty', () => {
      const styles = stripRedundantStyles({
        base: { fontSize: '14px' },
        states: {
          hover: { opacity: '' },
          focus: { outline: undefined as unknown as string },
        },
      });

      expect(styles.base).toEqual({ fontSize: '14px' });
      expect(styles.states).toBeUndefined();
    });
  });

  describe('4. Deterministic Node IDs', () => {
    it('assigns deterministic IDs based on root-page, parent path, and sibling index', () => {
      const tree: PageNode[] = [
        {
          id: 'temp-root',
          type: 'page',
          children: [
            {
              id: 'temp-sec',
              type: 'section',
              children: [
                { id: 'temp-p1', type: 'paragraph', props: { text: 'P1' } },
                { id: 'temp-p2', type: 'paragraph', props: { text: 'P2' } },
              ],
            },
            {
              id: 'temp-sec2',
              type: 'section',
              children: [
                { id: 'temp-p3', type: 'paragraph', props: { text: 'P3' } },
              ],
            },
          ],
        },
      ];

      const normalized = normalizeNodeTree(tree);
      const root = normalized[0];

      expect(root.id).toBe('root-page');
      expect(root.children?.[0].id).toBe('node-1');
      expect(root.children?.[0].children?.[0].id).toBe('node-1-1');
      expect(root.children?.[0].children?.[1].id).toBe('node-1-2');
      expect(root.children?.[1].id).toBe('node-2');
      expect(root.children?.[1].children?.[0].id).toBe('node-2-1');
    });

    it('assigns deterministic IDs for fragment arrays without root page', () => {
      const fragments: PageNode[] = [
        {
          id: 'temp-1',
          type: 'paragraph',
          props: { text: 'Item 1' },
        },
        {
          id: 'temp-2',
          type: 'container',
          styles: { base: { padding: '10px' } },
          children: [
            { id: 'temp-sub-1', type: 'paragraph', props: { text: 'Sub 1' } },
            { id: 'temp-sub-2', type: 'paragraph', props: { text: 'Sub 2' } },
          ],
        },
      ];

      const normalized = normalizeNodeTree(fragments);
      expect(normalized[0].id).toBe('node-1');
      expect(normalized[1].id).toBe('node-2');
      expect(normalized[1].children?.[0].id).toBe('node-2-1');
      expect(normalized[1].children?.[1].id).toBe('node-2-2');
    });

    it('guarantees identical AST output across two separate runs on the exact same HTML (deterministic structure)', async () => {
      const html = `
        <header>
          <nav>
            <a href="/">Home</a>
            <a href="/about">About</a>
          </nav>
        </header>
        <main>
          <div style="background: #fafafa; padding: 24px">
            <h1>Welcome to KUBUILD</h1>
            <p>Static HTML importer with deterministic AST compilation.</p>
          </div>
        </main>
      `;

      const run1 = await htmlToNodes(html);
      const run2 = await htmlToNodes(html);

      expect(run1.success).toBe(true);
      expect(run2.success).toBe(true);
      expect(run1.nodes).toEqual(run2.nodes);
    });

    it('guarantees identical PageDocument AST across two separate importHtml runs', async () => {
      const html = '<!DOCTYPE html><html><head><title>Title</title></head><body><h1>Header</h1><p>Body text</p></body></html>';
      const fixedDate = '2026-11-10T00:00:00.000Z';

      const res1 = await importHtml(html, {
        metadata: { createdAt: fixedDate, updatedAt: fixedDate },
      });
      const res2 = await importHtml(html, {
        metadata: { createdAt: fixedDate, updatedAt: fixedDate },
      });

      expect(res1.success).toBe(true);
      expect(res2.success).toBe(true);
      expect(res1.document).toEqual(res2.document);
    });
  });

  describe('5. Depth Limiting & Flattening', () => {
    it('properly flattens deeply nested HTML tree (> 32 levels deep) and records DEPTH_FLATTENED diagnostic', async () => {
      // Build 38 levels of nested styled divs to prevent wrapper collapsing
      let deepHtml = '<p>Deepest Text</p>';
      for (let i = 0; i < 38; i++) {
        deepHtml = `<div style="padding: 1px">${deepHtml}</div>`;
      }

      const report = createEmptyReport();
      const res = await htmlToNodes(deepHtml, { limits: { maxTreeDepth: 32 } });

      expect(res.success).toBe(true);
      expect(res.report.diagnostics.some((d) => d.code === 'DEPTH_FLATTENED')).toBe(true);

      const depthDiag = res.report.diagnostics.find((d) => d.code === 'DEPTH_FLATTENED');
      expect(depthDiag?.severity).toBe('warning');

      // Verify that no node in the resulting tree exceeds maxTreeDepth (32)
      function getMaxDepth(node: PageNode, depth = 1): number {
        let max = depth;
        if (node.children && node.children.length > 0) {
          for (const child of node.children) {
            max = Math.max(max, getMaxDepth(child, depth + 1));
          }
        }
        return max;
      }

      for (const root of res.nodes) {
        const depth = getMaxDepth(root, 1);
        expect(depth).toBeLessThanOrEqual(32);
      }
    });

    it('respects custom maxTreeDepth in limits options (e.g. depth limit = 4)', () => {
      // Create tree: Root (1) -> C1 (2) -> C2 (3) -> C3 (4) -> Leaf (5)
      const tree: PageNode[] = [
        {
          id: 'n1',
          type: 'container',
          styles: { base: { padding: '1px' } },
          children: [
            {
              id: 'n2',
              type: 'container',
              styles: { base: { padding: '1px' } },
              children: [
                {
                  id: 'n3',
                  type: 'container',
                  styles: { base: { padding: '1px' } },
                  children: [
                    {
                      id: 'n4',
                      type: 'container',
                      styles: { base: { padding: '1px' } },
                      children: [
                        { id: 'leaf', type: 'paragraph', props: { text: 'Deep leaf' } },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ];

      const report = createEmptyReport();
      const normalized = normalizeNodeTree(tree, { limits: { maxTreeDepth: 4 } }, report);

      expect(report.diagnostics.some((d) => d.code === 'DEPTH_FLATTENED')).toBe(true);

      function getMaxDepth(node: PageNode, depth = 1): number {
        let max = depth;
        if (node.children && node.children.length > 0) {
          for (const child of node.children) {
            max = Math.max(max, getMaxDepth(child, depth + 1));
          }
        }
        return max;
      }

      for (const root of normalized) {
        expect(getMaxDepth(root, 1)).toBeLessThanOrEqual(4);
      }
    });
  });

  describe('6. Node Count Limit Checking', () => {
    it('records LIMIT_EXCEEDED diagnostic with error severity when maxNodeCount is exceeded', () => {
      const nodes: PageNode[] = [
        { id: '1', type: 'paragraph', props: { text: 'One' } },
        { id: '2', type: 'paragraph', props: { text: 'Two' } },
        { id: '3', type: 'paragraph', props: { text: 'Three' } },
      ];

      const report = createEmptyReport();
      normalizeNodeTree(nodes, { limits: { maxNodeCount: 2 } }, report);

      const limitDiag = report.diagnostics.find((d) => d.code === 'LIMIT_EXCEEDED');
      expect(limitDiag).toBeDefined();
      expect(limitDiag?.severity).toBe('error');
      expect(limitDiag?.message).toContain('exceeds maximum allowed node count');
    });

    it('rejects htmlToNodes and importHtml when node count exceeds maxNodeCount', async () => {
      const html = '<p>P1</p><p>P2</p><p>P3</p><p>P4</p><p>P5</p>';

      const nodesRes = await htmlToNodes(html, { limits: { maxNodeCount: 3 } });
      expect(nodesRes.success).toBe(false);
      expect(nodesRes.error).toContain('Node count limit exceeded');
      expect(nodesRes.report.diagnostics.some((d) => d.code === 'LIMIT_EXCEEDED')).toBe(true);

      const docRes = await importHtml(html, { limits: { maxNodeCount: 3 } });
      expect(docRes.success).toBe(false);
      expect(docRes.error).toContain('Node count limit exceeded');
      expect(docRes.report.diagnostics.some((d) => d.code === 'LIMIT_EXCEEDED')).toBe(true);
    });

    it('correctly updates stats.nodeCount to reflect final normalized node count', async () => {
      // 3 unstyled single-child wrapper divs wrapping 1 paragraph
      const html = '<div><div><div><p>Only Paragraph</p></div></div></div>';
      const res = await htmlToNodes(html);

      expect(res.success).toBe(true);
      expect(res.nodes).toHaveLength(1);
      expect(res.nodes[0].type).toBe('paragraph');
      // stats.nodeCount should reflect the post-normalized count (1 paragraph)
      expect(res.report.stats.nodeCount).toBe(1);
    });
  });
});
