import type { AiChatMessage, AiContentBlock, AiToolUseBlock, AiToolResultBlock } from '../types';

/**
 * Flattens a message's content to plain text (STORA-530).
 *
 * `AiChatMessage.content` became `string | AiContentBlock[]` when tool calling landed;
 * every place that previously assumed a bare string (adapter message mapping, the chat
 * prompt's "last user message" lookup, chat UIs) goes through this helper instead of
 * re-implementing the narrowing. Tool-use/tool-result blocks contribute nothing to the
 * text rendering — they're transported separately by the adapters.
 */
export function getMessageText(message: Pick<AiChatMessage, 'content'>): string {
  if (typeof message.content === 'string') return message.content;
  return message.content
    .filter((block): block is Extract<AiContentBlock, { type: 'text' }> => block.type === 'text')
    .map((block) => block.text)
    .join('\n');
}

/** All `tool_use` blocks carried by a message, in order. Empty for plain-text messages. */
export function getToolUseBlocks(message: Pick<AiChatMessage, 'content'>): AiToolUseBlock[] {
  if (typeof message.content === 'string') return [];
  return message.content.filter((b): b is AiToolUseBlock => b.type === 'tool_use');
}

/** All `tool_result` blocks carried by a message, in order. */
export function getToolResultBlocks(message: Pick<AiChatMessage, 'content'>): AiToolResultBlock[] {
  if (typeof message.content === 'string') return [];
  return message.content.filter((b): b is AiToolResultBlock => b.type === 'tool_result');
}

/** True when the message carries any non-text block — i.e. adapters must map it structurally. */
export function hasStructuredContent(message: Pick<AiChatMessage, 'content'>): boolean {
  return typeof message.content !== 'string' && message.content.some((b) => b.type !== 'text');
}
