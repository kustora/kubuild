import { describe, it, expect, vi, afterAll } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { PageDocument } from '@kubuild/schema';
import { parseSkill, SkillParseError, isValidSkillName, formatActiveSkills } from '../src/core/skills';
import { loadSkillsFromDirectory } from '../src/server/skills-loader';
import { createSkillTools } from '../src/server/tools/skill-tools';
import { KubuildAiAgent } from '../src/server/agent';
import { KubuildAiEngine } from '../src/server/engine';
import type {
  AiProviderAdapter,
  AiProviderGenerateParams,
  AiProviderGenerateResult,
  AiSkill,
  AiStreamEvent,
} from '../src/types';

const SALES: AiSkill = {
  name: 'sales-page',
  description: 'Long-form sales page structure. Use when building a page that sells a product.',
  instructions: 'Open with the problem, then the offer, then proof, then a guarantee.',
  files: { 'references/sections.md': '1. Hero\n2. Problem' },
};
const LEAD: AiSkill = {
  name: 'lead-capture',
  description: 'Opt-in page that collects emails. Use for lead magnets and free downloads.',
  instructions: 'Keep one form above the fold.',
};

const DOC = {
  schema: 'stora.page',
  version: '1.0.0',
  metadata: { title: 'P', description: '', tags: [], category: 'landing', version: '1.0.0' },
  document: { id: 'root', type: 'page', children: [{ id: 'hero', type: 'section', children: [] }] },
} as PageDocument;

describe('parseSkill', () => {
  it('reads name, description and body', () => {
    const skill = parseSkill(`---\nname: sales-page\ndescription: "Sells things. Use for sales pages."\nmetadata:\n  author: x\n---\n# Steps\nDo it.\n`);
    expect(skill).toEqual({ name: 'sales-page', description: 'Sells things. Use for sales pages.', instructions: '# Steps\nDo it.' });
  });

  it('supports a folded block-scalar description', () => {
    const skill = parseSkill(`---\nname: a-b\ndescription: >\n  First line\n  second line.\n---\nBody`);
    expect(skill.description).toBe('First line second line.');
  });

  it('keeps bundled files', () => {
    const skill = parseSkill('---\nname: x\ndescription: d\n---\nB', { 'references/r.md': 'R' });
    expect(skill.files).toEqual({ 'references/r.md': 'R' });
  });

  it.each([
    ['no frontmatter', '# Just markdown'],
    ['uppercase name', '---\nname: Sales\ndescription: d\n---\n'],
    ['double hyphen', '---\nname: a--b\ndescription: d\n---\n'],
    ['missing description', '---\nname: ok\n---\n'],
  ])('rejects %s', (_label, markdown) => {
    expect(() => parseSkill(markdown)).toThrow(SkillParseError);
  });

  it('validates names per the spec', () => {
    expect(isValidSkillName('a-1')).toBe(true);
    expect(isValidSkillName('-a')).toBe(false);
    expect(isValidSkillName('a'.repeat(65))).toBe(false);
  });
});

describe('loadSkillsFromDirectory', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'kubuild-skills-'));
  afterAll(() => rmSync(root, { recursive: true, force: true }));

  function writeSkill(dir: string, name: string) {
    mkdirSync(path.join(dir, 'references'), { recursive: true });
    mkdirSync(path.join(dir, 'scripts'), { recursive: true });
    writeFileSync(path.join(dir, 'SKILL.md'), `---\nname: ${name}\ndescription: Does ${name}.\n---\nSteps for ${name}.`);
    writeFileSync(path.join(dir, 'references', 'guide.md'), 'Guide');
    writeFileSync(path.join(dir, 'references', 'logo.png'), 'binary');
    writeFileSync(path.join(dir, 'scripts', 'run.sh'), 'rm -rf /');
  }

  it('loads each skill folder with its reference text files, never scripts', async () => {
    const dir = path.join(root, 'ok');
    writeSkill(path.join(dir, 'beta'), 'beta');
    writeSkill(path.join(dir, 'alpha'), 'alpha');
    mkdirSync(path.join(dir, 'not-a-skill'));

    const skills = await loadSkillsFromDirectory(dir);
    expect(skills.map((s) => s.name)).toEqual(['alpha', 'beta']);
    expect(skills[0].instructions).toBe('Steps for alpha.');
    expect(skills[0].files).toEqual({ 'references/guide.md': 'Guide' });
  });

  it('rejects a skill whose name does not match its folder', async () => {
    const dir = path.join(root, 'mismatch');
    writeSkill(path.join(dir, 'folder-name'), 'other-name');
    await expect(loadSkillsFromDirectory(dir)).rejects.toThrow(SkillParseError);
  });
});

describe('skill tools', () => {
  const [loadSkill, readSkillFile] = createSkillTools([SALES, LEAD]);
  const ctx = { document: DOC, catalog: [] };

  it('load_skill returns the instructions and the file list', async () => {
    const result = await loadSkill.execute({ name: 'sales-page' }, ctx);
    expect(result.ok).toBe(true);
    expect(result.content).toMatchObject({
      instructions: SALES.instructions,
      files: ['references/sections.md'],
    });
  });

  it('load_skill fails for an unknown skill, listing the real ones', async () => {
    const result = await loadSkill.execute({ name: 'nope' }, ctx);
    expect(result.ok).toBe(false);
    expect(JSON.stringify(result.content)).toContain('sales-page');
  });

  it('read_skill_file only returns bundled files', async () => {
    expect((await readSkillFile.execute({ name: 'sales-page', path: 'references/sections.md' }, ctx)).ok).toBe(true);
    expect((await readSkillFile.execute({ name: 'sales-page', path: '../../etc/passwd' }, ctx)).ok).toBe(false);
  });
});

function scriptedAdapter(turns: Array<Partial<AiProviderGenerateResult>>) {
  const calls: AiProviderGenerateParams[] = [];
  let index = 0;
  const adapter: AiProviderAdapter = {
    name: 'scripted',
    supportsTools: true,
    async generate(params) {
      calls.push(params);
      const turn = turns[Math.min(index++, turns.length - 1)];
      return { text: '', stopReason: 'stop', ...turn } as AiProviderGenerateResult;
    },
  };
  return { adapter, calls };
}

async function drain(events: AsyncIterable<AiStreamEvent>): Promise<AiStreamEvent[]> {
  const out: AiStreamEvent[] = [];
  for await (const e of events) out.push(e);
  return out;
}

describe('agent with skills', () => {
  it('lists skills in the prompt and offers the skill tools', async () => {
    const { adapter, calls } = scriptedAdapter([{ text: 'done' }]);
    const agent = new KubuildAiAgent({ adapter, skills: [SALES, LEAD] });
    await drain(agent.run({ messages: [{ role: 'user', content: 'hi' }], document: DOC }));

    expect(calls[0].systemPrompt).toContain('### SKILLS');
    expect(calls[0].systemPrompt).toContain(`- sales-page: ${SALES.description}`);
    expect(calls[0].systemPrompt).not.toContain(SALES.instructions);
    expect(calls[0].tools?.map((t) => t.name)).toEqual(expect.arrayContaining(['load_skill', 'read_skill_file']));
  });

  it('has no skill section or tools when no skills are configured', async () => {
    const { adapter, calls } = scriptedAdapter([{ text: 'done' }]);
    await drain(new KubuildAiAgent({ adapter }).run({ messages: [{ role: 'user', content: 'hi' }], document: DOC }));
    expect(calls[0].systemPrompt).not.toContain('### SKILLS');
    expect(calls[0].tools?.map((t) => t.name)).not.toContain('load_skill');
  });

  it('generates insert_section with the skills the run loaded', async () => {
    const { adapter } = scriptedAdapter([
      { stopReason: 'tool_calls', toolCalls: [{ type: 'tool_use', id: 'c1', name: 'load_skill', input: { name: 'sales-page' } }] },
      { stopReason: 'tool_calls', toolCalls: [{ type: 'tool_use', id: 'c2', name: 'insert_section', input: { prompt: 'a hero' } }] },
      { text: 'done' },
    ]);
    const generateSection = vi.fn().mockResolvedValue({
      success: true,
      data: { id: 'new-sec', type: 'section', children: [] },
    });
    const engine = { generateSection } as unknown as KubuildAiEngine;
    const agent = new KubuildAiAgent({ adapter, skills: [SALES, LEAD], engine });
    await drain(agent.run({ messages: [{ role: 'user', content: 'add a hero' }], document: DOC }));

    expect(generateSection).toHaveBeenCalledTimes(1);
    expect(generateSection.mock.calls[0][1].skills).toEqual([SALES]);
  });
});

describe('engine skill selection (non-agent modes)', () => {
  const sectionJson = JSON.stringify({ id: 's1', type: 'section', children: [] });
  const planJson = JSON.stringify({ title: 'T', sections: [{ type: 'hero', title: 'Hero', prompt: 'hero' }] });

  /** Answers the skill-router call with `routerReply`, every other call with `reply`. */
  function routedAdapter(routerReply: string | Error, reply: string) {
    const calls: AiProviderGenerateParams[] = [];
    const adapter: AiProviderAdapter = {
      name: 'routed',
      async generate(params) {
        calls.push(params);
        if (params.systemPrompt.startsWith('You route a website-builder request')) {
          if (routerReply instanceof Error) throw routerReply;
          return { text: routerReply };
        }
        return { text: reply };
      },
    };
    return { adapter, calls };
  }

  it('adds the chosen skills to the prompt', async () => {
    const { adapter, calls } = routedAdapter('{"skills":["sales-page"]}', planJson);
    await new KubuildAiEngine({ adapter, skills: [SALES, LEAD] }).planPage({ prompt: 'sell my course' });

    expect(calls).toHaveLength(2);
    expect(calls[0].userPrompt).toContain('sell my course');
    expect(calls[1].systemPrompt).toContain(formatActiveSkills([SALES]));
    expect(calls[1].systemPrompt).not.toContain(LEAD.instructions);
  });

  it('ignores unknown names and caps the pick at two', async () => {
    const extra: AiSkill = { name: 'third', description: 'd', instructions: 'third rules' };
    const { adapter, calls } = routedAdapter('{"skills":["made-up","lead-capture","sales-page","third"]}', planJson);
    await new KubuildAiEngine({ adapter, skills: [SALES, LEAD, extra] }).planPage({ prompt: 'p' });
    expect(calls[1].systemPrompt).toContain(SALES.instructions);
    expect(calls[1].systemPrompt).toContain(LEAD.instructions);
    expect(calls[1].systemPrompt).not.toContain('third rules');
  });

  it('carries on without skills when the pick fails', async () => {
    const { adapter, calls } = routedAdapter(new Error('router down'), planJson);
    const res = await new KubuildAiEngine({ adapter, skills: [SALES] }).planPage({ prompt: 'p' });
    expect(res.success).toBe(true);
    expect(calls[1].systemPrompt).not.toContain('ACTIVE SKILLS');
  });

  it('makes no extra call when no skills are configured', async () => {
    const { adapter, calls } = routedAdapter('{"skills":[]}', planJson);
    await new KubuildAiEngine({ adapter }).planPage({ prompt: 'p' });
    expect(calls).toHaveLength(1);
  });

  it('streamPage picks once and applies the skills to the plan and every section', async () => {
    let n = 0;
    const calls: AiProviderGenerateParams[] = [];
    const adapter: AiProviderAdapter = {
      name: 'stream',
      async generate(params) {
        calls.push(params);
        n++;
        if (n === 1) return { text: '{"skills":["sales-page"]}' };
        if (n === 2) return { text: JSON.stringify({ title: 'T', sections: [{ type: 'hero', title: 'H', prompt: 'h' }, { type: 'cta', title: 'C', prompt: 'c' }] }) };
        return { text: sectionJson };
      },
    };
    const events = await drain(new KubuildAiEngine({ adapter, skills: [SALES, LEAD] }).streamPage({ prompt: 'sell' }));

    expect(calls).toHaveLength(4); // router + plan + 2 sections — no per-section re-pick
    for (const call of calls.slice(1)) expect(call.systemPrompt).toContain(SALES.instructions);
    expect(events.some((e) => e.type === 'status' && e.message.includes('sales-page'))).toBe(true);
  });
});
