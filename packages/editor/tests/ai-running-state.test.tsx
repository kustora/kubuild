import { describe, it, expect, afterEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { createBlankDocument, insertNode } from '@kubuild/core';
import { createDefaultComponentRegistry } from '@kubuild/components';
import { useEditorStore } from '../src/store';
import { resolveAiEditorConfig } from '../src/config';
import { AiChatPanel } from '../src/components/ai-chat/ai-chat-panel';
import { en, id } from '../src/i18n';

const registry = createDefaultComponentRegistry();

describe('isAiRunning blocks undo/redo', () => {
  afterEach(() => {
    useEditorStore.getState().setIsAiRunning(false);
  });

  it('undo and redo are no-ops while an AI request is running', () => {
    useEditorStore.getState().setDocument(createBlankDocument('Running'));
    useEditorStore.getState().dispatch((doc) =>
      insertNode(doc, {
        parentId: 'root-page',
        node: { id: 'added', type: 'text', props: { text: 'x' } },
      }),
    );
    const afterInsert = useEditorStore.getState().document;

    useEditorStore.getState().setIsAiRunning(true);
    useEditorStore.getState().undo();
    expect(useEditorStore.getState().document).toBe(afterInsert);

    useEditorStore.getState().setIsAiRunning(false);
    useEditorStore.getState().undo();
    expect(useEditorStore.getState().document).not.toBe(afterInsert);

    useEditorStore.getState().setIsAiRunning(true);
    const beforeRedo = useEditorStore.getState().document;
    useEditorStore.getState().redo();
    expect(useEditorStore.getState().document).toBe(beforeRedo);
  });
});

describe('AiChatPanel visible Generate / Enhance actions', () => {
  it('renders both buttons as visible controls (not in a hidden container) when their flags are on', () => {
    const doc = createBlankDocument('Visible');
    const aiConfig = resolveAiEditorConfig({
      provider: { endpoint: '/api/ai' },
      features: { chat: true, generate: true, enhance: true },
    });
    const html = renderToString(
      <AiChatPanel aiConfig={aiConfig} mode="docked" registry={registry} document={doc} selectedNodeId={null} />,
    );

    expect(html).toContain('data-testid="ai-chat-generate"');
    expect(html).toContain('data-testid="ai-chat-enhance"');
    expect(html).not.toContain('aria-hidden="true"><button');
    expect(html).toContain(en.aiChat.generateButton);
    expect(html).toContain(en.aiChat.enhanceButton);
  });

  it('routes panel copy through i18n (English by default, Indonesian available)', () => {
    const doc = createBlankDocument('i18n');
    const aiConfig = resolveAiEditorConfig({ provider: { endpoint: '/api/ai' }, features: { chat: true } });
    const html = renderToString(
      <AiChatPanel aiConfig={aiConfig} mode="docked" registry={registry} document={doc} selectedNodeId={null} />,
    );
    expect(html).toContain(en.aiChat.placeholderChat);
    expect(html).not.toContain(id.aiChat.placeholderChat);
    expect(id.aiChat.contextChipLabel).toBe('membahas:');
  });
});
