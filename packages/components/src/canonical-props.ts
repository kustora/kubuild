import { getCanonicalTextPropRule } from '@kubuild/schema';
import type { ComponentDefinition } from './registry';

/**
 * Definition fields documenting a component's canonical text prop and its deprecated
 * aliases (STORA-550), derived from `CANONICAL_TEXT_PROPS` so definitions, migration and
 * renderer can never disagree.
 */
export function canonicalTextPropFields(
  componentType: string,
): Pick<ComponentDefinition, 'canonicalTextProp' | 'deprecatedPropAliases'> {
  const rule = getCanonicalTextPropRule(componentType);
  if (!rule) return {};
  return {
    canonicalTextProp: rule.canonical,
    deprecatedPropAliases: Object.fromEntries(rule.aliases.map((alias) => [alias, rule.canonical])),
  };
}
