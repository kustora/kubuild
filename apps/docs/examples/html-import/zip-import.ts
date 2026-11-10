import { importHtmlZip } from '@kubuild/html-import';
import type { AssetReference } from '@kubuild/schema';

// Your own storage layer.
declare function storeAsset(
  path: string,
  bytes: Uint8Array,
  mimeType?: string,
): Promise<{ id: string; url: string }>;

export async function importSiteArchive(file: File) {
  const bytes = new Uint8Array(await file.arrayBuffer());

  // First pass: let the importer find the entry HTML and list the archive's files.
  const probe = await importHtmlZip(bytes);
  if (!probe.success) {
    return probe; // unsafe archive, no entry HTML, invalid document, ...
  }

  // Upload every local asset once, keyed by its path inside the archive.
  const uploaded = new Map<string, { id: string; url: string; mimeType?: string }>();
  for (const asset of probe.archiveAssets ?? []) {
    const stored = await storeAsset(asset.path, asset.data, asset.mimeType);
    uploaded.set(asset.path, { ...stored, mimeType: asset.mimeType });
  }

  // Second pass: references that resolve inside the archive arrive here as archive paths.
  return importHtmlZip(bytes, {
    entryHtmlPath: probe.entryHtmlPath,
    assetResolver: ({ url }): AssetReference | null => {
      const stored = uploaded.get(url);
      if (!stored) return null; // external URL: keep it as is
      return { type: 'asset', assetId: stored.id, mimeType: stored.mimeType, fallbackUrl: stored.url };
    },
  });
}
