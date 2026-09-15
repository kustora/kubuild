import type { AiToolDefinition } from '../../types';
import type { AgentTool } from './types';
import { READ_TOOLS } from './read-tools';
import { WRITE_TOOLS } from './write-tools';

export * from './types';
export { READ_TOOLS } from './read-tools';
export { WRITE_TOOLS } from './write-tools';
export {
  checkNesting,
  checkComponentType,
  checkDocumentSecurity,
  normalizeIncomingNode,
  suggestNodeIds,
} from './helpers';

export interface DocumentToolsOptions {
  /**
   * Set false to give the agent a read-only tool set — useful for a "review my page"
   * assistant that must never propose mutations.
   */
  allowWrites?: boolean;
  /** Tool names to exclude, e.g. `['delete_node']` on a plan that forbids deletions. */
  exclude?: string[];
}

/**
 * The document tool set the agent is given (STORA-530).
 *
 * Read tools first: the ordering is what the model sees, and putting the "look before you
 * edit" tools at the top nudges it toward reading a node before rewriting it.
 */
export function createDocumentTools(options: DocumentToolsOptions = {}): AgentTool[] {
  const { allowWrites = true, exclude = [] } = options;
  const tools = allowWrites ? [...READ_TOOLS, ...WRITE_TOOLS] : [...READ_TOOLS];
  return tools.filter((tool) => !exclude.includes(tool.definition.name));
}

/** Provider-facing definitions for a tool set. */
export function toToolDefinitions(tools: AgentTool[]): AiToolDefinition[] {
  return tools.map((tool) => tool.definition);
}
