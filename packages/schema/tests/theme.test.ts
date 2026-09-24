import { describe, it, expect } from 'vitest';
import {
  ThemeSchema,
  PageDocumentSchema,
  StyleDefinitionSchema,
  themeTokenRef,
  parseThemeTokenRef,
  themeToCssVariables,
  mergeThemes,
  getPageDocumentJsonSchema,
  CANONICAL_TEXT_PROPS,
  findDeprecatedPropAliases,
} from '../src';

describe('STORA-551: ThemeSchema', () => {
  it('accepts safe tokens and rejects CSS/markup injection', () => {
    expect(ThemeSchema.safeParse({ colors: { primary: '#2563eb' }, radii: { md: 8 } }).success).toBe(true);
    for (const bad of [
      { colors: { primary: 'red;}' } },
      { colors: { primary: '<script>' } },
      { fonts: { body: 'url(x)' } },
      { colors: { 'bad key': '#fff' } },
      { unknown: { a: 'b' } },
    ]) {
      expect(ThemeSchema.strict().safeParse(bad).success, JSON.stringify(bad)).toBe(false);
    }
  });

  it('is part of PageDocument and the JSON Schema export', () => {
    const parsed = PageDocumentSchema.parse({
      schema: 'stora.page',
      theme: { colors: { primary: '#000' } },
      document: { id: 'root', type: 'page' },
    });
    expect(parsed.theme).toEqual({ colors: { primary: '#000' } });
    const json = getPageDocumentJsonSchema() as { properties: Record<string, unknown>; definitions: Record<string, unknown> };
    expect(json.properties.theme).toEqual({ $ref: '#/definitions/theme' });
    expect(json.definitions.theme).toBeDefined();
  });

  it('token references are plain var() strings that pass style validation', () => {
    const ref = themeTokenRef('colors', 'primary');
    expect(ref).toBe('var(--kb-color-primary)');
    expect(StyleDefinitionSchema.safeParse({ backgroundColor: ref }).success).toBe(true);
    expect(parseThemeTokenRef(ref)).toEqual({ group: 'colors', key: 'primary' });
    expect(parseThemeTokenRef('var(--kb-space-lg, 16px)')).toEqual({ group: 'spacing', key: 'lg' });
    expect(parseThemeTokenRef('#fff')).toBeNull();
    expect(() => themeTokenRef('colors', 'x;y')).toThrow();
  });

  it('flattens to custom properties and merges overrides token-by-token', () => {
    const merged = mergeThemes({ colors: { primary: '#000', accent: '#111' } }, { colors: { primary: '#fff', bad: 'a;b' } });
    expect(merged).toEqual({ colors: { primary: '#fff', accent: '#111' } });
    expect(themeToCssVariables({ radii: { md: 8 }, fonts: { body: 'Inter' } })).toEqual([
      ['--kb-font-body', 'Inter'],
      ['--kb-radius-md', '8px'],
    ]);
  });
});

describe('STORA-550: canonical text props', () => {
  it('declares one canonical name per text component', () => {
    expect(CANONICAL_TEXT_PROPS.paragraph.canonical).toBe('text');
    expect(CANONICAL_TEXT_PROPS.button.canonical).toBe('label');
  });

  it('findDeprecatedPropAliases marks which alias is actually in effect', () => {
    expect(findDeprecatedPropAliases('link', { label: 'a', content: 'b' })).toEqual([
      { propName: 'label', canonicalName: 'text', inEffect: true },
      { propName: 'content', canonicalName: 'text', inEffect: false },
    ]);
    expect(findDeprecatedPropAliases('badge', { text: 'a', label: 'b' })).toEqual([
      { propName: 'label', canonicalName: 'text', inEffect: false },
    ]);
    expect(findDeprecatedPropAliases('image', { label: 'x' })).toEqual([]);
  });
});
