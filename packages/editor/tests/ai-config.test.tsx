import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { createDefaultComponentRegistry } from '@kubuild/components';
import type { AiProviderAdapter } from '@kubuild/ai';
import { KubuildEditor } from '../src/components/layout/editor';
import { resolveAiEditorConfig } from '../src/config';

describe('AiEditorConfig resolution (STORA-501)', () => {
  const registry = createDefaultComponentRegistry();

  const fakeAdapter: AiProviderAdapter = {
    name: 'fake',
    generate: async () => ({ text: '{}' }),
  };

  describe('resolveAiEditorConfig', () => {
    it('resolves every feature to disabled and provider to null when no config is given', () => {
      const resolved = resolveAiEditorConfig();

      expect(resolved.enabled).toBe(false);
      expect(resolved.provider).toBeNull();
      expect(resolved.features.chat).toBe(false);
      expect(resolved.features.generate).toBe(false);
      expect(resolved.features.enhance).toBe(false);
      expect(resolved.defaultPanelMode).toBe('hidden');
      expect(resolved.systemPromptPrefix).toBeUndefined();
    });

    it('resolves provider and defaults feature flags to false when omitted', () => {
      const resolved = resolveAiEditorConfig({ provider: fakeAdapter });

      expect(resolved.enabled).toBe(true);
      expect(resolved.provider).toBe(fakeAdapter);
      expect(resolved.features.chat).toBe(false);
      expect(resolved.features.generate).toBe(false);
      expect(resolved.features.enhance).toBe(false);
      expect(resolved.defaultPanelMode).toBe('hidden');
    });

    it('respects explicit feature flags, panel mode, and system prompt prefix', () => {
      const resolved = resolveAiEditorConfig({
        provider: fakeAdapter,
        features: { chat: true, generate: true, enhance: false },
        defaultPanelMode: 'docked',
        systemPromptPrefix: 'You are KUBUILD assistant.',
      });

      expect(resolved.features.chat).toBe(true);
      expect(resolved.features.generate).toBe(true);
      expect(resolved.features.enhance).toBe(false);
      expect(resolved.defaultPanelMode).toBe('docked');
      expect(resolved.systemPromptPrefix).toBe('You are KUBUILD assistant.');
    });

    it('supports an { endpoint, headers } provider shape (host-proxied AI handler)', () => {
      const resolved = resolveAiEditorConfig({
        provider: { endpoint: '/api/ai', headers: { Authorization: 'Bearer token' } },
      });

      expect(resolved.provider).toEqual({
        endpoint: '/api/ai',
        headers: { Authorization: 'Bearer token' },
      });
    });

    it('defaults individually-omitted feature flags to false alongside explicit ones', () => {
      const resolved = resolveAiEditorConfig({
        provider: fakeAdapter,
        features: { chat: true },
      });

      expect(resolved.features.chat).toBe(true);
      expect(resolved.features.generate).toBe(false);
      expect(resolved.features.enhance).toBe(false);
    });
  });

  describe('KubuildEditor with ai prop', () => {
    it('renders identically with zero AI UI when ai prop is omitted', () => {
      const html = renderToString(<KubuildEditor registry={registry} />);

      expect(html).toContain('data-ai-enabled="false"');
      expect(html).toContain('KUBUILD Editor');
    });

    it('marks data-ai-enabled true once an ai config is supplied, without adding visible chat UI', () => {
      const html = renderToString(
        <KubuildEditor
          registry={registry}
          ai={{ provider: fakeAdapter, features: { chat: true } }}
        />,
      );

      expect(html).toContain('data-ai-enabled="true"');
      // No chat panel exists yet (later epic) — layout stays identical either way.
      expect(html).toContain('KUBUILD Editor');
    });
  });
});
