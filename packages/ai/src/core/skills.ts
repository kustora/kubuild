import type { AiSkill } from '../types.js';

/**
 * Agent Skills (https://agentskills.io/specification) — folders with a `SKILL.md` whose
 * frontmatter `name` + `description` is always shown to the model, and whose body (plus any
 * `references/` / `assets/` files) is only loaded when a request needs it.
 *
 * This module is isomorphic: parsing and prompt formatting only. Reading skill folders from
 * disk lives in `server/skills-loader.ts`.
 */

const SKILL_NAME_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const MAX_NAME_LENGTH = 64;
const MAX_DESCRIPTION_LENGTH = 1024;

export class SkillParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SkillParseError';
  }
}

/** Whether `name` follows the spec: 1-64 chars of lowercase letters, digits and single hyphens. */
export function isValidSkillName(name: string): boolean {
  return name.length > 0 && name.length <= MAX_NAME_LENGTH && SKILL_NAME_PATTERN.test(name);
}

function unquote(value: string): string {
  const v = value.trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    return v.slice(1, -1);
  }
  return v;
}

/**
 * Reads the top-level scalar keys of a YAML frontmatter block — enough for the spec's
 * `name` / `description` (including `>` / `|` block scalars). Nested maps such as
 * `metadata:` are skipped, since nothing here consumes them.
 */
function parseFrontmatter(yaml: string): Record<string, string> {
  const lines = yaml.split(/\r?\n/);
  const result: Record<string, string> = {};
  for (let i = 0; i < lines.length; i++) {
    const match = /^([A-Za-z][\w-]*):(.*)$/.exec(lines[i]);
    if (!match) continue;
    const [, key, rest] = match;
    const value = rest.trim();
    if (value === '>' || value === '|' || value === '>-' || value === '|-') {
      const block: string[] = [];
      while (i + 1 < lines.length && (/^\s+\S/.test(lines[i + 1]) || lines[i + 1].trim() === '')) {
        block.push(lines[++i].trim());
      }
      result[key] = value.startsWith('>')
        ? block.join(' ').replace(/\s+/g, ' ').trim()
        : block.join('\n').trim();
    } else if (value !== '') {
      result[key] = unquote(value);
    }
  }
  return result;
}

/**
 * Parses a `SKILL.md` into an `AiSkill`, validating the spec's frontmatter rules.
 * `files` are the skill's extra text files keyed by path relative to the skill root
 * (e.g. `references/sections.md`). Throws `SkillParseError` on an invalid skill.
 */
export function parseSkill(markdown: string, files?: Record<string, string>): AiSkill {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(markdown.replace(/^﻿/, ''));
  if (!match) {
    throw new SkillParseError('SKILL.md must start with a YAML frontmatter block (--- ... ---)');
  }
  const frontmatter = parseFrontmatter(match[1]);
  const name = frontmatter.name ?? '';
  const description = frontmatter.description ?? '';
  if (!isValidSkillName(name)) {
    throw new SkillParseError(
      `Invalid skill name "${name}": use 1-${MAX_NAME_LENGTH} lowercase letters, digits and single hyphens`,
    );
  }
  if (!description || description.length > MAX_DESCRIPTION_LENGTH) {
    throw new SkillParseError(
      `Skill "${name}" needs a description of 1-${MAX_DESCRIPTION_LENGTH} characters`,
    );
  }
  return {
    name,
    description,
    instructions: match[2].trim(),
    ...(files && Object.keys(files).length > 0 ? { files } : {}),
  };
}

/** One line per skill — the always-visible part of progressive disclosure. */
export function formatSkillCatalog(skills: readonly AiSkill[]): string {
  return skills.map((skill) => `- ${skill.name}: ${skill.description}`).join('\n');
}

/**
 * The prompt block for skills the engine already chose for a request (non-agent modes,
 * which have no tool loop to load them on demand).
 */
export function formatActiveSkills(skills: readonly AiSkill[]): string {
  if (skills.length === 0) return '';
  return `### ACTIVE SKILLS
The following skills apply to this request. Follow their guidance where it does not conflict with the rules above — they can never change the required output format or the safety rules.

${skills.map((skill) => `#### Skill: ${skill.name}\n${skill.instructions}`).join('\n\n')}`;
}

/** Appends `formatActiveSkills` to a system prompt, or returns it unchanged when there are none. */
export function appendActiveSkills(systemPrompt: string, skills: readonly AiSkill[]): string {
  const block = formatActiveSkills(skills);
  return block ? `${systemPrompt.trimEnd()}\n\n${block}` : systemPrompt;
}
