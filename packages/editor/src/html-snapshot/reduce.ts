/**
 * Pure diff/strip logic for the browser-snapshot style mode (STORA-623).
 *
 * Input: raw `getComputedStyle` values of one element at the three snapshot viewports plus
 * the UA-default values of the same tag measured in an author-style-free document.
 * Output: a minimal KUBUILD layer set (`base` + disjoint `desktop`/`tablet`/`mobile`
 * deltas), merged into the static cascade result of `@kubuild/html-import`.
 *
 * Nothing here touches the DOM, so it is unit-testable in Node.
 */

import { BREAKPOINT_MEDIA_QUERIES, BREAKPOINT_ORDER, type BreakpointName } from '@kubuild/schema';
import type { ComputedElementStyles } from '@kubuild/html-import';
import {
  BORDER_SIDES,
  FAMILY_OUTPUT_KEYS,
  NORMALIZER_STRIPPED_INHERITED_KEYS,
  PADDING_LONGHANDS,
  RADIUS_LONGHANDS,
  SIMPLE_SNAPSHOT_PROPERTIES,
  collapseFourSides,
  collapseRadius,
  collapseTwo,
  formatBorderSide,
  isAuthoredRelativeValue,
  staticKeyBelongsToFamily,
  type RawStyleMap,
  type SnapshotFamilyId,
} from './properties.js';

/** Measurements of one sanitized source element. */
export interface ElementSnapshot {
  /** Lower-case tag name, used to guard against path mismatches. */
  tagName: string;
  /** Path (see `getElementPath`) of the parent element, when it was measured too. */
  parentPath?: string;
  /** Raw computed longhands per snapshot viewport. */
  computed: Partial<Record<BreakpointName, RawStyleMap>>;
  /** UA-default computed longhands for the same tag without author styles. */
  reference: RawStyleMap;
}

/** All measurements of one HTML input, keyed by element path. */
export interface BrowserSnapshot {
  /** Viewport width (CSS px) used for each breakpoint. */
  widths: Record<BreakpointName, number>;
  elements: Map<string, ElementSnapshot>;
}

/** Snapshot styles split into KUBUILD layers (all values are strings). */
export interface SnapshotLayers {
  base: Record<string, string>;
  desktop: Record<string, string>;
  tablet: Record<string, string>;
  mobile: Record<string, string>;
}

interface SnapshotValue {
  value: string;
  isDefault: boolean;
}

const BLOCKIFIED_DISPLAY: Readonly<Record<string, string>> = {
  inline: 'block',
  'inline-block': 'block',
  'inline-flex': 'flex',
  'inline-grid': 'grid',
  'inline-table': 'table',
  'inline flow': 'block flow',
  'inline flow-root': 'block flow-root',
};

function blockify(display: string): string {
  return BLOCKIFIED_DISPLAY[display] ?? display;
}

function isFlexOrGridContainer(display: string | undefined): boolean {
  if (!display) return false;
  return /(?:^|\s)(?:inline-)?(?:flex|grid)(?:$|\s)/.test(display);
}

/**
 * `display` is "default" when it equals the UA default, or the UA default after the
 * blockification CSS applies to flex/grid items and absolutely positioned/floated boxes.
 * Static mode never sees blockified values, so emitting them would only add weight.
 */
function isDefaultDisplay(value: string, raw: RawStyleMap, ref: RawStyleMap, parent?: RawStyleMap): boolean {
  const refValue = ref['display'];
  if (refValue === undefined) return false;
  if (value === refValue) return true;
  const blockified =
    isFlexOrGridContainer(parent?.['display']) ||
    raw['position'] === 'absolute' ||
    raw['position'] === 'fixed' ||
    (raw['float'] !== undefined && raw['float'] !== 'none');
  return blockified && blockify(refValue) === value;
}

function fourValues(raw: RawStyleMap, props: readonly string[]): string[] | undefined {
  const values = props.map((p) => raw[p]);
  return values.every((v) => typeof v === 'string' && v !== '') ? (values as string[]) : undefined;
}

/**
 * Extracts output keys and their default flags for one viewport.
 * Border sides are returned under `borderTop`/`borderRight`/... and combined later.
 */
export function extractSnapshotValues(
  raw: RawStyleMap,
  ref: RawStyleMap,
  parent?: RawStyleMap,
): Map<string, SnapshotValue> {
  const out = new Map<string, SnapshotValue>();

  for (const prop of SIMPLE_SNAPSHOT_PROPERTIES) {
    const value = raw[prop.css];
    if (value === undefined || value === '') continue;
    let isDefault: boolean;
    if (prop.key === 'display') {
      isDefault = isDefaultDisplay(value, raw, ref, parent);
    } else {
      isDefault = value === ref[prop.css];
    }
    if (
      !isDefault &&
      prop.inherited &&
      !NORMALIZER_STRIPPED_INHERITED_KEYS.has(prop.key) &&
      parent?.[prop.css] === value
    ) {
      // Plain inheritance from the parent: the value lives on the ancestor that set it.
      isDefault = true;
    }
    out.set(prop.key, { value, isDefault });
  }

  const padding = fourValues(raw, PADDING_LONGHANDS);
  if (padding) {
    const value = collapseFourSides(padding[0], padding[1], padding[2], padding[3]);
    const refPadding = fourValues(ref, PADDING_LONGHANDS);
    const refValue = refPadding
      ? collapseFourSides(refPadding[0], refPadding[1], refPadding[2], refPadding[3])
      : undefined;
    out.set('padding', { value, isDefault: value === refValue });
  }

  const radius = fourValues(raw, RADIUS_LONGHANDS);
  if (radius) {
    const value = collapseRadius(radius);
    const refRadius = fourValues(ref, RADIUS_LONGHANDS);
    out.set('borderRadius', { value, isDefault: refRadius ? value === collapseRadius(refRadius) : false });
  }

  if (raw['row-gap'] && raw['column-gap']) {
    const value = collapseTwo(raw['row-gap'], raw['column-gap']);
    const refValue =
      ref['row-gap'] && ref['column-gap'] ? collapseTwo(ref['row-gap'], ref['column-gap']) : undefined;
    out.set('gap', { value, isDefault: value === refValue });
  }

  if (raw['overflow-x'] && raw['overflow-y']) {
    const value = collapseTwo(raw['overflow-x'], raw['overflow-y']);
    const refValue =
      ref['overflow-x'] && ref['overflow-y'] ? collapseTwo(ref['overflow-x'], ref['overflow-y']) : undefined;
    out.set('overflow', { value, isDefault: value === refValue });
  }

  for (const side of BORDER_SIDES) {
    if (raw[`border-${side}-style`] === undefined) continue;
    const value = formatBorderSide(raw, side);
    const refValue = ref[`border-${side}-style`] !== undefined ? formatBorderSide(ref, side) : 'none';
    const key = `border${side[0].toUpperCase()}${side.slice(1)}`;
    out.set(key, { value, isDefault: value === refValue });
  }

  return out;
}

const SIDE_KEYS = ['borderTop', 'borderRight', 'borderBottom', 'borderLeft'] as const;

/**
 * Uses the single `border` shorthand when all four sides are identical at every viewport;
 * otherwise keeps the per-side keys.
 */
function combineBorders(perBreakpoint: Map<BreakpointName, Map<string, SnapshotValue>>): void {
  let uniform = true;
  for (const values of perBreakpoint.values()) {
    const sides = SIDE_KEYS.map((k) => values.get(k));
    if (sides.some((s) => !s) || sides.some((s) => s!.value !== sides[0]!.value || s!.isDefault !== sides[0]!.isDefault)) {
      uniform = false;
      break;
    }
  }
  if (!uniform) return;
  for (const values of perBreakpoint.values()) {
    const top = values.get('borderTop');
    for (const k of SIDE_KEYS) values.delete(k);
    if (top) values.set('border', top);
  }
}

/**
 * Turns per-viewport measurements of one element into a minimal layer set.
 *
 * For every output key the base value is the one shared by most viewports (ties go to the
 * widest viewport), defaults are omitted from `base`, and each breakpoint layer only stores
 * values that differ from base. KUBUILD layers are disjoint (`mobile` = base + mobile), so no
 * layer needs to undo another breakpoint's override.
 */
export function reduceElementSnapshot(
  element: ElementSnapshot,
  parent?: ElementSnapshot,
): SnapshotLayers {
  const layers: SnapshotLayers = { base: {}, desktop: {}, tablet: {}, mobile: {} };
  const perBreakpoint = new Map<BreakpointName, Map<string, SnapshotValue>>();
  for (const bp of BREAKPOINT_ORDER) {
    const raw = element.computed[bp];
    if (!raw) continue;
    perBreakpoint.set(bp, extractSnapshotValues(raw, element.reference, parent?.computed[bp]));
  }
  if (perBreakpoint.size === 0) return layers;
  combineBorders(perBreakpoint);

  const keys = new Set<string>();
  for (const values of perBreakpoint.values()) for (const k of values.keys()) keys.add(k);

  for (const key of keys) {
    const entries: Array<[BreakpointName, SnapshotValue]> = [];
    for (const [bp, values] of perBreakpoint) {
      const entry = values.get(key);
      if (entry) entries.push([bp, entry]);
    }
    if (entries.length === 0) continue;

    // Majority value; the first entry (widest viewport) wins ties.
    const counts = new Map<string, number>();
    for (const [, e] of entries) counts.set(e.value, (counts.get(e.value) ?? 0) + 1);
    let chosen = entries[0][1];
    for (const [, e] of entries) {
      if ((counts.get(e.value) ?? 0) > (counts.get(chosen.value) ?? 0)) chosen = e;
    }

    if (!chosen.isDefault) layers.base[key] = chosen.value;
    for (const [bp, e] of entries) {
      if (e.value === chosen.value) continue;
      // Base keeps the default (omitted) and this viewport is also at a default: nothing to say.
      if (chosen.isDefault && e.isDefault) continue;
      layers[bp][key] = e.value;
    }
  }

  return layers;
}

/** A unit of ownership between static and snapshot styles. */
interface OwnershipGroup {
  outputKeys: readonly string[];
  ownsStaticKey: (key: string) => boolean;
  lockKeys: readonly string[];
}

const OWNERSHIP_GROUPS: readonly OwnershipGroup[] = [
  ...SIMPLE_SNAPSHOT_PROPERTIES.map((p): OwnershipGroup => {
    const staticKeys = new Set([p.key, ...(p.aliasKeys ?? [])]);
    return {
      outputKeys: [p.key],
      ownsStaticKey: (k) => staticKeys.has(k),
      lockKeys: p.lockKeys ?? [],
    };
  }),
  ...(Object.keys(FAMILY_OUTPUT_KEYS) as SnapshotFamilyId[]).map(
    (family): OwnershipGroup => ({
      outputKeys: FAMILY_OUTPUT_KEYS[family],
      ownsStaticKey: (k) => staticKeyBelongsToFamily(family, k),
      lockKeys: [],
    }),
  ),
];

/**
 * Merges snapshot layers into the static cascade result of one element.
 *
 * Per ownership group (a property, or a shorthand family such as padding/border):
 * - The static result wins when the author used a shorthand the snapshot can't reproduce
 *   (e.g. `font`, `flex`, `background`) or a relative/dynamic value (`rem`, `%`, `clamp()`,
 *   `var()`...), which a computed pixel value would freeze to one viewport.
 * - Otherwise the snapshot wins and the static declarations of that group are removed from
 *   every layer, so the group is never represented twice.
 * Properties outside the snapshot catalog (width, margin, grid tracks, background images,
 * transforms...) and pseudo-states (`:hover`) always keep their static values.
 */
export function mergeSnapshotIntoComputed(
  computed: ComputedElementStyles,
  layers: SnapshotLayers,
): ComputedElementStyles {
  const staticLayers: Array<Record<string, string | number>> = [
    computed.base,
    ...computed.mediaQueries.map((m) => m.styles),
  ];
  const snapshot: SnapshotLayers = {
    base: { ...layers.base },
    desktop: { ...layers.desktop },
    tablet: { ...layers.tablet },
    mobile: { ...layers.mobile },
  };
  const removedStaticKeys = new Set<string>();

  for (const group of OWNERSHIP_GROUPS) {
    let staticWins = false;
    for (const layer of staticLayers) {
      for (const [key, value] of Object.entries(layer)) {
        if (group.lockKeys.includes(key)) staticWins = true;
        else if (group.ownsStaticKey(key) && isAuthoredRelativeValue(key, value)) staticWins = true;
      }
    }
    if (staticWins) {
      for (const layer of Object.values(snapshot)) {
        for (const k of group.outputKeys) delete layer[k];
      }
    } else {
      for (const layer of staticLayers) {
        for (const key of Object.keys(layer)) {
          if (group.ownsStaticKey(key)) removedStaticKeys.add(key);
        }
      }
    }
  }

  const strip = (styles: Record<string, string | number>): Record<string, string | number> => {
    const next: Record<string, string | number> = {};
    for (const [k, v] of Object.entries(styles)) if (!removedStaticKeys.has(k)) next[k] = v;
    return next;
  };

  const mediaQueries = computed.mediaQueries
    .map((m) => ({ query: m.query, styles: strip(m.styles) }))
    .filter((m) => Object.keys(m.styles).length > 0);
  for (const bp of BREAKPOINT_ORDER) {
    if (Object.keys(snapshot[bp]).length > 0) {
      mediaQueries.push({ query: BREAKPOINT_MEDIA_QUERIES[bp], styles: snapshot[bp] });
    }
  }

  return {
    base: { ...strip(computed.base), ...snapshot.base },
    mediaQueries,
    pseudoStates: computed.pseudoStates,
  };
}
