import { z } from 'zod';

/**
 * Document Theme / Design Tokens (STORA-551)
 *
 * A theme is a small, portable set of named design tokens stored on the document
 * (`PageDocument.theme`). The renderer emits every token as a CSS custom property on
 * the page root, and node styles reference tokens with a plain CSS `var()` string:
 *
 *   styles.base.backgroundColor = 'var(--kb-color-primary)'
 *
 * Because the reference is an ordinary CSS value it passes the existing style
 * validation, renders unchanged in inline styles, generated CSS and exported HTML,
 * and falls back gracefully (to the property's initial value) when a token is absent.
 *
 * Token groups map to custom-property prefixes:
 *   colors  -> --kb-color-<key>
 *   fonts   -> --kb-font-<key>
 *   radii   -> --kb-radius-<key>
 *   spacing -> --kb-space-<key>
 *
 * Security: token keys are restricted to a safe identifier alphabet and token values
 * are screened like style values, and additionally may not contain characters that can
 * terminate a CSS declaration/rule or open markup (`; { } < > \`), since values end up
 * inside a `<style>` block in generated HTML.
 */

export const THEME_TOKEN_GROUPS = ['colors', 'fonts', 'radii', 'spacing'] as const;

export type ThemeTokenGroup = (typeof THEME_TOKEN_GROUPS)[number];

/** CSS custom-property prefix per token group. */
export const THEME_TOKEN_CSS_PREFIX: Readonly<Record<ThemeTokenGroup, string>> = Object.freeze({
  colors: '--kb-color-',
  fonts: '--kb-font-',
  radii: '--kb-radius-',
  spacing: '--kb-space-',
});

const THEME_TOKEN_KEY_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/;
const DANGEROUS_THEME_VALUE_PATTERN =
  /javascript:|expression\(|@import|<script|vbscript:|data:text\/html|url\s*\(/i;
const FORBIDDEN_THEME_VALUE_CHARS = /[;{}<>\\]/;
const MAX_THEME_VALUE_LENGTH = 512;

/** True when `key` can be used as a theme token key (and custom-property suffix). */
export function isSafeThemeTokenKey(key: unknown): key is string {
  return typeof key === 'string' && THEME_TOKEN_KEY_PATTERN.test(key);
}

/**
 * True when `value` is safe to emit as a CSS custom-property value. Numbers are allowed
 * (finite only); strings must be short and free of injection vectors.
 */
export function isSafeThemeTokenValue(value: unknown): value is string | number {
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value !== 'string') return false;
  if (value.trim().length === 0 || value.length > MAX_THEME_VALUE_LENGTH) return false;
  if (FORBIDDEN_THEME_VALUE_CHARS.test(value)) return false;
  if (DANGEROUS_THEME_VALUE_PATTERN.test(value)) return false;
  return true;
}

export const ThemeTokenKeySchema = z.string().refine(isSafeThemeTokenKey, {
  message:
    'Theme token key must be 1-64 characters of letters, digits, "-" or "_" (starting with a letter or digit)',
});

export const ThemeTokenValueSchema = z.union([
  z.string().refine((value) => isSafeThemeTokenValue(value), {
    message: 'Theme token value contains a disallowed or unsafe pattern',
  }),
  z
    .number()
    .refine((value) => Number.isFinite(value), { message: 'Theme token value must be finite' }),
]);

export type ThemeTokenValue = z.infer<typeof ThemeTokenValueSchema>;

export const ThemeTokenMapSchema = z.record(ThemeTokenKeySchema, ThemeTokenValueSchema);

export type ThemeTokenMap = Record<string, ThemeTokenValue>;

export const ThemeSchema = z.object({
  colors: ThemeTokenMapSchema.optional(),
  fonts: ThemeTokenMapSchema.optional(),
  radii: ThemeTokenMapSchema.optional(),
  spacing: ThemeTokenMapSchema.optional(),
});

export type Theme = z.infer<typeof ThemeSchema>;

/**
 * Builds the custom-property name for a token, e.g. `('colors', 'primary')` ->
 * `--kb-color-primary`. Returns `null` for unsafe keys.
 */
export function themeTokenCssVarName(group: ThemeTokenGroup, key: string): string | null {
  if (!isSafeThemeTokenKey(key)) return null;
  return `${THEME_TOKEN_CSS_PREFIX[group]}${key}`;
}

/**
 * Builds the style value that references a token, e.g. `var(--kb-color-primary)`.
 * This is the canonical token reference format stored in node styles.
 */
export function themeTokenRef(group: ThemeTokenGroup, key: string): string {
  const name = themeTokenCssVarName(group, key);
  if (!name) {
    throw new Error(`Invalid theme token key "${key}"`);
  }
  return `var(${name})`;
}

const TOKEN_REF_PATTERN =
  /^var\(\s*--kb-(color|font|radius|space)-([a-zA-Z0-9][a-zA-Z0-9_-]*)\s*(?:,[^)]*)?\)$/;
const PREFIX_TO_GROUP: Record<string, ThemeTokenGroup> = {
  color: 'colors',
  font: 'fonts',
  radius: 'radii',
  space: 'spacing',
};

/**
 * Parses a token reference style value back into `{ group, key }`, or `null` when the
 * value is not a theme token reference.
 */
export function parseThemeTokenRef(value: unknown): { group: ThemeTokenGroup; key: string } | null {
  if (typeof value !== 'string') return null;
  const match = TOKEN_REF_PATTERN.exec(value.trim());
  if (!match) return null;
  return { group: PREFIX_TO_GROUP[match[1]], key: match[2] };
}

/**
 * Merges theme layers left-to-right (later layers win per token). Used to apply a host
 * runtime override on top of the document theme without mutating either. Unsafe tokens in
 * any layer are skipped, so an invalid override never clobbers a valid lower-layer value.
 */
export function mergeThemes(...layers: Array<Partial<Theme> | undefined | null>): Theme {
  const merged: Theme = {};
  for (const layer of layers) {
    if (!layer || typeof layer !== 'object') continue;
    for (const group of THEME_TOKEN_GROUPS) {
      const tokens = layer[group];
      if (!tokens || typeof tokens !== 'object') continue;
      for (const [key, value] of Object.entries(tokens)) {
        if (!isSafeThemeTokenKey(key) || !isSafeThemeTokenValue(value)) continue;
        merged[group] = { ...(merged[group] ?? {}), [key]: value };
      }
    }
  }
  return merged;
}

/**
 * Flattens a theme into `[customPropertyName, value]` pairs, silently dropping any
 * token whose key or value is unsafe. Safe to call on unvalidated input (e.g. a host
 * runtime override), which is why it re-checks every entry.
 */
export function themeToCssVariables(
  theme: Partial<Theme> | undefined | null,
): Array<[string, string]> {
  const entries: Array<[string, string]> = [];
  if (!theme || typeof theme !== 'object') return entries;
  for (const group of THEME_TOKEN_GROUPS) {
    const tokens = theme[group];
    if (!tokens || typeof tokens !== 'object') continue;
    for (const [key, value] of Object.entries(tokens)) {
      const name = themeTokenCssVarName(group, key);
      if (!name || !isSafeThemeTokenValue(value)) continue;
      entries.push([
        name,
        typeof value === 'number' && (group === 'radii' || group === 'spacing')
          ? `${value}px`
          : String(value),
      ]);
    }
  }
  return entries;
}

export function isTheme(value: unknown): value is Theme {
  return ThemeSchema.safeParse(value).success;
}
