import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { createBlankDocument } from '@kubuild/core';
import { createDefaultComponentRegistry } from '@kubuild/components';
import type { AiProviderAdapter } from '@kubuild/ai';
import { useEditorStore } from '../src/store';
import { KubuildEditor } from '../src/components/layout/editor';
import {
  resolveAiEditorConfig,
  isAnyAiFeatureEnabled,
  shouldRenderAiChatPanel,
} from '../src/config';
import {
  AiChatPanel,
  AiChatBubble,
  AiChatTypingIndicator,
  AiChatErrorBubble,
} from '../src/components/ai-chat/ai-chat-panel';

describe('AiChatPanel (STORA-503, STORA-505, STORA-506)', () => {
  const registry = createDefaultComponentRegistry();

  const fakeAdapter: AiProviderAdapter = {
    name: 'fake',
    generate: async () => ({ text: '{}' }),
  };

  const enabledConfig = resolveAiEditorConfig({
    provider: { endpoint: '/api/ai' },
    features: { chat: true },
  });

  beforeEach(() => {
    const doc = createBlankDocument('AI Chat Panel Test');
    useEditorStore.getState().setDocument(doc);
    useEditorStore.getState().selectNode(null);
    useEditorStore.getState().setAiChatMode('hidden');
  });

  describe('isAnyAiFeatureEnabled', () => {
    it('is false when ai config is omitted', () => {
      expect(isAnyAiFeatureEnabled(resolveAiEditorConfig())).toBe(false);
    });

    it('is false when a provider is given but every feature flag is false/omitted', () => {
      expect(isAnyAiFeatureEnabled(resolveAiEditorConfig({ provider: fakeAdapter }))).toBe(false);
    });

    it('is true once at least one feature flag is true', () => {
      expect(
        isAnyAiFeatureEnabled(
          resolveAiEditorConfig({ provider: fakeAdapter, features: { enhance: true } }),
        ),
      ).toBe(true);
    });
  });

  describe('shouldRenderAiChatPanel (STORA-503 docked/floating/hidden gating)', () => {
    // Zustand v5's SSR snapshot (`getServerSnapshot` → `store.getInitialState()`) always
    // reflects the store's state *at module creation*, never a mutation applied right before
    // a `renderToString` call in tests — so the docked/floating/hidden gate that reads
    // `aiChatMode` from the store inside `KubuildEditor` is verified here as pure boolean
    // logic instead of through a full-editor SSR render.
    it('never renders (either slot) when AI features are disabled, regardless of aiChatMode', () => {
      expect(shouldRenderAiChatPanel(false, 'docked', 'docked')).toBe(false);
      expect(shouldRenderAiChatPanel(false, 'floating', 'floating')).toBe(false);
    });

    it('renders the docked slot only when aiChatMode is docked', () => {
      expect(shouldRenderAiChatPanel(true, 'docked', 'docked')).toBe(true);
      expect(shouldRenderAiChatPanel(true, 'floating', 'docked')).toBe(false);
      expect(shouldRenderAiChatPanel(true, 'hidden', 'docked')).toBe(false);
    });

    it('renders the floating slot only when aiChatMode is floating', () => {
      expect(shouldRenderAiChatPanel(true, 'floating', 'floating')).toBe(true);
      expect(shouldRenderAiChatPanel(true, 'docked', 'floating')).toBe(false);
      expect(shouldRenderAiChatPanel(true, 'hidden', 'floating')).toBe(false);
    });

    it('never renders either slot when aiChatMode is hidden', () => {
      expect(shouldRenderAiChatPanel(true, 'hidden', 'docked')).toBe(false);
      expect(shouldRenderAiChatPanel(true, 'hidden', 'floating')).toBe(false);
    });
  });

  describe('mode rendering: docked | floating | hidden', () => {
    it('renders a fixed-position floating shell in floating mode', () => {
      const html = renderToString(<AiChatPanel aiConfig={enabledConfig} mode="floating" />);
      expect(html).toContain('data-testid="ai-chat-panel"');
      expect(html).toContain('data-mode="floating"');
      expect(html).toContain('AI Assistant');
    });

    it('renders a plain flex-fill shell (no fixed positioning) in docked mode', () => {
      const html = renderToString(<AiChatPanel aiConfig={enabledConfig} mode="docked" />);
      expect(html).toContain('data-testid="ai-chat-panel"');
      expect(html).toContain('data-mode="docked"');
      expect(html).not.toContain('fixed bottom-4 right-4');
    });

    it("'hidden' mode is the caller's responsibility: KubuildEditor renders zero ai-chat-panel nodes by default (store's true initial aiChatMode is 'hidden')", () => {
      const html = renderToString(
        <KubuildEditor
          registry={registry}
          ai={{ provider: fakeAdapter, features: { chat: true } }}
        />,
      );
      expect(html).not.toContain('data-testid="ai-chat-panel"');
    });
  });

  describe('zero-cost when AI is fully disabled', () => {
    it('never mounts the panel when no ai prop is given at all', () => {
      const html = renderToString(<KubuildEditor registry={registry} />);
      expect(html).not.toContain('data-testid="ai-chat-panel"');
      expect(html).not.toContain('AI Assistant');
    });

    it('never mounts the panel when ai is given but every feature flag is false', () => {
      const html = renderToString(
        <KubuildEditor registry={registry} ai={{ provider: fakeAdapter }} />,
      );
      expect(html).not.toContain('data-testid="ai-chat-panel"');
    });
  });

  describe('message bubbles (STORA-505)', () => {
    it('renders user and assistant messages with distinguishing data-role + styling', () => {
      const userHtml = renderToString(
        <AiChatBubble message={{ role: 'user', content: 'Hello there' }} />,
      );
      const assistantHtml = renderToString(
        <AiChatBubble message={{ role: 'assistant', content: 'Hi! How can I help?' }} />,
      );

      expect(userHtml).toContain('data-role="user"');
      expect(userHtml).toContain('Hello there');
      expect(userHtml).toContain('bg-blue-600');

      expect(assistantHtml).toContain('data-role="assistant"');
      expect(assistantHtml).toContain('Hi! How can I help?');
      expect(assistantHtml).toContain('bg-slate-100');
    });

    it('renders the full panel message list in chronological order via initialMessages', () => {
      const html = renderToString(
        <AiChatPanel
          aiConfig={enabledConfig}
          mode="docked"
          initialMessages={[
            { role: 'user', content: 'First question', timestamp: 1 },
            { role: 'assistant', content: 'First answer', timestamp: 2 },
            { role: 'user', content: 'Second question', timestamp: 3 },
          ]}
        />,
      );

      const firstQIdx = html.indexOf('First question');
      const firstAIdx = html.indexOf('First answer');
      const secondQIdx = html.indexOf('Second question');

      expect(firstQIdx).toBeGreaterThan(-1);
      expect(firstAIdx).toBeGreaterThan(firstQIdx);
      expect(secondQIdx).toBeGreaterThan(firstAIdx);
    });
  });

  describe('loading indicator (STORA-505)', () => {
    it('renders a "Thinking…" typing indicator bubble', () => {
      const html = renderToString(<AiChatTypingIndicator />);
      expect(html).toContain('data-testid="ai-chat-loading"');
      expect(html).toContain('Thinking');
    });

    it('the panel shows no loading indicator up-front (no in-flight request on mount)', () => {
      const html = renderToString(<AiChatPanel aiConfig={enabledConfig} mode="docked" />);
      expect(html).not.toContain('data-testid="ai-chat-loading"');
    });
  });

  describe('error state with retry (STORA-505)', () => {
    it('renders an inline error bubble with a Retry action, never silently swallowed', () => {
      const html = renderToString(
        <AiChatErrorBubble message="Network request failed" onRetry={() => {}} />,
      );
      expect(html).toContain('role="alert"');
      expect(html).toContain('data-testid="ai-chat-error"');
      expect(html).toContain('Network request failed');
      expect(html).toContain('data-testid="ai-chat-retry"');
      expect(html).toContain('Retry');
    });

    it('the panel shows no error state up-front (no failed request on mount)', () => {
      const html = renderToString(<AiChatPanel aiConfig={enabledConfig} mode="docked" />);
      expect(html).not.toContain('data-testid="ai-chat-error"');
    });
  });

  describe('active-context chip (STORA-506)', () => {
    // `document`/`selectedNodeId` are passed as explicit prop overrides here (same
    // prop-over-store precedence as `InspectorPanel`) rather than mutating the store right
    // before `renderToString` — see the `shouldRenderAiChatPanel` describe block above for
    // why store mutations don't reach an SSR render in this test environment.
    it('shows a "membahas: #<nodeId>" chip when a node is selected', () => {
      const doc = createBlankDocument('Context Chip Test');
      doc.document.children = [{ id: 'button-1', type: 'button', props: { text: 'Click me' } }];

      const html = renderToString(
        <AiChatPanel
          aiConfig={enabledConfig}
          mode="docked"
          document={doc}
          selectedNodeId="button-1"
        />,
      );

      expect(html).toContain('data-testid="ai-chat-context-chip"');
      expect(html).toContain('button-1');
      expect(html).toContain('membahas:');
      expect(html).toContain('data-testid="ai-chat-context-dismiss"');
    });

    it('includes the node type in the chip label when available', () => {
      const doc = createBlankDocument('Context Chip Type Test');
      doc.document.children = [{ id: 'my-heading', type: 'heading', props: { text: 'Hi' } }];

      const html = renderToString(
        <AiChatPanel
          aiConfig={enabledConfig}
          mode="docked"
          document={doc}
          selectedNodeId="my-heading"
        />,
      );
      expect(html).toContain('heading:');
      expect(html).toContain('my-heading');
    });

    it('does not show the chip when there is no active canvas selection', () => {
      const doc = createBlankDocument('Context Chip No Selection Test');
      const html = renderToString(
        <AiChatPanel aiConfig={enabledConfig} mode="docked" document={doc} selectedNodeId={null} />,
      );
      expect(html).not.toContain('data-testid="ai-chat-context-chip"');
    });

    it('chip disappears automatically once the canvas selection is cleared entirely', () => {
      const doc = createBlankDocument('Context Chip Clear Test');
      doc.document.children = [{ id: 'button-1', type: 'button', props: { text: 'Click me' } }];

      const withSelection = renderToString(
        <AiChatPanel
          aiConfig={enabledConfig}
          mode="docked"
          document={doc}
          selectedNodeId="button-1"
        />,
      );
      expect(withSelection).toContain('data-testid="ai-chat-context-chip"');

      const withoutSelection = renderToString(
        <AiChatPanel aiConfig={enabledConfig} mode="docked" document={doc} selectedNodeId={null} />,
      );
      expect(withoutSelection).not.toContain('data-testid="ai-chat-context-chip"');
    });
  });
});
