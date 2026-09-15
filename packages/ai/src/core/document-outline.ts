import type { Node, PageDocument } from '@kubuild/schema';

/**
 * Props that carry user-visible text, ordered by how well they identify a node. Used to
 * label outline rows so the model can say "the CTA button" instead of guessing from ids.
 * Matches the prop names the component definitions in `@kubuild/components` actually use
 * (`label` on button/checkbox/file-upload, `text`/`content` on text nodes, `title` on
 * section-ish components, `src`/`alt` on media).
 */
const LABEL_PROPS = ['text', 'label', 'title', 'heading', 'content', 'placeholder', 'alt', 'src'];

const DEFAULT_LABEL_MAX = 60;

/** Trims a value to a single short line — outlines must stay cheap in tokens. */
function truncate(value: string, max = DEFAULT_LABEL_MAX): string {
  const oneLine = value.replace(/\s+/g, ' ').trim();
  return oneLine.length > max ? `${oneLine.slice(0, max - 1)}…` : oneLine;
}

/**
 * Best-effort human label for a node, derived from its text-carrying props. Returns an
 * empty string when the node has none (layout containers, mostly).
 */
export function getNodeLabel(node: Node, max = DEFAULT_LABEL_MAX): string {
  const props = node.props ?? {};
  for (const key of LABEL_PROPS) {
    const value = props[key];
    if (typeof value === 'string' && value.trim()) {
      return truncate(value, max);
    }
  }
  return '';
}

export interface DocumentOutlineOptions {
  /** How deep to walk before collapsing into a `(+N nested)` marker. Default: 3. */
  maxDepth?: number;
  /**
   * When set, the branch containing this node is always expanded in full regardless of
   * `maxDepth`, and the node itself is marked with `← SELECTED`. This is what makes
   * "user selected a component on the canvas" legible to the model.
   */
  focusNodeId?: string;
  /** Hard ceiling on emitted rows, so a huge page can't blow up the prompt. Default: 200. */
  maxNodes?: number;
}

function isOnPathTo(node: Node, targetId: string): boolean {
  if (node.id === targetId) return true;
  return (node.children ?? []).some((child) => isOnPathTo(child, targetId));
}

/**
 * Renders a compact, indented outline of a node tree (STORA-530).
 *
 * This is the agent's *default* view of the document: one line per node with id, type,
 * label and child count — never full props/styles. Detail is fetched on demand via the
 * `read_node` tool, which keeps per-step prompt cost roughly constant no matter how big
 * the page is. `engine.buildChatPrompt`'s depth-1 section summary can't do this: nested
 * nodes were invisible to the model, so it could never target them.
 */
export function summarizeNodeTree(root: Node, options: DocumentOutlineOptions = {}): string {
  const { maxDepth = 3, focusNodeId, maxNodes = 200 } = options;
  const lines: string[] = [];
  let emitted = 0;
  let truncated = false;

  const walk = (node: Node, depth: number): void => {
    if (emitted >= maxNodes) {
      truncated = true;
      return;
    }

    const indent = '  '.repeat(depth);
    const label = getNodeLabel(node);
    const children = node.children ?? [];
    const parts = [`${indent}- #${node.id} (${node.type})`];
    if (label) parts.push(`"${label}"`);
    if (children.length > 0) parts.push(`[${children.length} children]`);
    if (focusNodeId && node.id === focusNodeId) parts.push('← SELECTED');
    lines.push(parts.join(' '));
    emitted++;

    if (children.length === 0) return;

    // The focused branch stays fully expanded even past maxDepth — the model needs to see
    // what it's being asked to edit, and its siblings, to make a surgical change.
    const onFocusPath = Boolean(focusNodeId) && isOnPathTo(node, focusNodeId!);
    if (depth + 1 > maxDepth && !onFocusPath) {
      lines.push(`${indent}  (+${countDescendants(node)} nested nodes — use read_node to expand)`);
      return;
    }

    for (const child of children) {
      walk(child, depth + 1);
    }
  };

  walk(root, 0);

  if (truncated) {
    lines.push(`  (outline truncated at ${maxNodes} nodes — use find_nodes to locate specifics)`);
  }

  return lines.join('\n');
}

/** Total number of descendants below a node (not counting the node itself). */
export function countDescendants(node: Node): number {
  return (node.children ?? []).reduce((total, child) => total + 1 + countDescendants(child), 0);
}

/** Outline of a whole `PageDocument`, prefixed with its metadata. */
export function summarizeDocument(
  document: PageDocument,
  options: DocumentOutlineOptions = {},
): string {
  const header = [
    `Title: ${document.metadata?.title || 'Untitled Page'}`,
    `Description: ${document.metadata?.description || 'N/A'}`,
  ].join('\n');
  return `${header}\n\nPage outline:\n${summarizeNodeTree(document.document, options)}`;
}

export interface SelectionContext {
  node: Node;
  /** Root-first chain of ancestors, excluding the node itself. */
  ancestors: Node[];
  /** The node's siblings, in document order, including the node itself. */
  siblings: Node[];
  index: number;
  parentId: string | null;
}

/**
 * Resolves everything the agent needs to know about the canvas selection (STORA-530).
 *
 * Sending only `selectedNodeId` — what `engine.buildChatPrompt` does today — tells the
 * model an id but not what the node *is*, what it lives inside, or what sits next to it,
 * so it can't judge whether an instruction like "make this wider" belongs on the node or
 * on its parent container. Returns `null` when the id isn't in the tree.
 */
export function buildSelectionContext(root: Node, nodeId: string): SelectionContext | null {
  const ancestors: Node[] = [];

  const walk = (node: Node, parent: Node | null, index: number): SelectionContext | null => {
    if (node.id === nodeId) {
      return {
        node,
        ancestors: [...ancestors],
        siblings: parent ? (parent.children ?? []) : [node],
        index,
        parentId: parent?.id ?? null,
      };
    }
    ancestors.push(node);
    const children = node.children ?? [];
    for (let i = 0; i < children.length; i++) {
      const found = walk(children[i], node, i);
      if (found) return found;
    }
    ancestors.pop();
    return null;
  };

  return walk(root, null, 0);
}

/**
 * Depth-limits a node before it is serialized into a prompt. A selected section can carry
 * hundreds of descendants; dumping all of them would defeat the point of the outline.
 * Children below `maxDepth` are replaced by a marker node telling the model to call
 * `read_node` if it needs them.
 */
export function pruneNodeForPrompt(node: Node, maxDepth = 2, depth = 0): Node {
  const children = node.children ?? [];
  if (children.length === 0) return node;

  if (depth >= maxDepth) {
    return {
      ...node,
      children: [
        {
          id: `${node.id}__collapsed`,
          type: '__collapsed__',
          props: {
            note: `${countDescendants(node)} nested nodes omitted — call read_node on #${node.id} with includeChildren to expand`,
          },
        },
      ],
    };
  }

  return {
    ...node,
    children: children.map((child) => pruneNodeForPrompt(child, maxDepth, depth + 1)),
  };
}

/** Renders a `SelectionContext` as the prompt block describing the current selection. */
export function formatSelectionContext(context: SelectionContext): string {
  const path = context.ancestors.map((a) => `#${a.id}(${a.type})`).join(' > ');
  const siblings = context.siblings
    .map((sibling, i) => {
      const marker = sibling.id === context.node.id ? ' ← selected' : '';
      const label = getNodeLabel(sibling);
      return `  [${i}] #${sibling.id} (${sibling.type})${label ? ` "${label}"` : ''}${marker}`;
    })
    .join('\n');

  return [
    '### Currently Selected Component',
    `Node: #${context.node.id} (${context.node.type})`,
    `Parent: ${context.parentId ? `#${context.parentId}` : '(root)'} — position ${context.index}`,
    path ? `Path: ${path}` : '',
    'Full node JSON:',
    '```json',
    JSON.stringify(pruneNodeForPrompt(context.node), null, 2),
    '```',
    'Siblings:',
    siblings,
    'When the user says "this", "ini", "komponen ini" or similar, they mean the selected node above.',
  ]
    .filter(Boolean)
    .join('\n');
}
