import { PageDocument } from '@kubuild/schema';
import {
  exportPackage,
  ExportPackageOptions,
  collectArtboardReferenceNodes,
  sanitizeDocumentTracking,
  type EffectRegistry,
  type SkippedManifestEffect,
} from '@kubuild/core';
import { generateStandaloneHtml, type StandaloneHtmlOptions } from '@kubuild/renderer';
import { KUBUILD_RUNTIME_FILENAME, KUBUILD_RUNTIME_SOURCE } from '@kubuild/runtime-dom/source';
import { strToU8, zipSync } from 'fflate';
import { localizeDocumentAssets, type StaticAssetFailure, type StaticAssetOptions } from './static-assets.js';

/**
 * Refuse to export a page that depends on content living in a separate component artboard.
 *
 * `.stora` packaging is still single-`PageDocument` shaped, so such an export would silently
 * omit the detached artboards and re-import as dead triggers with no error anywhere. Blocking
 * is the honest behaviour until multi-artboard packaging lands.
 */
export function assertNoDetachedArtboardReferences(doc: PageDocument): void {
  const refs = collectArtboardReferenceNodes(doc.document);
  if (refs.length === 0) return;

  const names = refs.map((ref) => ref.artboardId ?? ref.nodeId).join(', ');
  throw new Error(
    `Export blocked: this page references ${refs.length} detached component frame(s) (${names}) ` +
      `that the .stora format cannot carry yet. Multi-frame export is not implemented — ` +
      `re-attach the content or export without it for now.`,
  );
}

/**
 * Clean a page title into a safe download filename slug
 */
export function sanitizeDocumentFilename(name: string, extension: string): string {
  const clean = name
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return `${clean || 'page'}.${extension.replace(/^\./, '')}`;
}

/**
 * Triggers a browser download of in-memory binary or text data.
 */
export function downloadFile(
  data: Uint8Array | ArrayBuffer | string,
  filename: string,
  mimeType: string = 'application/octet-stream'
): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }

  const blob = data instanceof Blob ? data : new Blob([data as BlobPart], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Exports a PageDocument as a .stora portable archive and initiates browser download.
 */
export async function downloadDocumentAsStora(
  doc: PageDocument,
  filename?: string,
  options?: ExportPackageOptions
): Promise<Uint8Array> {
  assertNoDetachedArtboardReferences(doc);
  const result = await exportPackage(doc, {
    allowExternalFallback: true,
    ...options,
  });
  if (!result.success) {
    const errorDetails = result.errors.map((e) => `${e.path}: ${e.message}`).join(', ');
    throw new Error(`Export failed: ${errorDetails || result.diagnosticMessage || 'Unknown error'}`);
  }

  const name = filename || sanitizeDocumentFilename(doc.metadata?.title || 'page', 'stora');
  downloadFile(result.archive, name, 'application/vnd.stora.package+zip');
  return result.archive;
}

/**
 * Exports a PageDocument as a formatted JSON document and initiates browser download.
 */
export function downloadDocumentAsJson(doc: PageDocument, filename?: string): void {
  assertNoDetachedArtboardReferences(doc);
  const name = filename || sanitizeDocumentFilename(doc.metadata?.title || 'page', 'json');
  // Defensive: exported JSON must never carry tracking secrets (exportPackage strips them for .stora).
  const { document: safeDoc } = sanitizeDocumentTracking(doc);
  const jsonStr = JSON.stringify(safeDoc, null, 2);
  downloadFile(jsonStr, name, 'application/json');
}

export interface StaticSiteExportOptions extends StaticAssetOptions {
  /** Effects (parallax, ...) are shipped only when the host passes its effect registry. */
  effectRegistry?: EffectRegistry;
  htmlOptions?: Omit<StandaloneHtmlOptions, 'effects'>;
}

export interface StaticSiteExport {
  /**
   * ZIP with `index.html`, `kubuild-runtime.js` when the page has effects to run, and
   * `assets/` for uploads and host assets the page references.
   */
  archive: Uint8Array;
  files: string[];
  skippedEffects: SkippedManifestEffect[];
  /** Assets that could not be read; their references are cleared in the exported page. */
  assetFailures: StaticAssetFailure[];
}

/**
 * Builds a self-hostable static site: `index.html` loading `kubuild-runtime.js` with
 * `<script src defer>`, so it also runs under a CSP without `'unsafe-inline'`. The runtime
 * file is only added when the page actually has effects to mount. Local assets (`blob:`
 * uploads, `asset:` URIs, asset references) are copied into `assets/` (STORA-657).
 */
export async function buildStaticSiteArchive(
  doc: PageDocument,
  options: StaticSiteExportOptions = {},
): Promise<StaticSiteExport> {
  assertNoDetachedArtboardReferences(doc);
  // A published page must never carry tracking secrets, same as .stora and JSON exports.
  const { document: safeDoc } = sanitizeDocumentTracking(doc);
  const { document: localDoc, files: assetFiles, failures: assetFailures } = await localizeDocumentAssets(
    safeDoc,
    options,
  );

  let skippedEffects: SkippedManifestEffect[] = [];
  const html = generateStandaloneHtml(localDoc, {
    ...options.htmlOptions,
    effects: options.effectRegistry
      ? {
          registry: options.effectRegistry,
          runtime: { src: KUBUILD_RUNTIME_FILENAME },
          onSkipped: (skipped) => {
            skippedEffects = skipped;
          },
        }
      : undefined,
  });

  const entries: Record<string, Uint8Array> = { 'index.html': strToU8(html) };
  if (html.includes(`src="${KUBUILD_RUNTIME_FILENAME}"`)) {
    entries[KUBUILD_RUNTIME_FILENAME] = strToU8(KUBUILD_RUNTIME_SOURCE);
  }
  Object.assign(entries, assetFiles);
  return {
    archive: zipSync(entries, { level: 6 }),
    files: Object.keys(entries),
    skippedEffects,
    assetFailures,
  };
}

/**
 * Exports the page as a static-site ZIP and initiates browser download.
 */
export async function downloadDocumentAsStaticSite(
  doc: PageDocument,
  filename?: string,
  options?: StaticSiteExportOptions,
): Promise<StaticSiteExport> {
  const result = await buildStaticSiteArchive(doc, options);
  const name = filename || sanitizeDocumentFilename(doc.metadata?.title || 'page', 'zip');
  downloadFile(result.archive, name, 'application/zip');
  return result;
}
