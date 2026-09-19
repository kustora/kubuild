import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import type { AssetProvider, AssetInfo } from '../src';
import { BackgroundImageControls } from '../src/components/style-manager/background-image-controls';
import { AssetManagerModal } from '../src/components/modals/asset-manager-modal';
import { TraitsPanel } from '../src/components/panels/traits-panel';
import { createDefaultComponentRegistry } from '@kubuild/components';
import { createBlankDocument } from '@kubuild/core';

describe('AssetProvider Integration in Kubuild Editor', () => {
  const mockAssetProvider: AssetProvider = {
    resolve: (uri) => uri,
    upload: vi.fn(async (file: File | Blob): Promise<AssetInfo> => ({
      id: 'test-asset-key',
      url: 'https://s3.example.com/bucket/test-image.jpg',
      mimeType: file.type || 'image/jpeg',
      size: file.size,
      alt: 'test-image.jpg',
    })),
    list: vi.fn(async (): Promise<AssetInfo[]> => [
      {
        id: 'existing-1',
        url: 'https://s3.example.com/bucket/existing-1.png',
        mimeType: 'image/png',
        alt: 'Existing Asset 1',
      },
    ]),
  };

  it('renders BackgroundImageControls with AssetProvider and gallery button', () => {
    const html = renderToString(
      <BackgroundImageControls
        styles={{}}
        onChange={() => {}}
        assetProvider={mockAssetProvider}
      />
    );

    expect(html).toContain('data-testid="bg-image-upload-btn"');
    expect(html).toContain('data-testid="bg-image-gallery-btn"');
  });

  it('renders AssetManagerModal with gallery items from mock asset provider', () => {
    const html = renderToString(
      <AssetManagerModal
        isOpen={true}
        onClose={() => {}}
        onSelect={() => {}}
        assetProvider={mockAssetProvider}
      />
    );

    expect(html).toContain('Asset Manager');
    expect(html).toContain('Gallery');
    expect(html).toContain('Upload');
  });

  it('renders TraitsPanel with AssetProvider support for media traits', () => {
    const registry = createDefaultComponentRegistry();
    const doc = createBlankDocument('Test');
    // Add an image node
    doc.document.children = [
      {
        id: 'img-1',
        type: 'image',
        props: { src: 'https://example.com/img.jpg', alt: 'Test' },
        styles: { base: {} },
        children: [],
      },
    ];

    const html = renderToString(
      <TraitsPanel
        registry={registry}
        document={doc}
        selectedNodeId="img-1"
        onCommitTrait={() => {}}
        assetProvider={mockAssetProvider}
      />
    );

    expect(html).toContain('Ganti');
    expect(html).toContain('img.jpg');
    expect(html).toContain('Gunakan URL manual');
  });
});
