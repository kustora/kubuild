import { describe, it, expect } from 'vitest';
import { resolveNodeStyles, collectStateStylesCss, styleDefinitionToCssDeclarations } from '../src/styles';
import { createBlankDocument } from '@kubuild/core';

describe('STORA-023: Renderer applies responsive style overrides', () => {
  it('resolves base styles unchanged when no viewport override exists', () => {
    const result = resolveNodeStyles({ base: { fontSize: '48px', color: '#111' } }, 'desktop');
    expect(result).toEqual({ fontSize: '48px', color: '#111' });
  });

  it('layers the mobile override on top of base for the same key', () => {
    const result = resolveNodeStyles(
      { base: { fontSize: '48px', color: '#111' }, mobile: { fontSize: '32px' } },
      'mobile',
    );
    expect(result).toEqual({ fontSize: '32px', color: '#111' });
  });

  it('does not leak a desktop-only override into a mobile resolution', () => {
    const result = resolveNodeStyles(
      { base: { fontSize: '48px' }, desktop: { fontSize: '56px' } },
      'mobile',
    );
    expect(result).toEqual({ fontSize: '48px' });
  });

  it('applies the desktop override on top of base when viewport is desktop', () => {
    const result = resolveNodeStyles(
      { base: { fontSize: '48px' }, desktop: { fontSize: '56px' } },
      'desktop',
    );
    expect(result).toEqual({ fontSize: '56px' });
  });

  it('returns an empty object when styles are undefined', () => {
    expect(resolveNodeStyles(undefined, 'mobile')).toEqual({});
  });
});

describe('STORA-222: Dynamic hover style compilation', () => {
  it('converts camelCase style keys to kebab-case CSS declarations', () => {
    const css = styleDefinitionToCssDeclarations({ backgroundColor: '#1d4ed8', zIndex: 2 });
    expect(css).toBe('background-color: #1d4ed8; z-index: 2;');
  });

  it('skips empty/null values in style definitions', () => {
    const css = styleDefinitionToCssDeclarations({ color: '', opacity: null, padding: '8px' });
    expect(css).toBe('padding: 8px;');
  });

  it('produces a scoped :hover rule for a node with a hover state layer', () => {
    const doc = createBlankDocument('Hover Test');
    doc.document.children = [
      {
        id: 'btn-1',
        type: 'button',
        props: { text: 'Click' },
        styles: {
          base: { backgroundColor: '#2563eb' },
          states: { ':hover': { backgroundColor: '#1d4ed8', cursor: 'pointer' } },
        },
      },
    ];

    const css = collectStateStylesCss(doc);
    expect(css).toContain('[data-kubuild-node="btn-1"]:hover');
    expect(css).toContain('background-color: #1d4ed8;');
    expect(css).toContain('cursor: pointer;');
  });

  it('produces rules for multiple states and multiple nodes', () => {
    const doc = createBlankDocument('Multi State Test');
    doc.document.children = [
      {
        id: 'a',
        type: 'button',
        styles: { states: { ':hover': { opacity: 0.8 }, ':active': { opacity: 0.6 } } },
      },
      { id: 'b', type: 'heading', styles: { states: { ':focus': { outline: '2px solid blue' } } } },
    ];

    const css = collectStateStylesCss(doc);
    expect(css).toContain('[data-kubuild-node="a"]:hover');
    expect(css).toContain('[data-kubuild-node="a"]:active');
    expect(css).toContain('[data-kubuild-node="b"]:focus');
  });

  it('returns empty string when no state layers exist', () => {
    const doc = createBlankDocument('No States');
    doc.document.children = [{ id: 'a', type: 'heading', styles: { base: { color: 'red' } } }];
    expect(collectStateStylesCss(doc)).toBe('');
    expect(collectStateStylesCss(undefined)).toBe('');
  });

  it('rejects non-pseudo-class state keys to prevent selector injection', () => {
    const doc = createBlankDocument('Injection Test');
    doc.document.children = [
      {
        id: 'a',
        type: 'heading',
        styles: {
          states: {
            'evil { body { background: red } }': { color: 'red' },
            ':hover': { color: 'blue' },
          } as Record<string, Record<string, string>>,
        },
      },
    ];

    const css = collectStateStylesCss(doc);
    expect(css).not.toContain('evil');
    expect(css).toContain(':hover');
  });

  it('escapes CSS-breaking characters in declaration values', () => {
    const css = styleDefinitionToCssDeclarations({ content: 'a{b}c;d' });
    expect(css).not.toContain('{');
    expect(css).not.toContain('}');
    expect(css).not.toContain(';d');
  });
});
