/// <reference types="node" />
// Node types are scoped to this file — the rest of the package stays runtime-agnostic.
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import type { AiSkill } from '../types.js';
import { parseSkill, SkillParseError } from '../core/skills.js';

/** Sub-folders whose text files are bundled into `AiSkill.files`. `scripts/` is never read. */
const RESOURCE_DIRS = ['references', 'assets'];
const TEXT_EXTENSIONS = new Set(['.md', '.txt', '.json', '.html', '.csv', '.yaml', '.yml']);
const MAX_FILE_BYTES = 64 * 1024;

async function readResourceFiles(skillDir: string): Promise<Record<string, string>> {
  const files: Record<string, string> = {};
  for (const dir of RESOURCE_DIRS) {
    const entries = await readdir(path.join(skillDir, dir), { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      if (!entry.isFile() || !TEXT_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) continue;
      const filePath = path.join(skillDir, dir, entry.name);
      if ((await stat(filePath)).size > MAX_FILE_BYTES) continue;
      files[`${dir}/${entry.name}`] = await readFile(filePath, 'utf8');
    }
  }
  return files;
}

/**
 * Loads every skill under `rootDir` — one folder per skill, each with a `SKILL.md` whose
 * `name` matches the folder name. Text files in `references/` and `assets/` (one level, up
 * to 64 KB each) become `AiSkill.files`. `scripts/` is deliberately ignored: skill scripts
 * are never executed. Throws `SkillParseError` for an invalid skill, so a broken skill fails
 * at startup instead of silently disappearing.
 */
export async function loadSkillsFromDirectory(rootDir: string): Promise<AiSkill[]> {
  const entries = await readdir(rootDir, { withFileTypes: true });
  const skills: AiSkill[] = [];
  for (const entry of entries.filter((e) => e.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
    const skillDir = path.join(rootDir, entry.name);
    const markdown = await readFile(path.join(skillDir, 'SKILL.md'), 'utf8').catch(() => null);
    if (markdown === null) continue;
    const skill = parseSkill(markdown, await readResourceFiles(skillDir));
    if (skill.name !== entry.name) {
      throw new SkillParseError(`Skill "${skill.name}" must live in a folder named "${skill.name}", not "${entry.name}"`);
    }
    skills.push(skill);
  }
  return skills;
}
