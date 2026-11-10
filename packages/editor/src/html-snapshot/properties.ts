/**
 * Property catalog for the browser-snapshot style mode (STORA-623).
 *
 * `getComputedStyle` exposes hundreds of longhands; most are defaults, and several
 * (`width`, `height`, `margin-*`, `top`/`left`, grid tracks) return *used* pixel values
 * for one specific viewport. Reading all of them would make the imported document far
 * "fatter" than the static cascade and freeze responsive layouts to one width. The
 * snapshot therefore only reads the curated longhands below; everything else keeps the
 * static-cascade value.
 */

/** Raw computed values for one element at one viewport, keyed by kebab-case CSS longhand. */
export type RawStyleMap = Record<string, string>;

/** Single-key output properties: `key` is the KUBUILD style key, `css` the longhand read. */
export interface SimpleSnapshotProperty {
  key: string;
  css: string;
  /** CSS-inherited property. */
  inherited?: boolean;
  /** Static keys whose presence means the author used a shorthand the snapshot can't reproduce. */
  lockKeys?: readonly string[];
  /** Additional static keys this output replaces (aliases). */
  aliasKeys?: readonly string[];
}

export const SIMPLE_SNAPSHOT_PROPERTIES: readonly SimpleSnapshotProperty[] = [
  { key: 'display', css: 'display' },
  { key: 'position', css: 'position' },
  { key: 'zIndex', css: 'z-index' },
  { key: 'flexDirection', css: 'flex-direction', lockKeys: ['flexFlow'] },
  { key: 'flexWrap', css: 'flex-wrap', lockKeys: ['flexFlow'] },
  { key: 'justifyContent', css: 'justify-content', lockKeys: ['placeContent'] },
  { key: 'alignItems', css: 'align-items', lockKeys: ['placeItems'] },
  { key: 'alignContent', css: 'align-content', lockKeys: ['placeContent'] },
  { key: 'alignSelf', css: 'align-self', lockKeys: ['placeSelf'] },
  { key: 'flexGrow', css: 'flex-grow', lockKeys: ['flex'] },
  { key: 'flexShrink', css: 'flex-shrink', lockKeys: ['flex'] },
  { key: 'flexBasis', css: 'flex-basis', lockKeys: ['flex'] },
  { key: 'order', css: 'order' },
  { key: 'gridAutoFlow', css: 'grid-auto-flow', lockKeys: ['grid'] },
  { key: 'boxSizing', css: 'box-sizing' },
  { key: 'color', css: 'color', inherited: true },
  { key: 'backgroundColor', css: 'background-color', lockKeys: ['background'] },
  { key: 'fontFamily', css: 'font-family', inherited: true, lockKeys: ['font'] },
  { key: 'fontSize', css: 'font-size', inherited: true, lockKeys: ['font'] },
  { key: 'fontWeight', css: 'font-weight', inherited: true, lockKeys: ['font'] },
  { key: 'fontStyle', css: 'font-style', inherited: true, lockKeys: ['font'] },
  { key: 'lineHeight', css: 'line-height', inherited: true, lockKeys: ['font'] },
  { key: 'letterSpacing', css: 'letter-spacing', inherited: true },
  { key: 'textAlign', css: 'text-align', inherited: true },
  { key: 'textTransform', css: 'text-transform', inherited: true },
  { key: 'textDecoration', css: 'text-decoration-line', aliasKeys: ['textDecorationLine'] },
  { key: 'whiteSpace', css: 'white-space', inherited: true },
  { key: 'opacity', css: 'opacity' },
  { key: 'boxShadow', css: 'box-shadow' },
  { key: 'objectFit', css: 'object-fit' },
  { key: 'visibility', css: 'visibility', inherited: true },
  { key: 'maxWidth', css: 'max-width' },
  { key: 'minWidth', css: 'min-width' },
  { key: 'maxHeight', css: 'max-height' },
  { key: 'minHeight', css: 'min-height' },
  { key: 'listStyleType', css: 'list-style-type', inherited: true, lockKeys: ['listStyle'] },
  { key: 'verticalAlign', css: 'vertical-align' },
];

/**
 * Inherited properties that the static pipeline itself propagates to every descendant and
 * the normalizer later strips when equal to the mapped parent (`INHERITED_TEXT_PROPERTIES`
 * in `@kubuild/html-import`). The snapshot mirrors that: these are only dropped when equal
 * to the UA default, so the normalizer sees the same shape it sees in static mode.
 * Other inherited properties are additionally dropped when equal to the parent element.
 */
export const NORMALIZER_STRIPPED_INHERITED_KEYS: ReadonlySet<string> = new Set([
  'color',
  'fontSize',
  'fontFamily',
  'fontWeight',
  'fontStyle',
  'lineHeight',
  'textAlign',
  'letterSpacing',
]);

const SIDES = ['top', 'right', 'bottom', 'left'] as const;
const CORNERS = ['top-left', 'top-right', 'bottom-right', 'bottom-left'] as const;

export const PADDING_LONGHANDS = SIDES.map((s) => `padding-${s}`);
export const RADIUS_LONGHANDS = CORNERS.map((c) => `border-${c}-radius`);
export const BORDER_LONGHANDS = SIDES.flatMap((s) => [
  `border-${s}-width`,
  `border-${s}-style`,
  `border-${s}-color`,
]);
export const GAP_LONGHANDS = ['row-gap', 'column-gap'];
export const OVERFLOW_LONGHANDS = ['overflow-x', 'overflow-y'];

/** Every longhand the snapshot reads via `getComputedStyle().getPropertyValue`. */
export const SNAPSHOT_LONGHANDS: readonly string[] = [
  ...SIMPLE_SNAPSHOT_PROPERTIES.map((p) => p.css),
  // Needed to detect display blockification of absolutely positioned/floated boxes.
  'float',
  ...PADDING_LONGHANDS,
  ...RADIUS_LONGHANDS,
  ...BORDER_LONGHANDS,
  ...GAP_LONGHANDS,
  ...OVERFLOW_LONGHANDS,
];

/** Families of output keys that the snapshot emits from several longhands. */
export type SnapshotFamilyId = 'padding' | 'borderRadius' | 'border' | 'gap' | 'overflow';

/** Output keys a compound family may emit. */
export const FAMILY_OUTPUT_KEYS: Readonly<Record<SnapshotFamilyId, readonly string[]>> = {
  padding: ['padding'],
  borderRadius: ['borderRadius'],
  border: ['border', 'borderTop', 'borderRight', 'borderBottom', 'borderLeft'],
  gap: ['gap'],
  overflow: ['overflow'],
};

/** Returns true when a static style key belongs to a compound family. */
export function staticKeyBelongsToFamily(family: SnapshotFamilyId, key: string): boolean {
  switch (family) {
    case 'padding':
      return key.startsWith('padding');
    case 'borderRadius':
      return /^border.*Radius$/.test(key);
    case 'border':
      return (
        key.startsWith('border') &&
        !/Radius$/.test(key) &&
        !key.startsWith('borderImage') &&
        key !== 'borderCollapse' &&
        key !== 'borderSpacing'
      );
    case 'gap':
      return key === 'gap' || key === 'rowGap' || key === 'columnGap' || /^grid(Row|Column)?Gap$/.test(key);
    case 'overflow':
      return key === 'overflow' || key === 'overflowX' || key === 'overflowY';
  }
}

/** Collapses four side values into the shortest equivalent CSS shorthand value. */
export function collapseFourSides(top: string, right: string, bottom: string, left: string): string {
  if (top === right && right === bottom && bottom === left) return top;
  if (top === bottom && right === left) return `${top} ${right}`;
  if (right === left) return `${top} ${right} ${bottom}`;
  return `${top} ${right} ${bottom} ${left}`;
}

/** Collapses two axis values (`row`/`column`, `x`/`y`) into one shorthand value. */
export function collapseTwo(first: string, second: string): string {
  return first === second ? first : `${first} ${second}`;
}

/** Builds the `border-radius` shorthand from four computed corner values (`h` or `h v`). */
export function collapseRadius(corners: readonly string[]): string {
  const horizontal = corners.map((c) => c.trim().split(/\s+/)[0] ?? '0px');
  const vertical = corners.map((c, i) => c.trim().split(/\s+/)[1] ?? horizontal[i]);
  const h = collapseFourSides(horizontal[0], horizontal[1], horizontal[2], horizontal[3]);
  const elliptical = vertical.some((v, i) => v !== horizontal[i]);
  return elliptical ? `${h} / ${collapseFourSides(vertical[0], vertical[1], vertical[2], vertical[3])}` : h;
}

/** Formats one border side from computed width/style/color (`none` when invisible). */
export function formatBorderSide(raw: RawStyleMap, side: (typeof SIDES)[number]): string {
  const style = (raw[`border-${side}-style`] ?? 'none').trim();
  const width = (raw[`border-${side}-width`] ?? '0px').trim();
  if (style === 'none' || style === 'hidden' || style === '' || parseFloat(width) === 0) {
    return 'none';
  }
  const color = (raw[`border-${side}-color`] ?? '').trim();
  return color ? `${width} ${style} ${color}` : `${width} ${style}`;
}

export const BORDER_SIDES = SIDES;

/**
 * Values that keep authored intent better than a resolved computed value: relative units,
 * math functions, custom properties. When the static cascade declares a property this way,
 * the static value wins over the snapshot (which would freeze it to one viewport's pixels).
 */
const RELATIVE_VALUE_PATTERN =
  /(?:\d(?:em|rem|ex|ch|vw|vh|vmin|vmax|svh|lvh|dvh|svw|lvw|dvw|cqw|cqh|cqi|cqb|%)(?![a-z])|calc\(|clamp\(|min\(|max\(|var\(|env\()/i;

/** Returns true when a static value should be preferred over the measured one. */
export function isAuthoredRelativeValue(key: string, value: unknown): boolean {
  if (value === undefined || value === null) return false;
  const text = String(value).trim();
  if (RELATIVE_VALUE_PATTERN.test(text)) return true;
  // Unitless line-height scales with font-size; computed style resolves it to px.
  if (key === 'lineHeight' && /^\d*\.?\d+$/.test(text)) return true;
  return false;
}
