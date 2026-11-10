/**
 * @kubuild/html-import
 * Tests for responsive style processing: media query mapping, pseudo-states mapping,
 * delta computation, and ResponsiveStylesSchema validation (STORA-606).
 */

import { describe, expect, it } from 'vitest';
import * as parse5 from 'parse5';
import * as cssSelect from 'css-select';
import { ResponsiveStylesSchema } from '@kubuild/schema';
import {
  buildResponsiveStyles,
  computeDeltaStyles,
  mapMediaQueryToBreakpoint,
  mapPseudoClassToState,
  parseMediaQueryWidth,
} from '../src/responsive.js';
import { computeElementStyles, parse5Adapter } from '../src/cascade.js';
import { collectAndParseStylesheets } from '../src/stylesheet.js';
import { parseHtml } from '../src/parser.js';
import { createEmptyReport } from '../src/types.js';

describe('responsive: media query parsing and breakpoint mapping', () => {
  it('maps exact breakpoints correctly', () => {
    // Exact mobile: max-width: 767px (or 767.98px)
    expect(mapMediaQueryToBreakpoint('(max-width: 767px)')).toBe('mobile');
    expect(mapMediaQueryToBreakpoint('(max-width: 767.98px)')).toBe('mobile');
    expect(mapMediaQueryToBreakpoint('screen and (max-width: 767px)')).toBe('mobile');
    expect(mapMediaQueryToBreakpoint('@media (max-width: 767px)')).toBe('mobile');

    // Exact tablet: min-width: 768px, or (min-width: 768px) and (max-width: 1023px)
    expect(mapMediaQueryToBreakpoint('(min-width: 768px)')).toBe('tablet');
    expect(mapMediaQueryToBreakpoint('(min-width: 768px) and (max-width: 1023px)')).toBe('tablet');
    expect(mapMediaQueryToBreakpoint('(min-width: 768px) and (max-width: 1023.98px)')).toBe('tablet');
    expect(mapMediaQueryToBreakpoint('screen and (min-width: 768px)')).toBe('tablet');

    // Exact desktop: min-width: 1024px
    expect(mapMediaQueryToBreakpoint('(min-width: 1024px)')).toBe('desktop');
    expect(mapMediaQueryToBreakpoint('only screen and (min-width: 1024px)')).toBe('desktop');
  });

  it('converts rem and em units to px based on 16px font size', () => {
    // 47.9375em * 16 = 767px -> mobile
    expect(mapMediaQueryToBreakpoint('(max-width: 47.9375em)')).toBe('mobile');

    // 48rem * 16 = 768px -> tablet
    expect(mapMediaQueryToBreakpoint('(min-width: 48rem)')).toBe('tablet');

    // 64rem * 16 = 1024px -> desktop
    expect(mapMediaQueryToBreakpoint('(min-width: 64rem)')).toBe('desktop');
  });

  it('supports CSS Level 4 range syntax', () => {
    expect(mapMediaQueryToBreakpoint('(width <= 767px)')).toBe('mobile');
    expect(mapMediaQueryToBreakpoint('(width < 768px)')).toBe('mobile');
    expect(mapMediaQueryToBreakpoint('(768px <= width <= 1023px)')).toBe('tablet');
    expect(mapMediaQueryToBreakpoint('(width >= 1024px)')).toBe('desktop');
  });

  it('approximates custom boundaries and reports CSS_MEDIA_APPROXIMATED diagnostic', () => {
    const report1 = createEmptyReport();
    const bp1 = mapMediaQueryToBreakpoint('(max-width: 900px)', report1);
    expect(bp1).toBe('tablet');
    expect(report1.diagnostics).toHaveLength(1);
    expect(report1.diagnostics[0]?.code).toBe('CSS_MEDIA_APPROXIMATED');
    expect(report1.diagnostics[0]?.severity).toBe('info');
    expect(report1.diagnostics[0]?.message).toContain('(max-width: 900px)');
    expect(report1.diagnostics[0]?.details?.mappedBreakpoint).toBe('tablet');
    expect(report1.diagnostics[0]?.details?.maxWidth).toBe(900);

    const report2 = createEmptyReport();
    const bp2 = mapMediaQueryToBreakpoint('(min-width: 600px)', report2);
    expect(bp2).toBe('mobile');
    expect(report2.diagnostics).toHaveLength(1);
    expect(report2.diagnostics[0]?.code).toBe('CSS_MEDIA_APPROXIMATED');
    expect(report2.diagnostics[0]?.severity).toBe('info');
    expect(report2.diagnostics[0]?.message).toContain('(min-width: 600px)');
    expect(report2.diagnostics[0]?.details?.mappedBreakpoint).toBe('mobile');
    expect(report2.diagnostics[0]?.details?.minWidth).toBe(600);

    const report3 = createEmptyReport();
    const bp3 = mapMediaQueryToBreakpoint('(min-width: 1200px)', report3);
    expect(bp3).toBe('desktop');
    expect(report3.diagnostics).toHaveLength(1);
    expect(report3.diagnostics[0]?.code).toBe('CSS_MEDIA_APPROXIMATED');
  });

  it('does not emit diagnostic for exact breakpoints', () => {
    const report = createEmptyReport();
    mapMediaQueryToBreakpoint('(max-width: 767px)', report);
    mapMediaQueryToBreakpoint('(min-width: 768px)', report);
    mapMediaQueryToBreakpoint('(min-width: 1024px)', report);
    expect(report.diagnostics).toHaveLength(0);
  });

  it('ignores non-width media queries without throwing', () => {
    const report = createEmptyReport();
    expect(mapMediaQueryToBreakpoint('print', report)).toBeNull();
    expect(mapMediaQueryToBreakpoint('speech', report)).toBeNull();
    expect(mapMediaQueryToBreakpoint('(prefers-color-scheme: dark)', report)).toBeNull();
    expect(mapMediaQueryToBreakpoint('(prefers-reduced-motion: reduce)', report)).toBeNull();
    expect(mapMediaQueryToBreakpoint('(orientation: landscape)', report)).toBeNull();
    expect(mapMediaQueryToBreakpoint('', report)).toBeNull();
    expect(report.diagnostics).toHaveLength(0);
  });

  it('handles comma-separated media queries', () => {
    expect(mapMediaQueryToBreakpoint('print, (max-width: 767px)')).toBe('mobile');
  });

  it('parseMediaQueryWidth returns null for empty or non-width queries', () => {
    expect(parseMediaQueryWidth('')).toBeNull();
    const printParsed = parseMediaQueryWidth('print');
    expect(printParsed?.isPrintOrSpeech).toBe(true);
    expect(printParsed?.hasWidthConstraint).toBe(false);
  });
});

describe('responsive: pseudo-class to state mapping', () => {
  it('maps interactive pseudo-classes to schema state keys', () => {
    expect(mapPseudoClassToState(':hover')).toBe('hover');
    expect(mapPseudoClassToState('hover')).toBe('hover');

    expect(mapPseudoClassToState(':focus')).toBe('focus');
    expect(mapPseudoClassToState('focus')).toBe('focus');

    expect(mapPseudoClassToState(':active')).toBe('active');
    expect(mapPseudoClassToState('active')).toBe('active');

    expect(mapPseudoClassToState(':focus-visible')).toBe('focusVisible');
    expect(mapPseudoClassToState('focus-visible')).toBe('focusVisible');
    expect(mapPseudoClassToState('focusVisible')).toBe('focusVisible');

    expect(mapPseudoClassToState(':disabled')).toBe('disabled');
    expect(mapPseudoClassToState('disabled')).toBe('disabled');
    expect(mapPseudoClassToState('[disabled]')).toBe('disabled');
  });

  it('ignores unsupported pseudo-classes gracefully', () => {
    expect(mapPseudoClassToState(':first-child')).toBeNull();
    expect(mapPseudoClassToState(':last-child')).toBeNull();
    expect(mapPseudoClassToState(':nth-child(2)')).toBeNull();
    expect(mapPseudoClassToState(':visited')).toBeNull();
    expect(mapPseudoClassToState('')).toBeNull();
  });
});

describe('responsive: delta styles calculation', () => {
  it('keeps only properties that differ from base', () => {
    const base = { color: 'red', fontSize: '16px', margin: '10px' };
    const override = {
      color: 'red', // identical -> stripped
      fontSize: '18px', // different -> kept
      padding: '8px', // new property -> kept
    };

    const delta = computeDeltaStyles(base, override);
    expect(delta).toEqual({
      fontSize: '18px',
      padding: '8px',
    });
  });

  it('returns undefined if all override properties are identical to base', () => {
    const base = { color: 'red', fontSize: '16px' };
    const override = { color: 'red', fontSize: '16px' };

    const delta = computeDeltaStyles(base, override);
    expect(delta).toBeUndefined();
  });

  it('returns all non-empty properties if base is empty or undefined', () => {
    const override = { color: 'blue', display: 'flex' };
    expect(computeDeltaStyles({}, override)).toEqual(override);
    expect(computeDeltaStyles(undefined, override)).toEqual(override);
  });

  it('returns undefined if override is empty or undefined', () => {
    expect(computeDeltaStyles({ color: 'red' }, {})).toBeUndefined();
    expect(computeDeltaStyles({ color: 'red' }, undefined)).toBeUndefined();
  });

  it('handles numeric vs string values and trims cleanly', () => {
    const base = { zIndex: 10, lineHeight: 1.5 };
    const override = { zIndex: 10, lineHeight: 1.5, opacity: 0.8 };
    expect(computeDeltaStyles(base, override)).toEqual({ opacity: 0.8 });
  });
});

describe('responsive: buildResponsiveStyles function', () => {
  it('builds ResponsiveStyles with base, delta breakpoints, and delta states', () => {
    const report = createEmptyReport();
    const computed = {
      base: {
        color: '#1e293b',
        fontSize: '16px',
        padding: '12px',
        backgroundColor: '#ffffff',
      },
      mediaQueries: [
        {
          query: '(max-width: 767px)',
          styles: {
            color: '#1e293b', // identical to base -> stripped
            fontSize: '14px', // delta -> kept in mobile
            padding: '8px', // delta -> kept in mobile
          },
        },
        {
          query: '(min-width: 768px) and (max-width: 1023px)',
          styles: {
            color: '#1e293b', // identical -> stripped
            fontSize: '16px', // identical -> stripped
            padding: '12px', // identical -> stripped
          },
        },
        {
          query: '(min-width: 1024px)',
          styles: {
            padding: '24px', // delta -> kept in desktop
          },
        },
      ],
      pseudoStates: {
        ':hover': {
          color: '#1e293b', // identical -> stripped
          backgroundColor: '#f1f5f9', // delta -> kept in hover
        },
        ':focus': {
          outline: '2px solid #2563eb', // delta -> kept in focus
        },
        ':active': {
          transform: 'scale(0.98)',
        },
        ':focus-visible': {
          outline: '2px solid #3b82f6',
        },
        ':disabled': {
          opacity: 0.5,
          cursor: 'not-allowed',
        },
        ':first-child': {
          marginTop: '0px', // unmapped pseudo-class -> ignored
        },
      },
    };

    const responsive = buildResponsiveStyles(computed, report);

    // Base matches
    expect(responsive.base).toEqual({
      color: '#1e293b',
      fontSize: '16px',
      padding: '12px',
      backgroundColor: '#ffffff',
    });

    // Mobile has only deltas
    expect(responsive.mobile).toEqual({
      fontSize: '14px',
      padding: '8px',
    });

    // Tablet had 0 deltas -> omitted/undefined
    expect(responsive.tablet).toBeUndefined();

    // Desktop has only deltas
    expect(responsive.desktop).toEqual({
      padding: '24px',
    });

    // States
    expect(responsive.states).toBeDefined();
    expect(responsive.states?.hover).toEqual({
      backgroundColor: '#f1f5f9',
    });
    expect(responsive.states?.focus).toEqual({
      outline: '2px solid #2563eb',
    });
    expect(responsive.states?.active).toEqual({
      transform: 'scale(0.98)',
    });
    expect(responsive.states?.focusVisible).toEqual({
      outline: '2px solid #3b82f6',
    });
    expect(responsive.states?.disabled).toEqual({
      opacity: 0.5,
      cursor: 'not-allowed',
    });
    expect(responsive.states?.[':first-child']).toBeUndefined();

    // Validates against ResponsiveStylesSchema from @kubuild/schema
    const parsed = ResponsiveStylesSchema.safeParse(responsive);
    expect(parsed.success).toBe(true);
  });

  it('merges multiple rules mapping to the same breakpoint and accumulates deltas', () => {
    const report = createEmptyReport();
    const computed = {
      base: {
        fontSize: '16px',
        color: 'black',
        padding: '20px',
      },
      mediaQueries: [
        {
          query: '(max-width: 767px)',
          styles: { fontSize: '14px', color: 'black' },
        },
        {
          query: '(max-width: 600px)', // custom boundary approximated to mobile
          styles: { padding: '10px' },
        },
      ],
      pseudoStates: {},
    };

    const responsive = buildResponsiveStyles(computed, report);

    expect(responsive.mobile).toEqual({
      fontSize: '14px',
      padding: '10px',
    });
    expect(report.diagnostics).toHaveLength(1);
    expect(report.diagnostics[0]?.code).toBe('CSS_MEDIA_APPROXIMATED');
  });

  it('omits states entirely if all state overrides are identical to base', () => {
    const computed = {
      base: { color: 'red' },
      mediaQueries: [],
      pseudoStates: {
        ':hover': { color: 'red' },
      },
    };

    const responsive = buildResponsiveStyles(computed);
    expect(responsive.states).toBeUndefined();
    expect(ResponsiveStylesSchema.safeParse(responsive).success).toBe(true);
  });

  it('omits breakpoints when media queries contain non-width rules like print', () => {
    const computed = {
      base: { color: 'blue' },
      mediaQueries: [{ query: 'print', styles: { color: 'black' } }],
      pseudoStates: {},
    };

    const responsive = buildResponsiveStyles(computed);
    expect(responsive.mobile).toBeUndefined();
    expect(responsive.tablet).toBeUndefined();
    expect(responsive.desktop).toBeUndefined();
    expect(ResponsiveStylesSchema.safeParse(responsive).success).toBe(true);
  });
});

describe('responsive: end-to-end integration with HTML and CSS cascade', () => {
  it('resolves real HTML element styles through cascade into ResponsiveStyles', async () => {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            .cta-button {
              display: inline-block;
              padding: 12px 24px;
              background-color: #3b82f6;
              color: #ffffff;
              font-size: 16px;
            }
            .cta-button:hover {
              background-color: #1d4ed8;
              color: #ffffff; /* identical to base */
            }
            .cta-button:focus-visible {
              outline: 2px solid #93c5fd;
            }
            .cta-button:disabled {
              opacity: 0.5;
              cursor: not-allowed;
            }
            @media (max-width: 767px) {
              .cta-button {
                font-size: 14px;
                padding: 10px 16px;
                color: #ffffff; /* identical to base */
              }
            }
            @media (min-width: 1024px) {
              .cta-button {
                font-size: 18px;
              }
            }
            @media print {
              .cta-button {
                display: none;
              }
            }
          </style>
        </head>
        <body>
          <button class="cta-button">Click Here</button>
        </body>
      </html>
    `;

    const report = createEmptyReport();
    const parsed = parseHtml(html, undefined, report);
    const bundle = await collectAndParseStylesheets(parsed.document!, undefined, report);

    const buttonEl = cssSelect.selectOne(
      'button.cta-button',
      parsed.document!.rootElement as parse5.DefaultTreeAdapterMap['document'],
      { adapter: parse5Adapter },
    )!;

    const computed = computeElementStyles(buttonEl, bundle, undefined, report);
    const responsiveStyles = buildResponsiveStyles(computed, report);

    // Validate schema compliance
    const validated = ResponsiveStylesSchema.parse(responsiveStyles);
    expect(validated).toBeDefined();

    // Check base styles
    expect(responsiveStyles.base?.backgroundColor).toBe('#3b82f6');
    expect(responsiveStyles.base?.color).toBe('#ffffff');
    expect(responsiveStyles.base?.fontSize).toBe('16px');

    // Check mobile delta: color was stripped, fontSize and padding kept
    expect(responsiveStyles.mobile).toEqual({
      fontSize: '14px',
      padding: '10px 16px',
    });

    // Check desktop delta
    expect(responsiveStyles.desktop).toEqual({
      fontSize: '18px',
    });

    // Tablet was not specified, so omitted
    expect(responsiveStyles.tablet).toBeUndefined();

    // States: hover color was stripped, backgroundColor kept
    expect(responsiveStyles.states?.hover).toEqual({
      backgroundColor: '#1d4ed8',
    });
    expect(responsiveStyles.states?.focusVisible).toEqual({
      outline: '2px solid #93c5fd',
    });
    expect(responsiveStyles.states?.disabled).toEqual({
      opacity: 0.5,
      cursor: 'not-allowed',
    });
  });
});
