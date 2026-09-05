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
    expect(css).toContain('background-color: #1d4ed8 !important;');
    expect(css).toContain('cursor: pointer !important;');
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

describe('CSS Grid, Auto Layout Flex, Sizing, and Effect Styles Resolution', () => {
  it('resolves CSS Grid container properties', () => {
    const styles = resolveNodeStyles({
      base: {
        display: 'grid',
        gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
        gridTemplateRows: 'repeat(2, 100px)',
        gridAutoFlow: 'row dense',
        columnGap: 16,
        rowGap: 24,
      },
    });

    expect(styles.display).toBe('grid');
    expect(styles.gridTemplateColumns).toBe('repeat(3, minmax(0, 1fr))');
    expect(styles.gridTemplateRows).toBe('repeat(2, 100px)');
    expect(styles.gridAutoFlow).toBe('row dense');
    expect(styles.columnGap).toBe('16px');
    expect(styles.rowGap).toBe('24px');
  });

  it('resolves colSpan and rowSpan into CSS gridColumn and gridRow', () => {
    const stylesNum = resolveNodeStyles({
      base: {
        colSpan: 2,
        rowSpan: 3,
      },
    });
    expect(stylesNum.gridColumn).toBe('span 2');
    expect(stylesNum.gridRow).toBe('span 3');

    const stylesStr = resolveNodeStyles({
      base: {
        colSpan: '4',
        rowSpan: 'span 2',
      },
    });
    expect(stylesStr.gridColumn).toBe('span 4');
    expect(stylesStr.gridRow).toBe('span 2');
  });

  it('resolves Auto Layout flex properties and converts numeric gaps to px', () => {
    const styles = resolveNodeStyles({
      base: {
        display: 'flex',
        flexDirection: 'column',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 12,
        flexGrow: 1,
        flexShrink: 0,
      },
    });

    expect(styles.display).toBe('flex');
    expect(styles.flexDirection).toBe('column');
    expect(styles.flexWrap).toBe('wrap');
    expect(styles.justifyContent).toBe('space-between');
    expect(styles.alignItems).toBe('center');
    expect(styles.gap).toBe('12px');
    expect(styles.flexGrow).toBe(1);
    expect(styles.flexShrink).toBe(0);
  });

  it('resolves child sizing modes: fit-content (hug) and fill (flex: 1 1 0%)', () => {
    const hugStyles = resolveNodeStyles({
      base: {
        width: 'hug',
        height: 'fit-content',
      },
    });
    expect(hugStyles.width).toBe('fit-content');
    expect(hugStyles.height).toBe('fit-content');

    const fillStyles = resolveNodeStyles({
      base: {
        width: 'fill',
        sizingMode: 'fill',
      },
    });
    expect(fillStyles.width).toBe('100%');
    expect(fillStyles.flex).toBe('1 1 0%');

    const explicitFlexStyles = resolveNodeStyles({
      base: {
        flex: '1 1 0%',
      },
    });
    expect(explicitFlexStyles.flex).toBe('1 1 0%');
  });

  it('resolves 4-corner border radius into valid CSS styles', () => {
    const styles = resolveNodeStyles({
      base: {
        borderTopLeftRadius: 8,
        borderTopRightRadius: 12,
        borderBottomRightRadius: '16px',
        borderBottomLeftRadius: 4,
      },
    });

    expect(styles.borderTopLeftRadius).toBe('8px');
    expect(styles.borderTopRightRadius).toBe('12px');
    expect(styles.borderBottomRightRadius).toBe('16px');
    expect(styles.borderBottomLeftRadius).toBe('4px');
  });

  it('resolves backdrop blur into backdropFilter and WebkitBackdropFilter', () => {
    const blurNumStyles = resolveNodeStyles({
      base: {
        backdropBlur: 16,
      },
    });
    expect(blurNumStyles.backdropFilter).toBe('blur(16px)');
    expect(blurNumStyles.WebkitBackdropFilter).toBe('blur(16px)');

    const filterStyles = resolveNodeStyles({
      base: {
        backdropFilter: 'blur(20px) saturate(180%)',
      },
    });
    expect(filterStyles.backdropFilter).toBe('blur(20px) saturate(180%)');
    expect(filterStyles.WebkitBackdropFilter).toBe('blur(20px) saturate(180%)');
  });

  it('resolves linear and radial gradients into backgroundImage', () => {
    const linearStyles = resolveNodeStyles({
      base: {
        gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      },
    });
    expect(linearStyles.backgroundImage).toBe('linear-gradient(135deg, #667eea 0%, #764ba2 100%)');

    const radialStyles = resolveNodeStyles({
      base: {
        backgroundGradient: 'radial-gradient(circle at center, #ff0000 0%, #0000ff 100%)',
      },
    });
    expect(radialStyles.backgroundImage).toBe('radial-gradient(circle at center, #ff0000 0%, #0000ff 100%)');
  });

  it('compiles normalized styles into CSS declarations via styleDefinitionToCssDeclarations', () => {
    const css = styleDefinitionToCssDeclarations({
      colSpan: 2,
      backdropBlur: 10,
      gradient: 'linear-gradient(90deg, #f00, #00f)',
    });

    expect(css).toContain('grid-column: span 2;');
    expect(css).toContain('backdrop-filter: blur(10px);');
    expect(css).toContain('-webkit-backdrop-filter: blur(10px);');
    expect(css).toContain('background-image: linear-gradient(90deg, #f00, #00f);');
  });
});

