/**
 * Template and Expression Variable Interpolator
 *
 * Provides safe, deterministic resolution and interpolation of template strings
 * like `{{form.email}}`, `{{variables.token}}`, and `{{response.data.id}}` into
 * targets without using eval() or Function().
 */

/**
 * Segments a path must never traverse into, preventing prototype pollution
 * and unauthorized object introspection.
 */
const FORBIDDEN_KEY_SEGMENTS = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * Regex matching `{{ expression }}` template placeholders.
 */
const TEMPLATE_EXPRESSION_REGEX = /\{\{\s*([a-zA-Z0-9_$.,\-[\]\s]+?)\s*\}\}/g;

/**
 * Regex matching an exact single `{{ expression }}` placeholder without surrounding text.
 */
const EXACT_TEMPLATE_REGEX = /^\{\{\s*([a-zA-Z0-9_$.,\-[\]\s]+?)\s*\}\}$/;

/**
 * Standard structured runtime context for interpolations.
 */
export interface InterpolationContext {
  form?: Record<string, unknown>;
  variables?: Record<string, unknown>;
  response?: Record<string, unknown>;
  state?: Record<string, unknown>;
  [key: string]: unknown;
}

/**
 * Checks if a string contains one or more `{{ ... }}` template expressions.
 */
export function hasTemplateExpressions(text: unknown): boolean {
  if (typeof text !== 'string') return false;
  return /\{\{\s*[\s\S]+?\s*\}\}/.test(text);
}

/**
 * Extracts all unique property keys / variable paths referenced inside `{{ ... }}`.
 */
export function extractTemplateVariables(text: string): string[] {
  if (!text || typeof text !== 'string') return [];
  const matches: string[] = [];
  const regex = new RegExp(TEMPLATE_EXPRESSION_REGEX.source, 'g');
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match[1]) {
      const trimmed = match[1].trim();
      if (trimmed && !matches.includes(trimmed)) {
        matches.push(trimmed);
      }
    }
  }

  return matches;
}

/**
 * Safely traverses a nested data source to resolve a dot/bracket path
 * (e.g. `form.user.profile.name`, `response.data[0].id`, `items.0.title`).
 *
 * Returns `fallback` if any segment is missing, undefined, null, or points to
 * a function or forbidden prototype property.
 */
export function resolvePropertyPath(
  source: unknown,
  path: string,
  fallback: unknown = '',
): unknown {
  if (!path || typeof path !== 'string' || source === null || source === undefined) {
    return fallback;
  }

  // Normalize bracket notations: `items[0]` -> `items.0`
  const normalizedPath = path.replace(/\[(\d+)\]/g, '.$1');
  const segments = normalizedPath.split('.').map((s) => s.trim()).filter(Boolean);

  if (segments.length === 0) {
    return fallback;
  }

  let current: unknown = source;

  for (const segment of segments) {
    if (FORBIDDEN_KEY_SEGMENTS.has(segment)) {
      return fallback;
    }
    if (current === null || current === undefined) {
      return fallback;
    }
    if (typeof current !== 'object') {
      return fallback;
    }

    if (Array.isArray(current)) {
      const index = Number(segment);
      if (!Number.isInteger(index) || index < 0 || index >= current.length) {
        return fallback;
      }
      current = current[index];
    } else if (Object.prototype.hasOwnProperty.call(current, segment)) {
      current = (current as Record<string, unknown>)[segment];
    } else {
      return fallback;
    }
  }

  if (current === undefined || typeof current === 'function') {
    return fallback;
  }

  return current;
}

/**
 * Interpolates all `{{ path }}` placeholders in a template string using values
 * from the provided context object.
 *
 * If a variable cannot be resolved, it replaces it with `fallback` (default: `""`).
 */
export function interpolateTemplateString(
  template: string,
  context?: Record<string, unknown>,
  fallback: string = '',
): string {
  if (!template || typeof template !== 'string') return '';
  if (!hasTemplateExpressions(template)) return template;

  return template.replace(/\{\{\s*([a-zA-Z0-9_$.,\-[\]\s]+?)\s*\}\}/g, (_match, rawKey) => {
    const key = rawKey.trim();
    if (!key) return fallback;

    const resolved = resolvePropertyPath(context, key, fallback);
    if (resolved === undefined || resolved === null) {
      return fallback;
    }
    if (typeof resolved === 'object') {
      try {
        return JSON.stringify(resolved);
      } catch {
        return fallback;
      }
    }
    return String(resolved);
  });
}

/**
 * Recursively interpolates any value (string, object, array, primitive).
 *
 * - If string is exactly `{{ path }}`, returns the raw resolved value (retaining type: number, boolean, object, array).
 * - If string contains embedded templates (e.g. `Bearer {{token}}`), returns the interpolated string.
 * - If array, interpolates every element.
 * - If object, interpolates every property value while stripping forbidden prototype keys.
 */
export function interpolateValue(value: unknown, context?: Record<string, unknown>): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    const exactMatch = EXACT_TEMPLATE_REGEX.exec(trimmed);
    if (exactMatch && exactMatch[1]) {
      const key = exactMatch[1].trim();
      return resolvePropertyPath(context, key, '');
    }
    return interpolateTemplateString(value, context);
  }

  if (Array.isArray(value)) {
    return value.map((item) => interpolateValue(item, context));
  }

  if (typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (!FORBIDDEN_KEY_SEGMENTS.has(k)) {
        result[k] = interpolateValue(v, context);
      }
    }
    return result;
  }

  return value;
}
