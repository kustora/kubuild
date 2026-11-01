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

describe('InspectorPanel AI tab', () => {
  beforeEach(() => {
    useEditorStore.getState().setDocument(createBlankDocument('Reset'));
    useEditorStore.getState().selectNode(null);
    useEditorStore.getState().setInspectorTab('style');
  });

  const aiConfig = resolveAiEditorConfig({ provider: { endpoint: '/api/ai' }, features: { chat: true } });

  it('renders an AI tab next to Style/Settings when an AI feature is on', () => {
    const html = renderToString(
      <InspectorPanel registry={registry} document={docWithButton()} selectedNodeId="button-1" aiConfig={aiConfig} />,
    );
    expect(html).toContain('data-testid="inspector-tab-style"');
    expect(html).toContain('data-testid="inspector-tab-traits"');
    expect(html).toContain('data-testid="inspector-tab-ai"');
  });

  it('no longer renders the old "Ask AI about this component" card', () => {
    const enhanceConfig = resolveAiEditorConfig({ provider: { endpoint: '/api/ai' }, features: { enhance: true } });
    const html = renderToString(
      <InspectorPanel registry={registry} document={docWithButton()} selectedNodeId="button-1" aiConfig={enhanceConfig} />,
    );
    expect(html).not.toContain('data-testid="ask-ai-about-component-btn"');
  });

  it('does not render the AI tab when aiConfig is omitted', () => {
    const html = renderToString(<InspectorPanel registry={registry} document={docWithButton()} selectedNodeId="button-1" />);
    expect(html).not.toContain('data-testid="inspector-tab-ai"');
  });

  it('does not render the AI tab when every feature flag is off', () => {
    const noFeatures = resolveAiEditorConfig({ provider: { endpoint: '/api/ai' } });
    const html = renderToString(
      <InspectorPanel registry={registry} document={docWithButton()} selectedNodeId="button-1" aiConfig={noFeatures} />,
    );
    expect(html).not.toContain('data-testid="inspector-tab-ai"');
  });

  it('keeps the AI tab reachable with no selection, alongside the empty state', () => {
    const html = renderToString(
      <InspectorPanel registry={registry} document={createBlankDocument('No Selection')} selectedNodeId={null} aiConfig={aiConfig} />,
    );
    expect(html).toContain('data-testid="inspector-tab-ai"');
    expect(html).toContain('No element selected');
  });

  it('does not mount the chat panel until the AI tab is opened', () => {
    const html = renderToString(
      <InspectorPanel registry={registry} document={docWithButton()} selectedNodeId="button-1" aiConfig={aiConfig} />,
    );
    expect(html).not.toContain('data-testid="ai-chat-panel"');
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

describe('AiChatPanel Generate action (STORA-507) — full-page generation trigger', () => {
  it('renders the Generate button only when features.generate is on', () => {
    const doc = createBlankDocument('Generate Test');
    const generateEnabled = resolveAiEditorConfig({
      provider: { endpoint: '/api/ai' },
      features: { chat: true, generate: true },
    });

    const html = renderToString(
      <AiChatPanel aiConfig={generateEnabled} mode="docked" registry={registry} document={doc} selectedNodeId={null} />,
    );
    expect(html).toContain('data-testid="ai-chat-generate"');
  });

  it('does not render the Generate button when features.generate is off', () => {
    const doc = createBlankDocument('Generate Test');
    const chatOnly = resolveAiEditorConfig({ provider: { endpoint: '/api/ai' }, features: { chat: true } });

    const html = renderToString(
      <AiChatPanel aiConfig={chatOnly} mode="docked" registry={registry} document={doc} selectedNodeId={null} />,
    );
    expect(html).not.toContain('data-testid="ai-chat-generate"');
  });

  it('is available with no node selected, unlike Enhance', () => {
    const doc = createBlankDocument('Generate Test');
    const generateEnabled = resolveAiEditorConfig({
      provider: { endpoint: '/api/ai' },
      features: { generate: true },
    });

    const html = renderToString(
      <AiChatPanel aiConfig={generateEnabled} mode="docked" registry={registry} document={doc} selectedNodeId={null} />,
    );
    const idx = html.indexOf('data-testid="ai-chat-generate"');
    expect(idx).toBeGreaterThan(-1);
  });

  it('the Generate button is disabled up front (no prompt typed on mount)', () => {
    const doc = createBlankDocument('Generate Test');
    const generateEnabled = resolveAiEditorConfig({
      provider: { endpoint: '/api/ai' },
      features: { generate: true },
    });

    const html = renderToString(
      <AiChatPanel aiConfig={generateEnabled} mode="docked" registry={registry} document={doc} selectedNodeId={null} />,
    );
    const idx = html.indexOf('data-testid="ai-chat-generate"');
    expect(idx).toBeGreaterThan(-1);
    const buttonMarkup = html.slice(idx, idx + 250);
    expect(buttonMarkup).toContain('disabled=""');
  });

  it('renders no generation status/error/summary up front (no request has been made on mount)', () => {
    const doc = createBlankDocument('Generate Test');
    const generateEnabled = resolveAiEditorConfig({
      provider: { endpoint: '/api/ai' },
      features: { generate: true },
    });

    const html = renderToString(
      <AiChatPanel aiConfig={generateEnabled} mode="docked" registry={registry} document={doc} selectedNodeId={null} />,
    );
    expect(html).not.toContain('data-testid="ai-generate-loading"');
    expect(html).not.toContain('data-testid="ai-generate-summary"');
  });
});
