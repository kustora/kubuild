import { describe, it, expect } from 'vitest';
import { CANONICAL_TEXT_PROPS, findDeprecatedPropAliases, type Node } from '@kubuild/schema';
import { createDefaultComponentRegistry, STARTER_BLOCKS } from '../src/index';

function collectAliasUsages(node: Node, path: string, out: string[]): void {
  for (const usage of findDeprecatedPropAliases(node.type, node.props)) {
    out.push(`${path} (${node.type}#${node.id}): "${usage.propName}" -> "${usage.canonicalName}"`);
  }
  node.children?.forEach((child, index) =>
    collectAliasUsages(child, `${path}.children.${index}`, out),
  );
}

describe('STORA-550: canonical text prop names', () => {
  const registry = createDefaultComponentRegistry();

  it('every text component documents its canonical prop and deprecated aliases on its definition', () => {
    for (const [type, rule] of Object.entries(CANONICAL_TEXT_PROPS)) {
      const definition = registry.get(type);
      expect(definition, `definition for ${type}`).toBeDefined();
      expect(definition!.canonicalTextProp).toBe(rule.canonical);
      expect(definition!.deprecatedPropAliases).toEqual(
        Object.fromEntries(rule.aliases.map((alias) => [alias, rule.canonical])),
      );
      // The canonical name is what the definition itself defaults and edits.
      expect(definition!.defaultProps?.[rule.canonical]).toBeDefined();
      expect(definition!.propFields?.some((field) => field.name === rule.canonical)).toBe(true);
    }
  });

  it('built-in starter blocks only use canonical prop names', () => {
    const usages: string[] = [];
    for (const block of STARTER_BLOCKS) {
      collectAliasUsages(block.createNodeTree(), block.id, usages);
    }
    expect(usages).toEqual([]);
  });
});
