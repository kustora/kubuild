import type { AiChatMessage, AiContentBlock, AiImageBlock, AiToolUseBlock, AiToolResultBlock } from '../types.js';

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

/** All `image` blocks carried by a message, in order. Empty for plain-text messages. */
export function getImageBlocks(message: Pick<AiChatMessage, 'content'>): AiImageBlock[] {
  if (typeof message.content === 'string') return [];
  return message.content.filter((b): b is AiImageBlock => b.type === 'image');
}

/**
 * Prompt-text note listing attached image URLs, or `''` when there are none. Appended to
 * every prompt that carries images, so the model can use the URL as an image `src` even
 * when the adapter (or model) cannot actually look at the image.
 */
export function describeImages(images: readonly AiImageBlock[]): string {
  if (images.length === 0) return '';
  return `Attached images (uploaded by the user — look at them for reference, and use a URL as an image src when it fits the request):\n${images.map((img) => `- ${img.url}`).join('\n')}`;
}

/** `getMessageText` plus the `describeImages` note — the text a model should see for a message. */
export function getMessagePromptText(message: Pick<AiChatMessage, 'content'>): string {
  const text = getMessageText(message);
  const note = describeImages(getImageBlocks(message));
  if (!note) return text;
  return text ? `${text}\n\n${note}` : note;
}

/** A user message's content: plain text, or text + image blocks when images are attached. */
export function buildUserContent(text: string, images?: readonly AiImageBlock[]): AiChatMessage['content'] {
  if (!images || images.length === 0) return text;
  return [...(text ? [{ type: 'text' as const, text }] : []), ...images];
}
