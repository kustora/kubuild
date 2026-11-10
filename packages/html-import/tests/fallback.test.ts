/**
 * @kubuild/html-import
 * Unit tests for fallback html-embed handling of unmapped HTML elements (STORA-611).
 */

import { describe, it, expect } from 'vitest';
import { parseFragment } from 'parse5';
import {
  HtmlRuleRegistry,
  createRuleRegistry,
  handleFallbackElement,
  createFallbackEmbedNode,
  isElementSafeForEmbed,
  sanitizeAndSerializeElement,
  importHtml,
  htmlToNodes,
  type PageNode,
} from '../src/index.js';
import { isElement } from '../src/sanitizer.js';
import type { Parse5Element } from '../src/cascade.js';

function parseSingleElement(html: string): Parse5Element {
  const fragment = parseFragment(html);
  const element = fragment.childNodes.find(isElement);
  if (!element) {
    throw new Error(`Failed to parse element from HTML: ${html}`);
  }
  return element;
}

describe('Fallback html-embed for unmapped elements (STORA-611)', () => {
  describe('Unmapped element conversion with default fallback: "embed"', () => {
    it('converts <canvas id="c1"> to html-embed with outerHTML and warning diagnostic', () => {
      const registry = createRuleRegistry();
      const element = parseSingleElement('<canvas id="c1" width="300" height="150">Your browser does not support canvas</canvas>');
      const ctx = registry.createContext();

      const node = registry.convertElement(element, ctx) as PageNode;

      expect(node).not.toBeNull();
      expect(node.type).toBe('html-embed');
      expect(node.id).toBeDefined();
      expect(node.props?.html).toContain('<canvas id="c1" width="300" height="150">');
      expect(node.props?.html).toContain('Your browser does not support canvas');
      expect(node.props?.html).toContain('</canvas>');

      const fallbackDiagnostic = ctx.report.diagnostics.find((d) => d.code === 'ELEMENT_FALLBACK_EMBED');
      expect(fallbackDiagnostic).toBeDefined();
      expect(fallbackDiagnostic?.severity).toBe('warning');
      expect(fallbackDiagnostic?.location?.tagName).toBe('canvas');
      expect(ctx.report.stats.fallbackCount).toBe(1);
    });

    it('converts custom elements like <custom-element attr="val"> to html-embed', () => {
      const registry = createRuleRegistry();
      const element = parseSingleElement('<custom-element attr="val"><span>Child node</span></custom-element>');
      const ctx = registry.createContext({ fallback: 'embed' });

      const node = registry.convertElement(element, ctx) as PageNode;

      expect(node).not.toBeNull();
      expect(node.type).toBe('html-embed');
      expect(node.props?.html).toContain('<custom-element attr="val">');
      expect(node.props?.html).toContain('<span>Child node</span>');
      expect(node.props?.html).toContain('</custom-element>');

      expect(ctx.report.stats.fallbackCount).toBe(1);
      const diagnostic = ctx.report.diagnostics.find((d) => d.code === 'ELEMENT_FALLBACK_EMBED');
      expect(diagnostic?.location?.tagName).toBe('custom-element');
    });

    it('converts third-party <iframe> (non-YouTube/Vimeo) to html-embed', () => {
      const registry = createRuleRegistry();
      const element = parseSingleElement(
        '<iframe src="https://maps.google.com/maps?q=Monas&output=embed" width="600" height="450" title="Map"></iframe>',
      );
      const ctx = registry.createContext();

      const node = registry.convertElement(element, ctx) as PageNode;

      expect(node).not.toBeNull();
      expect(node.type).toBe('html-embed');
      expect(node.props?.html).toContain('src="https://maps.google.com/maps?q=Monas&amp;output=embed"');
      expect(node.props?.html).toContain('title="Map"');
      expect(ctx.report.stats.fallbackCount).toBe(1);
      expect(ctx.report.diagnostics.some((d) => d.code === 'ELEMENT_FALLBACK_EMBED')).toBe(true);
    });

    it('defaults to "embed" when options.fallback is not specified', () => {
      const registry = createRuleRegistry();
      const element = parseSingleElement('<my-widget data-prop="foo">Content</my-widget>');
      const ctx = registry.createContext({});

      const node = registry.convertElement(element, ctx) as PageNode;

      expect(node).not.toBeNull();
      expect(node.type).toBe('html-embed');
      expect(ctx.report.stats.fallbackCount).toBe(1);
    });

    it('preserves responsive styles from computed styles on html-embed', () => {
      const registry = createRuleRegistry();
      const element = parseSingleElement('<canvas id="c-styled" style="width: 250px; height: 120px;"></canvas>');
      const ctx = registry.createContext();

      const node = registry.convertElement(element, ctx) as PageNode;

      expect(node).not.toBeNull();
      expect(node.type).toBe('html-embed');
      expect(node.styles?.base).toBeDefined();
      expect(node.styles?.base?.width).toBe('250px');
      expect(node.styles?.base?.height).toBe('120px');
    });
  });

  describe('Diagnostic recording and statistics', () => {
    it('records ELEMENT_FALLBACK_EMBED with warning severity, tagName, and location', () => {
      const registry = createRuleRegistry();
      const element = parseSingleElement('<complex-graphic id="g1"></complex-graphic>');
      const ctx = registry.createContext();

      registry.convertElement(element, ctx);

      const diag = ctx.report.diagnostics.find((d) => d.code === 'ELEMENT_FALLBACK_EMBED');
      expect(diag).toBeDefined();
      expect(diag?.severity).toBe('warning');
      expect(diag?.location?.tagName).toBe('complex-graphic');
      expect(diag?.message).toContain('<complex-graphic>');
      expect(ctx.report.stats.fallbackCount).toBe(1);
    });
  });

  describe('Fidelity score impact', () => {
    it('decreases fidelity score when fallback is triggered during direct element conversion', () => {
      const registry = createRuleRegistry();
      const element = parseSingleElement('<canvas id="c-fidelity"></canvas>');
      const ctx = registry.createContext();

      expect(ctx.report.stats.fidelityScore).toBe(100);

      registry.convertElement(element, ctx);

      expect(ctx.report.stats.fallbackCount).toBe(1);
      // Fallback embed has partial weight (0.5), lowering fidelity score below 100
      expect(ctx.report.stats.fidelityScore).toBeLessThan(100);
      expect(ctx.report.stats.fidelityScore).toBe(50);
    });

    it('penalizes fidelity score in end-to-end importHtml when fallback embeds are present', async () => {
      const htmlWithoutFallback = '<!DOCTYPE html><html><body><h1>Title</h1><p>Paragraph</p></body></html>';
      const resClean = await importHtml(htmlWithoutFallback);
      expect(resClean.success).toBe(true);
      expect(resClean.report.stats.fallbackCount).toBe(0);
      expect(resClean.report.stats.fidelityScore).toBe(100);

      const htmlWithFallback = '<!DOCTYPE html><html><body><h1>Title</h1><canvas id="c1"></canvas></body></html>';
      const resFallback = await importHtml(htmlWithFallback);
      expect(resFallback.success).toBe(true);
      expect(resFallback.report.stats.fallbackCount).toBe(1);
      expect(resFallback.report.stats.fidelityScore).toBeLessThan(100);
    });

    it('penalizes fidelity score in end-to-end htmlToNodes', async () => {
      const fragment = '<p>Intro</p><custom-widget>Data</custom-widget>';
      const result = await htmlToNodes(fragment);

      expect(result.success).toBe(true);
      expect(result.nodes.length).toBe(2);
      expect(result.nodes[0].type).toBe('paragraph');
      expect(result.nodes[1].type).toBe('html-embed');
      expect(result.report.stats.fallbackCount).toBe(1);
      expect(result.report.stats.fidelityScore).toBeLessThan(100);
    });
  });

  describe('options.fallback === "drop"', () => {
    it('drops unmapped element and emits ELEMENT_DROPPED instead of html-embed', () => {
      const registry = createRuleRegistry();
      const element = parseSingleElement('<canvas id="dropped-canvas"></canvas>');
      const ctx = registry.createContext({ fallback: 'drop' });

      const node = registry.convertElement(element, ctx);

      expect(node).toBeNull();
      expect(ctx.report.stats.fallbackCount).toBe(0);
      expect(ctx.report.stats.droppedCount).toBe(1);

      const dropDiagnostic = ctx.report.diagnostics.find((d) => d.code === 'ELEMENT_DROPPED');
      expect(dropDiagnostic).toBeDefined();
      expect(dropDiagnostic?.location?.tagName).toBe('canvas');
      expect(dropDiagnostic?.message).toContain('dropped as requested by options.fallback');
    });

    it('omits dropped elements from output nodes in htmlToNodes with fallback: "drop"', async () => {
      const fragment = '<p>Paragraph</p><canvas id="c1"></canvas>';
      const result = await htmlToNodes(fragment, { fallback: 'drop' });

      expect(result.success).toBe(true);
      expect(result.nodes.length).toBe(1);
      expect(result.nodes[0].type).toBe('paragraph');
      expect(result.report.stats.droppedCount).toBe(1);
      expect(result.report.stats.fallbackCount).toBe(0);
    });
  });

  describe('Unsafe element handling', () => {
    it('never embeds prohibited <script> element even if fallback is "embed"', () => {
      const registry = createRuleRegistry();
      const element = parseSingleElement('<script>alert("xss")</script>');
      const ctx = registry.createContext({ fallback: 'embed' });

      const node = registry.convertElement(element, ctx);

      expect(node).toBeNull();
      expect(ctx.report.stats.fallbackCount).toBe(0);
      expect(ctx.report.stats.droppedCount).toBeGreaterThanOrEqual(1);
      expect(ctx.report.diagnostics.some((d) => d.code === 'ELEMENT_DROPPED')).toBe(true);
    });

    it('never embeds prohibited <object> element', () => {
      const registry = createRuleRegistry();
      const element = parseSingleElement('<object data="exploit.swf" type="application/x-shockwave-flash"></object>');
      const ctx = registry.createContext({ fallback: 'embed' });

      const node = registry.convertElement(element, ctx);

      expect(node).toBeNull();
      expect(ctx.report.stats.fallbackCount).toBe(0);
      expect(ctx.report.stats.droppedCount).toBeGreaterThanOrEqual(1);
    });

    it('never embeds prohibited <embed> element', () => {
      const registry = createRuleRegistry();
      const element = parseSingleElement('<embed src="exploit.pdf" type="application/pdf">');
      const ctx = registry.createContext({ fallback: 'embed' });

      const node = registry.convertElement(element, ctx);

      expect(node).toBeNull();
      expect(ctx.report.stats.fallbackCount).toBe(0);
      expect(ctx.report.stats.droppedCount).toBeGreaterThanOrEqual(1);
    });

    it('never embeds prohibited <applet> element', () => {
      const registry = createRuleRegistry();
      const element = parseSingleElement('<applet code="Malicious.class"></applet>');
      const ctx = registry.createContext({ fallback: 'embed' });

      const node = registry.convertElement(element, ctx);

      expect(node).toBeNull();
      expect(ctx.report.stats.fallbackCount).toBe(0);
      expect(ctx.report.stats.droppedCount).toBeGreaterThanOrEqual(1);
    });

    it('never embeds <iframe> with javascript: URL in src attribute', () => {
      const registry = createRuleRegistry();
      const element = parseSingleElement('<iframe src="javascript:alert(1)"></iframe>');
      const ctx = registry.createContext({ fallback: 'embed' });

      const node = registry.convertElement(element, ctx);

      expect(node).toBeNull();
      expect(ctx.report.stats.fallbackCount).toBe(0);
      expect(ctx.report.stats.droppedCount).toBe(1);
      expect(ctx.report.diagnostics.some((d) => d.code === 'ELEMENT_DROPPED')).toBe(true);
    });

    it('never embeds <iframe> with data:text/html in src attribute', () => {
      const registry = createRuleRegistry();
      const element = parseSingleElement('<iframe src="data:text/html,<script>alert(1)</script>"></iframe>');
      const ctx = registry.createContext({ fallback: 'embed' });

      const node = registry.convertElement(element, ctx);

      expect(node).toBeNull();
      expect(ctx.report.stats.fallbackCount).toBe(0);
      expect(ctx.report.stats.droppedCount).toBe(1);
    });

    it('strips inline event handlers (on*) before embedding unmapped elements', () => {
      const registry = createRuleRegistry();
      const element = parseSingleElement('<canvas id="c-evt" onclick="alert(1)" onmouseover="evil()"></canvas>');
      const ctx = registry.createContext({ fallback: 'embed' });

      const node = registry.convertElement(element, ctx) as PageNode;

      expect(node).not.toBeNull();
      expect(node.type).toBe('html-embed');
      expect(node.props?.html).not.toContain('onclick');
      expect(node.props?.html).not.toContain('onmouseover');
      expect(node.props?.html).not.toContain('alert(1)');
      expect(node.props?.html).toContain('<canvas id="c-evt"></canvas>');

      expect(ctx.report.diagnostics.some((d) => d.code === 'URL_BLOCKED')).toBe(true);
      expect(ctx.report.stats.fallbackCount).toBe(1);
    });

    it('strips dangerous inline CSS styles before embedding unmapped elements', () => {
      const registry = createRuleRegistry();
      const element = parseSingleElement(
        '<canvas id="c-danger" style="background: url(\'javascript:alert(1)\'); width: 100px;"></canvas>',
      );
      const ctx = registry.createContext({ fallback: 'embed' });

      const node = registry.convertElement(element, ctx) as PageNode;

      expect(node).not.toBeNull();
      expect(node.type).toBe('html-embed');
      expect(node.props?.html).not.toContain('javascript');
      expect(node.props?.html).not.toContain('style=');
      expect(node.props?.html).toContain('<canvas id="c-danger"></canvas>');

      expect(ctx.report.diagnostics.some((d) => d.code === 'URL_BLOCKED')).toBe(true);
      expect(ctx.report.stats.fallbackCount).toBe(1);
    });

    it('strips prohibited children (like <script>) inside custom element before embedding', () => {
      const registry = createRuleRegistry();
      const element = parseSingleElement(
        '<custom-card><h3>Safe Heading</h3><script>alert("nested")</script></custom-card>',
      );
      const ctx = registry.createContext({ fallback: 'embed' });

      const node = registry.convertElement(element, ctx) as PageNode;

      expect(node).not.toBeNull();
      expect(node.type).toBe('html-embed');
      expect(node.props?.html).not.toContain('<script');
      expect(node.props?.html).not.toContain('alert("nested")');
      expect(node.props?.html).toContain('<h3>Safe Heading</h3>');
      expect(node.props?.html).toContain('<custom-card>');

      expect(ctx.report.diagnostics.some((d) => d.code === 'ELEMENT_DROPPED')).toBe(true);
      expect(ctx.report.stats.fallbackCount).toBe(1);
    });
  });

  describe('Fallback utility functions export', () => {
    it('exports isElementSafeForEmbed correctly identifying safe vs unsafe elements', () => {
      const safeCanvas = parseSingleElement('<canvas id="c1"></canvas>');
      expect(isElementSafeForEmbed(safeCanvas)).toBe(true);

      const safeIframe = parseSingleElement('<iframe src="https://example.com/widget"></iframe>');
      expect(isElementSafeForEmbed(safeIframe)).toBe(true);

      const unsafeScript = parseSingleElement('<script>alert(1)</script>');
      expect(isElementSafeForEmbed(unsafeScript)).toBe(false);

      const unsafeObject = parseSingleElement('<object data="x.swf"></object>');
      expect(isElementSafeForEmbed(unsafeObject)).toBe(false);

      const unsafeIframe = parseSingleElement('<iframe src="javascript:alert(1)"></iframe>');
      expect(isElementSafeForEmbed(unsafeIframe)).toBe(false);
    });

    it('exports sanitizeAndSerializeElement producing sanitized outerHTML string', () => {
      const registry = createRuleRegistry();
      const ctx = registry.createContext();
      const element = parseSingleElement('<canvas id="c2" onclick="bad()"></canvas>');

      const html = sanitizeAndSerializeElement(element, ctx.report);
      expect(html).toBe('<canvas id="c2"></canvas>');
      expect(html).not.toContain('onclick');
    });

    it('exports createFallbackEmbedNode returning a schema-valid html-embed node', () => {
      const registry = createRuleRegistry();
      const ctx = registry.createContext();
      const element = parseSingleElement('<canvas id="c3" style="width: 100px;"></canvas>');

      const node = createFallbackEmbedNode(element, ctx);
      expect(node).not.toBeNull();
      expect(node?.type).toBe('html-embed');
      expect(node?.id).toBeDefined();
      expect(node?.props?.html).toBe('<canvas id="c3" style="width: 100px;"></canvas>');
      expect(node?.styles?.base?.width).toBe('100px');
      expect(node?.children).toEqual([]);
    });

    it('exports handleFallbackElement executing the full fallback protocol', () => {
      const registry = createRuleRegistry();
      const ctx = registry.createContext();
      const element = parseSingleElement('<my-counter count="5"></my-counter>');

      const node = handleFallbackElement(element, ctx);
      expect(node).not.toBeNull();
      expect(node?.type).toBe('html-embed');
      expect(node?.props?.html).toContain('<my-counter count="5"></my-counter>');
      expect(ctx.report.stats.fallbackCount).toBe(1);
    });
  });
});
