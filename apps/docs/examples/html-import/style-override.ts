import {
  getElementPath,
  importHtml,
  type ComputedElementStyles,
  type HtmlStyleOverride,
} from '@kubuild/html-import';

/**
 * Styles measured elsewhere (a headless browser, a design tool export, …), keyed by the
 * structural element path `getElementPath` produces, e.g. `html:0/body:1/section:0/h1:0`.
 */
type MeasuredStyles = Map<string, Partial<ComputedElementStyles>>;

export function createMeasuredStyleOverride(measured: MeasuredStyles): HtmlStyleOverride {
  return (element, computed) => {
    const match = measured.get(getElementPath(element));
    // Returning undefined keeps the static cascade for this element.
    if (!match) return undefined;
    return {
      base: { ...computed.base, ...match.base },
      mediaQueries: [...computed.mediaQueries, ...(match.mediaQueries ?? [])],
      pseudoStates: computed.pseudoStates, // keep :hover/:focus from the static cascade
    };
  };
}

export async function importWithMeasuredStyles(html: string, measured: MeasuredStyles) {
  // The hook runs synchronously for every element; if it throws, that element
  // silently falls back to its static styles.
  return importHtml(html, { styleOverride: createMeasuredStyleOverride(measured) });
}
