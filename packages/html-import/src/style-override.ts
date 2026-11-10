/**
 * @kubuild/html-import
 * Optional hook for externally computed element styles (STORA-623).
 *
 * The static cascade (`computeElementStyles`) is the default and only style source in
 * Node. A host that can measure styles some other way (e.g. the editor's browser-snapshot
 * mode, which reads `getComputedStyle` from an inert, script-less iframe) passes
 * `HtmlImportOptions.styleOverride` to replace or refine the static result per element.
 * This module stays DOM-free: it only routes the static result through the hook.
 */

import type { DefaultTreeAdapterMap } from 'parse5';
import type { HtmlImportOptions, HtmlImportReport } from './types.js';
import { computeElementStyles, type ComputedElementStyles, type Parse5Element } from './cascade.js';
import type { ParsedStylesheetBundle } from './stylesheet.js';

/**
 * Computes the static cascade of `element`, then lets `options.styleOverride` replace it.
 * A missing hook, a hook returning `null`/`undefined`, or a hook that throws all fall back
 * to the static result, so behavior without the hook is unchanged.
 */
export function computeElementStylesWithOverride(
  element: Parse5Element,
  bundle: ParsedStylesheetBundle,
  parentStyles: Record<string, string | number> | undefined,
  report: HtmlImportReport | undefined,
  options: HtmlImportOptions | undefined,
): ComputedElementStyles {
  const computed = computeElementStyles(element, bundle, parentStyles, report);
  const override = options?.styleOverride;
  if (typeof override !== 'function') return computed;
  try {
    const replaced = override(element, computed);
    return replaced && typeof replaced === 'object' ? replaced : computed;
  } catch {
    return computed;
  }
}

/**
 * Returns a deterministic structural path for a parse5 element, e.g.
 * `html:0/body:1/div:0/p:2` (tag name plus index among the parent's element children).
 *
 * Two parses of the same input with the same options (and the same sanitization) yield the
 * same paths, which lets an external style provider key its measurements by element.
 */
export function getElementPath(element: Parse5Element): string {
  const segments: string[] = [];
  let current: DefaultTreeAdapterMap['node'] | null = element;
  while (current && 'tagName' in current && typeof current.tagName === 'string') {
    const parent: DefaultTreeAdapterMap['parentNode'] | null = current.parentNode ?? null;
    let index = 0;
    if (parent && 'childNodes' in parent) {
      for (const sibling of parent.childNodes) {
        if (sibling === current) break;
        if ('tagName' in sibling && typeof sibling.tagName === 'string') index++;
      }
    }
    segments.push(`${current.tagName.toLowerCase()}:${index}`);
    current = parent as DefaultTreeAdapterMap['node'] | null;
  }
  return segments.reverse().join('/');
}
