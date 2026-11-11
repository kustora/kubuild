import { MAX_NODE_EFFECTS, type NodeEffect } from '@kubuild/schema';
import { findNodeById, updateEffects, type EffectRegistry } from '@kubuild/core';
import type { AgentOp } from '../../types.js';
import type { AgentTool, ToolExecutionResult } from './types.js';
import { checkDocumentSecurity, describeNode, fail, readString, resolveNode, succeed } from './helpers.js';

const TOOL = 'set_node_effects';

type EffectInput = { plugin: string; enabled?: boolean; config?: Record<string, unknown> };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Validates the model's effect list against the host's plugins. Every problem is collected
 * (not just the first) so one retry can fix them all; the config the model sent is kept as
 * written — defaults stay with the plugin, as when a user edits effects in the panel.
 */
function readEffects(
  raw: unknown,
  registry: EffectRegistry,
): { effects: EffectInput[] } | { error: ToolExecutionResult } {
  if (!Array.isArray(raw)) {
    return { error: fail(`${TOOL}: invalid effects`, 'Argument "effects" must be an array (use [] to remove all).') };
  }
  if (raw.length > MAX_NODE_EFFECTS) {
    return { error: fail(`${TOOL}: too many effects`, `A node may carry at most ${MAX_NODE_EFFECTS} effects.`) };
  }

  const problems: string[] = [];
  const effects: EffectInput[] = [];
  const available = registry.list().map((plugin) => plugin.id).join(', ');
  raw.forEach((entry, index) => {
    if (!isPlainObject(entry) || typeof entry.plugin !== 'string') {
      problems.push(`effects[${index}]: must be an object with a "plugin" id`);
      return;
    }
    const plugin = registry.get(entry.plugin);
    if (!plugin) {
      problems.push(`effects[${index}]: unknown plugin "${entry.plugin}". Available: ${available}`);
      return;
    }
    if (entry.enabled !== undefined && typeof entry.enabled !== 'boolean') {
      problems.push(`effects[${index}].enabled: must be a boolean`);
      return;
    }
    if (entry.config !== undefined && !isPlainObject(entry.config)) {
      problems.push(`effects[${index}].config: must be an object`);
      return;
    }
    const parsed = plugin.parse(entry.config ?? {});
    if (!parsed.success) {
      problems.push(`effects[${index}] (${entry.plugin}).config: ${parsed.error}`);
      return;
    }
    effects.push({
      plugin: entry.plugin,
      ...(entry.enabled !== undefined ? { enabled: entry.enabled } : {}),
      config: (entry.config as Record<string, unknown> | undefined) ?? {},
    });
  });

  if (problems.length > 0) {
    return { error: fail(`${TOOL}: invalid effects`, problems.join('\n')) };
  }
  return { effects };
}

/**
 * Agent tools for node effects (STORA-651). Only created when the host passes an effect
 * registry, so the model never sees a tool for plugins the page can't run.
 */
export function createEffectTools(registry: EffectRegistry): AgentTool[] {
  const pluginIds = registry.list().map((plugin) => plugin.id);

  const setNodeEffects: AgentTool = {
    kind: 'write',
    definition: {
      name: TOOL,
      description:
        "Set the runtime effects (animations, text reveals, counters, parallax, scroll-linked motion, scroll pins, …) of one node. REPLACES the node's whole effect list: read_node first and include any existing effects you want to keep. Pass [] to remove all effects. Only plugins from the EFFECT PLUGINS section exist; omitted config fields use the plugin defaults.",
      inputSchema: {
        type: 'object',
        properties: {
          nodeId: { type: 'string', description: 'Id of the node that gets the effects.' },
          effects: {
            type: 'array',
            maxItems: MAX_NODE_EFFECTS,
            description: 'The complete new effect list, in order.',
            items: {
              type: 'object',
              properties: {
                plugin: { type: 'string', enum: pluginIds, description: 'Effect plugin id.' },
                enabled: { type: 'boolean', description: 'Default true.' },
                config: {
                  type: 'object',
                  description: "Plugin config; only the fields that differ from the plugin's defaults.",
                },
              },
              required: ['plugin'],
            },
          },
        },
        required: ['nodeId', 'effects'],
      },
    },
    execute(input, context) {
      const nodeId = readString(input, 'nodeId');
      if (!nodeId) return fail(`${TOOL}: nodeId missing`, 'Argument "nodeId" is required.');

      const resolved = resolveNode(context.document, nodeId, TOOL);
      if ('error' in resolved) return resolved.error;

      const read = readEffects(input.effects, registry);
      if ('error' in read) return read.error;

      let document;
      try {
        ({ document } = updateEffects(context.document, { nodeId, effects: read.effects }));
      } catch (err) {
        return fail(`${TOOL} failed`, err instanceof Error ? err.message : String(err));
      }

      const violation = checkDocumentSecurity(document, context.securityLimits);
      if (violation) {
        return fail(
          `${TOOL} rejected (security)`,
          `The resulting document failed the security check and was rejected: ${violation}`,
        );
      }

      // The op carries the list as stored (schema defaults applied), so the editor replays
      // exactly what the snapshot holds.
      const stored: NodeEffect[] = findNodeById(document.document, nodeId)?.effects ?? [];
      const op: AgentOp = { kind: 'set-effects', nodeId, effects: stored };
      const summary =
        stored.length > 0
          ? `Set effects on ${describeNode(resolved.node)}: ${stored.map((effect) => effect.plugin).join(', ')}`
          : `Remove effects from ${describeNode(resolved.node)}`;

      return succeed(summary, { nodeId, effects: stored }, { op, document });
    },
  };

  return [setNodeEffects];
}
