import type { Node, PageDocument } from '@kubuild/schema';
import {
  deepClone,
  sanitizeFilename,
  type AssetBytesProvider,
  type AssetProvider,
  type CollectedAssetReference,
  type ExportAssetData,
} from '@kubuild/core';

/**
 * Asset localization for the static-site export (STORA-657).
 *
 * A published folder can't reach what only existed in the editor: `blob:` URLs from
 * in-memory uploads, `asset:` URIs that only the host's `AssetProvider` understands, and
 * `{ type: 'asset' }` references. Each of those is turned into a file under `assets/` and
 * the reference is rewritten to that relative path. `http(s)`, `data:` and relative URLs
 * already work on a static host and are left alone.
 */

export const STATIC_ASSET_DIR = 'assets';

type AssetBytes = Uint8Array | ArrayBuffer | Blob | string | ExportAssetData;

export interface StaticAssetOptions {
  /** Asset bytes keyed by asset id, when the host already holds them. */
  assets?: Record<string, AssetBytes> | Map<string, AssetBytes>;
  /** Fetches bytes for an asset reference on demand (same contract as `.stora` export). */
  getAssetBytes?: AssetBytesProvider;
  /** Resolves `asset:` URIs and asset ids to a URL, as on the canvas. */
  assetProvider?: AssetProvider;
  /** Downloads a URL. Defaults to `fetch`; override for auth headers or a server context. */
  fetchAsset?: (url: string) => Promise<{ data: Uint8Array; mimeType?: string } | null>;
}

export interface StaticAssetFailure {
  nodeId: string;
  /** The value as stored in the document (asset id or URL). */
  source: string;
  reason: string;
}

export interface LocalizedAssets {
  document: PageDocument;
  /** Archive path → bytes, e.g. `assets/hero.png`. */
  files: Record<string, Uint8Array>;
  /** References that could not be resolved; they are cleared instead of left dead. */
  failures: StaticAssetFailure[];
}

/** A value of this shape lives where `collectAssetReferences` would find it. */
type AssetReference = CollectedAssetReference['reference'];

const LOCAL_URL = /^(blob:|asset:)/i;
const CSS_URL = /url\(\s*(['"]?)((?:blob|asset):[^'")\s]+)\1\s*\)/gi;
const HAS_LOCAL_CSS_URL = /url\(\s*['"]?(?:blob|asset):/i;

function isAssetReference(value: unknown): value is AssetReference {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { type?: unknown }).type === 'asset' &&
    typeof (value as { assetId?: unknown }).assetId === 'string'
  );
}

async function defaultFetchAsset(url: string): Promise<{ data: Uint8Array; mimeType?: string } | null> {
  if (typeof fetch !== 'function') return null;
  const response = await fetch(url);
  if (!response.ok) return null;
  return {
    data: new Uint8Array(await response.arrayBuffer()),
    mimeType: response.headers.get('content-type')?.split(';')[0] || undefined,
  };
}

async function toBytes(input: unknown): Promise<{ data: Uint8Array; mimeType?: string; filename?: string } | null> {
  if (!input) return null;
  if (input instanceof Uint8Array) return { data: input };
  if (input instanceof ArrayBuffer) return { data: new Uint8Array(input) };
  if (typeof Blob !== 'undefined' && input instanceof Blob) {
    return { data: new Uint8Array(await input.arrayBuffer()), mimeType: input.type || undefined };
  }
  if (typeof input === 'object' && 'data' in (input as object)) {
    const { data, mimeType, filename } = input as ExportAssetData;
    const inner = await toBytes(data);
    return inner ? { ...inner, mimeType: mimeType ?? inner.mimeType, filename } : null;
  }
  return null;
}

/** Recognizes common media by magic bytes, for blobs that arrive without a type. */
function sniffMimeType(data: Uint8Array): string | undefined {
  const starts = (...bytes: number[]) => bytes.every((byte, i) => data[i] === byte);
  if (starts(0x89, 0x50, 0x4e, 0x47)) return 'image/png';
  if (starts(0xff, 0xd8, 0xff)) return 'image/jpeg';
  if (starts(0x47, 0x49, 0x46, 0x38)) return 'image/gif';
  if (starts(0x52, 0x49, 0x46, 0x46) && data[8] === 0x57 && data[9] === 0x45) return 'image/webp';
  if (data.length > 8 && data[4] === 0x66 && data[5] === 0x74 && data[6] === 0x79 && data[7] === 0x70) return 'video/mp4';
  const head = new TextDecoder().decode(data.subarray(0, 256)).trimStart().toLowerCase();
  if (head.startsWith('<svg') || (head.startsWith('<?xml') && head.includes('<svg'))) return 'image/svg+xml';
  return undefined;
}

export async function localizeDocumentAssets(
  doc: PageDocument,
  options: StaticAssetOptions = {},
): Promise<LocalizedAssets> {
  const document = deepClone(doc);
  const files: Record<string, Uint8Array> = {};
  const failures: StaticAssetFailure[] = [];
  const fetchAsset = options.fetchAsset ?? defaultFetchAsset;
  // One download per source, however often the page uses it.
  const pending = new Map<string, Promise<string | null>>();
  let counter = 0;

  const store = (bytes: { data: Uint8Array; mimeType?: string; filename?: string }, nameHint: string): string => {
    const mimeType = bytes.mimeType && bytes.mimeType !== 'application/octet-stream' ? bytes.mimeType : sniffMimeType(bytes.data);
    const name = sanitizeFilename(bytes.filename, nameHint, mimeType);
    let path = `${STATIC_ASSET_DIR}/${name}`;
    for (let n = 1; path in files; n++) {
      const dot = name.lastIndexOf('.');
      path = `${STATIC_ASSET_DIR}/${dot > 0 ? `${name.slice(0, dot)}_${n}${name.slice(dot)}` : `${name}_${n}`}`;
    }
    files[path] = bytes.data;
    return path;
  };

  /** A URL → where the page should point now (archive path or a usable URL), or null. */
  const localizeUrl = (url: string, nameHint: string): Promise<string | null> => {
    const cached = pending.get(url);
    if (cached) return cached;
    const task = (async (): Promise<string | null> => {
      let target = url;
      if (/^asset:/i.test(url)) {
        const resolved = options.assetProvider ? await options.assetProvider.resolve(url) : undefined;
        if (!resolved || /^asset:/i.test(resolved)) throw new Error('no asset provider resolved it');
        // A provider URL that a static host can reach is fine as it is.
        if (!/^blob:/i.test(resolved)) return resolved;
        target = resolved;
      }
      const bytes = await fetchAsset(target);
      if (!bytes) throw new Error('download failed');
      return store(bytes, nameHint);
    })().catch(() => null);
    pending.set(url, task);
    return task;
  };

  const localizeReference = (ref: AssetReference): Promise<string | null> => {
    const key = `asset-ref:${ref.assetId}`;
    const cached = pending.get(key);
    if (cached) return cached;
    const task = (async (): Promise<string | null> => {
      let raw: unknown;
      const { assets } = options;
      if (assets) raw = assets instanceof Map ? assets.get(ref.assetId) : assets[ref.assetId];
      if (!raw && options.getAssetBytes) {
        raw = await options.getAssetBytes(ref.assetId, { assetId: ref.assetId, reference: ref, nodeId: '', propPath: '' });
      }
      const bytes = await toBytes(raw);
      if (bytes) return store({ ...bytes, filename: bytes.filename ?? ref.filename, mimeType: bytes.mimeType ?? ref.mimeType }, ref.assetId);
      if (typeof raw === 'string' && raw) {
        // Same rule as `.stora` export: URLs are references, anything else is file content.
        if (/^(data:|https?:)/i.test(raw)) return raw;
        if (LOCAL_URL.test(raw)) return localizeUrl(raw, ref.assetId);
        return store({ data: new TextEncoder().encode(raw), mimeType: ref.mimeType, filename: ref.filename }, ref.assetId);
      }

      if (options.assetProvider) {
        const resolved = await options.assetProvider.resolve(ref.assetId);
        if (resolved && !/^asset:/i.test(resolved)) {
          return /^blob:/i.test(resolved) ? localizeUrl(resolved, ref.assetId) : resolved;
        }
      }
      return ref.fallbackUrl ?? null;
    })().catch(() => ref.fallbackUrl ?? null);
    pending.set(key, task);
    return task;
  };

  const nameHintFor = (): string => `asset-${++counter}`;
  const jobs: Promise<void>[] = [];

  const walkProps = (holder: Record<string, unknown> | unknown[], node: Node): void => {
    for (const [key, value] of Object.entries(holder)) {
      const write = (next: string) => {
        (holder as Record<string, unknown>)[key] = next;
      };
      if (isAssetReference(value)) {
        jobs.push(
          localizeReference(value).then((result) => {
            if (result === null) failures.push({ nodeId: node.id, source: value.assetId, reason: 'Asset could not be resolved' });
            write(result ?? '');
          }),
        );
      } else if (typeof value === 'string' && LOCAL_URL.test(value)) {
        jobs.push(
          localizeUrl(value, nameHintFor()).then((result) => {
            if (result === null) failures.push({ nodeId: node.id, source: value, reason: 'Local URL could not be read' });
            write(result ?? '');
          }),
        );
      } else if (value && typeof value === 'object') {
        walkProps(value as Record<string, unknown>, node);
      }
    }
  };

  const walkStyles = (holder: Record<string, unknown>, node: Node): void => {
    for (const [key, value] of Object.entries(holder)) {
      if (typeof value === 'string' && HAS_LOCAL_CSS_URL.test(value)) {
        const sources = [...value.matchAll(CSS_URL)].map((match) => match[2]);
        jobs.push(
          Promise.all(sources.map((source) => localizeUrl(source, nameHintFor()).then((result) => [source, result] as const))).then(
            (resolved) => {
              holder[key] = value.replace(CSS_URL, (_match, _quote, source: string) => {
                const result = resolved.find(([s]) => s === source)?.[1];
                if (!result) {
                  failures.push({ nodeId: node.id, source, reason: 'Background image could not be read' });
                  return 'none';
                }
                return `url("${result.replace(/"/g, '%22')}")`;
              });
            },
          ),
        );
      } else if (value && typeof value === 'object') {
        walkStyles(value as Record<string, unknown>, node);
      }
    }
  };

  const walk = (node: Node): void => {
    if (node.props) walkProps(node.props, node);
    if (node.styles) walkStyles(node.styles as Record<string, unknown>, node);
    node.children?.forEach(walk);
  };
  walk(document.document);
  await Promise.all(jobs);

  return { document, files, failures };
}
