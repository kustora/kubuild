import { describe, expect, it } from 'vitest';
import { resolveBinding, resolveBindingValue } from '../src/runtime/binding-resolver';
import type { RuntimeContext } from '../src/types/interfaces';

describe('resolveBinding', () => {
  it('resolves a top-level scalar key', () => {
    const context: RuntimeContext = { variables: { title: 'Hello' } };
    expect(resolveBinding({ key: 'title' }, context)).toEqual({ status: 'resolved', value: 'Hello' });
  });

  it('resolves a nested dotted-path key', () => {
    const context: RuntimeContext = { variables: { site: { name: 'My Website' } } };
    expect(resolveBinding({ key: 'site.name' }, context)).toEqual({
      status: 'resolved',
      value: 'My Website',
    });
  });

  it('resolves a multi-level nested key', () => {
    const context: RuntimeContext = { variables: { a: { b: { c: { d: 42 } } } } };
    expect(resolveBinding({ key: 'a.b.c.d' }, context)).toEqual({ status: 'resolved', value: 42 });
  });

  it('returns the provided fallback when the key is missing', () => {
    const context: RuntimeContext = { variables: { site: {} } };
    expect(resolveBinding({ key: 'site.missing', fallback: 'Default' }, context)).toEqual({
      status: 'fallback',
      value: 'Default',
    });
  });

  it('preserves falsy fallback values (0, false, empty string)', () => {
    const context: RuntimeContext = { variables: {} };
    expect(resolveBinding({ key: 'missing', fallback: 0 }, context)).toEqual({
      status: 'fallback',
      value: 0,
    });
    expect(resolveBinding({ key: 'missing', fallback: false }, context)).toEqual({
      status: 'fallback',
      value: false,
    });
  });

  it('applies the empty policy when the key is missing and no fallback is provided', () => {
    const context: RuntimeContext = { variables: {} };
    expect(resolveBinding({ key: 'missing' }, context)).toEqual({ status: 'empty', value: '' });
  });

  it('never throws when context or context.variables is missing', () => {
    expect(resolveBinding({ key: 'x' }, undefined)).toEqual({ status: 'empty', value: '' });
    expect(resolveBinding({ key: 'x' }, {})).toEqual({ status: 'empty', value: '' });
  });

  it('rejects __proto__ segments without polluting the prototype', () => {
    const context: RuntimeContext = { variables: {} };
    const result = resolveBinding({ key: '__proto__.polluted' }, context);
    expect(result.status).not.toBe('resolved');
    expect((Object.prototype as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('rejects constructor/prototype segments without polluting the prototype', () => {
    const context: RuntimeContext = { variables: { a: {} } };
    const result = resolveBinding({ key: 'a.constructor.prototype.polluted' }, context);
    expect(result.status).not.toBe('resolved');
    expect((Object.prototype as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('treats function values as missing rather than returning a callable reference', () => {
    const context: RuntimeContext = { variables: { greet: () => 'hi' } };
    const result = resolveBinding({ key: 'greet' }, context);
    expect(result.status).not.toBe('resolved');
  });

  it('treats a non-object intermediate segment as missing instead of throwing', () => {
    const context: RuntimeContext = { variables: { site: 'a string' } };
    expect(() => resolveBinding({ key: 'site.name' }, context)).not.toThrow();
    expect(resolveBinding({ key: 'site.name' }, context).status).not.toBe('resolved');
  });

  it('treats an expression-shaped key as an inert missing path, never executing it', () => {
    const context: RuntimeContext = { variables: { site: { name: 'X' } } };
    const result = resolveBinding({ key: 'site.name; alert(1)' }, context);
    expect(result.status).not.toBe('resolved');
  });
});

describe('resolveBindingValue', () => {
  it('returns just the resolved value', () => {
    const context: RuntimeContext = { variables: { site: { name: 'My Website' } } };
    expect(resolveBindingValue({ key: 'site.name' }, context)).toBe('My Website');
  });

  it('returns the empty-policy value when nothing resolves', () => {
    expect(resolveBindingValue({ key: 'missing' }, { variables: {} })).toBe('');
  });
});
