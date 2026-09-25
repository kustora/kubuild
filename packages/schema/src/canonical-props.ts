/**
 * Canonical prop names for text-bearing components (STORA-550).
 *
 * Historically the renderer accepted several names for the same visible text
 * (`text` / `content`, `text` / `label`, `quote` / `text`, ...). Each component now has
 * exactly one canonical name; the others are deprecated aliases that
 * - the `1.1.0 -> 1.2.0` document migration moves onto the canonical name, and
 * - the renderer still reads (for one minor version) while emitting a
 *   `DEPRECATED_PROP` diagnostic.
 *
 * Pure data, no zod — safe to import from any layer.
 */
export interface CanonicalTextPropRule {
  /** The one prop name authors, templates and the editor should write. */
  canonical: string;
  /** Deprecated names still read for backwards compatibility. */
  aliases: readonly string[];
  /**
   * Order in which the pre-1.2.0 renderer resolved the visible value (first defined
   * wins). The migration uses this so a migrated document renders exactly as before.
   */
  legacyReadOrder: readonly string[];
}

export const CANONICAL_TEXT_PROPS: Readonly<Record<string, CanonicalTextPropRule>> = Object.freeze({
  heading: { canonical: 'text', aliases: ['content'], legacyReadOrder: ['text', 'content'] },
  text: { canonical: 'text', aliases: ['content'], legacyReadOrder: ['text', 'content'] },
  paragraph: { canonical: 'text', aliases: ['content'], legacyReadOrder: ['text', 'content'] },
  link: {
    canonical: 'text',
    aliases: ['label', 'content'],
    legacyReadOrder: ['text', 'label', 'content'],
  },
  badge: { canonical: 'text', aliases: ['label'], legacyReadOrder: ['text', 'label'] },
  blockquote: { canonical: 'text', aliases: ['quote'], legacyReadOrder: ['quote', 'text'] },
  button: {
    canonical: 'label',
    aliases: ['text', 'content'],
    legacyReadOrder: ['label', 'text', 'content'],
  },
});

/** Returns the canonical text prop rule for a component type, if it has one. */
export function getCanonicalTextPropRule(componentType: string): CanonicalTextPropRule | undefined {
  return Object.prototype.hasOwnProperty.call(CANONICAL_TEXT_PROPS, componentType)
    ? CANONICAL_TEXT_PROPS[componentType]
    : undefined;
}

export interface DeprecatedPropUsage {
  /** Alias prop present on the node. */
  propName: string;
  /** Canonical prop name that should be used instead. */
  canonicalName: string;
  /** True when the canonical prop is absent, i.e. the alias is what actually renders. */
  inEffect: boolean;
}

/**
 * Lists deprecated alias props present on a node's props (does not mutate).
 */
export function findDeprecatedPropAliases(
  componentType: string,
  props: Record<string, unknown> | undefined,
): DeprecatedPropUsage[] {
  const rule = getCanonicalTextPropRule(componentType);
  if (!rule || !props) return [];
  const canonicalPresent = props[rule.canonical] !== undefined;
  let aliasInEffect = canonicalPresent;
  const usages: DeprecatedPropUsage[] = [];
  for (const alias of rule.aliases) {
    if (props[alias] === undefined) continue;
    usages.push({ propName: alias, canonicalName: rule.canonical, inEffect: !aliasInEffect });
    aliasInEffect = true;
  }
  return usages;
}
