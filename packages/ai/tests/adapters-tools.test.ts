import { describe, it, expect, vi, afterEach } from 'vitest';
import { OpenAiAdapter } from '../src/server/adapters/openai';
import type { AiToolDefinition } from '../src/types';

const TOOLS: AiToolDefinition[] = [
  {
    name: 'update_node_props',
    description: 'Update props of a node',
    inputSchema: {
      type: 'object',
      properties: { nodeId: { type: 'string' }, props: { type: 'object' } },
      required: ['nodeId', 'props'],
    },
  },
];

function sseStream(frames: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const frame of frames) controller.enqueue(encoder.encode(frame));
      controller.close();
    },
  });
}

async function collectStream(gen: AsyncGenerator<string, unknown, void>) {
  const chunks: string[] = [];
  let result: unknown;
  while (true) {
    const { value, done } = await gen.next();
    if (done) {
      result = value;
      break;
    }
    chunks.push(value as string);
  }
  return { chunks, result };
}

describe('OpenAiAdapter tool calling (STORA-530)', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('advertises tool support so the agent loop will accept it', () => {
    expect(new OpenAiAdapter({ apiKey: 'sk-test' }).supportsTools).toBe(true);
  });

  it('forwards tools as OpenAI function definitions and omits response_format', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ finish_reason: 'stop', message: { content: 'done' } }],
      }),
    });
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    const adapter = new OpenAiAdapter({ apiKey: 'sk-test' });
    await adapter.generate({
      // mentions "JSON" on purpose: without tools this would trigger json_object mode,
      // which OpenAI rejects when combined with tools.
      systemPrompt: 'Return JSON only',
      userPrompt: 'hi',
      tools: TOOLS,
      toolChoice: 'auto',
    });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.tools).toEqual([
      {
        type: 'function',
        function: {
          name: 'update_node_props',
          description: 'Update props of a node',
          parameters: TOOLS[0].inputSchema,
        },
      },
    ]);
    expect(body.tool_choice).toBe('auto');
    expect(body.response_format).toBeUndefined();
  });

  it('parses tool_calls into tool_use blocks with stopReason "tool_calls"', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            finish_reason: 'tool_calls',
            message: {
              content: null,
              tool_calls: [
                {
                  id: 'call_1',
                  type: 'function',
                  function: {
                    name: 'update_node_props',
                    arguments: '{"nodeId":"cta-btn","props":{"label":"Mulai"}}',
                  },
                },
              ],
            },
          },
        ],
        usage: { prompt_tokens: 12, completion_tokens: 8 },
      }),
    }) as unknown as typeof fetch;

    const adapter = new OpenAiAdapter({ apiKey: 'sk-test' });
    const result = await adapter.generate({
      systemPrompt: 'sys',
      userPrompt: 'ubah label tombol',
      tools: TOOLS,
    });

    expect(result.stopReason).toBe('tool_calls');
    expect(result.text).toBe('');
    expect(result.toolCalls).toEqual([
      {
        type: 'tool_use',
        id: 'call_1',
        name: 'update_node_props',
        input: { nodeId: 'cta-btn', props: { label: 'Mulai' } },
      },
    ]);
  });

  it('degrades a malformed arguments blob to empty input instead of throwing', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            finish_reason: 'tool_calls',
            message: {
              content: null,
              tool_calls: [
                { id: 'call_1', type: 'function', function: { name: 'update_node_props', arguments: '{"nodeId":' } },
              ],
            },
          },
        ],
      }),
    }) as unknown as typeof fetch;

    const adapter = new OpenAiAdapter({ apiKey: 'sk-test' });
    const result = await adapter.generate({ systemPrompt: 's', userPrompt: 'u', tools: TOOLS });

    // The executor rejects this with a tool_result error and the model retries — far
    // better than aborting the whole run.
    expect(result.toolCalls).toEqual([
      { type: 'tool_use', id: 'call_1', name: 'update_node_props', input: {} },
    ]);
  });

  it('maps tool_use/tool_result blocks onto OpenAI assistant tool_calls + role:"tool" messages', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ finish_reason: 'stop', message: { content: 'ok' } }] }),
    });
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    const adapter = new OpenAiAdapter({ apiKey: 'sk-test' });
    await adapter.generate({
      systemPrompt: 'sys',
      userPrompt: '',
      tools: TOOLS,
      messages: [
        { role: 'user', content: 'ubah warna tombol' },
        {
          role: 'assistant',
          content: [
            { type: 'text', text: 'Saya ubah tombolnya.' },
            { type: 'tool_use', id: 'call_1', name: 'update_node_props', input: { nodeId: 'b1' } },
          ],
        },
        {
          role: 'user',
          content: [{ type: 'tool_result', toolUseId: 'call_1', content: '{"ok":true}' }],
        },
      ],
    });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.messages).toEqual([
      { role: 'system', content: 'sys' },
      { role: 'user', content: 'ubah warna tombol' },
      {
        role: 'assistant',
        content: 'Saya ubah tombolnya.',
        tool_calls: [
          {
            id: 'call_1',
            type: 'function',
            function: { name: 'update_node_props', arguments: '{"nodeId":"b1"}' },
          },
        ],
      },
      { role: 'tool', content: '{"ok":true}', tool_call_id: 'call_1' },
    ]);
  });

  it('accumulates fragmented tool_call argument deltas while streaming', async () => {
    const frames = [
      `data: ${JSON.stringify({
        choices: [
          {
            delta: {
              tool_calls: [
                { index: 0, id: 'call_1', type: 'function', function: { name: 'update_node_props', arguments: '{"nodeId"' } },
              ],
            },
          },
        ],
      })}\n\n`,
      `data: ${JSON.stringify({
        choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: ':"cta-btn"}' } }] } }],
      })}\n\n`,
      `data: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: 'tool_calls' }] })}\n\n`,
      `data: [DONE]\n\n`,
    ];
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue({ ok: true, body: sseStream(frames) }) as unknown as typeof fetch;

    const adapter = new OpenAiAdapter({ apiKey: 'sk-test' });
    const { chunks, result } = await collectStream(
      adapter.generateStream!({ systemPrompt: 'sys', userPrompt: 'u', tools: TOOLS }),
    );

    // Tool call deltas are not part of the visible assistant message.
    expect(chunks).toEqual([]);
    expect(result).toMatchObject({
      text: '',
      stopReason: 'tool_calls',
      toolCalls: [
        { type: 'tool_use', id: 'call_1', name: 'update_node_props', input: { nodeId: 'cta-btn' } },
      ],
    });
  });
});
