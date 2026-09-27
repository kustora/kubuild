import { describe, expect, it } from 'vitest';
import { buildSampleVariablesFromCatalog, getVariableGroup, groupVariableCatalog } from '../src/runtime/variable-catalog';
import type { VariableCatalog } from '../src/types/interfaces';

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

describe('getVariableGroup', () => {
  it('uses the explicit group label when set', () => {
    expect(getVariableGroup({ key: 'store.name', label: 'Name', type: 'string', sampleValue: '', group: 'Kedai' })).toBe(
      'Kedai',
    );
  });

  it('falls back to the first key segment when group is missing or blank', () => {
    expect(getVariableGroup({ key: 'store.name', label: 'Name', type: 'string', sampleValue: '' })).toBe('store');
    expect(getVariableGroup({ key: 'store.name', label: 'Name', type: 'string', sampleValue: '', group: '  ' })).toBe(
      'store',
    );
  });

  it('uses the whole key for a top-level key', () => {
    expect(getVariableGroup({ key: 'products', label: 'Products', type: 'array', sampleValue: [] })).toBe('products');
  });
});

describe('groupVariableCatalog', () => {
  it('buckets entries by group, keeping first-appearance group order and catalog entry order', () => {
    const catalog: VariableCatalog = [
      { key: 'product.name', label: 'Product Name', type: 'string', sampleValue: '', group: 'Product' },
      { key: 'store.name', label: 'Store Name', type: 'string', sampleValue: '', group: 'Store' },
      { key: 'product.price', label: 'Price', type: 'string', sampleValue: '', group: 'Product' },
      { key: 'funnel.nextStepUrl', label: 'Next Step', type: 'string', sampleValue: '' },
    ];
    expect(groupVariableCatalog(catalog)).toEqual([
      { group: 'Product', entries: [catalog[0], catalog[2]] },
      { group: 'Store', entries: [catalog[1]] },
      { group: 'funnel', entries: [catalog[3]] },
    ]);
  });

  it('returns an empty list for an empty or undefined catalog', () => {
    expect(groupVariableCatalog([])).toEqual([]);
    expect(groupVariableCatalog(undefined)).toEqual([]);
  });
});
