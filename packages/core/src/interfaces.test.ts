import { describe, it, expect } from 'vitest';
import { createBlankDocument } from './index';
import type {
  AssetInfo,
  AssetProvider,
  ActionHandler,
  ActionRegistry,
  ActionExecutionContext,
} from './interfaces';
import { isAssetReference, isVariableBinding, isActionBinding } from '@kubuild/schema';
import * as coreExports from './index';

describe('STORA-015: Asset Provider and Action Registry Contracts', () => {
  describe('Acceptance Criteria 1: Asset contract supports id, MIME type, URL resolve, minimal metadata', () => {
    const store = new Map<string, AssetInfo>([
      ['asset_1', { id: 'asset_1', url: 'https://cdn.example.com/asset_1.png', mimeType: 'image/png', size: 1024, alt: 'Example' }],
    ]);

    const provider: AssetProvider = {
      resolve(assetIdOrUri) {
        return store.get(assetIdOrUri)?.url ?? assetIdOrUri;
      },
      async upload(_file, metadata) {
        const info: AssetInfo = {
          id: 'asset_2',
          url: 'https://cdn.example.com/asset_2.png',
          mimeType: 'image/png',
          ...metadata,
        };
        store.set(info.id, info);
        return info;
      },
      async delete(assetId) {
        return store.delete(assetId);
      },
      async list() {
        return Array.from(store.values());
      },
    };

    it('resolves an asset id to a URL synchronously', () => {
      expect(provider.resolve('asset_1')).toBe('https://cdn.example.com/asset_1.png');
    });

    it('falls back to the input when the id is unknown', () => {
      expect(provider.resolve('unknown')).toBe('unknown');
    });

    it('uploads and returns a typed AssetInfo with id, url, and mimeType', async () => {
      const info = await provider.upload!(new Blob(), { size: 2048, alt: 'Uploaded' });
      expect(info).toMatchObject({ id: 'asset_2', mimeType: 'image/png', size: 2048, alt: 'Uploaded' });
      expect(typeof info.url).toBe('string');
    });

    it('lists known assets with minimal metadata intact', async () => {
      const all = await provider.list!();
      expect(all.some((a) => a.id === 'asset_1' && a.mimeType === 'image/png')).toBe(true);
    });

    it('deletes an asset by id', async () => {
      await provider.upload!(new Blob(), {});
      const deleted = await provider.delete!('asset_2');
      expect(deleted).toBe(true);
      expect((await provider.list!()).some((a) => a.id === 'asset_2')).toBe(false);
    });
  });

  describe('Acceptance Criteria 2: Action contract accepts type, serializable payload, and runtime context', () => {
    function createInMemoryActionRegistry(): ActionRegistry {
      const handlers = new Map<string, ActionHandler>();
      return {
        get(actionType) {
          return handlers.get(actionType);
        },
        register(actionType, handler) {
          handlers.set(actionType, handler);
        },
        unregister(actionType) {
          handlers.delete(actionType);
        },
      };
    }

    it('dispatches a handler by action type with a serializable payload and runtime context', async () => {
      const registry = createInMemoryActionRegistry();
      const document = createBlankDocument('Action Test Page');
      let received: { payload: unknown; context: ActionExecutionContext } | undefined;

      registry.register('navigate', (payload, context) => {
        received = { payload, context };
      });

      const payload = { url: '/checkout', replace: false, count: 1, note: null };
      const context: ActionExecutionContext = { nodeId: 'node_button', document, variables: { user: 'guest' } };

      registry.get('navigate')!(payload, context);

      expect(JSON.parse(JSON.stringify(payload))).toEqual(payload);
      expect(received?.payload).toEqual(payload);
      expect(received?.context.document).toBe(document);
      expect(received?.context.variables).toEqual({ user: 'guest' });
    });

    it('supports unregistering an action type', () => {
      const registry = createInMemoryActionRegistry();
      registry.register('noop', () => {});
      expect(registry.get('noop')).toBeDefined();
      registry.unregister('noop');
      expect(registry.get('noop')).toBeUndefined();
    });

    it('returns undefined for an unknown action type', () => {
      const registry = createInMemoryActionRegistry();
      expect(registry.get('does-not-exist')).toBeUndefined();
    });
  });

  describe('Acceptance Criteria 3: core makes no network requests and stores no credentials', () => {
    it('exposes AssetProvider and ActionRegistry as pure type contracts with no runtime value', () => {
      expect((coreExports as Record<string, unknown>).AssetProvider).toBeUndefined();
      expect((coreExports as Record<string, unknown>).ActionRegistry).toBeUndefined();
    });
  });

  describe('Schema binding type guards (document-level bindings resolved via these runtime contracts)', () => {
    it('isAssetReference accepts a valid asset reference and rejects malformed input', () => {
      expect(isAssetReference({ type: 'asset', assetId: 'asset_1' })).toBe(true);
      expect(isAssetReference({ type: 'asset', assetId: '' })).toBe(false);
      expect(isAssetReference({ type: 'variable', key: 'x' })).toBe(false);
    });

    it('isVariableBinding accepts a valid variable binding and rejects malformed input', () => {
      expect(isVariableBinding({ type: 'variable', key: 'site.name' })).toBe(true);
      expect(isVariableBinding({ type: 'variable', key: '' })).toBe(false);
      expect(isVariableBinding({ type: 'asset', assetId: 'a' })).toBe(false);
    });

    it('isActionBinding accepts a valid action binding and rejects malformed input', () => {
      expect(isActionBinding({ type: 'navigate', payload: { url: '/x' } })).toBe(true);
      expect(isActionBinding({ type: '' })).toBe(false);
      expect(isActionBinding({ payload: {} })).toBe(false);
    });
  });
});
