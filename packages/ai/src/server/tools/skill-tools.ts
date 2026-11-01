import type { AiSkill } from '../../types.js';
import type { AgentTool } from './types.js';
import { fail, readString, succeed } from './helpers.js';

/**
 * Skill tools — the on-demand half of progressive disclosure. The agent's system prompt
 * lists every skill's name and description; these load a skill's instructions, then any
 * reference/asset file it points to, only when the task needs them.
 */
export function createSkillTools(skills: readonly AiSkill[]): AgentTool[] {
  const byName = new Map(skills.map((skill) => [skill.name, skill]));
  const names = skills.map((skill) => skill.name).join(', ');

  const loadSkill: AgentTool = {
    kind: 'read',
    definition: {
      name: 'load_skill',
      description:
        'Load the full instructions of one of the skills listed under SKILLS. Call it before working on a task a skill covers, then follow those instructions.',
      inputSchema: {
        type: 'object',
        properties: { name: { type: 'string', description: `Skill name. One of: ${names}.` } },
        required: ['name'],
      },
    },
    execute(input) {
      const name = readString(input, 'name');
      const skill = name ? byName.get(name) : undefined;
      if (!skill) return fail('Unknown skill', `Unknown skill "${name ?? ''}". Available skills: ${names}.`);
      return succeed(`Loaded skill ${skill.name}`, {
        name: skill.name,
        instructions: skill.instructions,
        files: Object.keys(skill.files ?? {}),
      });
    },
  };

  const readSkillFile: AgentTool = {
    kind: 'read',
    definition: {
      name: 'read_skill_file',
      description:
        "Read one of a loaded skill's reference or asset files, by the path load_skill listed (e.g. references/sections.md).",
      inputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Skill name.' },
          path: { type: 'string', description: 'File path relative to the skill root.' },
        },
        required: ['name', 'path'],
      },
    },
    execute(input) {
      const name = readString(input, 'name');
      const filePath = readString(input, 'path');
      const skill = name ? byName.get(name) : undefined;
      if (!skill) return fail('Unknown skill', `Unknown skill "${name ?? ''}". Available skills: ${names}.`);
      // Only files the loader bundled can be returned — a lookup, never a filesystem read.
      const content = filePath ? skill.files?.[filePath] : undefined;
      if (content === undefined) {
        const available = Object.keys(skill.files ?? {}).join(', ') || '(none)';
        return fail('Unknown skill file', `Skill "${skill.name}" has no file "${filePath ?? ''}". Files: ${available}.`);
      }
      return succeed(`Read ${skill.name}/${filePath}`, { name: skill.name, path: filePath, content });
    },
  };

  return [loadSkill, readSkillFile];
}
