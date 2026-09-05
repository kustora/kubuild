import { describe, it, expect, vi, afterEach } from 'vitest';
import { KubuildAiEngine } from '../src/server/engine';
import type { AiProviderAdapter } from '../src/types';

/**
 * STORA-518 — every raw console.log/warn/error that used to be scattered through
 * generatePage/streamPage/chat must go through the engine's `logger`/`debug` option,
 * so default behavior (neither configured) is completely silent, and `debug: true` or a
 * custom `logger` still surfaces the same information for development use.
 */
describe('Engine logging (STORA-518)', () => {
  const consoleSpies = ['log', 'warn', 'error', 'debug'] as const;
  let spies: Array<ReturnType<typeof vi.spyOn>>;

  afterEach(() => {
    spies?.forEach((s) => s.mockRestore());
  });

  function spyOnConsole() {
    spies = consoleSpies.map((method) => vi.spyOn(console, method).mockImplementation(() => {}));
    return spies;
  }

  const mockAdapter: AiProviderAdapter = {
    name: 'mock',
    generate: vi.fn().mockResolvedValue({
      text: JSON.stringify({
        schema: 'stora.page',
        version: '1.0.0',
        document: { id: 'root', type: 'page', children: [] },
      }),
    }),
  };

  it('emits nothing to console by default (no debug, no logger)', async () => {
    const consoleSpy = spyOnConsole();
    const engine = new KubuildAiEngine({ adapter: mockAdapter });

    await engine.generatePage({ prompt: 'test' });

    for (const spy of consoleSpy) {
      expect(spy).not.toHaveBeenCalled();
    }
  });

  it('emits nothing to console by default for streamPage either', async () => {
    const consoleSpy = spyOnConsole();
    const streamAdapter: AiProviderAdapter = {
      name: 'mock',
      generate: vi
        .fn()
        .mockResolvedValueOnce({
          text: JSON.stringify({
            title: 'App',
            sections: [{ type: 'hero', title: 'Hero', prompt: 'hero' }],
          }),
        })
        .mockResolvedValueOnce({
          text: JSON.stringify({ id: 'sec-1', type: 'section', children: [] }),
        }),
    };
    const engine = new KubuildAiEngine({ adapter: streamAdapter });

    for await (const _ev of engine.streamPage({ prompt: 'test' })) {
      // drain
    }

    for (const spy of consoleSpy) {
      expect(spy).not.toHaveBeenCalled();
    }
  });

  it('emits nothing to console by default for chat/chatStream either', async () => {
    const consoleSpy = spyOnConsole();
    const chatAdapter: AiProviderAdapter = {
      name: 'mock',
      generate: vi.fn().mockResolvedValue({ text: 'hi there' }),
    };
    const engine = new KubuildAiEngine({ adapter: chatAdapter });

    await engine.chat({ messages: [{ role: 'user', content: 'hi' }] });
    for await (const _ev of engine.chatStream({ messages: [{ role: 'user', content: 'hi' }] })) {
      // drain
    }

    for (const spy of consoleSpy) {
      expect(spy).not.toHaveBeenCalled();
    }
  });

  it('surfaces log lines via console.log when debug: true is set (no custom logger)', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const engine = new KubuildAiEngine({ adapter: mockAdapter, debug: true });

    await engine.generatePage({ prompt: 'test' });

    expect(logSpy).toHaveBeenCalled();
    // Sanity: at least one call carries the engine's log-line prefix.
    expect(
      logSpy.mock.calls.some((call) => typeof call[0] === 'string' && call[0].includes('[KUBUILD-AI')),
    ).toBe(true);

    logSpy.mockRestore();
  });

  it('routes every log level through a custom logger instead of console, covering generatePage/streamPage/chat', async () => {
    const logger = vi.fn();

    const streamAdapter: AiProviderAdapter = {
      name: 'mock',
      generate: vi
        .fn()
        .mockResolvedValueOnce({
          text: JSON.stringify({
            title: 'App',
            sections: [{ type: 'hero', title: 'Hero', prompt: 'hero' }],
          }),
        })
        .mockResolvedValueOnce({
          text: JSON.stringify({ id: 'sec-1', type: 'section', children: [] }),
        }),
    };

    const engine = new KubuildAiEngine({ adapter: streamAdapter, logger });

    for await (const _ev of engine.streamPage({ prompt: 'test' })) {
      // drain
    }

    expect(logger).toHaveBeenCalled();
    // Every call must use one of the four known levels, proving nothing bypassed `log()`.
    for (const call of logger.mock.calls) {
      expect(['info', 'warn', 'error', 'debug']).toContain(call[0]);
      expect(typeof call[1]).toBe('string');
    }

    // No raw console output should have occurred once a custom logger is configured.
    const consoleSpy = spyOnConsole();
    logger.mockClear();
    await engine.chat({ messages: [{ role: 'user', content: 'hi' }] });
    for (const spy of consoleSpy) {
      expect(spy).not.toHaveBeenCalled();
    }
    expect(logger).toHaveBeenCalled();
  });
});
