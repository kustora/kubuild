import type { Node } from '@kubuild/schema';
import {
  buildSelectionContext,
  getNodeLabel,
  pruneNodeForPrompt,
  summarizeNodeTree,
} from '../../core/document-outline';
import type { AgentTool } from './types';
import { fail, readString, resolveNode, succeed } from './helpers';

/**
 * Read-only tools (STORA-530).
 *
 * All of them are answered straight from the agent's snapshot — no extra model round trip,
 * no network. They exist so the system prompt can ship a cheap outline instead of the whole
 * document, and the model pulls detail only for the handful of nodes it actually needs.
 */

const getPageOutline: AgentTool = {
  kind: 'read',
  definition: {
    name: 'get_page_outline',
    description:
      'Return the page structure as an indented outline of node ids, types, labels and child counts. Use this to re-orient after edits. Does not include props or styles — call read_node for those.',
    inputSchema: {
      type: 'object',
      properties: {
        maxDepth: {
          type: 'integer',
          description: 'How deep to expand the tree before collapsing. Default 3.',
        },
      },
    },
  },
  execute(input, context) {
    const maxDepth =
      typeof input.maxDepth === 'number' && input.maxDepth > 0 ? Math.floor(input.maxDepth) : 3;
    return succeed('Read page outline', {
      outline: summarizeNodeTree(context.document.document, { maxDepth }),
    });
  },
};

const readNode: AgentTool = {
  kind: 'read',
  definition: {
    name: 'read_node',
    description:
      'Return one node with its full props and styles, plus its parent, position and siblings. Always read a node before editing it, so you change only the fields that need changing.',
    inputSchema: {
      type: 'object',
      properties: {
        nodeId: { type: 'string', description: 'Id of the node to read (from the outline).' },
        includeChildren: {
          type: 'boolean',
          description: 'Include the node subtree. Default false — keeps the result small.',
        },
      },
      required: ['nodeId'],
    },
  },
  execute(input, context) {
    const nodeId = readString(input, 'nodeId');
    if (!nodeId) return fail('read_node: nodeId missing', 'Argument "nodeId" is required.');

    const resolved = resolveNode(context.document, nodeId, 'read_node');
    if ('error' in resolved) return resolved.error;

    const selection = buildSelectionContext(context.document.document, nodeId);
    const includeChildren = input.includeChildren === true;
    const node = includeChildren
      ? pruneNodeForPrompt(resolved.node, 3)
      : { ...resolved.node, children: undefined };

    return succeed(`Membaca node ${nodeId}`, {
      node,
      childCount: resolved.node.children?.length ?? 0,
      parentId: selection?.parentId ?? null,
      index: selection?.index ?? 0,
      ancestors: selection?.ancestors.map((a) => ({ id: a.id, type: a.type })) ?? [],
      siblings:
        selection?.siblings.map((sibling, i) => ({
          index: i,
          id: sibling.id,
          type: sibling.type,
          label: getNodeLabel(sibling),
        })) ?? [],
    });
  },
};

const findNodes: AgentTool = {
  kind: 'read',
  definition: {
    name: 'find_nodes',
    description:
      'Search the page for nodes by component type and/or visible text. Use this instead of guessing ids when the user refers to something by what it says ("the Get Started button").',
    inputSchema: {
      type: 'object',
      properties: {
        type: { type: 'string', description: 'Component type to match exactly, e.g. "button".' },
        textContains: {
          type: 'string',
          description: 'Case-insensitive substring to match against the node text/label props.',
        },
        parentId: { type: 'string', description: 'Limit the search to this node subtree.' },
        limit: { type: 'integer', description: 'Max results. Default 20.' },
      },
    },
  },
  execute(input, context) {
    const type = readString(input, 'type');
    const textContains = readString(input, 'textContains');
    const parentId = readString(input, 'parentId');
    const limit =
      typeof input.limit === 'number' && input.limit > 0 ? Math.floor(input.limit) : 20;

    if (!type && !textContains) {
      return fail(
        'find_nodes: empty filter',
        'Provide at least one of "type" or "textContains" — an unfiltered search would just return the whole outline.',
      );
    }

    let root: Node = context.document.document;
    if (parentId) {
      const resolved = resolveNode(context.document, parentId, 'find_nodes');
      if ('error' in resolved) return resolved.error;
      root = resolved.node;
    }

    const needle = textContains?.toLowerCase();
    const matches: Array<{ id: string; type: string; label: string }> = [];

    const walk = (node: Node): void => {
      if (matches.length >= limit) return;
      const label = getNodeLabel(node);
      const typeMatches = !type || node.type === type;
      const textMatches = !needle || label.toLowerCase().includes(needle);
      if (typeMatches && textMatches) {
        matches.push({ id: node.id, type: node.type, label });
      }
      for (const child of node.children ?? []) walk(child);
    };
    walk(root);

    return succeed(
      `Mencari node (${matches.length} hasil)`,
      matches.length > 0
        ? { matches, count: matches.length }
        : {
            matches: [],
            count: 0,
            hint: 'Nothing matched. Try a broader filter, or call get_page_outline to see what exists.',
          },
    );
  },
};

const listComponentTypes: AgentTool = {
  kind: 'read',
  definition: {
    name: 'list_component_types',
    description:
      'List component types available in this editor, with their props and nesting rules. Call this before inserting a component type you have not used yet.',
    inputSchema: {
      type: 'object',
      properties: {
        category: { type: 'string', description: 'Filter to one category, e.g. "layout".' },
      },
    },
  },
  execute(input, context) {
    const category = readString(input, 'category');
    const entries = category
      ? context.catalog.filter((spec) => spec.category === category)
      : context.catalog;

    return succeed(`Viewed component catalog (${entries.length})`, {
      components: entries.map((spec) => ({
        type: spec.type,
        label: spec.label,
        category: spec.category,
        acceptsChildren: spec.acceptsChildren,
        allowedChildren: spec.allowedChildren,
        props: spec.props?.map((prop) => ({
          name: prop.name,
          type: prop.type,
          options: prop.options,
        })),
      })),
    });
  },
};

export const READ_TOOLS: AgentTool[] = [getPageOutline, readNode, findNodes, listComponentTypes];
