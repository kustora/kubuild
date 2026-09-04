import { describe, it, expect } from 'vitest';
import {
  createDefaultComponentRegistry,
  imageDefinition,
  videoDefinition,
  iconDefinition,
  htmlEmbedDefinition,
} from '../src/index';

describe('Media Components (image, video, icon, html-embed)', () => {
  describe('image', () => {
    it('is valid with a direct src and alt text', () => {
      expect(imageDefinition.validateProps?.({ src: 'https://x/y.png', alt: 'An image' })).toBe(true);
    });

    it('is valid with a valid asset reference and alt text (no src required)', () => {
      expect(
        imageDefinition.validateProps?.({ asset: { type: 'asset', assetId: 'a1' }, alt: 'An image' }),
      ).toBe(true);
    });

    it('is valid with variable bindings for src and alt (STORA-051: bindable props)', () => {
      expect(
        imageDefinition.validateProps?.({
          src: { type: 'variable', key: 'hero.src' },
          alt: { type: 'variable', key: 'hero.alt' },
        }),
      ).toBe(true);
    });

    it('rejects when neither src nor a valid asset reference is present', () => {
      const result = imageDefinition.validateProps?.({ alt: 'An image' });
      expect((result as string[])[0]).toContain('src" URL or a valid "asset"');
    });

    it('rejects missing alt text', () => {
      const result = imageDefinition.validateProps?.({ src: 'https://x/y.png' });
      expect((result as string[])[0]).toContain('alt');
    });

    it('declares the assetProvider capability', () => {
      expect(imageDefinition.capabilities).toContain('assetProvider');
    });
  });

  describe('STORA-194: Video, Icon, and HTML Embed Components', () => {
    it('registers video, icon, and html-embed in default registry', () => {
      const registry = createDefaultComponentRegistry();
      const mediaTypes = ['video', 'icon', 'html-embed'];

      for (const type of mediaTypes) {
        expect(registry.has(type)).toBe(true);
        const def = registry.get(type);
        expect(def).toBeDefined();
        expect(def?.acceptsChildren).toBe(false);
      }
    });

    it('validates video definition and props', () => {
      expect(videoDefinition.type).toBe('video');
      expect(videoDefinition.category).toBe('media');
      expect(videoDefinition.validateProps?.({
        src: 'https://www.youtube.com/watch?v=12345678901',
        provider: 'youtube',
        controls: true,
        autoplay: false,
        loop: true,
        muted: true,
      })).toBe(true);

      const invalidProvider = videoDefinition.validateProps?.({ provider: 'invalid-provider' });
      expect(Array.isArray(invalidProvider)).toBe(true);
      expect((invalidProvider as string[])[0]).toContain('Video "provider" must be one of');

      const invalidControls = videoDefinition.validateProps?.({ controls: 'yes' as unknown as boolean });
      expect(Array.isArray(invalidControls)).toBe(true);
      expect((invalidControls as string[])[0]).toContain('Video "controls" must be a boolean');
    });

    it('validates icon definition and props', () => {
      expect(iconDefinition.type).toBe('icon');
      expect(iconDefinition.category).toBe('media');
      expect(iconDefinition.validateProps?.({
        name: 'heart',
        size: 32,
        color: '#ef4444',
        strokeWidth: 2.5,
      })).toBe(true);

      const emptyName = iconDefinition.validateProps?.({ name: '' });
      expect(Array.isArray(emptyName)).toBe(true);
      expect((emptyName as string[])[0]).toContain('Icon requires a non-empty "name"');

      const invalidSize = iconDefinition.validateProps?.({ name: 'star', size: -5 });
      expect(Array.isArray(invalidSize)).toBe(true);
      expect((invalidSize as string[])[0]).toContain('Icon "size" must be a non-negative number');
    });

    it('validates html-embed definition and props', () => {
      expect(htmlEmbedDefinition.type).toBe('html-embed');
      expect(htmlEmbedDefinition.category).toBe('custom');
      expect(htmlEmbedDefinition.validateProps?.({ html: '<iframe src="https://example.com"></iframe>' })).toBe(true);

      const invalidHtml = htmlEmbedDefinition.validateProps?.({ html: 12345 as unknown as string });
      expect(Array.isArray(invalidHtml)).toBe(true);
      expect((invalidHtml as string[])[0]).toContain('HTML Embed "html" must be a string');
    });

    it('allows video, icon, and html-embed inside containers, sections, columns, list-items, and table-cells', () => {
      const registry = createDefaultComponentRegistry();
      const parents = ['section', 'container', 'columns', 'list-item', 'table-cell'];
      const types = ['video', 'icon', 'html-embed'];

      for (const parent of parents) {
        for (const child of types) {
          const canInsert = registry.canInsertChild(parent, child);
          expect(canInsert.valid, `Expected ${child} to be insertable inside ${parent}`).toBe(true);
        }
      }
    });
  });
});

