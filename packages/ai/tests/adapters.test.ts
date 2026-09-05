import { describe, it, expect, vi, afterEach } from 'vitest';
import { GeminiAdapter } from '../src/server/adapters/gemini';
import { OpenAiAdapter } from '../src/server/adapters/openai';
import { AnthropicAdapter } from '../src/server/adapters/anthropic';
import { CustomHttpAdapter } from '../src/server/adapters/custom';

describe('AI Adapters', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe('GeminiAdapter', () => {
    it('throws if apiKey is missing', () => {
      expect(() => new GeminiAdapter({ apiKey: '' })).toThrow();
    });

    it('sends proper request structure to Google Gemini API', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [{ text: '{"result": "gemini-ok"}' }],
              },
            },
          ],
          usageMetadata: { promptTokenCount: 15, candidatesTokenCount: 25 },
        }),
      });
      globalThis.fetch = mockFetch;

      const adapter = new GeminiAdapter({
        apiKey: 'test-gemini-key',
        model: 'gemini-2.5-flash',
      });

      const res = await adapter.generate({
        systemPrompt: 'System rules',
        userPrompt: 'User prompt',
      });

      expect(res.text).toBe('{"result": "gemini-ok"}');
      expect(res.usage?.promptTokens).toBe(15);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      const [calledUrl, calledOptions] = mockFetch.mock.calls[0];
      expect(calledUrl).toContain('models/gemini-2.5-flash:generateContent');
      expect(calledUrl).toContain('key=test-gemini-key');

      const body = JSON.parse(calledOptions.body);
      expect(body.system_instruction.parts[0].text).toBe('System rules');
      expect(body.contents[0].parts[0].text).toBe('User prompt');
    });
  });

  describe('OpenAiAdapter', () => {
    it('throws if apiKey is missing', () => {
      expect(() => new OpenAiAdapter({ apiKey: '' })).toThrow();
    });

    it('sends proper request structure to OpenAI API', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: { content: '{"result": "openai-ok"}' },
            },
          ],
          usage: { prompt_tokens: 30, completion_tokens: 40 },
        }),
      });
      globalThis.fetch = mockFetch;

      const adapter = new OpenAiAdapter({
        apiKey: 'sk-test-key',
        model: 'gpt-4o',
      });

      const res = await adapter.generate({
        systemPrompt: 'System rules',
        userPrompt: 'User prompt',
      });

      expect(res.text).toBe('{"result": "openai-ok"}');
      expect(res.usage?.completionTokens).toBe(40);

      const [calledUrl, calledOptions] = mockFetch.mock.calls[0];
      expect(calledUrl).toBe('https://api.openai.com/v1/chat/completions');
      expect(calledOptions.headers.Authorization).toBe('Bearer sk-test-key');

      const body = JSON.parse(calledOptions.body);
      expect(body.model).toBe('gpt-4o');
      expect(body.messages[0].content).toBe('System rules');
      expect(body.messages[1].content).toBe('User prompt');
    });
  });

  describe('AnthropicAdapter', () => {
    it('throws if apiKey is missing', () => {
      expect(() => new AnthropicAdapter({ apiKey: '' })).toThrow();
    });

    it('sends proper request structure to Anthropic Messages API', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          content: [
            {
              type: 'text',
              text: '{"result": "claude-ok"}',
            },
          ],
          usage: { input_tokens: 22, output_tokens: 44 },
        }),
      });
      globalThis.fetch = mockFetch;

      const adapter = new AnthropicAdapter({
        apiKey: 'ant-test-key',
        model: 'claude-3-5-sonnet-20241022',
      });

      const res = await adapter.generate({
        systemPrompt: 'Claude system prompt',
        userPrompt: 'Claude user prompt',
      });

      expect(res.text).toBe('{"result": "claude-ok"}');
      expect(res.usage?.promptTokens).toBe(22);
      expect(res.usage?.completionTokens).toBe(44);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      const [calledUrl, calledOptions] = mockFetch.mock.calls[0];
      expect(calledUrl).toBe('https://api.anthropic.com/v1/messages');
      expect(calledOptions.headers['x-api-key']).toBe('ant-test-key');
      expect(calledOptions.headers['anthropic-version']).toBe('2023-06-01');

      const body = JSON.parse(calledOptions.body);
      expect(body.model).toBe('claude-3-5-sonnet-20241022');
      expect(body.system).toBe('Claude system prompt');
      expect(body.messages[0].role).toBe('user');
      expect(body.messages[0].content).toBe('Claude user prompt');
    });
  });

  describe('CustomHttpAdapter', () => {
    it('sends custom body and parses custom responses', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          response: '{"result": "ollama-ok"}',
        }),
      });
      globalThis.fetch = mockFetch;

      const adapter = new CustomHttpAdapter({
        url: 'http://localhost:11434/api/generate',
      });

      const res = await adapter.generate({
        systemPrompt: 'System rules',
        userPrompt: 'User prompt',
      });

      expect(res.text).toBe('{"result": "ollama-ok"}');
    });
  });
});
