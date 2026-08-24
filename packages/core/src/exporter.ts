import { zipSync, strToU8 } from 'fflate';
import {
  PageDocument,
  DocumentMetadata,
  Manifest,
  ManifestAssetItem,
  SCHEMA_NAME,
  CURRENT_SCHEMA_VERSION,
} from '@kubuild/schema';
import {
  validateDocument,
  DocumentValidationError,
  ValidationOptions,
  ComponentRegistryLike,
} from './validator';
import {
  collectAssetReferences,
  extractRequirementsFromTree,
  CollectedAssetReference,
} from './document-utils';
import type { AssetProvider } from './interfaces';

export interface ExportAssetData {
  data: Uint8Array | ArrayBuffer | Blob | string;
  mimeType?: string;
  filename?: string;
}

export type AssetBytesProvider = (
  assetId: string,
  assetRef: CollectedAssetReference,
) =>
  | Promise<Uint8Array | ArrayBuffer | Blob | string | ExportAssetData | null | undefined>
  | Uint8Array
  | ArrayBuffer
  | Blob
  | string
  | ExportAssetData
  | null
  | undefined;

export interface ExportPackageOptions {
  /**
   * Component registry to validate document components and extract requirements.
   */
  componentRegistry?: ComponentRegistryLike;

  /**
   * Known component types if registry is not passed.
   */
  knownComponentTypes?: string[] | Set<string>;

  /**
   * Directly supplied asset binary map (keyed by assetId).
   */
  assets?:
    | Record<string, Uint8Array | ArrayBuffer | Blob | string | ExportAssetData>
    | Map<string, Uint8Array | ArrayBuffer | Blob | string | ExportAssetData>;

  /**
   * Host function to retrieve asset binary data dynamically.
   */
  getAssetBytes?: AssetBytesProvider;

  /**
   * Host AssetProvider instance to resolve assets if bytes provider is not present.
   */
  assetProvider?: AssetProvider;

  /**
   * Package version to write in manifest (defaults to "1.0.0").
   */
  packageVersion?: string;

  /**
   * Builder compatibility semver range (defaults to ">=0.1.0").
   */
  builderCompatibility?: string;

  /**
   * If true, assets that have a fallbackUrl or are externally hosted will not cause export failure if local bytes are missing.
   * If false and a referenced asset has no bytes available, export fails.
   */
  allowExternalFallback?: boolean;

  /**
   * Additional validation options passed to validateDocument.
   */
  validationOptions?: ValidationOptions;

  /**
   * Optional metadata overrides (e.g. author, tags).
   */
  metadata?: Partial<DocumentMetadata>;
}

export interface ExportPackageSuccess {
  success: true;
  archive: Uint8Array;
  manifest: Manifest;
  page: PageDocument;
  metadata: DocumentMetadata;
  assetCount: number;
}

export interface ExportPackageFailure {
  success: false;
  errors: DocumentValidationError[];
  diagnosticMessage: string;
}

export type ExportPackageResult = ExportPackageSuccess | ExportPackageFailure;

/**
 * Pure TypeScript SHA-256 implementation (zero native dependencies, deterministic).
 */
export function sha256Sync(data: Uint8Array): string {
  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];

  let h0 = 0x6a09e667;
  let h1 = 0xbb67ae85;
  let h2 = 0x3c6ef372;
  let h3 = 0xa54ff53a;
  let h4 = 0x510e527f;
  let h5 = 0x9b05688c;
  let h6 = 0x1f83d9ab;
  let h7 = 0x5be0cd19;

  const length = data.length;
  const bitLength = length * 8;
  const newLength = ((length + 9 + 63) >>> 6) << 6;
  const padded = new Uint8Array(newLength);
  padded.set(data);
  padded[length] = 0x80;

  const view = new DataView(padded.buffer);
  view.setUint32(newLength - 4, bitLength >>> 0, false);
  view.setUint32(newLength - 8, Math.floor(bitLength / 0x100000000), false);

  const w = new Uint32Array(64);

  for (let chunk = 0; chunk < newLength; chunk += 64) {
    for (let i = 0; i < 16; i++) {
      w[i] = view.getUint32(chunk + i * 4, false);
    }
    for (let i = 16; i < 64; i++) {
      const s0 =
        ((w[i - 15] >>> 7) | (w[i - 15] << 25)) ^
        ((w[i - 15] >>> 18) | (w[i - 15] << 14)) ^
        (w[i - 15] >>> 3);
      const s1 =
        ((w[i - 2] >>> 17) | (w[i - 2] << 15)) ^
        ((w[i - 2] >>> 19) | (w[i - 2] << 13)) ^
        (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }

    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    let f = h5;
    let g = h6;
    let h = h7;

    for (let i = 0; i < 64; i++) {
      const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + K[i] + w[i]) >>> 0;
      const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
    h5 = (h5 + f) >>> 0;
    h6 = (h6 + g) >>> 0;
    h7 = (h7 + h) >>> 0;
  }

  const result = [h0, h1, h2, h3, h4, h5, h6, h7]
    .map((val) => val.toString(16).padStart(8, '0'))
    .join('');

  return result;
}

/**
 * Compute SHA-256 checksum with "sha256:" prefix.
 */
export async function calculateChecksum(data: Uint8Array): Promise<string> {
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.subtle?.digest) {
    try {
      const buffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
      const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', buffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
      return `sha256:${hashHex}`;
    } catch {
      // fallback to sync implementation
    }
  }
  return `sha256:${sha256Sync(data)}`;
}


/**
 * Sanitize asset file names to prevent zip-slip or directory traversal vulnerabilities.
 */
export function sanitizeFilename(filename: string | undefined, assetId: string, mimeType?: string): string {
  let name = (filename || '').trim();

  // Strip path traversal characters and directory separators
  name = name.replace(/^[./\\]+/, '').replace(/[/\\]+/g, '_').replace(/\0/g, '');
  name = name.replace(/[^a-zA-Z0-9._-]/g, '_');

  if (!name || name === '.' || name === '..') {
    const ext = getExtensionFromMime(mimeType) || 'bin';
    const cleanId = assetId.replace(/[^a-zA-Z0-9_-]/g, '_');
    name = `${cleanId}.${ext}`;
  }

  return name;
}

function getExtensionFromMime(mimeType?: string): string | null {
  if (!mimeType) return null;
  const m = mimeType.toLowerCase();
  if (m.includes('png')) return 'png';
  if (m.includes('jpeg') || m.includes('jpg')) return 'jpg';
  if (m.includes('webp')) return 'webp';
  if (m.includes('svg')) return 'svg';
  if (m.includes('gif')) return 'gif';
  if (m.includes('json')) return 'json';
  if (m.includes('pdf')) return 'pdf';
  if (m.includes('mp4')) return 'mp4';
  if (m.includes('mp3')) return 'mp3';
  return null;
}

async function convertToUint8Array(input: unknown): Promise<Uint8Array | null> {
  if (!input) return null;

  if (input instanceof Uint8Array) {
    return input;
  }

  if (input instanceof ArrayBuffer) {
    return new Uint8Array(input);
  }

  if (typeof Blob !== 'undefined' && input instanceof Blob) {
    const arrayBuffer = await input.arrayBuffer();
    return new Uint8Array(arrayBuffer);
  }

  if (typeof input === 'string') {
    // Check if data URL
    if (input.startsWith('data:')) {
      const commaIdx = input.indexOf(',');
      if (commaIdx !== -1) {
        const meta = input.substring(0, commaIdx);
        const rawData = input.substring(commaIdx + 1);
        if (meta.includes(';base64')) {
          if (typeof atob === 'function') {
            const binary = atob(rawData);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) {
              bytes[i] = binary.charCodeAt(i);
            }
            return bytes;
          }
        }
      }
    }
    return new TextEncoder().encode(input);
  }

  return null;
}

/**
 * Validates document, collects asset references, resolves local asset bytes,
 * writes manifest.json, page.json, metadata.json, and packages everything into a .stora archive.
 */
export async function exportPackage(
  document: unknown,
  options: ExportPackageOptions = {},
): Promise<ExportPackageResult> {
  // 1. Validate the Document
  const validation = validateDocument(document, {
    componentRegistry: options.componentRegistry,
    knownComponentTypes: options.knownComponentTypes,
    ...options.validationOptions,
  });

  if (!validation.valid || !validation.data) {
    const diagnosticMessage = `Document validation failed with ${validation.errors.length} error(s):\n` +
      validation.errors.map((e) => `[${e.code}] ${e.path}: ${e.message}`).join('\n');

    return {
      success: false,
      errors: validation.errors,
      diagnosticMessage,
    };
  }

  const pageDoc: PageDocument = JSON.parse(JSON.stringify(validation.data));

  // Merge optional metadata overrides safely
  if (options.metadata) {
    pageDoc.metadata = {
      ...(pageDoc.metadata || {
        title: 'Untitled Page',
        description: '',
        author: '',
        tags: [],
        category: 'general',
        version: '1.0.0',
      }),
      ...options.metadata,
      updatedAt: new Date().toISOString(),
    };
  }

  // 2. Collect Asset References from the document tree
  const collectedAssets = collectAssetReferences(pageDoc.document);
  const assetRefsById = new Map<string, CollectedAssetReference>();
  for (const item of collectedAssets) {
    if (!assetRefsById.has(item.assetId)) {
      assetRefsById.set(item.assetId, item);
    }
  }

  // 3. Extract Component and Capability Requirements
  const requirements = extractRequirementsFromTree(pageDoc.document, options.componentRegistry);

  // 4. Resolve Asset Bytes and build Manifest Assets
  const manifestAssets: ManifestAssetItem[] = [];
  const archiveFiles: Record<string, Uint8Array> = {};
  const assetCollectionErrors: DocumentValidationError[] = [];
  const usedArchivePaths = new Set<string>();

  for (const [assetId, assetRef] of assetRefsById.entries()) {
    let rawAsset: Uint8Array | ArrayBuffer | Blob | string | ExportAssetData | null | undefined;
    let customMime: string | undefined = assetRef.reference.mimeType;
    let customFilename: string | undefined = assetRef.reference.filename;

    // Check options.assets map/record
    if (options.assets) {
      if (options.assets instanceof Map) {
        rawAsset = options.assets.get(assetId);
      } else if (typeof options.assets === 'object' && assetId in options.assets) {
        rawAsset = options.assets[assetId];
      }
    }

    // Check options.getAssetBytes
    if (!rawAsset && options.getAssetBytes) {
      try {
        rawAsset = await options.getAssetBytes(assetId, assetRef);
      } catch (err) {
        assetCollectionErrors.push({
          code: 'INVALID_ASSET_REFERENCE',
          message: `Failed to retrieve asset bytes for "${assetId}": ${err instanceof Error ? err.message : String(err)}`,
          path: assetRef.propPath,
          nodeId: assetRef.nodeId,
        });
        continue;
      }
    }

    // Check options.assetProvider
    if (!rawAsset && options.assetProvider?.resolve) {
      try {
        const resolved = await options.assetProvider.resolve(assetId);
        if (resolved) {
          rawAsset = resolved;
        }
      } catch {
        // Continue to fallback check
      }
    }

    // Unpack ExportAssetData if provided
    let dataToConvert: unknown = rawAsset;
    if (rawAsset && typeof rawAsset === 'object' && 'data' in rawAsset) {
      const assetObj = rawAsset as ExportAssetData;
      dataToConvert = assetObj.data;
      if (assetObj.mimeType) customMime = assetObj.mimeType;
      if (assetObj.filename) customFilename = assetObj.filename;
    }

    const assetBytes = await convertToUint8Array(dataToConvert);

    if (assetBytes) {
      // Local asset found and collected
      const sanitizedName = sanitizeFilename(customFilename, assetId, customMime);
      let archivePath = `assets/${sanitizedName}`;

      // Avoid collision inside archive
      let counter = 1;
      while (usedArchivePaths.has(archivePath)) {
        const extDot = sanitizedName.lastIndexOf('.');
        if (extDot !== -1) {
          archivePath = `assets/${sanitizedName.substring(0, extDot)}_${counter}${sanitizedName.substring(extDot)}`;
        } else {
          archivePath = `assets/${sanitizedName}_${counter}`;
        }
        counter++;
      }
      usedArchivePaths.add(archivePath);

      const mimeType = customMime || 'application/octet-stream';
      const checksum = await calculateChecksum(assetBytes);

      manifestAssets.push({
        id: assetId,
        path: archivePath,
        mimeType,
        size: assetBytes.byteLength,
        checksum,
      });

      archiveFiles[archivePath] = assetBytes;
    } else {
      // Asset bytes not collected
      const isExternal = Boolean(assetRef.reference.fallbackUrl || options.allowExternalFallback);

      if (!isExternal) {
        assetCollectionErrors.push({
          code: 'INVALID_ASSET_REFERENCE',
          message: `Required asset "${assetId}" could not be collected for export and has no external fallback`,
          path: assetRef.propPath,
          nodeId: assetRef.nodeId,
        });
      }
    }
  }

  // If any required asset could not be collected, abort export
  if (assetCollectionErrors.length > 0) {
    const diagnosticMessage = `Asset collection failed with ${assetCollectionErrors.length} error(s):\n` +
      assetCollectionErrors.map((e) => `[${e.code}] ${e.path}: ${e.message}`).join('\n');

    return {
      success: false,
      errors: assetCollectionErrors,
      diagnosticMessage,
    };
  }

  // 5. Construct Manifest and Metadata
  const metadata: DocumentMetadata = pageDoc.metadata || {
    title: 'Untitled Page',
    description: '',
    author: '',
    tags: [],
    category: 'general',
    version: '1.0.0',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const manifest: Manifest = {
    schema: SCHEMA_NAME,
    schemaVersion: pageDoc.version || CURRENT_SCHEMA_VERSION,
    packageVersion: options.packageVersion || '1.0.0',
    builderCompatibility: options.builderCompatibility || '>=0.1.0',
    requiredComponents: requirements.requiredComponents,
    requiredCapabilities: requirements.requiredCapabilities,
    assets: manifestAssets,
    createdAt: new Date().toISOString(),
  };

  // 6. Write Archive Files
  archiveFiles['manifest.json'] = strToU8(JSON.stringify(manifest, null, 2));
  archiveFiles['page.json'] = strToU8(JSON.stringify(pageDoc, null, 2));
  archiveFiles['metadata.json'] = strToU8(JSON.stringify(metadata, null, 2));

  // 7. Compress into .stora ZIP Archive
  const archive = zipSync(archiveFiles, { level: 6 });

  return {
    success: true,
    archive,
    manifest,
    page: pageDoc,
    metadata,
    assetCount: manifestAssets.length,
  };
}

/**
 * Alias for exportPackage.
 */
export const exportStoraPackage = exportPackage;
