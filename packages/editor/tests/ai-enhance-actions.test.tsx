import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { createBlankDocument } from '@kubuild/core';
import { createDefaultComponentRegistry } from '@kubuild/components';
import { useEditorStore } from '../src/store';
import { resolveAiEditorConfig } from '../src/config';
import { InspectorPanel } from '../src/components/panels/inspector-panel';
import { AiChatPanel } from '../src/components/ai-chat/ai-chat-panel';

const registry = createDefaultComponentRegistry();

function docWithButton() {
  const doc = createBlankDocument('Enhance Actions Test');
  doc.document.children = [{ id: 'button-1', type: 'button', props: { label: 'Click me' } }];
  return doc;
}

describe('InspectorPanel "Ask AI about this component" (STORA-511)', () => {
  beforeEach(() => {
    useEditorStore.getState().setDocument(createBlankDocument('Reset'));
    useEditorStore.getState().selectNode(null);
    useEditorStore.getState().setAiChatMode('hidden');
  });

  it('renders the action when a node is selected and features.enhance is on', () => {
    const doc = docWithButton();
    const aiConfig = resolveAiEditorConfig({ provider: { endpoint: '/api/ai' }, features: { enhance: true } });

    const html = renderToString(
      <InspectorPanel registry={registry} document={doc} selectedNodeId="button-1" aiConfig={aiConfig} />,
    );

    expect(html).toContain('data-testid="ask-ai-about-component-btn"');
    expect(html).toContain('Ask AI');
  });

  it('does not render when aiConfig is omitted', () => {
    const doc = docWithButton();
    const html = renderToString(<InspectorPanel registry={registry} document={doc} selectedNodeId="button-1" />);
    expect(html).not.toContain('data-testid="ask-ai-about-component-btn"');
  });

  it('does not render when features.enhance is false', () => {
    const doc = docWithButton();
    const aiConfig = resolveAiEditorConfig({ provider: { endpoint: '/api/ai' }, features: { chat: true } });

    const html = renderToString(
      <InspectorPanel registry={registry} document={doc} selectedNodeId="button-1" aiConfig={aiConfig} />,
    );
    expect(html).not.toContain('data-testid="ask-ai-about-component-btn"');
  });

  it('does not render when there is no selected node (Inspector shows its empty state instead)', () => {
    const doc = createBlankDocument('No Selection');
    const aiConfig = resolveAiEditorConfig({ provider: { endpoint: '/api/ai' }, features: { enhance: true } });

    const html = renderToString(
      <InspectorPanel registry={registry} document={doc} selectedNodeId={null} aiConfig={aiConfig} />,
    );
    expect(html).not.toContain('data-testid="ask-ai-about-component-btn"');
    expect(html).toContain('No element selected');
  });
});

describe('AiChatPanel Enhance action (STORA-512/513)', () => {
  it('renders the Enhance button only when features.enhance is on', () => {
    const doc = docWithButton();
    const enhanceEnabled = resolveAiEditorConfig({
      provider: { endpoint: '/api/ai' },
      features: { chat: true, enhance: true },
    });

    const html = renderToString(
      <AiChatPanel
        aiConfig={enhanceEnabled}
        mode="docked"
        registry={registry}
        document={doc}
        selectedNodeId="button-1"
      />,
    );
    expect(html).toContain('data-testid="ai-chat-enhance"');
  });

  it('does not render the Enhance button when features.enhance is off', () => {
    const doc = docWithButton();
    const chatOnly = resolveAiEditorConfig({ provider: { endpoint: '/api/ai' }, features: { chat: true } });

    const html = renderToString(
      <AiChatPanel aiConfig={chatOnly} mode="docked" registry={registry} document={doc} selectedNodeId="button-1" />,
    );
    expect(html).not.toContain('data-testid="ai-chat-enhance"');
  });

  it('the Enhance button is disabled up front (no node attached / no instruction typed on mount)', () => {
    const doc = createBlankDocument('No Selection');
    const enhanceEnabled = resolveAiEditorConfig({
      provider: { endpoint: '/api/ai' },
      features: { enhance: true },
    });

    const html = renderToString(
      <AiChatPanel aiConfig={enhanceEnabled} mode="docked" registry={registry} document={doc} selectedNodeId={null} />,
    );
    // Extract the enhance button's markup and confirm it carries the `disabled` attribute.
    const idx = html.indexOf('data-testid="ai-chat-enhance"');
    expect(idx).toBeGreaterThan(-1);
    const buttonMarkup = html.slice(idx, idx + 250);
    expect(buttonMarkup).toContain('disabled=""');
  });

  it('renders no enhance preview/candidate up front (no request has been made on mount)', () => {
    const doc = docWithButton();
    const enhanceEnabled = resolveAiEditorConfig({
      provider: { endpoint: '/api/ai' },
      features: { enhance: true },
    });

    const html = renderToString(
      <AiChatPanel
        aiConfig={enhanceEnabled}
        mode="docked"
        registry={registry}
        document={doc}
        selectedNodeId="button-1"
      />,
    );
    expect(html).not.toContain('data-testid="ai-enhance-preview"');
    expect(html).not.toContain('data-testid="ai-enhance-loading"');
  });
});
