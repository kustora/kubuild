import type { Node, StyleDefinition } from '@kubuild/schema';
import type { AiRefactorNodeRequest } from '@kubuild/ai';
import { normalizeAndValidateRefactoredNode } from '@kubuild/ai';
import type { DocumentSecurityLimits } from '@kubuild/core';

/**
 * STORA-513 — one changed prop/style/state field between the original node and an AI
 * enhance candidate. `path` is a dotted pointer such as `props.label`,
 * `styles.base.color`, or `styles.states.:hover.color` — used to render a targeted diff
 * line instead of a full object dump (explicitly disallowed by the ticket).
 */
export interface EnhanceFieldDiff {
  path: string;
  before: unknown;
  after: unknown;
}

export interface EnhanceNodeDiff {
  fields: EnhanceFieldDiff[];
  /**
   * True when the candidate's `children` subtree differs structurally from the
   * original (not just a props/styles tweak) — e.g. the AI regenerated nested content.
   * `updateNodeProps`/`updateNodeStyle` can't express this; Apply (STORA-514) falls back
   * to the `replaceNode` command engine command when this is true.
   */
  childrenChanged: boolean;
}

function isEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

/**
 * STORA-513 — pure diff between an original node and a validated AI enhance candidate.
 * Only ever surfaces props/styles(+pseudo-state) fields that actually changed, plus a
 * coarse `childrenChanged` flag — never a full node dump.
 */
export function diffEnhanceNode(original: Node, candidate: Node): EnhanceNodeDiff {
  const fields: EnhanceFieldDiff[] = [];

  const beforeProps = original.props ?? {};
  const afterProps = candidate.props ?? {};
  const propKeys = new Set([...Object.keys(beforeProps), ...Object.keys(afterProps)]);
  for (const key of propKeys) {
    const before = beforeProps[key];
    const after = afterProps[key];
    if (!isEqual(before, after)) {
      fields.push({ path: `props.${key}`, before, after });
    }
  }

  const breakpoints = ['base', 'desktop', 'tablet', 'mobile'] as const;
  for (const bp of breakpoints) {
    const beforeBp = (original.styles?.[bp] as StyleDefinition | undefined) ?? {};
    const afterBp = (candidate.styles?.[bp] as StyleDefinition | undefined) ?? {};
    const keys = new Set([...Object.keys(beforeBp), ...Object.keys(afterBp)]);
    for (const key of keys) {
      if (!isEqual(beforeBp[key], afterBp[key])) {
        fields.push({ path: `styles.${bp}.${key}`, before: beforeBp[key], after: afterBp[key] });
      }
    }
  }

  const beforeStates = original.styles?.states ?? {};
  const afterStates = candidate.styles?.states ?? {};
  const stateKeys = new Set([...Object.keys(beforeStates), ...Object.keys(afterStates)]);
  for (const stateKey of stateKeys) {
    const beforeState = (beforeStates as Record<string, StyleDefinition>)[stateKey] ?? {};
    const afterState = (afterStates as Record<string, StyleDefinition>)[stateKey] ?? {};
    const keys = new Set([...Object.keys(beforeState), ...Object.keys(afterState)]);
    for (const key of keys) {
      if (!isEqual(beforeState[key], afterState[key])) {
        fields.push({
          path: `styles.states.${stateKey}.${key}`,
          before: beforeState[key],
          after: afterState[key],
        });
      }
    }
  }

  const childrenChanged = !isEqual(original.children ?? [], candidate.children ?? []);

  return { fields, childrenChanged };
}

export type EnhanceNodeOutcome =
  | { status: 'success'; originalNode: Node; candidateNode: Node }
  /** Network/provider/abort failure — already surfaced via `useAiGenerator`'s own `error` state. */
  | { status: 'no-result' }
  /** The candidate failed the STORA-509 normalize/validate pipeline. */
  | { status: 'invalid'; message: string };

/**
 * STORA-512 — wires `useAiGenerator().refactorNode` into the same document-safety
 * pipeline `generate-page.ts` uses for `streamPage` sections: the raw result is
 * re-validated through `@kubuild/ai`'s `normalizeAndValidateRefactoredNode` (normalize ->
 * Zod schema validate -> `validateDocumentSecurity`) *before* it is ever shown to the
 * user as a candidate. This is defense-in-depth, exactly like `runStreamPageGeneration`:
 * regardless of whether the configured provider already validated server-side via
 * `KubuildAiEngine`, a host's custom HTTP endpoint may not have.
 *
 * Critically, this function never touches the document or the command engine — it only
 * ever returns a candidate for the caller to hold in local/component state. The original
 * node is not mutated until the caller explicitly applies the result (STORA-514).
 */
export async function runEnhanceNode(
  refactorNode: (params: AiRefactorNodeRequest) => Promise<Node | null>,
  params: AiRefactorNodeRequest,
  deps: { securityLimits?: DocumentSecurityLimits } = {},
): Promise<EnhanceNodeOutcome> {
  const rawResult = await refactorNode(params);
  if (!rawResult) {
    return { status: 'no-result' };
  }

  try {
    const candidateNode = normalizeAndValidateRefactoredNode(
      rawResult,
      params.node,
      deps.securityLimits,
    );
    return { status: 'success', originalNode: params.node, candidateNode };
  } catch (err) {
    return { status: 'invalid', message: err instanceof Error ? err.message : String(err) };
  }
}

export interface EnhanceCandidate {
  originalNode: Node;
  candidateNode: Node;
  diff: EnhanceNodeDiff;
}

export interface ApplyEnhanceResult {
  success: boolean;
  error?: string;
}

/**
 * Dependency-injected store bindings for `applyEnhanceCandidate` (STORA-514) — mirrors
 * `StreamPageGenerationDeps` in `generate-page.ts`: every mutation goes through the exact
 * same store actions manual editing uses (`updateNodeProps`/`updateNodeStyle`/
 * `updateNodeStateStyle`), so it lands in `DocumentHistoryManager` and `undo()` reverts it.
 */
export interface ApplyEnhanceCandidateDeps {
  updateNodeProps: (nodeId: string, props: Record<string, unknown>, merge: boolean) => ApplyEnhanceResult;
  updateNodeStyle: (
    nodeId: string,
    styles: StyleDefinition,
    breakpoint: 'base' | 'desktop' | 'tablet' | 'mobile',
    merge: boolean,
  ) => ApplyEnhanceResult;
  updateNodeStateStyle: (
    nodeId: string,
    styles: StyleDefinition,
    state: string,
    merge: boolean,
  ) => ApplyEnhanceResult;
  /** Only invoked when `diff.childrenChanged` — falls back to the `replaceNode` command. */
  replaceNodeSubtree: (nodeId: string, node: Node) => ApplyEnhanceResult;
  /** Groups a multi-field apply (props + several style layers) into one undo entry. */
  beginHistoryTransaction: () => void;
  endHistoryTransaction: () => void;
}

/**
 * STORA-514 — applies a validated enhance candidate through the command engine, the same
 * path manual editing already uses. Reuses `updateNodeProps`/`updateNodeStyle` for the
 * common case (only props/styles changed); falls back to a whole-subtree `replaceNode`
 * only when `diff.childrenChanged` is true, since `updateNodeProps`/`updateNodeStyle`
 * can't express a nested-children change.
 *
 * The `replaceNode` fallback re-attaches the *original* node's `animation`/`actions`/
 * `formConfig` onto the candidate before dispatching: `normalizeAndValidateRefactoredNode`
 * never reads or preserves those fields (the AI enhance pipeline is props/styles/children
 * only), so without this the candidate would silently wipe out any existing interactivity
 * config on Apply.
 */
export function applyEnhanceCandidate(
  candidate: EnhanceCandidate,
  deps: ApplyEnhanceCandidateDeps,
): ApplyEnhanceResult {
  const { originalNode, candidateNode, diff } = candidate;

  if (diff.childrenChanged) {
    const mergedNode: Node = {
      ...candidateNode,
      ...(originalNode.animation ? { animation: originalNode.animation } : {}),
      ...(originalNode.actions ? { actions: originalNode.actions } : {}),
      ...(originalNode.formConfig ? { formConfig: originalNode.formConfig } : {}),
    };
    return deps.replaceNodeSubtree(originalNode.id, mergedNode);
  }

  const propsChanged = diff.fields.some((f) => f.path.startsWith('props.'));
  const changedBreakpoints = Array.from(
    new Set(
      diff.fields
        .filter((f) => f.path.startsWith('styles.') && !f.path.startsWith('styles.states.'))
        .map((f) => f.path.split('.')[1] as 'base' | 'desktop' | 'tablet' | 'mobile'),
    ),
  );
  const changedStates = Array.from(
    new Set(
      diff.fields.filter((f) => f.path.startsWith('styles.states.')).map((f) => f.path.split('.')[2]),
    ),
  );

  const stepCount = (propsChanged ? 1 : 0) + changedBreakpoints.length + changedStates.length;
  if (stepCount === 0) {
    return { success: true };
  }

  if (stepCount > 1) deps.beginHistoryTransaction();
  try {
    if (propsChanged) {
      const result = deps.updateNodeProps(originalNode.id, candidateNode.props ?? {}, false);
      if (!result.success) return result;
    }
    for (const bp of changedBreakpoints) {
      const result = deps.updateNodeStyle(
        originalNode.id,
        (candidateNode.styles?.[bp] as StyleDefinition) ?? {},
        bp,
        false,
      );
      if (!result.success) return result;
    }
    for (const state of changedStates) {
      const result = deps.updateNodeStateStyle(
        originalNode.id,
        ((candidateNode.styles?.states as Record<string, StyleDefinition> | undefined)?.[state]) ?? {},
        state,
        false,
      );
      if (!result.success) return result;
    }
  } finally {
    if (stepCount > 1) deps.endHistoryTransaction();
  }

  return { success: true };
}
