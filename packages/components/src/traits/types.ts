/**
 * Trait metadata (STORA-210).
 *
 * A **trait** is a *functional* prop — it carries behavior, semantics, or
 * identity rather than pure visual styling. Examples: `href`, `target`, `alt`,
 * `title`, `placeholder`, `aria-label`, and a custom `id`.
 */

/** The primitive data types a trait value can take. */
export type TraitType = 'string' | 'number' | 'boolean' | 'select';

/** A constrained choice for `select`-typed traits. */
export interface TraitOption {
  label: string;
  value: unknown;
}

/**
 * Logical grouping used to organize traits in an inspector UI. Kept as a
 * closed union so hosts can render a stable, ordered set of trait sections.
 */
export type TraitGroup =
  | 'link'
  | 'media'
  | 'form'
  | 'accessibility'
  | 'identity'
  | 'behavior'
  | 'semantic';

/** Ordered display order for trait groups in an inspector. */
export const TRAIT_GROUP_ORDER: TraitGroup[] = [
  'identity',
  'link',
  'media',
  'form',
  'behavior',
  'semantic',
  'accessibility',
];

/** Human-readable labels for each trait group. */
export const TRAIT_GROUP_LABELS: Record<TraitGroup, string> = {
  identity: 'Identity',
  link: 'Link',
  media: 'Media',
  form: 'Form',
  behavior: 'Behavior',
  semantic: 'Semantic',
  accessibility: 'Accessibility',
};

/**
 * Metadata describing a single functional trait on a component.
 *
 * `name` is the prop key on the node's `props` object; `attribute` is the HTML
 * attribute it maps to at render time (when they differ, e.g. `name` → `id`).
 */
export interface ComponentTraitDefinition {
  /** Prop key on the node's `props` object (e.g. `'href'`, `'alt'`). */
  name: string;
  /** Human-readable label shown in the inspector. */
  label: string;
  /** Data type of the trait value. */
  type: TraitType;
  /** Default value applied when the trait is not set. */
  defaultValue?: unknown;
  /** Constrained choices for `select`-typed traits. */
  options?: TraitOption[];
  /** Short description of the trait's purpose. */
  description?: string;
  /** The HTML attribute this trait maps to at render time (e.g. `'href'`). */
  attribute?: string;
  /** Whether the trait must be present for the component to be valid. */
  required?: boolean;
  /** Logical grouping for inspector organization. */
  group?: TraitGroup;
}

/** Convenience alias for a list of trait definitions. */
export type ComponentTraits = ComponentTraitDefinition[];

/**
 * Merge helper: applies partial overrides on top of a base trait definition.
 * Used by the factories below so callers can tweak label/default/group without
 * repeating the full shape.
 */
export function withOverrides(
  base: ComponentTraitDefinition,
  overrides?: Partial<ComponentTraitDefinition>,
): ComponentTraitDefinition {
  return overrides ? { ...base, ...overrides } : base;
}

/**
 * Sort a component's traits into a stable, inspector-friendly order:
 * identity first, then the remaining groups in `TRAIT_GROUP_ORDER`, with
 * ungrouped traits last. Preserves relative order within each group.
 */
export function sortTraits(traits: ComponentTraits): ComponentTraits {
  const groupRank = (group?: TraitGroup): number => {
    if (!group) return Number.MAX_SAFE_INTEGER;
    const idx = TRAIT_GROUP_ORDER.indexOf(group);
    return idx === -1 ? Number.MAX_SAFE_INTEGER : idx;
  };
  return [...traits].sort((a, b) => groupRank(a.group) - groupRank(b.group));
}

/**
 * Collect the union of all trait names declared across a set of component
 * definitions. Useful for building a global trait catalog / search index.
 */
export function collectTraitNames(traitsList: ComponentTraits[]): string[] {
  const names = new Set<string>();
  for (const traits of traitsList) {
    for (const trait of traits) {
      names.add(trait.name);
    }
  }
  return Array.from(names);
}

