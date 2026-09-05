/**
 * Shared SSE (server-sent events) frame reader for provider adapters that support
 * token-level streaming (STORA-515) — OpenAI, Anthropic and Gemini all expose their
 * streaming APIs as `data: <json>\n\n` frames, so every adapter reuses this single
 * low-level reader instead of re-implementing buffering/decoding three times.
 *
 * Yields the raw string payload of each `data:` line (already trimmed), in arrival
 * order. Callers are responsible for `JSON.parse`-ing (or ignoring sentinel values
 * like OpenAI's `[DONE]`) and for interpreting provider-specific event shapes.
 */
export async function* readSseDataLines(
  body: ReadableStream<Uint8Array>,
  signal?: AbortSignal,
): AsyncGenerator<string, void, void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      if (signal?.aborted) {
        throw new Error('Streaming aborted by client');
      }

      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const frames = buffer.split('\n\n');
      buffer = frames.pop() || '';

      for (const frame of frames) {
        for (const line of frame.split('\n')) {
          const trimmed = line.trim();
          if (trimmed.startsWith('data:')) {
            yield trimmed.slice(5).trim();
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
