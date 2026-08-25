import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { PageDocument, Node } from '@kubuild/schema';
import { createBlankDocument } from '@kubuild/core';
import { createDefaultComponentRegistry } from '@kubuild/components';
import {
  KubuildRenderer,
  NodeRenderer,
  RenderContextProvider,
  useRenderContext,
  createRenderContext,
  createMinimalRenderContext,
  resolveVariable,
  resolveAssetSync,
  isActionRegistered,
  DEFAULT_RENDER_CONTEXT,
} from '../src/index';

describe('STORA-031: Immutable RenderContext & Host Resolvers', () => {
  const registry = createDefaultComponentRegistry();

  function renderDocument(doc: PageDocument, context?: Parameters<typeof KubuildRenderer>[0]['context']): string {
    return renderToString(<KubuildRenderer document={doc} registry={registry} context={context} />);
  }

  describe('Context Immutability & Decoupling', () => {
    it('creates frozen immutable RenderContext by default', () => {
      const context = createRenderContext({
        variables: { siteName: 'My App', port: 3000 },
      });

      expect(Object.isFrozen(context)).toBe(true);
      expect(Object.isFrozen(context.variables)).toBe(true);

      // Attempting to mutate in runtime fails because variables is frozen
      expect(() => {
        (context.variables as Record<string, unknown>).siteName = 'Hacked';
      }).toThrow();
    });

    it('returns DEFAULT_RENDER_CONTEXT when no options are passed to createRenderContext', () => {
      const context = createRenderContext();
      expect(context).toBe(DEFAULT_RENDER_CONTEXT);
      expect(Object.isFrozen(context)).toBe(true);
    });

    it('creates minimal offline context without any network dependencies', () => {
      const minimal = createMinimalRenderContext({
        variables: { appName: 'Offline Test' },
        assets: { logo: 'https://local.test/logo.svg' },
        actions: { submit: () => {} },
      });

      expect(minimal.variables?.appName).toBe('Offline Test');
      expect(minimal.assetProvider?.resolve('logo')).toBe('https://local.test/logo.svg');
      expect(minimal.assetProvider?.resolve('unregistered-id')).toBe('unregistered-id');
      expect(minimal.actionRegistry?.get('submit')).toBeDefined();
      expect(minimal.actionRegistry?.get('unknown')).toBeUndefined();
    });

    it('does not mutate input PageDocument or child nodes during render pass', () => {
      const doc = createBlankDocument('Immutable Test');
      doc.document.children = [
        {
          id: 'heading-1',
          type: 'heading',
          props: { text: 'Welcome to {{ siteName }}' },
        },
        {
          id: 'img-1',
          type: 'image',
          props: {
            asset: { type: 'asset', assetId: 'hero-asset', fallbackUrl: 'https://fallback.com/img.png' },
            alt: 'Hero for {{ siteName }}',
          },
        },
        {
          id: 'btn-1',
          type: 'button',
          props: {
            label: 'Click {{ siteName }}',
            action: { type: 'openModal' },
          },
        },
      ];

      const snapshotBefore = JSON.stringify(doc);

      const context = createMinimalRenderContext({
        variables: { siteName: 'AwesomeSite' },
        assets: { 'hero-asset': 'https://cdn.example.com/hero.jpg' },
        actions: { openModal: () => {} },
      });

      const html = renderDocument(doc, context);

      // Verify rendering outputs resolved data
      expect(html).toContain('Welcome to AwesomeSite');
      expect(html).toContain('src="https://cdn.example.com/hero.jpg"');
      expect(html).toContain('alt="Hero for AwesomeSite"');
      expect(html).toContain('Click AwesomeSite');
      expect(html).toContain('data-kubuild-action="openModal"');
      expect(html).toContain('data-kubuild-action-resolved="true"');

      // Verify original document is completely untouched
      const snapshotAfter = JSON.stringify(doc);
      expect(snapshotAfter).toBe(snapshotBefore);
    });
  });

  describe('Variable Resolution', () => {
    it('resolves VariableBinding objects and falls back correctly', () => {
      const context = createRenderContext({
        variables: { hero: { title: 'Super Hero Title' } },
      });

      const resolved = resolveVariable(context, {
        type: 'variable',
        key: 'hero.title',
        fallback: 'Fallback Title',
      });
      expect(resolved).toBe('Super Hero Title');

      const fallback = resolveVariable(context, {
        type: 'variable',
        key: 'missing.key',
        fallback: 'Default Fallback',
      });
      expect(fallback).toBe('Default Fallback');
    });

    it('resolves a nested dotted-path key (site.name against a nested variables object)', () => {
      const context = createRenderContext({
        variables: { site: { name: 'My Website' } },
      });

      const resolved = resolveVariable(context, { type: 'variable', key: 'site.name' });
      expect(resolved).toBe('My Website');
    });

    it('interpolates template string {{ variable.key }} patterns', () => {
      const context = createRenderContext({
        variables: { user: 'Alice', role: 'Admin' },
      });

      const text = resolveVariable(context, 'Hello {{ user }}, your role is {{ role }}!');
      expect(text).toBe('Hello Alice, your role is Admin!');
    });

    it('leaves unmapped template keys as-is if not found in variables', () => {
      const context = createRenderContext({
        variables: { known: 'Value' },
      });

      const text = resolveVariable(context, 'Known: {{ known }}, Unknown: {{ not_found }}');
      expect(text).toBe('Known: Value, Unknown: {{ not_found }}');
    });

    it('renders heading and text components with variable substitution', () => {
      const doc = createBlankDocument('Var Test');
      doc.document.children = [
        {
          id: 'head-var',
          type: 'heading',
          props: { text: 'Welcome {{ user.name }}', level: 1 },
        },
        {
          id: 'text-var',
          type: 'text',
          props: { content: 'Plan: {{ plan.name }}' },
        },
      ];

      const context = createMinimalRenderContext({
        variables: {
          user: { name: 'Bob' },
          plan: { name: 'Enterprise' },
        },
      });

      const html = renderDocument(doc, context);
      expect(html).toContain('Welcome Bob');
      expect(html).toContain('Plan: Enterprise');
    });
  });

  describe('Asset Resolution', () => {
    it('resolves asset synchronously using resolveAssetSync helper', () => {
      const assetProvider = {
        resolve: (id: string) => `https://cdn.custom.io/${id}.webp`,
      };

      expect(resolveAssetSync(assetProvider, 'hero-image')).toBe('https://cdn.custom.io/hero-image.webp');
      expect(resolveAssetSync(undefined, 'hero-image')).toBeUndefined();
    });

    it('returns undefined when assetProvider.resolve returns a Promise', () => {
      const asyncProvider = {
        resolve: async (id: string) => `https://async.cdn/${id}.webp`,
      };

      expect(resolveAssetSync(asyncProvider, 'hero-image')).toBeUndefined();
    });
  });

  describe('Action Resolution', () => {
    it('checks action registration correctly via isActionRegistered', () => {
      const minimal = createMinimalRenderContext({
        actions: {
          checkout: () => {},
        },
      });

      expect(isActionRegistered(minimal.actionRegistry, 'checkout')).toBe(true);
      expect(isActionRegistered(minimal.actionRegistry, 'notRegistered')).toBe(false);
      expect(isActionRegistered(undefined, 'checkout')).toBe(false);
    });
  });

  describe('React Context Provider & Hook', () => {
    it('allows custom child components to access RenderContext via useRenderContext hook', () => {
      const CustomConsumer: React.FC = () => {
        const ctx = useRenderContext();
        return <div data-testid="consumer">{String(ctx.variables?.appName ?? 'none')}</div>;
      };

      const minimal = createMinimalRenderContext({
        variables: { appName: 'ContextHookApp' },
      });

      const html = renderToString(
        <RenderContextProvider value={minimal}>
          <CustomConsumer />
        </RenderContextProvider>,
      );

      expect(html).toContain('ContextHookApp');
    });
  });
});
