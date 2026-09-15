import type { Node, StyleDefinition } from '@kubuild/schema';
import type { AgentOp, AgentOpRecord } from '@kubuild/ai';

/** Mirrors the `{ success, error? }` shape every editor store mutation already returns. */
export interface ApplyOpResult {
  success: boolean;
  error?: string;
}

/**
 * Store bindings for `applyAgentOps` (STORA-530) — dependency-injected for the same reason
 * `ApplyEnhanceCandidateDeps` is: every mutation must go through the exact store actions
 * manual editing uses, so agent edits land in `DocumentHistoryManager` and `undo()` reverts
 * them, while the function itself stays unit-testable without a live store.
 */
export interface ApplyAgentOpsDeps {
  updateNodeProps: (
    nodeId: string,
    props: Record<string, unknown>,
    merge: boolean,
  ) => ApplyOpResult;
  updateNodeStyle: (
    nodeId: string,
    styles: StyleDefinition,
    breakpoint: 'base' | 'desktop' | 'tablet' | 'mobile',
    merge: boolean,
  ) => ApplyOpResult;
  updateNodeStateStyle: (
    nodeId: string,
    styles: StyleDefinition,
    state: string,
    merge: boolean,
  ) => ApplyOpResult;
  /** Inserts an already-built node subtree (the agent authors the whole node, not a type). */
  insertNodeTree: (parentId: string, node: Node, index?: number) => ApplyOpResult;
  moveNode: (nodeId: string, targetParentId: string, index?: number) => ApplyOpResult;
  deleteNode: (nodeId: string) => ApplyOpResult;
  duplicateNode: (nodeId: string, targetParentId?: string, index?: number) => ApplyOpResult;
  replaceNodeSubtree: (nodeId: string, node: Node) => ApplyOpResult;
  beginHistoryTransaction: () => void;
  endHistoryTransaction: () => void;
  /** Optional: reads the node currently in the document, used to preserve interactivity config. */
  getNode?: (nodeId: string) => Node | null;
}

export interface ApplyAgentOpsResult {
  success: boolean;
  appliedOpIds: string[];
  /** The op that failed, if any. Ops after it are not attempted. */
  failedOpId?: string;
  error?: string;
}

function applyOne(op: AgentOp, deps: ApplyAgentOpsDeps): ApplyOpResult {
  switch (op.kind) {
    case 'update-props':
      return deps.updateNodeProps(op.nodeId, op.props, op.merge);

    case 'update-styles':
      return op.state
        ? deps.updateNodeStateStyle(op.nodeId, op.styles as StyleDefinition, op.state, op.merge)
        : deps.updateNodeStyle(
            op.nodeId,
            op.styles as StyleDefinition,
            op.breakpoint ?? 'base',
            op.merge,
          );

    case 'insert-node':
      return deps.insertNodeTree(op.parentId, op.node, op.index);

    case 'move-node':
      return deps.moveNode(op.nodeId, op.targetParentId, op.index);

    case 'delete-node':
      return deps.deleteNode(op.nodeId);

    case 'duplicate-node':
      return deps.duplicateNode(op.nodeId, op.targetParentId, op.index);

    case 'replace-node': {
      // The agent's tool pipeline only ever reasons about props/styles/children, so a
      // replacement node carries none of the node's `animation`/`actions`/`formConfig`.
      // Re-attaching them is the same safeguard `applyEnhanceCandidate` applies on its
      // `replaceNode` fallback — without it, Apply would silently wipe a node's
      // interactivity config.
      const existing = deps.getNode?.(op.nodeId);
      const merged: Node = existing
        ? {
            ...op.node,
            ...(existing.animation ? { animation: existing.animation } : {}),
            ...(existing.actions ? { actions: existing.actions } : {}),
            ...(existing.formConfig ? { formConfig: existing.formConfig } : {}),
          }
        : op.node;
      return deps.replaceNodeSubtree(op.nodeId, merged);
    }

    default: {
      const exhaustive: never = op;
      return { success: false, error: `Unsupported agent op: ${JSON.stringify(exhaustive)}` };
    }
  }
}

/**
 * Applies an agent run's ops to the document (STORA-530).
 *
 * The whole run is wrapped in one history transaction, so an agent turn — however many
 * nodes it touched — is a single Ctrl+Z for the user, matching how full-page generation
 * already batches its sections.
 *
 * Application stops at the first failure: later ops routinely depend on earlier ones (a
 * node inserted in op 1 being styled in op 2), so continuing past a failure would apply a
 * meaningless partial edit. Whatever did land stays inside the transaction and is reverted
 * by a single undo.
 */
export function applyAgentOps(
  ops: AgentOpRecord[],
  deps: ApplyAgentOpsDeps,
): ApplyAgentOpsResult {
  if (ops.length === 0) {
    return { success: true, appliedOpIds: [] };
  }

  const appliedOpIds: string[] = [];

  if (ops.length > 1) deps.beginHistoryTransaction();
  try {
    for (const record of ops) {
      const result = applyOne(record.op, deps);
      if (!result.success) {
        return {
          success: false,
          appliedOpIds,
          failedOpId: record.id,
          error: result.error ?? `Gagal menerapkan: ${record.summary}`,
        };
      }
      appliedOpIds.push(record.id);
    }
  } finally {
    if (ops.length > 1) deps.endHistoryTransaction();
  }

  return { success: true, appliedOpIds };
}

/**
 * Splits a run's ops into the ones safe to apply automatically and the ones that always
 * need explicit confirmation (STORA-530).
 *
 * Auto-apply is a convenience for the common case — recolor this, reword that. Destructive
 * ops (`delete_node`, `replace_node`) are never included: losing content to an agent that
 * misread an instruction is not something an undo prompt makes acceptable.
 */
export function partitionAutoApplicableOps(ops: AgentOpRecord[]): {
  autoApplicable: AgentOpRecord[];
  needsConfirmation: AgentOpRecord[];
} {
  const firstDestructive = ops.findIndex((record) => record.destructive);
  if (firstDestructive === -1) {
    return { autoApplicable: ops, needsConfirmation: [] };
  }
  // Ops after a destructive one may depend on it, so everything from that point on is held
  // back rather than applied out of order.
  return {
    autoApplicable: ops.slice(0, firstDestructive),
    needsConfirmation: ops.slice(firstDestructive),
  };
}
