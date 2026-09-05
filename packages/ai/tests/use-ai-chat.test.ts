import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import * as TestRenderer from 'react-test-renderer';
import { useAiChat, type AiChatHistoryStorageAdapter } from '../src/react/use-ai-chat';
import type { AiChatMessage } from '../src/types';

// Tells React this environment intentionally drives effects via `act()` (no
// jsdom/testing-library available in this workspace — see the `renderHook` helper
// below) so it doesn't warn on every `act()` call.
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const { act } = TestRenderer;

/**
 * Minimal `renderHook`-equivalent using `react-test-renderer` (no jsdom/testing-library
 * available in this workspace) — a plain function component that stashes whatever the
 * hook returns into `result.current` on every render.
 */
function renderHook<T>(callback: () => T) {
  const result: { current: T } = { current: undefined as unknown as T };
  function TestComponent() {
    result.current = callback();
    return null;
  }

  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(React.createElement(TestComponent));
  });

  return {
    result,
    unmount: () => {
      act(() => {
        renderer.unmount();
      });
    },
  };
}

function mockNonStreamingChatFetch(responseMessage: AiChatMessage) {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ success: true, data: { message: responseMessage } }),
  });
}

function mockStreamingChatFetch(chunks: string[], finalMessage: AiChatMessage) {
  const ssePayload =
    chunks
      .map((delta, idx) => {
        const content = chunks.slice(0, idx + 1).join('');
        return `event: chat-chunk\ndata: ${JSON.stringify({ type: 'chat-chunk', delta, content })}\n\n`;
      })
      .join('') +
    `event: chat-complete\ndata: ${JSON.stringify({ type: 'chat-complete', message: finalMessage })}\n\n`;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(ssePayload));
      controller.close();
    },
  });

  return vi.fn().mockResolvedValue({ ok: true, body: stream });
}

describe('useAiChat history storage adapter (STORA-520)', () => {
  it('without an adapter, behaves exactly as before: pure in-memory, fresh state per hook instance (reload-equivalent)', async () => {
    const mockFetch = mockNonStreamingChatFetch({
      role: 'assistant',
      content: 'Hi there',
      timestamp: 1,
    });

    const { result, unmount } = renderHook(() => useAiChat({ endpoint: '/api/ai', fetch: mockFetch }));

    expect(result.current.messages).toEqual([]);

    await act(async () => {
      await result.current.sendMessage('Hello', { stream: false });
    });

    expect(result.current.messages).toHaveLength(2);
    expect(result.current.messages[0]).toMatchObject({ role: 'user', content: 'Hello' });
    expect(result.current.messages[1]).toMatchObject({ role: 'assistant', content: 'Hi there' });

    unmount();

    // A fresh hook instance is the reload-equivalent — with no adapter, nothing was ever
    // persisted, so it must start empty again, exactly like before STORA-520.
    const { result: reloaded } = renderHook(() =>
      useAiChat({ endpoint: '/api/ai', fetch: mockFetch }),
    );
    expect(reloaded.current.messages).toEqual([]);
  });

  it('calls loadHistory on mount and hydrates messages from a non-empty adapter result', async () => {
    const seeded: AiChatMessage[] = [
      { role: 'user', content: 'Earlier question', timestamp: 1 },
      { role: 'assistant', content: 'Earlier answer', timestamp: 2 },
    ];
    const adapter: AiChatHistoryStorageAdapter = {
      loadHistory: vi.fn().mockResolvedValue(seeded),
      saveHistory: vi.fn(),
    };

    const { result } = renderHook(() => useAiChat({ endpoint: '/api/ai', historyStorage: adapter }));

    // `loadHistory` resolves asynchronously — flush the microtask queue under `act`.
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(adapter.loadHistory).toHaveBeenCalledTimes(1);
    expect(result.current.messages).toEqual(seeded);
  });

  it('does not clobber a host-provided initialMessages seed when the adapter resolves an empty history', async () => {
    const initial: AiChatMessage[] = [{ role: 'assistant', content: 'Welcome!', timestamp: 1 }];
    const adapter: AiChatHistoryStorageAdapter = {
      loadHistory: vi.fn().mockResolvedValue([]),
      saveHistory: vi.fn(),
    };

    const { result } = renderHook(() =>
      useAiChat({ endpoint: '/api/ai', historyStorage: adapter, initialMessages: initial }),
    );

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(adapter.loadHistory).toHaveBeenCalledTimes(1);
    expect(result.current.messages).toEqual(initial);
  });

  it('saves history at completed-message boundaries only — never once per streaming chunk', async () => {
    const savedSnapshots: AiChatMessage[][] = [];
    const adapter: AiChatHistoryStorageAdapter = {
      loadHistory: vi.fn().mockResolvedValue([]),
      saveHistory: vi.fn((messages: AiChatMessage[]) => {
        savedSnapshots.push(messages);
      }),
    };

    // Three chunk events before completion — if `saveHistory` fired per-chunk we'd see
    // 3+ calls; boundary-based persistence must only ever produce 2 (user message sent,
    // assistant reply completed).
    const mockFetch = mockStreamingChatFetch(['Hel', 'lo', '!'], {
      role: 'assistant',
      content: 'Hello!',
      timestamp: 2,
    });

    const { result } = renderHook(() =>
      useAiChat({ endpoint: '/api/ai', fetch: mockFetch, historyStorage: adapter }),
    );

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    await act(async () => {
      await result.current.sendMessage('Hi'); // default stream: true
    });

    expect(adapter.saveHistory).toHaveBeenCalledTimes(2);

    const finalSnapshot = savedSnapshots[savedSnapshots.length - 1];
    expect(finalSnapshot).toHaveLength(2);
    expect(finalSnapshot[0]).toMatchObject({ role: 'user', content: 'Hi' });
    expect(finalSnapshot[1]).toEqual({ role: 'assistant', content: 'Hello!', timestamp: 2 });
  });

  it('persists an empty array via saveHistory when clearMessages is called', async () => {
    const adapter: AiChatHistoryStorageAdapter = {
      loadHistory: vi.fn().mockResolvedValue([{ role: 'user', content: 'old', timestamp: 1 }]),
      saveHistory: vi.fn(),
    };

    const { result } = renderHook(() => useAiChat({ endpoint: '/api/ai', historyStorage: adapter }));

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.messages).toHaveLength(1);

    act(() => {
      result.current.clearMessages();
    });

    expect(result.current.messages).toEqual([]);
    expect(adapter.saveHistory).toHaveBeenCalledWith([]);
  });
});
