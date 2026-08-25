import { describe, expect, it } from 'vitest';
import { getCompatibleCatalogEntries, toBindingValue } from '../src/variable-picker';
import type { ComponentFieldDefinition } from '@kubuild/components';
import type { VariableCatalog } from '@kubuild/core';

const catalog: VariableCatalog = [
  { key: 'site.name', label: 'Site Name', type: 'string', sampleValue: 'My Website' },
  { key: 'site.visits', label: 'Visits', type: 'number', sampleValue: 42 },
  { key: 'site.isLive', label: 'Is Live', type: 'boolean', sampleValue: true },
  { key: 'products', label: 'Products', type: 'array', sampleValue: [{ name: 'Widget' }] },
  { key: 'settings', label: 'Settings', type: 'object', sampleValue: { theme: 'dark' } },
];

const stringField: ComponentFieldDefinition = { name: 'text', label: 'Text', type: 'string' };
const numberField: ComponentFieldDefinition = { name: 'width', label: 'Width', type: 'number' };
const booleanField: ComponentFieldDefinition = { name: 'disabled', label: 'Disabled', type: 'boolean' };
const selectField: ComponentFieldDefinition = { name: 'level', label: 'Level', type: 'select' };

describe('getCompatibleCatalogEntries', () => {
  it('returns only string-typed catalog entries for a string field', () => {
    expect(getCompatibleCatalogEntries(stringField, catalog)).toEqual([catalog[0]]);
  });

  it('returns only number-typed catalog entries for a number field', () => {
    expect(getCompatibleCatalogEntries(numberField, catalog)).toEqual([catalog[1]]);
  });

  it('returns only boolean-typed catalog entries for a boolean field', () => {
    expect(getCompatibleCatalogEntries(booleanField, catalog)).toEqual([catalog[2]]);
  });

  it('never offers array/object catalog entries onto a scalar-bindable field', () => {
    const result = getCompatibleCatalogEntries(stringField, catalog);
    expect(result.some((e) => e.type === 'array' || e.type === 'object')).toBe(false);
  });

  it('returns an empty array for a non-bindable field type (select/image/action/json)', () => {
    expect(getCompatibleCatalogEntries(selectField, catalog)).toEqual([]);
  });

  it('returns an empty array when no catalog is provided', () => {
    expect(getCompatibleCatalogEntries(stringField, undefined)).toEqual([]);
  });
});

describe('toBindingValue', () => {
  it('builds a VariableBinding object from a key', () => {
    expect(toBindingValue('site.name')).toEqual({ type: 'variable', key: 'site.name' });
  });
});
