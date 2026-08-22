import { Node } from '@kubuild/schema';
import { ComponentRegistry } from './registry';

export interface ComponentRequirements {
  requiredComponents: string[];
  requiredCapabilities: string[];
}

/**
 * Walks a node tree and extracts the custom component types and runtime
 * capabilities it depends on, in the shape expected by `@kubuild/schema`'s
 * `ManifestSchema` (`requiredComponents`/`requiredCapabilities`).
 *
 * Built-in/core component types are never listed in `requiredComponents` —
 * they ship with `kubuild` and are always available. Only types whose
 * registered definition has `category: 'custom'` are considered a real
 * requirement a host must satisfy before it can render/import the document.
 */
export function extractComponentRequirements(
  root: Node,
  registry: ComponentRegistry,
): ComponentRequirements {
  const requiredComponents = new Set<string>();
  const requiredCapabilities = new Set<string>();

  const visit = (node: Node): void => {
    const definition = registry.get(node.type);

    if (definition?.category === 'custom') {
      requiredComponents.add(node.type);
    }
    for (const capability of definition?.capabilities ?? []) {
      requiredCapabilities.add(capability);
    }

    node.children?.forEach(visit);
  };

  visit(root);

  return {
    requiredComponents: Array.from(requiredComponents),
    requiredCapabilities: Array.from(requiredCapabilities),
  };
}
