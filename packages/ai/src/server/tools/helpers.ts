import type { Node, PageDocument } from '@kubuild/schema';
import { NodeSchema } from '@kubuild/schema';
import {
  collectNodeIdSet,
  findNodeById,
  validateDocumentSecurity,
  type DocumentSecurityLimits,
} from '@kubuild/core';
import type { AiCompiledComponentSpec } from '../../types';
import { normalizeNodeTree } from '../../core/normalizer';
import { getNodeLabel } from '../../core/document-outline';
import type { ToolExecutionResult } from './types';

/**
 * A failed tool call (STORA-530).
 *
 * Failures are deliberately *not* thrown: they're returned to the model as a normal
 * `tool_result` with `ok: false` so it can read the reason, fix its arguments and retry.
 * That self-correction loop is the main reason agent mode beats one-shot JSON generation —
 * a hallucinated node id becomes a retry instead of a broken document.
 */
export function fail(summary: string, message: string, extra?: Record<string, unknown>): ToolExecutionResult {
  return {
    ok: false,
    summary,
    content: { ok: false, error: message, ...(extra ?? {}) },
  };
}

export function succeed(
  summary: string,
  content: Record<string, unknown>,
  rest?: Pick<ToolExecutionResult, 'op' | 'document'>,
): ToolExecutionResult {
  return { ok: true, summary, content: { ok: true, ...content }, ...(rest ?? {}) };
}

/** Reads a required string argument, tolerating the whitespace LLMs sometimes emit. */
export function readString(input: Record<string, unknown>, key: string): string | null {
  const value = input[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export function readPlainObject(
  input: Record<string, unknown>,
  key: string,
): Record<string, unknown> | null {
  const value = input[key];
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export function readOptionalIndex(input: Record<string, unknown>, key: string): number | undefined {
  const value = input[key];
  if (typeof value === 'number' && Number.isInteger(value) && value >= 0) return value;
  return undefined;
}

/**
 * Cheap similarity used only to suggest alternatives when the model invents a node id —
 * shared prefix length plus a substring bonus. Good enough to turn "hero-title" into a
 * pointer at "hero-heading"; no need for a real edit-distance implementation here.
 */
function similarity(a: string, b: string): number {
  if (a === b) return Infinity;
  let shared = 0;
  const max = Math.min(a.length, b.length);
  while (shared < max && a[shared] === b[shared]) shared++;
  return shared + (a.includes(b) || b.includes(a) ? 3 : 0);
}

/** Up to `limit` existing node ids most similar to a bad one, for the retry hint. */
export function suggestNodeIds(document: PageDocument, badId: string, limit = 5): string[] {
  return Array.from(collectNodeIdSet(document.document))
    .map((id) => ({ id, score: similarity(id.toLowerCase(), badId.toLowerCase()) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry) => entry.id);
}

export interface ResolvedNode {
  node: Node;
}

/** Resolves a node id against the snapshot, or returns a retry-friendly failure. */
export function resolveNode(
  document: PageDocument,
  nodeId: string,
  toolName: string,
): { node: Node } | { error: ToolExecutionResult } {
  const node = findNodeById(document.document, nodeId);
  if (!node) {
    return {
      error: fail(
        `${toolName}: node "${nodeId}" not found`,
        `No node with id "${nodeId}" exists in this page. Node ids must come from the outline or from a tool result — never invented.`,
        { suggestedNodeIds: suggestNodeIds(document, nodeId) },
      ),
    };
  }
  return { node };
}

export function findCatalogEntry(
  catalog: AiCompiledComponentSpec[],
  type: string,
): AiCompiledComponentSpec | undefined {
  return catalog.find((entry) => entry.type === type);
}

/**
 * Enforces the registry's nesting contract before an insert/move (STORA-530).
 *
 * The same `acceptsChildren`/`allowedChildren` rules the prompt states are checked here,
 * because a prompt rule is a suggestion while a tool check is a guarantee — and a document
 * that violates them renders wrong rather than failing loudly.
 *
 * An empty catalog (host supplied no registry) means "unknown", so nesting is allowed
 * rather than blocking every insert.
 */
export function checkNesting(
  catalog: AiCompiledComponentSpec[],
  parent: Node,
  childType: string,
): string | null {
  if (catalog.length === 0) return null;

  const parentSpec = findCatalogEntry(catalog, parent.type);
  if (parentSpec && !parentSpec.acceptsChildren) {
    return `Component "${parent.type}" (#${parent.id}) cannot contain children. Insert into a container/section node instead.`;
  }
  if (parentSpec?.allowedChildren && parentSpec.allowedChildren.length > 0) {
    if (!parentSpec.allowedChildren.includes(childType)) {
      return `Component "${parent.type}" only accepts children of type [${parentSpec.allowedChildren.join(', ')}] — "${childType}" is not allowed.`;
    }
  }

  const childSpec = findCatalogEntry(catalog, childType);
  if (childSpec?.disallowedParents?.includes(parent.type)) {
    return `Component "${childType}" cannot be placed inside "${parent.type}".`;
  }

  return null;
}

/** Validates a component type against the catalog, returning a retry hint when unknown. */
export function checkComponentType(
  catalog: AiCompiledComponentSpec[],
  type: string,
): string | null {
  if (catalog.length === 0) return null;
  if (findCatalogEntry(catalog, type)) return null;
  const known = catalog.map((entry) => entry.type);
  return `Unknown component type "${type}". Use list_component_types to see valid types. Known types: ${known.slice(0, 40).join(', ')}${known.length > 40 ? ', …' : ''}`;
}

/**
 * The defense-in-depth gate every write tool passes through before its op is accepted —
 * the same `validateDocumentSecurity` pass `normalizeAndValidate*` already applies to
 * generated documents, now applied per mutation so a single bad tool call can't smuggle
 * a `javascript:` href or a prototype-pollution key into the snapshot.
 */
export function checkDocumentSecurity(
  document: PageDocument,
  limits?: DocumentSecurityLimits,
): string | null {
  const result = validateDocumentSecurity(document, limits);
  if (result.safe) return null;
  return result.errors.map((error) => `${error.code}: ${error.message}`).join('; ');
}

/**
 * Normalizes a model-authored node and guarantees its ids don't collide with the snapshot
 * (`insertNode` in `@kubuild/core` throws on duplicate ids). Reuses the shared
 * `normalizeNodeTree` so agent-authored nodes get the same prop/style coercions as nodes
 * from full-page generation.
 */
export function normalizeIncomingNode(
  raw: unknown,
  document: PageDocument,
  options: { preserveIds?: boolean } = {},
): { node: Node } | { error: string } {
  let normalized: Node;
  try {
    normalized = normalizeNodeTree(raw);
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }

  if (!options.preserveIds) {
    const taken = collectNodeIdSet(document.document);
    const reassign = (node: Node): void => {
      if (!node.id || taken.has(node.id)) {
        let counter = 1;
        let candidate = `${node.type}-${counter}`;
        while (taken.has(candidate)) {
          counter++;
          candidate = `${node.type}-${counter}`;
        }
        node.id = candidate;
      }
      taken.add(node.id);
      for (const child of node.children ?? []) reassign(child);
    };
    reassign(normalized);
  }

  const parsed = NodeSchema.safeParse(normalized);
  if (!parsed.success) {
    return {
      error: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
    };
  }

  return { node: parsed.data };
}

/** Short human description of a node for tool summaries / op labels. */
export function describeNode(node: Node): string {
  const label = getNodeLabel(node, 32);
  return label ? `${node.type} "${label}" (#${node.id})` : `${node.type} (#${node.id})`;
}
