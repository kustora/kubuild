/**
 * @kubuild/html-import
 * Unit tests for element mapping rule registry, priority engine, and type validation (STORA-607).
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseFragment } from 'parse5';
import { BUILTIN_COMPONENT_TYPES, type PageDocument } from '@kubuild/schema';
import {
  HtmlRuleRegistry,
  createRuleRegistry,
  createMappingContext,
  createIdGenerator,
  type HtmlMappingRule,
  type HtmlMappingContext,
} from '../src/rules/index.js';
import { isElement } from '../src/sanitizer.js';
import type { Parse5Element } from '../src/cascade.js';
import type { PageNode } from '../src/types.js';

function parseSingleElement(html: string): Parse5Element {
  const fragment = parseFragment(html);
  const element = fragment.childNodes.find(isElement);
  if (!element) {
    throw new Error(`Failed to parse element from HTML: ${html}`);
  }
  return element;
}

describe('HtmlRuleRegistry', () => {
  describe('Priority evaluation', () => {
    it('sorts registered rules in descending priority order', () => {
      const registry = new HtmlRuleRegistry();

      registry.register({
        id: 'low-prio',
        priority: 10,
        match: () => true,
        convert: () => null,
      });

      registry.register({
        id: 'high-prio',
        priority: 100,
        match: () => true,
        convert: () => null,
      });

      registry.register({
        id: 'mid-prio',
        priority: 50,
        match: () => true,
        convert: () => null,
      });

      const rules = registry.getRules();
      expect(rules.map((r) => r.id)).toEqual(['high-prio', 'mid-prio', 'low-prio']);
      expect(rules.map((r) => r.priority)).toEqual([100, 50, 10]);
    });

    it('evaluates higher priority rule first when multiple rules match', () => {
      const registry = new HtmlRuleRegistry();
      const executionOrder: string[] = [];

      registry.register({
        id: 'div-default',
        priority: 20,
        match: (el) => el.tagName === 'div',
        convert: () => {
          executionOrder.push('div-default');
          return { id: 'node-default', type: 'container', props: {}, children: [] };
        },
      });

      registry.register({
        id: 'div-high',
        priority: 150,
        match: (el) => el.tagName === 'div',
        convert: () => {
          executionOrder.push('div-high');
          return { id: 'node-high', type: 'section', props: {}, children: [] };
        },
      });

      const element = parseSingleElement('<div>Hello</div>');
      const ctx = registry.createContext();
      const result = registry.convertElement(element, ctx);

      expect(executionOrder).toEqual(['div-high']);
      expect(result).not.toBeNull();
      expect((result as PageNode).type).toBe('section');
      expect((result as PageNode).id).toBe('node-high');
    });

    it('preserves insertion order when rules have identical priority', () => {
      const registry = new HtmlRuleRegistry();

      registry.register({
        id: 'rule-1',
        priority: 50,
        match: () => true,
        convert: () => null,
      });
      registry.register({
        id: 'rule-2',
        priority: 50,
        match: () => true,
        convert: () => null,
      });
      registry.register({
        id: 'rule-3',
        priority: 50,
        match: () => true,
        convert: () => null,
      });

      const rules = registry.getRules();
      expect(rules.map((r) => r.id)).toEqual(['rule-1', 'rule-2', 'rule-3']);
    });
  });

  describe('Host rule override', () => {
    it('allows host rule with identical id to override a default rule in place', () => {
      const registry = new HtmlRuleRegistry();

      registry.register({
        id: 'heading',
        priority: 50,
        match: (el) => el.tagName === 'h1',
        convert: () => ({ id: 'default-h1', type: 'heading', props: { level: 1 } }),
      });

      // Host rule with the exact same ID
      registry.register({
        id: 'heading',
        priority: 60,
        match: (el) => el.tagName === 'h1',
        convert: () => ({ id: 'custom-h1', type: 'heading', props: { level: 1, custom: true } }),
      });

      const rules = registry.getRules();
      expect(rules.length).toBe(1);
      expect(rules[0].id).toBe('heading');
      expect(rules[0].priority).toBe(60);

      const element = parseSingleElement('<h1>Title</h1>');
      const ctx = registry.createContext();
      const node = registry.convertElement(element, ctx) as PageNode;

      expect(node.id).toBe('custom-h1');
      expect(node.props).toEqual({ level: 1, custom: true });
    });

    it('allows host rule with higher priority and different id to preempt default rule', () => {
      const registry = new HtmlRuleRegistry();

      registry.register({
        id: 'default-paragraph',
        priority: 30,
        match: (el) => el.tagName === 'p',
        convert: () => ({ id: 'p-node', type: 'paragraph', props: {} }),
      });

      const hostRule: HtmlMappingRule = {
        id: 'host-paragraph-callout',
        priority: 250,
        match: (el) => el.tagName === 'p',
        convert: () => ({ id: 'callout-node', type: 'blockquote', props: {} }),
      };

      const element = parseSingleElement('<p>Callout text</p>');
      const ctx = registry.createContext({ rules: [hostRule] });
      const node = registry.convertElement(element, ctx) as PageNode;

      expect(node.id).toBe('callout-node');
      expect(node.type).toBe('blockquote');
    });

    it('supports host rule overriding a default rule via options.rules with identical id', () => {
      const registry = new HtmlRuleRegistry();

      registry.register({
        id: 'link',
        priority: 40,
        match: (el) => el.tagName === 'a',
        convert: () => ({ id: 'link-default', type: 'link', props: { href: '#' } }),
      });

      const hostOverrideRule: HtmlMappingRule = {
        id: 'link',
        priority: 40,
        match: (el) => el.tagName === 'a',
        convert: () => ({ id: 'link-override', type: 'button', props: { variant: 'link' } }),
      };

      const element = parseSingleElement('<a href="https://example.com">Click me</a>');
      const ctx = registry.createContext({ rules: [hostOverrideRule] });
      const node = registry.convertElement(element, ctx) as PageNode;

      expect(node.id).toBe('link-override');
      expect(node.type).toBe('button');

      // The base registry rules list should NOT be mutated by options.rules
      expect(registry.getRules()[0].convert(element, ctx, { base: {}, mediaQueries: [], pseudoStates: {} }))
        .toMatchObject({ id: 'link-default' });
    });

    it('withHostRules creates an isolated clone with host rules registered', () => {
      const baseRegistry = new HtmlRuleRegistry();
      baseRegistry.register({
        id: 'box',
        priority: 10,
        match: () => true,
        convert: () => ({ id: 'base-box', type: 'container', props: {} }),
      });

      const activeRegistry = baseRegistry.withHostRules([
        {
          id: 'box',
          priority: 200,
          match: () => true,
          convert: () => ({ id: 'host-box', type: 'section', props: {} }),
        },
      ]);

      const element = parseSingleElement('<div>Test</div>');
      const baseCtx = baseRegistry.createContext();
      const activeCtx = activeRegistry.createContext();

      expect((baseRegistry.convertElement(element, baseCtx) as PageNode).id).toBe('base-box');
      expect((activeRegistry.convertElement(element, activeCtx) as PageNode).id).toBe('host-box');
    });
  });

  describe('Match failure fallback', () => {
    it('falls back to the next rule in priority order when a higher priority rule does not match', () => {
      const registry = new HtmlRuleRegistry();
      const trace: string[] = [];

      registry.register({
        id: 'h1-hero-only',
        priority: 100,
        match: (el) => {
          trace.push('checked-hero');
          return el.attrs.some((a) => a.name === 'class' && a.value.includes('hero'));
        },
        convert: () => ({ id: 'hero-node', type: 'heading', props: { level: 1 } }),
      });

      registry.register({
        id: 'h1-generic',
        priority: 50,
        match: (el) => {
          trace.push('checked-generic');
          return el.tagName === 'h1';
        },
        convert: () => ({ id: 'generic-node', type: 'heading', props: { level: 1 } }),
      });

      const element = parseSingleElement('<h1>Plain Title</h1>');
      const ctx = registry.createContext();
      const node = registry.convertElement(element, ctx) as PageNode;

      expect(trace).toEqual(['checked-hero', 'checked-generic']);
      expect(node.id).toBe('generic-node');
    });

    it('gracefully handles an exception thrown in a match function and moves to the next rule', () => {
      const registry = new HtmlRuleRegistry();

      registry.register({
        id: 'buggy-match-rule',
        priority: 100,
        match: () => {
          throw new Error('Unexpected selector engine error');
        },
        convert: () => ({ id: 'buggy', type: 'container', props: {} }),
      });

      registry.register({
        id: 'safe-fallback-rule',
        priority: 50,
        match: () => true,
        convert: () => ({ id: 'safe', type: 'container', props: {} }),
      });

      const element = parseSingleElement('<div>Content</div>');
      const ctx = registry.createContext();
      const node = registry.convertElement(element, ctx) as PageNode;

      expect(node).not.toBeNull();
      expect(node.id).toBe('safe');
    });

    it('returns fallback html-embed when no rules match and fallback is embed', () => {
      const registry = new HtmlRuleRegistry();
      // No rules registered
      const element = parseSingleElement('<unknown-tag data-widget="true">Custom content</unknown-tag>');
      const ctx = registry.createContext({ fallback: 'embed' });
      const node = registry.convertElement(element, ctx) as PageNode;

      expect(node).not.toBeNull();
      expect(node.type).toBe('html-embed');
      expect(node.props?.html).toContain('<unknown-tag');
      expect(ctx.report.diagnostics.some((d) => d.code === 'ELEMENT_FALLBACK_EMBED')).toBe(true);
      expect(ctx.report.stats.fallbackCount).toBe(1);
    });

    it('records ELEMENT_DROPPED and returns null when no rules match and fallback is drop', () => {
      const registry = new HtmlRuleRegistry();
      const element = parseSingleElement('<custom-widget></custom-widget>');
      const ctx = registry.createContext({ fallback: 'drop' });
      const node = registry.convertElement(element, ctx);

      expect(node).toBeNull();
      expect(ctx.report.diagnostics.some((d) => d.code === 'ELEMENT_DROPPED')).toBe(true);
      expect(ctx.report.stats.droppedCount).toBe(1);
    });
  });

  describe('Component type validation', () => {
    it('allows valid BUILTIN_COMPONENT_TYPES', () => {
      for (const builtin of ['heading', 'paragraph', 'container', 'section', 'button', 'image', 'link'] as const) {
        const registry = new HtmlRuleRegistry();
        registry.register({
          id: `rule-${builtin}`,
          priority: 10,
          match: () => true,
          convert: () => ({ id: `node-${builtin}`, type: builtin, props: {} }),
        });

        const el = parseSingleElement('<div>Test</div>');
        const ctx = registry.createContext();
        const node = registry.convertElement(el, ctx) as PageNode;

        expect(node).not.toBeNull();
        expect(node.type).toBe(builtin);
        expect(ctx.report.stats.droppedCount).toBe(0);
      }
    });

    it('drops node and records ELEMENT_DROPPED diagnostic if converted type is not builtin or allowed', () => {
      const registry = new HtmlRuleRegistry();

      registry.register({
        id: 'bad-type-rule',
        priority: 100,
        match: () => true,
        convert: () => ({
          id: 'bad-node',
          // Deliberately unallowed type
          type: 'unregistered-slider' as any,
          props: {},
        }),
      });

      const element = parseSingleElement('<div class="slider"></div>');
      const ctx = registry.createContext();
      const result = registry.convertElement(element, ctx);

      expect(result).toBeNull();
      expect(ctx.report.stats.droppedCount).toBe(1);
      const droppedDiag = ctx.report.diagnostics.find((d) => d.code === 'ELEMENT_DROPPED');
      expect(droppedDiag).toBeDefined();
      expect(droppedDiag?.details?.nodeType).toBe('unregistered-slider');
      expect(droppedDiag?.location?.tagName).toBe('div');
    });

    it('permits custom component type when explicitly provided in allowedComponentTypes', () => {
      const registry = new HtmlRuleRegistry();

      registry.register({
        id: 'custom-type-rule',
        priority: 100,
        match: () => true,
        convert: () => ({
          id: 'slider-node',
          type: 'kustora-carousel' as any,
          props: {},
        }),
      });

      const element = parseSingleElement('<div class="carousel"></div>');

      // 1. Without allowedComponentTypes -> dropped
      const ctxWithout = registry.createContext();
      expect(registry.convertElement(element, ctxWithout)).toBeNull();
      expect(ctxWithout.report.stats.droppedCount).toBe(1);

      // 2. With allowedComponentTypes -> allowed and returned
      const ctxWith = registry.createContext({
        allowedComponentTypes: new Set(['kustora-carousel']),
      });
      const node = registry.convertElement(element, ctxWith) as PageNode;
      expect(node).not.toBeNull();
      expect(node.type).toBe('kustora-carousel');
      expect(ctxWith.report.stats.droppedCount).toBe(0);
    });

    it('filters invalid nodes when rule converts to an array of nodes', () => {
      const registry = new HtmlRuleRegistry();

      registry.register({
        id: 'multi-node-rule',
        priority: 50,
        match: () => true,
        convert: () => [
          { id: 'valid-1', type: 'heading', props: { level: 2 } },
          { id: 'invalid-2', type: 'disallowed-badge' as any, props: {} },
          { id: 'valid-3', type: 'paragraph', props: {} },
        ],
      });

      const element = parseSingleElement('<div><span>Title</span><span>Desc</span></div>');
      const ctx = registry.createContext();
      const nodes = registry.convertElement(element, ctx) as PageNode[];

      expect(Array.isArray(nodes)).toBe(true);
      expect(nodes.length).toBe(2);
      expect(nodes.map((n) => n.id)).toEqual(['valid-1', 'valid-3']);
      expect(ctx.report.stats.droppedCount).toBe(1);
      expect(ctx.report.diagnostics.some((d) => d.code === 'ELEMENT_DROPPED')).toBe(true);
    });

    it('falls back to html-embed if rule returns invalid type and fallback is embed', () => {
      const registry = new HtmlRuleRegistry();

      registry.register({
        id: 'rule-invalid-embed-fallback',
        priority: 10,
        match: () => true,
        convert: () => ({
          id: 'invalid-id',
          type: 'forbidden-widget' as any,
          props: {},
        }),
      });

      const element = parseSingleElement('<section id="test-embed">Content</section>');
      const ctx = registry.createContext({ fallback: 'embed' });
      const node = registry.convertElement(element, ctx) as PageNode;

      expect(node).not.toBeNull();
      expect(node.type).toBe('html-embed');
      expect(node.props?.html).toContain('<section id="test-embed"');
      expect(ctx.report.stats.droppedCount).toBe(1);
    });
  });

  describe('Engine independence from @kubuild/components', () => {
    it('verifies that @kubuild/components is NOT imported anywhere in html-import rules or index', () => {
      const filesToCheck = [
        resolve(__dirname, '../src/rules/types.ts'),
        resolve(__dirname, '../src/rules/registry.ts'),
        resolve(__dirname, '../src/rules/index.ts'),
        resolve(__dirname, '../src/index.ts'),
      ];

      for (const filePath of filesToCheck) {
        const content = readFileSync(filePath, 'utf-8');
        expect(content).not.toContain('@kubuild/components');
      }
    });

    it('verifies package.json does not declare @kubuild/components dependency', () => {
      const pkgJsonPath = resolve(__dirname, '../package.json');
      const pkg = JSON.parse(readFileSync(pkgJsonPath, 'utf-8'));

      expect(pkg.dependencies?.['@kubuild/components']).toBeUndefined();
      expect(pkg.peerDependencies?.['@kubuild/components']).toBeUndefined();
    });
  });

  describe('Context and recursive children conversion', () => {
    it('createIdGenerator produces unique, sequential IDs', () => {
      const gen = createIdGenerator('btn');
      expect(gen()).toBe('btn-1');
      expect(gen()).toBe('btn-2');
      expect(gen('custom')).toBe('custom-3');
    });

    it('converts children recursively and allows convertChildren in rule convert', () => {
      const registry = new HtmlRuleRegistry();

      registry.register({
        id: 'section-rule',
        priority: 50,
        match: (el) => el.tagName === 'section',
        convert: (el, ctx) => ({
          id: ctx.generateId('section'),
          type: 'section',
          props: {},
          children: ctx.convertChildren(el),
        }),
      });

      registry.register({
        id: 'p-rule',
        priority: 50,
        match: (el) => el.tagName === 'p',
        convert: (el, ctx) => ({
          id: ctx.generateId('para'),
          type: 'paragraph',
          props: {},
        }),
      });

      const element = parseSingleElement('<section><p>First</p><p>Second</p></section>');
      const ctx = registry.createContext();
      const sectionNode = registry.convertElement(element, ctx) as PageNode;

      expect(sectionNode).not.toBeNull();
      expect(sectionNode.type).toBe('section');
      expect(sectionNode.children?.length).toBe(2);
      expect(sectionNode.children?.[0].type).toBe('paragraph');
      expect(sectionNode.children?.[1].type).toBe('paragraph');
    });

    it('manages custom component types at registry level via allowComponentType', () => {
      const registry = new HtmlRuleRegistry();
      registry.allowComponentType(['my-plugin-hero', 'my-plugin-footer']);

      expect(registry.isAllowedType('my-plugin-hero')).toBe(true);
      expect(registry.isAllowedType('my-plugin-footer')).toBe(true);
      expect(registry.isAllowedType('heading')).toBe(true); // builtin
      expect(registry.isAllowedType('unknown-x')).toBe(false);
    });

    it('supports unregister and clear on HtmlRuleRegistry', () => {
      const registry = new HtmlRuleRegistry();
      registry.register({
        id: 'temp-rule',
        priority: 10,
        match: () => true,
        convert: () => null,
      });

      expect(registry.hasRule('temp-rule')).toBe(true);
      expect(registry.unregister('temp-rule')).toBe(true);
      expect(registry.hasRule('temp-rule')).toBe(false);

      registry.register([
        { id: 'r1', priority: 1, match: () => true, convert: () => null },
        { id: 'r2', priority: 2, match: () => true, convert: () => null },
      ]);
      expect(registry.getRules().length).toBe(2);
      registry.clear();
      expect(registry.getRules().length).toBe(0);
    });
  });
});
