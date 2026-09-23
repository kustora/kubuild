import type { Node, PageDocument } from '@kubuild/schema';
import {
  duplicateNode,
  findNodeById,
  insertNode,
  moveNode,
  removeNode,
  replaceNode,
  updateProps,
  updateStyle,
} from '@kubuild/core';
import type { AgentOp } from '../../types';
import { getNodeLabel } from '../../core/document-outline';
import type { AgentTool, ToolExecutionContext, ToolExecutionResult } from './types';
import {
  checkComponentType,
  checkDocumentSecurity,
  checkNesting,
  describeNode,
  fail,
  normalizeIncomingNode,
  readOptionalIndex,
  readPlainObject,
  readString,
  resolveNode,
  succeed,
} from './helpers';

/**
 * Write tools (STORA-530).
 *
 * Each one produces a single `AgentOp` — never a regenerated document. The op is what the
 * editor later replays through its own store actions, so an agent run lands in the command
 * engine and the history stack exactly like manual editing does.
 *
 * Every write follows the same three-step contract:
 *   1. validate the arguments against the snapshot (ids, types, nesting),
 *   2. apply the corresponding pure `@kubuild/core` command to the snapshot,
 *   3. re-run `validateDocumentSecurity` on the result before the op is accepted.
 * Step 3 matters because the arguments come from a language model: it's the same "AI output
 * is untrusted input" boundary `normalizeAndValidate*` enforces for generated documents.
 */

const BREAKPOINTS = ['base', 'desktop', 'tablet', 'mobile'] as const;
type Breakpoint = (typeof BREAKPOINTS)[number];

/**
 * Runs a `@kubuild/core` command against the snapshot and converts a throw into a
 * retry-friendly tool failure. The core commands throw on things the model plausibly gets
 * wrong (duplicate ids, moving a node into its own descendant, removing the root), and
 * those messages are already specific enough to hand straight back to the model.
 */
function applyCommand(
  toolName: string,
  run: () => { document: PageDocument },
): { document: PageDocument } | { error: ToolExecutionResult } {
  try {
    return run();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { error: fail(`${toolName} failed`, message) };
  }
}

function guardSecurity(
  toolName: string,
  document: PageDocument,
  context: ToolExecutionContext,
): ToolExecutionResult | null {
  const violation = checkDocumentSecurity(document, context.securityLimits);
  if (!violation) return null;
  return fail(
    `${toolName} rejected (security)`,
    `The resulting document failed the security check and was rejected: ${violation}`,
  );
}

const updateNodeProps: AgentTool = {
  kind: 'write',
  definition: {
    name: 'update_node_props',
    description:
      'Change the props of one existing node (text, label, href, src, level, …). This is the right tool for any content/copy change — it touches nothing else on the page.',
    inputSchema: {
      type: 'object',
      properties: {
        nodeId: { type: 'string', description: 'Id of the node to edit.' },
        props: {
          type: 'object',
          description: 'Props to write. Include only the props that should change.',
        },
        merge: {
          type: 'boolean',
          description:
            'true (default) merges with existing props. Only pass false to deliberately clear the other props.',
        },
      },
      required: ['nodeId', 'props'],
    },
  },
  execute(input, context) {
    const nodeId = readString(input, 'nodeId');
    if (!nodeId) return fail('update_node_props: nodeId missing', 'Argument "nodeId" is required.');

    const props = readPlainObject(input, 'props');
    if (!props) {
      return fail(
        'update_node_props: invalid props',
        'Argument "props" must be a JSON object of prop names to values.',
      );
    }

    const resolved = resolveNode(context.document, nodeId, 'update_node_props');
    if ('error' in resolved) return resolved.error;

    const merge = input.merge !== false;
    const applied = applyCommand('update_node_props', () =>
      updateProps(context.document, { nodeId, props, merge }),
    );
    if ('error' in applied) return applied.error;

    const violation = guardSecurity('update_node_props', applied.document, context);
    if (violation) return violation;

    const op: AgentOp = { kind: 'update-props', nodeId, props, merge };
    const updated = findNodeById(applied.document.document, nodeId);

    return succeed(
      `Update props of ${describeNode(resolved.node)}`,
      { nodeId, props: updated?.props ?? props, changedKeys: Object.keys(props) },
      { op, document: applied.document },
    );
  },
};

const updateNodeStyles: AgentTool = {
  kind: 'write',
  definition: {
    name: 'update_node_styles',
    description:
      'Change the styles of one existing node. Use `breakpoint` for normal styling and `state` for pseudo-classes like ":hover". This is the right tool for any color/spacing/size/typography change.',
    inputSchema: {
      type: 'object',
      properties: {
        nodeId: { type: 'string', description: 'Id of the node to restyle.' },
        styles: {
          type: 'object',
          description:
            'CSS properties in camelCase with primitive values, e.g. { "backgroundColor": "#16a34a", "paddingTop": "24px" }. Never nest objects here.',
        },
        breakpoint: {
          type: 'string',
          enum: ['base', 'desktop', 'tablet', 'mobile'],
          description: 'Breakpoint layer to write. Default "base".',
        },
        state: {
          type: 'string',
          description:
            'Pseudo-state layer such as ":hover", ":focus", ":active". Mutually exclusive with breakpoint.',
        },
        merge: {
          type: 'boolean',
          description: 'true (default) merges with existing styles in that layer.',
        },
      },
      required: ['nodeId', 'styles'],
    },
  },
  execute(input, context) {
    const nodeId = readString(input, 'nodeId');
    if (!nodeId) return fail('update_node_styles: nodeId missing', 'Argument "nodeId" is required.');

    const styles = readPlainObject(input, 'styles');
    if (!styles) {
      return fail(
        'update_node_styles: invalid styles',
        'Argument "styles" must be a JSON object of CSS properties with primitive values.',
      );
    }

    const nested = Object.entries(styles).find(
      ([, value]) => value !== null && typeof value === 'object',
    );
    if (nested) {
      return fail(
        'update_node_styles: nested value',
        `Style property "${nested[0]}" has an object value. Style values must be primitives — use the "state" argument for pseudo-classes instead of nesting them.`,
      );
    }

    const rawState = readString(input, 'state');
    const rawBreakpoint = readString(input, 'breakpoint');
    if (rawState && rawBreakpoint) {
      return fail(
        'update_node_styles: conflicting arguments',
        'Pass either "breakpoint" or "state", not both — a pseudo-state layer is not per-breakpoint.',
      );
    }
    if (rawBreakpoint && !BREAKPOINTS.includes(rawBreakpoint as Breakpoint)) {
      return fail(
        'update_node_styles: unknown breakpoint',
        `Unknown breakpoint "${rawBreakpoint}". Valid values: ${BREAKPOINTS.join(', ')}.`,
      );
    }

    const resolved = resolveNode(context.document, nodeId, 'update_node_styles');
    if ('error' in resolved) return resolved.error;

    const state = rawState ? (rawState.startsWith(':') ? rawState : `:${rawState}`) : undefined;
    const breakpoint = state ? undefined : ((rawBreakpoint as Breakpoint) ?? 'base');
    const merge = input.merge !== false;

    const applied = applyCommand('update_node_styles', () =>
      updateStyle(context.document, { nodeId, styles, breakpoint, state, merge }),
    );
    if ('error' in applied) return applied.error;

    const violation = guardSecurity('update_node_styles', applied.document, context);
    if (violation) return violation;

    const op: AgentOp = { kind: 'update-styles', nodeId, styles, breakpoint, state, merge };
    const layer = state ? `state ${state}` : `breakpoint ${breakpoint}`;

    return succeed(
      `Update styles of ${describeNode(resolved.node)} (${layer})`,
      { nodeId, layer, appliedStyles: styles },
      { op, document: applied.document },
    );
  },
};

const insertComponent: AgentTool = {
  kind: 'write',
  definition: {
    name: 'insert_component',
    description:
      'Insert one new component into an existing parent node. Use this for adding a single element (a button, a paragraph, an image). For a whole new page section, use insert_section instead.',
    inputSchema: {
      type: 'object',
      properties: {
        parentId: { type: 'string', description: 'Id of the node that will contain the new component.' },
        type: { type: 'string', description: 'Component type from the catalog.' },
        index: {
          type: 'integer',
          description: 'Position among the parent children. Omit to append at the end.',
        },
        props: { type: 'object', description: 'Initial props for the new component.' },
        styles: {
          type: 'object',
          description: 'Initial styles, e.g. { "base": { "marginTop": "16px" } }.',
        },
        children: {
          type: 'array',
          description: 'Optional nested child nodes, each { type, props?, styles?, children? }.',
          items: { type: 'object' },
        },
      },
      required: ['parentId', 'type'],
    },
  },
  execute(input, context) {
    const parentId = readString(input, 'parentId');
    const type = readString(input, 'type');
    if (!parentId || !type) {
      return fail(
        'insert_component: missing arguments',
        'Arguments "parentId" and "type" are both required.',
      );
    }

    const typeError = checkComponentType(context.catalog, type);
    if (typeError) return fail('insert_component: unknown type', typeError);

    const resolvedParent = resolveNode(context.document, parentId, 'insert_component');
    if ('error' in resolvedParent) return resolvedParent.error;

    const nestingError = checkNesting(context.catalog, resolvedParent.node, type);
    if (nestingError) return fail('insert_component: invalid nesting', nestingError);

    const normalized = normalizeIncomingNode(
      {
        type,
        props: readPlainObject(input, 'props') ?? undefined,
        styles: readPlainObject(input, 'styles') ?? undefined,
        children: Array.isArray(input.children) ? input.children : undefined,
      },
      context.document,
    );
    if ('error' in normalized) {
      return fail('insert_component: invalid node', normalized.error);
    }

    const index = readOptionalIndex(input, 'index');
    const applied = applyCommand('insert_component', () =>
      insertNode(context.document, { parentId, node: normalized.node, index }),
    );
    if ('error' in applied) return applied.error;

    const violation = guardSecurity('insert_component', applied.document, context);
    if (violation) return violation;

    const op: AgentOp = { kind: 'insert-node', parentId, index, node: normalized.node };

    return succeed(
      `Add ${describeNode(normalized.node)} to #${parentId}`,
      { nodeId: normalized.node.id, parentId, index: index ?? null },
      { op, document: applied.document },
    );
  },
};

/**
 * Section insertion delegates to `KubuildAiEngine.generateSection` rather than asking the
 * agent model to author a whole section inline: that path already handles planning,
 * normalization and the `section` JSON schema, and keeps generated markup consistent with
 * the non-agent "generate" feature.
 */
const insertSection: AgentTool = {
  kind: 'write',
  definition: {
    name: 'insert_section',
    description:
      'Generate and insert a complete new page section (hero, features, pricing, FAQ, CTA, …) from a description. Use this when the user asks to ADD a section — do not hand-build sections with insert_component.',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: {
          type: 'string',
          description:
            'Detailed description of the section: purpose, content, layout and tone. Write it in the language the page uses.',
        },
        index: {
          type: 'integer',
          description: 'Position among the page sections. Omit to append at the end.',
        },
      },
      required: ['prompt'],
    },
  },
  async execute(input, context) {
    const prompt = readString(input, 'prompt');
    if (!prompt) return fail('insert_section: prompt missing', 'Argument "prompt" is required.');

    if (!context.generateSection) {
      return fail(
        'insert_section: not available',
        'Section generation is not available in this deployment. Build the section with insert_component instead.',
      );
    }

    const rootId = context.document.document.id;
    const existingSections = (context.document.document.children ?? [])
      .map((child) => `${child.type}: ${getNodeLabel(child) || child.id}`)
      .join(', ');

    let generated: Node;
    try {
      generated = await context.generateSection({
        prompt,
        parentContext: `Page "${context.document.metadata?.title ?? 'Untitled'}". Existing sections: ${existingSections || '(none)'}`,
      });
    } catch (err) {
      return fail(
        'insert_section failed',
        `Section generation failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    const normalized = normalizeIncomingNode(generated, context.document);
    if ('error' in normalized) {
      return fail('insert_section: invalid section', normalized.error);
    }

    const index = readOptionalIndex(input, 'index');
    const applied = applyCommand('insert_section', () =>
      insertNode(context.document, { parentId: rootId, node: normalized.node, index }),
    );
    if ('error' in applied) return applied.error;

    const violation = guardSecurity('insert_section', applied.document, context);
    if (violation) return violation;

    const op: AgentOp = { kind: 'insert-node', parentId: rootId, index, node: normalized.node };

    return succeed(
      `Add new section (#${normalized.node.id})`,
      {
        nodeId: normalized.node.id,
        index: index ?? null,
        childCount: normalized.node.children?.length ?? 0,
      },
      { op, document: applied.document },
    );
  },
};

const moveNodeTool: AgentTool = {
  kind: 'write',
  definition: {
    name: 'move_node',
    description: 'Move an existing node to a different parent and/or position.',
    inputSchema: {
      type: 'object',
      properties: {
        nodeId: { type: 'string' },
        targetParentId: { type: 'string', description: 'Id of the new parent node.' },
        index: { type: 'integer', description: 'Position within the new parent. Omit to append.' },
      },
      required: ['nodeId', 'targetParentId'],
    },
  },
  execute(input, context) {
    const nodeId = readString(input, 'nodeId');
    const targetParentId = readString(input, 'targetParentId');
    if (!nodeId || !targetParentId) {
      return fail(
        'move_node: missing arguments',
        'Arguments "nodeId" and "targetParentId" are both required.',
      );
    }

    const resolved = resolveNode(context.document, nodeId, 'move_node');
    if ('error' in resolved) return resolved.error;
    const resolvedParent = resolveNode(context.document, targetParentId, 'move_node');
    if ('error' in resolvedParent) return resolvedParent.error;

    const nestingError = checkNesting(context.catalog, resolvedParent.node, resolved.node.type);
    if (nestingError) return fail('move_node: invalid nesting', nestingError);

    const index = readOptionalIndex(input, 'index');
    const applied = applyCommand('move_node', () =>
      moveNode(context.document, { nodeId, targetParentId, index }),
    );
    if ('error' in applied) return applied.error;

    const violation = guardSecurity('move_node', applied.document, context);
    if (violation) return violation;

    const op: AgentOp = { kind: 'move-node', nodeId, targetParentId, index };

    return succeed(
      `Move ${describeNode(resolved.node)} to #${targetParentId}`,
      { nodeId, targetParentId, index: index ?? null },
      { op, document: applied.document },
    );
  },
};

const duplicateNodeTool: AgentTool = {
  kind: 'write',
  definition: {
    name: 'duplicate_node',
    description:
      'Duplicate an existing node and its subtree, with fresh ids. Useful for repeating an existing card/feature rather than authoring a new one from scratch.',
    inputSchema: {
      type: 'object',
      properties: {
        nodeId: { type: 'string' },
        targetParentId: {
          type: 'string',
          description: 'Where to put the copy. Defaults to the original node parent.',
        },
        index: { type: 'integer', description: 'Position of the copy. Defaults to right after the original.' },
      },
      required: ['nodeId'],
    },
  },
  execute(input, context) {
    const nodeId = readString(input, 'nodeId');
    if (!nodeId) return fail('duplicate_node: nodeId missing', 'Argument "nodeId" is required.');

    const resolved = resolveNode(context.document, nodeId, 'duplicate_node');
    if ('error' in resolved) return resolved.error;

    const targetParentId = readString(input, 'targetParentId') ?? undefined;
    if (targetParentId) {
      const resolvedParent = resolveNode(context.document, targetParentId, 'duplicate_node');
      if ('error' in resolvedParent) return resolvedParent.error;
    }

    const index = readOptionalIndex(input, 'index');
    const applied = applyCommand('duplicate_node', () =>
      duplicateNode(context.document, { nodeId, targetParentId, index }),
    );
    if ('error' in applied) return applied.error;

    const violation = guardSecurity('duplicate_node', applied.document, context);
    if (violation) return violation;

    const op: AgentOp = { kind: 'duplicate-node', nodeId, targetParentId, index };

    return succeed(
      `Duplicate ${describeNode(resolved.node)}`,
      { nodeId, targetParentId: targetParentId ?? null, index: index ?? null },
      { op, document: applied.document },
    );
  },
};

const deleteNode: AgentTool = {
  kind: 'write',
  destructive: true,
  definition: {
    name: 'delete_node',
    description:
      'Permanently remove a node and everything inside it. Only call this when the user unambiguously asked to remove that specific thing. If the request is vague, ask instead.',
    inputSchema: {
      type: 'object',
      properties: {
        nodeId: { type: 'string' },
        reason: {
          type: 'string',
          description: 'Short justification quoting what the user asked for. Shown to the user before they apply.',
        },
      },
      required: ['nodeId', 'reason'],
    },
  },
  execute(input, context) {
    const nodeId = readString(input, 'nodeId');
    if (!nodeId) return fail('delete_node: nodeId missing', 'Argument "nodeId" is required.');

    const reason = readString(input, 'reason');
    if (!reason) {
      return fail(
        'delete_node: reason missing',
        'Argument "reason" is required for destructive actions — state what the user asked for.',
      );
    }

    const resolved = resolveNode(context.document, nodeId, 'delete_node');
    if ('error' in resolved) return resolved.error;

    const applied = applyCommand('delete_node', () => removeNode(context.document, { nodeId }));
    if ('error' in applied) return applied.error;

    const op: AgentOp = { kind: 'delete-node', nodeId };

    return succeed(
      `Delete ${describeNode(resolved.node)} — ${reason}`,
      { nodeId, removedType: resolved.node.type },
      { op, document: applied.document },
    );
  },
};

const replaceNodeTool: AgentTool = {
  kind: 'write',
  destructive: true,
  definition: {
    name: 'replace_node',
    description:
      'Replace a node subtree wholesale. LAST RESORT — only when the children genuinely must be restructured. Never use it to change props or styles; use update_node_props / update_node_styles for that.',
    inputSchema: {
      type: 'object',
      properties: {
        nodeId: { type: 'string', description: 'Id of the node being replaced. The replacement keeps this id.' },
        node: {
          type: 'object',
          description: 'Replacement node { type, props?, styles?, children? }. Its id is forced to nodeId.',
        },
        reason: {
          type: 'string',
          description: 'Why a structural replacement is required instead of a props/styles edit.',
        },
      },
      required: ['nodeId', 'node', 'reason'],
    },
  },
  execute(input, context) {
    const nodeId = readString(input, 'nodeId');
    const raw = readPlainObject(input, 'node');
    const reason = readString(input, 'reason');
    if (!nodeId || !raw || !reason) {
      return fail(
        'replace_node: missing arguments',
        'Arguments "nodeId", "node" and "reason" are all required.',
      );
    }

    const resolved = resolveNode(context.document, nodeId, 'replace_node');
    if ('error' in resolved) return resolved.error;

    // Ids inside the replacement are regenerated (preserveIds: false) so a model that
    // re-emits the old subtree's ids can't collide with the rest of the document; the root
    // id is then pinned back to the target, which is what `replaceNode` requires.
    const normalized = normalizeIncomingNode({ ...raw, id: undefined }, context.document);
    if ('error' in normalized) {
      return fail('replace_node: invalid node', normalized.error);
    }

    const replacement: Node = { ...normalized.node, id: nodeId, type: resolved.node.type };

    const applied = applyCommand('replace_node', () =>
      replaceNode(context.document, { nodeId, node: replacement }),
    );
    if ('error' in applied) return applied.error;

    const violation = guardSecurity('replace_node', applied.document, context);
    if (violation) return violation;

    const op: AgentOp = { kind: 'replace-node', nodeId, node: replacement };

    return succeed(
      `Replace structure of ${describeNode(resolved.node)} — ${reason}`,
      { nodeId, childCount: replacement.children?.length ?? 0 },
      { op, document: applied.document },
    );
  },
};

export const WRITE_TOOLS: AgentTool[] = [
  updateNodeProps,
  updateNodeStyles,
  insertComponent,
  insertSection,
  moveNodeTool,
  duplicateNodeTool,
  deleteNode,
  replaceNodeTool,
];
