import type { Node, TemplateRecord } from '@kubuild/schema';

/** Minimal registry shape needed for the requirement check. */
export interface TemplateRequirementRegistry {
  has(type: string): boolean;
}

function collectTypes(node: Node, into: Set<string>): void {
  into.add(node.type);
  for (const child of node.children ?? []) collectTypes(child, into);
}

/**
 * Component types a template needs that `registry` does not provide (STORA-536): every
 * declared `requirements.requiredComponents` entry plus any node type actually used in the
 * template's inline document. A template with missing components can't be applied.
 */
export function getMissingTemplateComponents(
  template: Pick<TemplateRecord, 'requirements' | 'document'>,
  registry: TemplateRequirementRegistry,
): string[] {
  const needed = new Set<string>(template.requirements?.requiredComponents ?? []);
  if (template.document?.document) collectTypes(template.document.document, needed);
  return Array.from(needed).filter((type) => !registry.has(type));
}
