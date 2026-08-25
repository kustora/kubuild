import { describe, it, expect } from 'vitest';
import { resolveNodeStyles } from '../src/styles';

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
