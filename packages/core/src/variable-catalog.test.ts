import { describe, expect, it } from 'vitest';
import { buildSampleVariablesFromCatalog } from './variable-catalog';
import type { VariableCatalog } from './interfaces';

describe('buildSampleVariablesFromCatalog', () => {
  it('expands a nested dotted key into a nested object', () => {
    const catalog: VariableCatalog = [
      { key: 'site.name', label: 'Site Name', type: 'string', sampleValue: 'My Website' },
    ];
    expect(buildSampleVariablesFromCatalog(catalog)).toEqual({ site: { name: 'My Website' } });
  });

  it('expands a top-level key', () => {
    const catalog: VariableCatalog = [
      { key: 'products', label: 'Products', type: 'array', sampleValue: [{ name: 'Widget' }] },
    ];
    expect(buildSampleVariablesFromCatalog(catalog)).toEqual({ products: [{ name: 'Widget' }] });
  });

  it('merges multiple entries sharing a common prefix', () => {
    const catalog: VariableCatalog = [
      { key: 'site.name', label: 'Name', type: 'string', sampleValue: 'My Website' },
      { key: 'site.tagline', label: 'Tagline', type: 'string', sampleValue: 'Build fast' },
    ];
    expect(buildSampleVariablesFromCatalog(catalog)).toEqual({
      site: { name: 'My Website', tagline: 'Build fast' },
    });
  });

  it('returns an empty object for an empty or undefined catalog', () => {
    expect(buildSampleVariablesFromCatalog([])).toEqual({});
    expect(buildSampleVariablesFromCatalog(undefined)).toEqual({});
  });

  it('skips entries whose key traverses a forbidden segment', () => {
    const catalog: VariableCatalog = [
      { key: '__proto__.polluted', label: 'Bad', type: 'string', sampleValue: 'x' },
      { key: 'a.constructor.prototype', label: 'Bad2', type: 'string', sampleValue: 'y' },
      { key: 'safe', label: 'Safe', type: 'string', sampleValue: 'ok' },
    ];
    const result = buildSampleVariablesFromCatalog(catalog);
    expect(result).toEqual({ safe: 'ok' });
    expect((Object.prototype as Record<string, unknown>).polluted).toBeUndefined();
  });
});
