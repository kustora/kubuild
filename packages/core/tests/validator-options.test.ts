import { describe, it, expect } from 'vitest';
import { validateDocument } from '../src';

function docWithProps(props: Record<string, unknown>) {
  return {
    schema: 'stora.page',
    version: '1.0.0',
    document: {
      id: 'root-page',
      type: 'page',
      children: [{ id: 'node-1', type: 'image', props, children: [] }],
    },
  };
}

const badAsset = docWithProps({ src: { type: 'asset', assetId: '' } });
const badVariable = docWithProps({ title: { type: 'variable', key: '' } });
const badAction = docWithProps({ action: { type: '', payload: {} } });

describe('ValidationOptions binding flags', () => {
  it('runs all binding checks by default', () => {
    expect(validateDocument(badAsset).errors.map((e) => e.code)).toContain('INVALID_ASSET_REFERENCE');
    expect(validateDocument(badVariable).errors.map((e) => e.code)).toContain('INVALID_VARIABLE_BINDING');
    expect(validateDocument(badAction).errors.map((e) => e.code)).toContain('INVALID_ACTION_BINDING');
  });

  it('runs checks when flags are explicitly true', () => {
    expect(validateDocument(badAsset, { checkAssetReferences: true }).valid).toBe(false);
    expect(validateDocument(badVariable, { checkVariableBindings: true }).valid).toBe(false);
    expect(validateDocument(badAction, { checkActionBindings: true }).valid).toBe(false);
  });

  it('checkAssetReferences: false skips asset reference checks only', () => {
    const result = validateDocument(badAsset, { checkAssetReferences: false });
    expect(result.errors.filter((e) => e.code === 'INVALID_ASSET_REFERENCE')).toHaveLength(0);
    expect(validateDocument(badVariable, { checkAssetReferences: false }).valid).toBe(false);
  });

  it('checkVariableBindings: false skips variable binding checks only', () => {
    const result = validateDocument(badVariable, { checkVariableBindings: false });
    expect(result.errors.filter((e) => e.code === 'INVALID_VARIABLE_BINDING')).toHaveLength(0);
    expect(validateDocument(badAction, { checkVariableBindings: false }).valid).toBe(false);
  });

  it('checkActionBindings: false skips action binding checks only', () => {
    const result = validateDocument(badAction, { checkActionBindings: false });
    expect(result.errors.filter((e) => e.code === 'INVALID_ACTION_BINDING')).toHaveLength(0);
    expect(validateDocument(badAsset, { checkActionBindings: false }).valid).toBe(false);
  });

  it('gates nested and array bindings too', () => {
    const nested = docWithProps({
      items: [{ image: { type: 'asset', assetId: '' } }],
      meta: { label: { type: 'variable', key: '' } },
    });
    expect(validateDocument(nested).errors).toHaveLength(2);
    expect(
      validateDocument(nested, { checkAssetReferences: false, checkVariableBindings: false }).errors,
    ).toHaveLength(0);
  });
});

describe('ValidationOptions.knownAssetIds', () => {
  const ref = docWithProps({ src: { type: 'asset', assetId: 'hero' } });
  const refWithFallback = docWithProps({
    src: { type: 'asset', assetId: 'hero', fallbackUrl: 'https://example.com/hero.png' },
  });

  it('does not check existence when knownAssetIds is not supplied', () => {
    expect(validateDocument(ref).valid).toBe(true);
  });

  it('accepts references to known assets (array or Set)', () => {
    expect(validateDocument(ref, { knownAssetIds: ['hero'] }).valid).toBe(true);
    expect(validateDocument(ref, { knownAssetIds: new Set(['hero']) }).valid).toBe(true);
  });

  it('errors on an unknown asset with no fallbackUrl', () => {
    const result = validateDocument(ref, { knownAssetIds: ['other'] });
    expect(result.valid).toBe(false);
    const err = result.errors.find((e) => e.code === 'INVALID_ASSET_REFERENCE');
    expect(err?.path).toBe('/document/children/0/props/src/assetId');
    expect(err?.details).toEqual({ assetId: 'hero' });
  });

  it('warns (non-blocking) on an unknown asset that has a fallbackUrl', () => {
    const result = validateDocument(refWithFallback, { knownAssetIds: [] });
    expect(result.valid).toBe(true);
    expect(result.warnings.map((w) => w.code)).toContain('UNRESOLVED_ASSET_REFERENCE');
  });

  it('is ignored when checkAssetReferences is false', () => {
    const result = validateDocument(ref, { knownAssetIds: [], checkAssetReferences: false });
    expect(result.valid).toBe(true);
    expect(result.warnings).toHaveLength(0);
  });
});
