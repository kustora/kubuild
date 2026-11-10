/**
 * @kubuild/html-import
 * Tests for CSS selector matching, specificity calculation, and cascade resolution.
 */

import { describe, expect, it } from 'vitest';
import * as parse5 from 'parse5';
import * as cssSelect from 'css-select';
import {
  calculateSpecificity,
  compareSpecificity,
  computeElementStyles,
  cssPropertyToCamelCase,
  extractPseudoState,
  INHERITED_TEXT_PROPERTIES,
  matchRulesForElement,
  normalizeStyleValue,
  parse5Adapter,
  parseInlineStyle,
  resolveCssVariables,
  splitSelectorList,
  type Specificity,
} from '../src/cascade.js';
import {
  collectAndParseStylesheets,
  type ParsedStylesheetBundle,
} from '../src/stylesheet.js';
import { parseHtml } from '../src/parser.js';
import { createEmptyReport } from '../src/types.js';

describe('cascade: parse5Adapter for css-select', () => {
  const html = `
    <!DOCTYPE html>
    <html>
      <head><title>Test</title></head>
      <body>
        <div id="container" class="main-wrapper" data-theme="dark">
          <header class="header">
            <h1 class="title">KUBUILD</h1>
            <p class="subtitle">Visual Page Builder</p>
          </header>
          <main>
            <ul class="nav-list">
              <li class="item active"><a href="#home">Home</a></li>
              <li class="item"><a href="#about">About</a></li>
              <li class="item"><a href="#contact">Contact</a></li>
            </ul>
          </main>
        </div>
      </body>
    </html>
  `;
  const parsed = parseHtml(html);
  const doc = parsed.document!.rootElement as parse5.DefaultTreeAdapterMap['document'];

  it('implements isTag correctly', () => {
    const header = cssSelect.selectOne('header', doc, { adapter: parse5Adapter });
    expect(header).toBeDefined();
    expect(parse5Adapter.isTag(header!)).toBe(true);
    expect(parse5Adapter.isTag(doc)).toBe(false);
  });

  it('implements getAttributeValue and hasAttrib', () => {
    const container = cssSelect.selectOne('#container', doc, { adapter: parse5Adapter });
    expect(container).toBeDefined();
    expect(parse5Adapter.getAttributeValue(container!, 'id')).toBe('container');
    expect(parse5Adapter.getAttributeValue(container!, 'class')).toBe('main-wrapper');
    expect(parse5Adapter.getAttributeValue(container!, 'data-theme')).toBe('dark');
    expect(parse5Adapter.hasAttrib(container!, 'data-theme')).toBe(true);
    expect(parse5Adapter.hasAttrib(container!, 'data-missing')).toBe(false);
  });

  it('implements getName, getChildren, getParent', () => {
    const h1 = cssSelect.selectOne('h1.title', doc, { adapter: parse5Adapter });
    expect(h1).toBeDefined();
    expect(parse5Adapter.getName(h1!)).toBe('h1');

    const parent = parse5Adapter.getParent(h1!);
    expect(parent).toBeDefined();
    expect(parse5Adapter.getName(parent as parse5.DefaultTreeAdapterMap['element'])).toBe('header');

    const children = parse5Adapter.getChildren(h1!);
    expect(children.length).toBeGreaterThan(0);
  });

  it('implements getSiblings and prevElementSibling', () => {
    const items = cssSelect.selectAll('.item', doc, { adapter: parse5Adapter });
    expect(items.length).toBe(3);

    const firstItem = items[0];
    const secondItem = items[1];
    const thirdItem = items[2];

    expect(parse5Adapter.prevElementSibling?.(firstItem)).toBeNull();
    expect(parse5Adapter.prevElementSibling?.(secondItem)).toBe(firstItem);
    expect(parse5Adapter.prevElementSibling?.(thirdItem)).toBe(secondItem);
  });

  it('implements getText', () => {
    const h1 = cssSelect.selectOne('h1', doc, { adapter: parse5Adapter });
    expect(parse5Adapter.getText(h1!)).toBe('KUBUILD');

    const subtitle = cssSelect.selectOne('.subtitle', doc, { adapter: parse5Adapter });
    expect(parse5Adapter.getText(subtitle!)).toBe('Visual Page Builder');
  });

  it('supports complex css-select queries (child, descendant, adjacent sibling, attribute)', () => {
    expect(cssSelect.is(cssSelect.selectOne('h1', doc, { adapter: parse5Adapter })!, 'header > h1.title', {
      adapter: parse5Adapter,
    })).toBe(true);

    const secondLi = cssSelect.selectAll('.item', doc, { adapter: parse5Adapter })[1];
    expect(cssSelect.is(secondLi, 'li.item + li.item', { adapter: parse5Adapter })).toBe(true);

    const container = cssSelect.selectOne('#container', doc, { adapter: parse5Adapter });
    expect(cssSelect.is(container!, 'div[data-theme="dark"]', { adapter: parse5Adapter })).toBe(true);
  });
});

describe('cascade: specificity calculation', () => {
  it('calculates specificity for basic selectors correctly', () => {
    // universal selector: [0, 0, 0]
    expect(calculateSpecificity('*')).toEqual([0, 0, 0]);

    // tag selector: [0, 0, 1]
    expect(calculateSpecificity('div')).toEqual([0, 0, 1]);
    expect(calculateSpecificity('h1')).toEqual([0, 0, 1]);

    // class selector: [0, 1, 0]
    expect(calculateSpecificity('.btn')).toEqual([0, 1, 0]);

    // attribute selector: [0, 1, 0]
    expect(calculateSpecificity('[type="text"]')).toEqual([0, 1, 0]);

    // ID selector: [1, 0, 0]
    expect(calculateSpecificity('#main')).toEqual([1, 0, 0]);
  });

  it('calculates compound and combinator selector specificity', () => {
    // div.btn#submit -> 1 ID, 1 class, 1 tag = [1, 1, 1]
    expect(calculateSpecificity('div.btn#submit')).toEqual([1, 1, 1]);

    // header.main > nav ul li.active a:hover ->
    // IDs: 0
    // Classes/attrs/pseudos: .main, .active, :hover = 3
    // Tags: header, nav, ul, li, a = 5
    expect(calculateSpecificity('header.main > nav ul li.active a:hover')).toEqual([0, 3, 5]);

    // #app > .card[data-active] p.text -> 1 ID, 3 classes/attrs (.card, [data-active], .text), 1 tag (p) = [1, 3, 1]
    expect(calculateSpecificity('#app > .card[data-active] p.text')).toEqual([1, 3, 1]);
  });

  it('handles :not, :is, and :where specificity', () => {
    // :where() carries [0, 0, 0]
    expect(calculateSpecificity(':where(#heavy-id)')).toEqual([0, 0, 0]);

    // :not takes max specificity of argument
    expect(calculateSpecificity('p:not(.highlight)')).toEqual([0, 1, 1]);
    expect(calculateSpecificity('div:not(#special)')).toEqual([1, 0, 1]);
  });

  it('compares specificity vectors correctly', () => {
    const id: Specificity = [1, 0, 0];
    const classes: Specificity = [0, 10, 0];
    const tags: Specificity = [0, 0, 100];

    expect(compareSpecificity(id, classes)).toBeGreaterThan(0);
    expect(compareSpecificity(classes, tags)).toBeGreaterThan(0);
    expect(compareSpecificity([0, 1, 1], [0, 1, 0])).toBeGreaterThan(0);
    expect(compareSpecificity([1, 2, 3], [1, 2, 3])).toBe(0);
  });
});

describe('cascade: property naming and variable resolution', () => {
  it('converts kebab-case properties to camelCase', () => {
    expect(cssPropertyToCamelCase('font-size')).toBe('fontSize');
    expect(cssPropertyToCamelCase('background-color')).toBe('backgroundColor');
    expect(cssPropertyToCamelCase('z-index')).toBe('zIndex');
    expect(cssPropertyToCamelCase('border-radius')).toBe('borderRadius');
    expect(cssPropertyToCamelCase('line-height')).toBe('lineHeight');
    expect(cssPropertyToCamelCase('text-align')).toBe('textAlign');
    expect(cssPropertyToCamelCase('letter-spacing')).toBe('letterSpacing');
    expect(cssPropertyToCamelCase('-webkit-line-clamp')).toBe('webkitLineClamp');
  });

  it('preserves CSS custom property names', () => {
    expect(cssPropertyToCamelCase('--primary-color')).toBe('--primary-color');
    expect(cssPropertyToCamelCase('--card-bg')).toBe('--card-bg');
  });

  it('normalizes unitless numeric properties', () => {
    expect(normalizeStyleValue('zIndex', '10')).toBe(10);
    expect(normalizeStyleValue('opacity', '0.75')).toBe(0.75);
    expect(normalizeStyleValue('flexGrow', '1')).toBe(1);
    expect(normalizeStyleValue('fontSize', '16px')).toBe('16px');
    expect(normalizeStyleValue('color', 'red')).toBe('red');
  });

  it('resolves CSS variables from dictionary with fallback', () => {
    const customProps = {
      '--primary': '#1d4ed8',
      '--spacing': '16px',
      '--alias': 'var(--primary)',
    };

    expect(resolveCssVariables('var(--primary)', customProps)).toBe('#1d4ed8');
    expect(resolveCssVariables('1px solid var(--primary)', customProps)).toBe('1px solid #1d4ed8');
    expect(resolveCssVariables('var(--spacing)', customProps)).toBe('16px');
    expect(resolveCssVariables('var(--alias)', customProps)).toBe('#1d4ed8');
    // Fallback when variable missing
    expect(resolveCssVariables('var(--missing, #64748b)', customProps)).toBe('#64748b');
    // Nested fallback
    expect(resolveCssVariables('var(--missing, var(--spacing))', customProps)).toBe('16px');
    // Unresolved without fallback is preserved as is
    expect(resolveCssVariables('var(--unresolved)', customProps)).toBe('var(--unresolved)');
  });
});

describe('cascade: inline style parser', () => {
  it('parses valid inline styles and flags !important', () => {
    const raw = 'color: #333; font-size: 14px !important; margin: 0 auto;';
    const decls = parseInlineStyle(raw);

    expect(decls).toEqual([
      { property: 'color', value: '#333', important: false },
      { property: 'font-size', value: '14px', important: true },
      { property: 'margin', value: '0 auto', important: false },
    ]);
  });

  it('tolerates malformed inline style syntax resiliently', () => {
    const raw = 'color: blue; ; ;; broken-prop; background-color: white;';
    const decls = parseInlineStyle(raw);
    expect(decls.some((d) => d.property === 'color' && d.value === 'blue')).toBe(true);
    expect(decls.some((d) => d.property === 'background-color' && d.value === 'white')).toBe(true);
  });

  it('drops dangerous inline declarations and reports them', () => {
    const report = createEmptyReport();
    const raw = 'color: red; background-image: url(javascript:alert(1)); behavior: url(test.htc);';
    const decls = parseInlineStyle(raw, report);

    expect(decls).toEqual([{ property: 'color', value: 'red', important: false }]);
    expect(report.diagnostics.length).toBeGreaterThan(0);
    expect(report.diagnostics.some((d) => d.code === 'URL_BLOCKED' || d.code === 'CSS_UNSUPPORTED_PROPERTY')).toBe(
      true,
    );
  });
});

describe('cascade: specificity and source order precedence', () => {
  it('resolves ID vs Class vs Tag specificity correctly', async () => {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            div { color: black; font-size: 12px; }
            .card { color: blue; font-size: 14px; }
            #my-card { color: purple; }
          </style>
        </head>
        <body>
          <div id="my-card" class="card">Card Text</div>
        </body>
      </html>
    `;
    const parsed = parseHtml(html);
    const bundle = await collectAndParseStylesheets(parsed.document!);

    const element = cssSelect.selectOne('#my-card', parsed.document!.rootElement as parse5.DefaultTreeAdapterMap['document'], {
      adapter: parse5Adapter,
    })!;

    const styles = computeElementStyles(element, bundle);

    // ID (#my-card) beats class (.card) and tag (div) for color
    expect(styles.base.color).toBe('purple');
    // Class (.card) beats tag (div) for font-size since ID did not declare font-size
    expect(styles.base.fontSize).toBe('14px');
  });

  it('resolves source order tie-breaker for equal specificity', async () => {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            .button { background-color: red; }
            .primary { background-color: blue; }
          </style>
        </head>
        <body>
          <button class="button primary">Submit</button>
        </body>
      </html>
    `;
    const parsed = parseHtml(html);
    const bundle = await collectAndParseStylesheets(parsed.document!);

    const element = cssSelect.selectOne('button', parsed.document!.rootElement as parse5.DefaultTreeAdapterMap['document'], {
      adapter: parse5Adapter,
    })!;

    const styles = computeElementStyles(element, bundle);

    // .primary appears later in source order than .button with identical specificity [0, 1, 0]
    expect(styles.base.backgroundColor).toBe('blue');
  });

  it('normal inline style beats normal stylesheet rules', async () => {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            #hero-text { color: red; font-size: 20px; }
            .lead { color: orange; }
          </style>
        </head>
        <body>
          <p id="hero-text" class="lead" style="color: green;">Inline wins</p>
        </body>
      </html>
    `;
    const parsed = parseHtml(html);
    const bundle = await collectAndParseStylesheets(parsed.document!);

    const element = cssSelect.selectOne('p', parsed.document!.rootElement as parse5.DefaultTreeAdapterMap['document'], {
      adapter: parse5Adapter,
    })!;

    const styles = computeElementStyles(element, bundle);

    // Inline style overrides even #hero-text ID selector
    expect(styles.base.color).toBe('green');
    // Non-overridden stylesheet rule remains
    expect(styles.base.fontSize).toBe('20px');
  });

  it('stylesheet !important beats normal inline style', async () => {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            .urgent { color: red !important; }
          </style>
        </head>
        <body>
          <span class="urgent" style="color: blue;">Important beats inline</span>
        </body>
      </html>
    `;
    const parsed = parseHtml(html);
    const bundle = await collectAndParseStylesheets(parsed.document!);

    const element = cssSelect.selectOne('span', parsed.document!.rootElement as parse5.DefaultTreeAdapterMap['document'], {
      adapter: parse5Adapter,
    })!;

    const styles = computeElementStyles(element, bundle);

    expect(styles.base.color).toBe('red');
  });

  it('inline !important beats stylesheet !important', async () => {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            #title { color: red !important; }
          </style>
        </head>
        <body>
          <h1 id="title" style="color: gold !important;">Inline Important Wins</h1>
        </body>
      </html>
    `;
    const parsed = parseHtml(html);
    const bundle = await collectAndParseStylesheets(parsed.document!);

    const element = cssSelect.selectOne('h1', parsed.document!.rootElement as parse5.DefaultTreeAdapterMap['document'], {
      adapter: parse5Adapter,
    })!;

    const styles = computeElementStyles(element, bundle);

    expect(styles.base.color).toBe('gold');
  });
});

describe('cascade: typography inheritance from parent styles', () => {
  it('inherits text properties from parent when not explicitly set', () => {
    const html = '<div><span>Child text</span></div>';
    const parsed = parseHtml(html);
    const bundle: ParsedStylesheetBundle = { rules: [], customProperties: {} };

    const span = cssSelect.selectOne('span', parsed.document!.rootElement as parse5.DefaultTreeAdapterMap['document'], {
      adapter: parse5Adapter,
    })!;

    const parentStyles = {
      color: '#1e293b',
      fontSize: '16px',
      fontFamily: 'Inter, sans-serif',
      fontWeight: '600',
      fontStyle: 'italic',
      lineHeight: '1.5',
      textAlign: 'center',
      letterSpacing: '0.05em',
      // Non-text properties that should NOT inherit:
      backgroundColor: '#f8fafc',
      padding: '24px',
      display: 'flex',
    };

    const computed = computeElementStyles(span, bundle, parentStyles);

    // Inherited text properties
    expect(computed.base.color).toBe('#1e293b');
    expect(computed.base.fontSize).toBe('16px');
    expect(computed.base.fontFamily).toBe('Inter, sans-serif');
    expect(computed.base.fontWeight).toBe('600');
    expect(computed.base.fontStyle).toBe('italic');
    expect(computed.base.lineHeight).toBe('1.5');
    expect(computed.base.textAlign).toBe('center');
    expect(computed.base.letterSpacing).toBe('0.05em');

    // Non-text properties must NOT be inherited
    expect(computed.base.backgroundColor).toBeUndefined();
    expect(computed.base.padding).toBeUndefined();
    expect(computed.base.display).toBeUndefined();
  });

  it('does not overwrite explicitly set child text properties', () => {
    const html = '<div style="color: blue;"><p style="color: red; font-size: 20px;">Text</p></div>';
    const parsed = parseHtml(html);
    const bundle: ParsedStylesheetBundle = { rules: [], customProperties: {} };

    const p = cssSelect.selectOne('p', parsed.document!.rootElement as parse5.DefaultTreeAdapterMap['document'], {
      adapter: parse5Adapter,
    })!;

    const parentStyles = {
      color: 'blue',
      fontSize: '14px',
      fontWeight: 'bold',
    };

    const computed = computeElementStyles(p, bundle, parentStyles);

    // Child color and fontSize override parent
    expect(computed.base.color).toBe('red');
    expect(computed.base.fontSize).toBe('20px');
    // Unset child property inherits
    expect(computed.base.fontWeight).toBe('bold');
  });
});

describe('cascade: media queries and pseudo-states', () => {
  it('extracts pseudo-state rules into pseudoStates layer', async () => {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            .btn { background-color: #2563eb; color: #fff; }
            .btn:hover { background-color: #1d4ed8; }
            .btn:focus { outline: 2px solid #93c5fd; }
          </style>
        </head>
        <body>
          <button class="btn">Click me</button>
        </body>
      </html>
    `;
    const parsed = parseHtml(html);
    const bundle = await collectAndParseStylesheets(parsed.document!);

    const btn = cssSelect.selectOne('button', parsed.document!.rootElement as parse5.DefaultTreeAdapterMap['document'], {
      adapter: parse5Adapter,
    })!;

    const styles = computeElementStyles(btn, bundle);

    expect(styles.base.backgroundColor).toBe('#2563eb');
    expect(styles.base.color).toBe('#fff');
    expect(styles.pseudoStates[':hover']).toEqual({ backgroundColor: '#1d4ed8' });
    expect(styles.pseudoStates[':focus']).toEqual({ outline: '2px solid #93c5fd' });
  });

  it('groups @media rules into mediaQueries layer', async () => {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            .box { padding: 32px; }
            @media (max-width: 768px) {
              .box { padding: 16px; }
            }
          </style>
        </head>
        <body>
          <div class="box">Content</div>
        </body>
      </html>
    `;
    const parsed = parseHtml(html);
    const bundle = await collectAndParseStylesheets(parsed.document!);

    const box = cssSelect.selectOne('.box', parsed.document!.rootElement as parse5.DefaultTreeAdapterMap['document'], {
      adapter: parse5Adapter,
    })!;

    const styles = computeElementStyles(box, bundle);

    expect(styles.base.padding).toBe('32px');
    expect(styles.mediaQueries).toHaveLength(1);
    expect(styles.mediaQueries[0].query).toContain('max-width: 768px');
    expect(styles.mediaQueries[0].styles.padding).toBe('16px');
  });
});

describe('cascade: error handling and unsupported selectors', () => {
  it('catches and reports :has selector as CSS_UNSUPPORTED_SELECTOR without throwing', async () => {
    const report = createEmptyReport();
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            .container:has(p) { background-color: pink; }
            .container { color: navy; }
          </style>
        </head>
        <body>
          <div class="container"><p>Text</p></div>
        </body>
      </html>
    `;
    const parsed = parseHtml(html, undefined, report);
    const bundle = await collectAndParseStylesheets(parsed.document!, undefined, report);

    const container = cssSelect.selectOne('.container', parsed.document!.rootElement as parse5.DefaultTreeAdapterMap['document'], {
      adapter: parse5Adapter,
    })!;

    expect(() => computeElementStyles(container, bundle, undefined, report)).not.toThrow();

    const styles = computeElementStyles(container, bundle, undefined, report);
    expect(styles.base.color).toBe('navy');

    const diag = report.diagnostics.find((d) => d.code === 'CSS_UNSUPPORTED_SELECTOR');
    expect(diag).toBeDefined();
    expect(diag?.severity).toBe('info');
    expect(diag?.location?.selector).toContain(':has');
  });

  it('catches pseudo-elements like ::after without throwing', async () => {
    const report = createEmptyReport();
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            .box::after { content: " *"; color: red; }
            .box { font-size: 16px; }
          </style>
        </head>
        <body>
          <div class="box">Box content</div>
        </body>
      </html>
    `;
    const parsed = parseHtml(html, undefined, report);
    const bundle = await collectAndParseStylesheets(parsed.document!, undefined, report);

    const box = cssSelect.selectOne('.box', parsed.document!.rootElement as parse5.DefaultTreeAdapterMap['document'], {
      adapter: parse5Adapter,
    })!;

    let styles: any;
    expect(() => {
      styles = computeElementStyles(box, bundle, undefined, report);
    }).not.toThrow();

    expect(styles.base.fontSize).toBe('16px');
    const diag = report.diagnostics.find((d) => d.code === 'CSS_UNSUPPORTED_SELECTOR');
    expect(diag).toBeDefined();
    expect(diag?.severity).toBe('info');
  });
});
