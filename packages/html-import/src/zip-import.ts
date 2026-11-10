/**
 * @kubuild/html-import
 * Zip archive HTML intake with safety checks, stylesheet fetching, and local asset resolution.
 */

import { unzipSync } from 'fflate';
import {
  checkZipBomb,
  isDangerousAssetFilename,
  isDangerousPath,
} from '@kubuild/core';
import type { AssetReference } from '@kubuild/schema';
import {
  addDiagnostic,
  createEmptyReport,
  type ZipImportOptions,
  type ZipImportResult,
} from './types.js';
import { DEFAULT_MAX_DOCUMENT_SIZE_BYTES } from './parser.js';
import { importHtml } from './index.js';

export type { ZipImportOptions, ZipImportResult } from './types.js';

/**
 * Infers the MIME type of an archive entry from its file extension.
 */
export function getMimeType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  switch (ext) {
    // Images
    case 'png':
      return 'image/png';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'gif':
      return 'image/gif';
    case 'webp':
      return 'image/webp';
    case 'svg':
      return 'image/svg+xml';
    case 'ico':
      return 'image/x-icon';
    case 'avif':
      return 'image/avif';
    case 'bmp':
      return 'image/bmp';
    // Videos
    case 'mp4':
      return 'video/mp4';
    case 'webm':
      return 'video/webm';
    case 'ogg':
    case 'ogv':
      return 'video/ogg';
    case 'mov':
      return 'video/quicktime';
    // Audio
    case 'mp3':
      return 'audio/mpeg';
    case 'wav':
      return 'audio/wav';
    case 'oga':
      return 'audio/ogg';
    // Fonts
    case 'woff2':
      return 'font/woff2';
    case 'woff':
      return 'font/woff';
    case 'ttf':
      return 'font/ttf';
    case 'otf':
      return 'font/otf';
    case 'eot':
      return 'application/vnd.ms-fontobject';
    // Documents / Styles
    case 'pdf':
      return 'application/pdf';
    case 'json':
      return 'application/json';
    case 'css':
      return 'text/css';
    case 'html':
    case 'htm':
      return 'text/html';
    default:
      return 'application/octet-stream';
  }
}

/**
 * Resolves the primary HTML entry file path within an archive.
 *
 * Algorithm:
 * 1. If options.entryHtmlPath is specified, search for matching entry.
 * 2. Search for root `index.html` or `index.htm` (case-insensitive).
 * 3. Search for nested `index.html` in common wrapper folders.
 * 4. If no index.html:
 *    - If exactly 1 .html/.htm file exists: select it.
 *    - If 0 .html files exist: error.
 *    - If multiple .html files exist without index.html: error (ambiguous).
 */
export function resolveEntryHtmlPath(
  filePaths: string[],
  specifiedEntry?: string,
): { entryPath?: string; error?: string } {
  if (specifiedEntry) {
    const cleanSpecified = specifiedEntry.trim().replace(/\\/g, '/').replace(/^\//, '');
    const found = filePaths.find(
      (p) => p.replace(/\\/g, '/').toLowerCase() === cleanSpecified.toLowerCase(),
    );
    if (!found) {
      return { error: `Specified entry HTML file not found in archive: ${specifiedEntry}` };
    }
    return { entryPath: found };
  }

  // Filter all non-directory HTML files
  const htmlFiles = filePaths.filter((p) => {
    if (p.endsWith('/')) return false;
    const lower = p.toLowerCase();
    return lower.endsWith('.html') || lower.endsWith('.htm');
  });

  if (htmlFiles.length === 0) {
    return { error: 'No HTML entry file found in archive' };
  }

  // 1. Check for root index.html / index.htm
  const rootIndex = htmlFiles.find((p) => {
    const lower = p.toLowerCase();
    return lower === 'index.html' || lower === 'index.htm';
  });
  if (rootIndex) {
    return { entryPath: rootIndex };
  }

  // 2. Check for index.html / index.htm in subfolders
  const nestedIndices = htmlFiles.filter((p) => {
    const lower = p.toLowerCase();
    return lower.endsWith('/index.html') || lower.endsWith('/index.htm');
  });

  if (nestedIndices.length === 1) {
    return { entryPath: nestedIndices[0] };
  }

  if (nestedIndices.length > 1) {
    nestedIndices.sort((a, b) => a.split('/').length - b.split('/').length);
    const depth0 = nestedIndices[0].split('/').length;
    const depth1 = nestedIndices[1].split('/').length;
    if (depth0 < depth1) {
      return { entryPath: nestedIndices[0] };
    }
    return { error: 'Ambiguous HTML entry: multiple index.html files found in archive' };
  }

  // 3. No index.html found anywhere
  if (htmlFiles.length === 1) {
    return { entryPath: htmlFiles[0] };
  }

  return { error: 'Ambiguous HTML entry: multiple .html files found without index.html' };
}

/**
 * Resolves a relative path or URL against the archive entries.
 */
export function resolveInArchive(
  baseDir: string,
  relativePath: string,
  archiveKeyMap: Map<string, { path: string; data: Uint8Array }>,
): { path: string; data: Uint8Array } | undefined {
  if (!relativePath || typeof relativePath !== 'string') return undefined;

  let clean = relativePath.trim();
  if (clean.toLowerCase().startsWith('data:')) return undefined;

  // Extract pathname if URL with scheme
  if (clean.startsWith('http://') || clean.startsWith('https://')) {
    try {
      clean = new URL(clean).pathname;
    } catch {
      // ignore
    }
  }

  // Strip query string and hash
  clean = clean.split('?')[0].split('#')[0].trim();
  if (!clean) return undefined;

  const normalizeSegments = (segments: string[]): string => {
    const stack: string[] = [];
    for (const seg of segments) {
      if (!seg || seg === '.') continue;
      if (seg === '..') {
        stack.pop();
      } else {
        stack.push(seg);
      }
    }
    return stack.join('/');
  };

  // 1. Try relative to baseDir (if clean does not start with leading slash)
  if (!clean.startsWith('/')) {
    const combined = baseDir ? `${baseDir}/${clean}` : clean;
    const resolvedCombined = normalizeSegments(combined.replace(/\\/g, '/').split('/')).toLowerCase();
    const found = archiveKeyMap.get(resolvedCombined);
    if (found) return found;
  }

  // 2. Try relative to archive root
  const rootCombined = clean.startsWith('/') ? clean.slice(1) : clean;
  const resolvedRoot = normalizeSegments(rootCombined.replace(/\\/g, '/').split('/')).toLowerCase();
  const rootFound = archiveKeyMap.get(resolvedRoot);
  if (rootFound) return rootFound;

  return undefined;
}

/**
 * Imports an HTML zip archive containing an entry HTML document, external stylesheets,
 * and local assets (images, videos, fonts) into a compiled KUBUILD PageDocument.
 *
 * Runs non-destructive security checks before parsing:
 * - Archive size limits
 * - Zip-slip path traversal detection
 * - Zip bomb compression ratio detection
 * - Prohibited executable asset screening
 *
 * Automatically resolves CSS stylesheets and local media references from the archive.
 *
 * @param archive The zip archive as a Uint8Array or ArrayBuffer
 * @param options Zip import configuration options
 * @returns Promise resolving to a ZipImportResult
 */
export async function importHtmlZip(
  archive: Uint8Array | ArrayBuffer,
  options?: ZipImportOptions,
): Promise<ZipImportResult> {
  const startTime = Date.now();
  const report = createEmptyReport();

  try {
    // 1. Check archive byte length
    const archiveBytes = archive instanceof Uint8Array ? archive : new Uint8Array(archive);
    if (!archiveBytes || archiveBytes.byteLength === 0) {
      addDiagnostic(report, {
        code: 'LIMIT_EXCEEDED',
        severity: 'error',
        message: 'Archive is empty or 0 bytes',
      });
      return {
        success: false,
        report,
        error: 'Archive is empty or 0 bytes',
      };
    }

    // 2. Check archive size limit
    const maxSizeBytes = options?.limits?.maxDocumentSizeBytes ?? DEFAULT_MAX_DOCUMENT_SIZE_BYTES;
    if (archiveBytes.byteLength > maxSizeBytes) {
      addDiagnostic(report, {
        code: 'LIMIT_EXCEEDED',
        severity: 'error',
        message: `Archive size (${archiveBytes.byteLength} bytes) exceeds maximum limit of ${maxSizeBytes} bytes`,
        details: { size: archiveBytes.byteLength, limit: maxSizeBytes },
      });
      return {
        success: false,
        report,
        error: `Archive size limit exceeded: ${archiveBytes.byteLength} bytes exceeds limit of ${maxSizeBytes} bytes`,
      };
    }

    // 3. Unzip archive
    let unzipped: Record<string, Uint8Array>;
    try {
      unzipped = unzipSync(archiveBytes);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      addDiagnostic(report, {
        code: 'LIMIT_EXCEEDED',
        severity: 'error',
        message: `Failed to unzip archive: ${errMsg}`,
      });
      return {
        success: false,
        report,
        error: `Failed to unzip archive: ${errMsg}`,
      };
    }

    const fileEntries = Object.entries(unzipped);

    // 4. Zip-slip check: verify all entry paths
    for (const [entryPath] of fileEntries) {
      if (isDangerousPath(entryPath)) {
        addDiagnostic(report, {
          code: 'LIMIT_EXCEEDED',
          severity: 'error',
          message: `Malicious path in zip archive: ${entryPath}`,
          location: { path: entryPath },
        });
        return {
          success: false,
          report,
          error: 'Malicious path in zip archive',
        };
      }
    }

    // 5. Zip bomb check
    let totalUncompressedBytes = 0;
    for (const [, fileBytes] of fileEntries) {
      totalUncompressedBytes += fileBytes.byteLength;
    }
    if (
      checkZipBomb(
        archiveBytes.byteLength,
        totalUncompressedBytes,
        options?.limits?.maxZipExpansionRatio,
      )
    ) {
      addDiagnostic(report, {
        code: 'LIMIT_EXCEEDED',
        severity: 'error',
        message: 'Zip bomb detected: compression ratio exceeded safe limit',
        details: {
          compressedBytes: archiveBytes.byteLength,
          uncompressedBytes: totalUncompressedBytes,
        },
      });
      return {
        success: false,
        report,
        error: 'Zip bomb detected: compression ratio exceeded safe limit',
      };
    }

    // 6. Dangerous asset check
    for (const [entryPath] of fileEntries) {
      if (entryPath.endsWith('/')) continue;
      if (isDangerousAssetFilename(entryPath, options?.limits?.prohibitedAssetExtensions)) {
        addDiagnostic(report, {
          code: 'LIMIT_EXCEEDED',
          severity: 'error',
          message: `Dangerous or prohibited file found in archive: ${entryPath}`,
          location: { path: entryPath },
        });
        return {
          success: false,
          report,
          error: `Dangerous or prohibited file found in archive: ${entryPath}`,
        };
      }
    }

    // 7. Resolve entry HTML file
    const filePaths = fileEntries.map(([p]) => p);
    const entryResolution = resolveEntryHtmlPath(filePaths, options?.entryHtmlPath);
    if (entryResolution.error || !entryResolution.entryPath) {
      const errMessage = entryResolution.error ?? 'No HTML entry file found in archive';
      addDiagnostic(report, {
        code: 'ASSET_UNRESOLVED',
        severity: 'error',
        message: errMessage,
      });
      return {
        success: false,
        report,
        error: errMessage,
      };
    }

    const entryHtmlPath = entryResolution.entryPath;
    const entryBytes = unzipped[entryHtmlPath];
    if (!entryBytes) {
      addDiagnostic(report, {
        code: 'ASSET_UNRESOLVED',
        severity: 'error',
        message: `Entry HTML file could not be read: ${entryHtmlPath}`,
        location: { path: entryHtmlPath },
      });
      return {
        success: false,
        report,
        error: `Entry HTML file could not be read: ${entryHtmlPath}`,
      };
    }

    const entryHtml = new TextDecoder().decode(entryBytes);

    // Compute entry directory for relative lookups
    const lastSlashIndex = entryHtmlPath.lastIndexOf('/');
    const entryDir = lastSlashIndex === -1 ? '' : entryHtmlPath.substring(0, lastSlashIndex);

    // 8. Build archive lookup map and extract local assets
    const archiveKeyMap = new Map<string, { path: string; data: Uint8Array }>();
    const archiveAssets: Array<{ path: string; data: Uint8Array; mimeType?: string }> = [];

    for (const [entryPath, fileBytes] of fileEntries) {
      const normalizedKey = entryPath.replace(/\\/g, '/').toLowerCase();
      archiveKeyMap.set(normalizedKey, { path: entryPath, data: fileBytes });

      if (entryPath.endsWith('/')) continue;
      const lower = entryPath.toLowerCase();
      if (lower.endsWith('.html') || lower.endsWith('.htm') || lower.endsWith('.css')) {
        continue;
      }

      archiveAssets.push({
        path: entryPath,
        data: fileBytes,
        mimeType: getMimeType(entryPath),
      });
    }

    // 9. Custom fetchStylesheet to retrieve CSS files from archive
    const customFetchStylesheet = async (href: string): Promise<string | null> => {
      const matched = resolveInArchive(entryDir, href, archiveKeyMap);
      if (matched) {
        return new TextDecoder().decode(matched.data);
      }
      if (options?.fetchStylesheet) {
        return options.fetchStylesheet(href);
      }
      return null;
    };

    // 10. Custom assetResolver adapter to resolve media and font references from archive
    const customAssetResolver = async (asset: {
      url: string;
      type: 'image' | 'video' | 'font' | 'other';
    }): Promise<string | AssetReference | null> => {
      const matched = resolveInArchive(entryDir, asset.url, archiveKeyMap);

      if (options?.assetResolver) {
        const resolvedUrl = matched ? matched.path : asset.url;
        const rehosted = await options.assetResolver({
          url: resolvedUrl,
          type: asset.type,
        });
        if (rehosted !== null && rehosted !== undefined) {
          return rehosted;
        }
      }

      if (matched) {
        return matched.path;
      }

      return asset.url;
    };

    // 11. Compile entry HTML
    const importResult = await importHtml(entryHtml, {
      ...options,
      fetchStylesheet: customFetchStylesheet,
      assetResolver: customAssetResolver,
    });

    return {
      ...importResult,
      entryHtmlPath,
      archiveAssets,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    report.stats.durationMs = Date.now() - startTime;
    return {
      success: false,
      report,
      error: message,
    };
  }
}
