import { describe, it, expect, vi, afterEach } from 'vitest';
import { OpenAiAdapter } from '../src/server/adapters/openai';
import { AnthropicAdapter } from '../src/server/adapters/anthropic';
import { KubuildAiEngine } from '../src/server/engine';
import { processAiRequest, MAX_IMAGES_PER_MESSAGE, MAX_REQUEST_IMAGES } from '../src/server/handler';
import { buildUserContent, getImageBlocks, getMessagePromptText, getMessageText } from '../src/core/messages';
import type { AiImageBlock, AiProviderAdapter, AiProviderGenerateParams } from '../src/types';

const IMAGE: AiImageBlock = { type: 'image', url: 'https://cdn.example.com/hero.png', mimeType: 'image/png' };

describe('image message helpers', () => {
  it('buildUserContent keeps plain text when there are no images', () => {
    expect(buildUserContent('hello')).toBe('hello');
    expect(buildUserContent('hello', [])).toBe('hello');
  });

  it('buildUserContent adds image blocks after the text, and drops empty text', () => {
    expect(buildUserContent('like this', [IMAGE])).toEqual([{ type: 'text', text: 'like this' }, IMAGE]);
    expect(buildUserContent('', [IMAGE])).toEqual([IMAGE]);
  });

  it('getMessagePromptText lists image URLs, while getMessageText stays text-only', () => {
    const message = { content: buildUserContent('use this photo', [IMAGE]) };
    expect(getImageBlocks(message)).toEqual([IMAGE]);
    expect(getMessageText(message)).toBe('use this photo');
    expect(getMessagePromptText(message)).toContain('use this photo');
    expect(getMessagePromptText(message)).toContain(IMAGE.url);
  });
});

describe('adapters send images to vision models', () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  function mockFetch(responseJson: unknown) {
    const fn = vi.fn().mockResolvedValue({ ok: true, json: async () => responseJson });
    globalThis.fetch = fn as unknown as typeof fetch;
    return fn;
  }
  const sentBody = (fn: ReturnType<typeof vi.fn>) => JSON.parse(fn.mock.calls[0][1].body);

  it('OpenAI: a user message with images becomes text + image_url parts', async () => {
    const fetchMock = mockFetch({ choices: [{ finish_reason: 'stop', message: { content: 'ok' } }] });
    await new OpenAiAdapter({ apiKey: 'sk-test' }).generate({
      systemPrompt: 'sys',
      userPrompt: 'ignored',
      messages: [{ role: 'user', content: buildUserContent('copy this layout', [IMAGE]) }],
    });

    const userMessage = sentBody(fetchMock).messages[1];
    expect(userMessage.role).toBe('user');
    expect(userMessage.content[0].type).toBe('text');
    expect(userMessage.content[0].text).toContain('copy this layout');
    expect(userMessage.content[0].text).toContain(IMAGE.url);
    expect(userMessage.content[1]).toEqual({ type: 'image_url', image_url: { url: IMAGE.url } });
  });

  it('OpenAI: params.images ride along with userPrompt when there are no messages', async () => {
    const fetchMock = mockFetch({ choices: [{ finish_reason: 'stop', message: { content: '{}' } }] });
    await new OpenAiAdapter({ apiKey: 'sk-test' }).generate({ systemPrompt: 'sys', userPrompt: 'plan it', images: [IMAGE] });

    expect(sentBody(fetchMock).messages[1].content).toEqual([
      { type: 'text', text: 'plan it' },
      { type: 'image_url', image_url: { url: IMAGE.url } },
    ]);
  });

  it('OpenAI: text-only messages are still sent as plain strings', async () => {
    const fetchMock = mockFetch({ choices: [{ finish_reason: 'stop', message: { content: 'ok' } }] });
    await new OpenAiAdapter({ apiKey: 'sk-test' }).generate({
      systemPrompt: 'sys',
      userPrompt: 'hi',
      messages: [{ role: 'user', content: 'hi' }],
    });
    expect(sentBody(fetchMock).messages[1].content).toBe('hi');
  });

  it('Anthropic: images become url-source image blocks', async () => {
    const fetchMock = mockFetch({ content: [{ type: 'text', text: 'ok' }] });
    await new AnthropicAdapter({ apiKey: 'sk-ant' }).generate({
      systemPrompt: 'sys',
      userPrompt: 'ignored',
      messages: [{ role: 'user', content: buildUserContent('what is this?', [IMAGE]) }],
    });

    const content = sentBody(fetchMock).messages[0].content;
    expect(content[1]).toEqual({ type: 'image', source: { type: 'url', url: IMAGE.url } });
  });
});

describe('engine forwards images to plan/generate/section calls', () => {
  const sectionNode = { id: 'sec-1', type: 'section', props: {}, children: [] };

  function capturingAdapter(responses: (params: AiProviderGenerateParams) => string) {
    const calls: AiProviderGenerateParams[] = [];
    const adapter: AiProviderAdapter = {
      name: 'capture',
      generate: vi.fn(async (params: AiProviderGenerateParams) => {
        calls.push(params);
        return { text: responses(params) };
      }),
    };
    return { adapter, calls };
  }

  it('planPage sends request images and images from the conversation history', async () => {
    const historyImage: AiImageBlock = { type: 'image', url: 'https://cdn.example.com/earlier.png' };
    const { adapter, calls } = capturingAdapter(() =>
      JSON.stringify({ title: 'T', sections: [{ type: 'hero', title: 'Hero', prompt: 'p' }] }),
    );
    await new KubuildAiEngine({ adapter }).planPage({
      prompt: 'make a page like this',
      images: [IMAGE],
      conversationHistory: [{ role: 'user', content: buildUserContent('reference', [historyImage]) }],
    });

    expect(calls[0].images?.map((i) => i.url)).toEqual([historyImage.url, IMAGE.url]);
    expect(calls[0].userPrompt).toContain(IMAGE.url);
    expect(calls[0].userPrompt).toContain(historyImage.url);
  });

  it('streamPage hands the images to every section call', async () => {
    const { adapter, calls } = capturingAdapter(() => JSON.stringify(sectionNode));
    const engine = new KubuildAiEngine({ adapter });
    const plan = {
      title: 'T',
      sections: [
        { type: 'hero', title: 'Hero', prompt: 'hero' },
        { type: 'cta', title: 'CTA', prompt: 'cta' },
      ],
    };
    for await (const _event of engine.streamPage({ prompt: 'p', plan, images: [IMAGE] })) {
      // drain
    }

    expect(calls).toHaveLength(2);
    for (const call of calls) {
      expect(call.images).toEqual([IMAGE]);
      expect(call.userPrompt).toContain(IMAGE.url);
    }
  });
});

describe('processAiRequest image validation', () => {
  const engine = new KubuildAiEngine({
    adapter: { name: 'noop', generate: vi.fn().mockResolvedValue({ text: '{}' }) },
  });

  it('rejects data: URLs', async () => {
    const { status, response } = await processAiRequest(engine, {
      mode: 'plan',
      prompt: 'p',
      images: [{ type: 'image', url: 'data:image/png;base64,AAAA' }],
    });
    expect(status).toBe(400);
    expect(response.error?.code).toBe('INVALID_IMAGES');
  });

  it('rejects image blocks inside chat messages that are not http(s)', async () => {
    const { status } = await processAiRequest(engine, {
      mode: 'chat',
      messages: [{ role: 'user', content: [{ type: 'image', url: 'javascript:alert(1)' }] }],
    });
    expect(status).toBe(400);
  });

  const imagesN = (n: number) =>
    Array.from({ length: n }, (_, i) => ({ type: 'image' as const, url: `https://cdn.example.com/${i}.png` }));

  it('rejects more than the per-message cap', async () => {
    const { status } = await processAiRequest(engine, {
      mode: 'plan',
      prompt: 'p',
      images: imagesN(MAX_IMAGES_PER_MESSAGE + 1),
    });
    expect(status).toBe(400);
  });

  it('allows history to add up past the per-message cap, but not past the request cap', async () => {
    const turn = (n: number) => ({ role: 'user' as const, content: imagesN(n) });
    const fits = await processAiRequest(engine, {
      mode: 'plan',
      prompt: 'p',
      conversationHistory: [turn(MAX_IMAGES_PER_MESSAGE), turn(MAX_IMAGES_PER_MESSAGE)],
    });
    expect(fits.response.error?.code).not.toBe('INVALID_IMAGES');

    const tooMany = Array.from({ length: MAX_REQUEST_IMAGES / MAX_IMAGES_PER_MESSAGE + 1 }, () =>
      turn(MAX_IMAGES_PER_MESSAGE),
    );
    const { status } = await processAiRequest(engine, { mode: 'plan', prompt: 'p', conversationHistory: tooMany });
    expect(status).toBe(400);
  });

  it('accepts hosted https images', async () => {
    const { response } = await processAiRequest(engine, { mode: 'plan', prompt: 'p', images: [IMAGE] });
    expect(response.error?.code).not.toBe('INVALID_IMAGES');
  });
});
