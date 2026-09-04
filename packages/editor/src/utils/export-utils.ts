import { PageDocument } from '@kubuild/schema';
import { exportPackage, ExportPackageOptions } from '@kubuild/core';

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
  const name = filename || sanitizeDocumentFilename(doc.metadata?.title || 'page', 'json');
  const jsonStr = JSON.stringify(doc, null, 2);
  downloadFile(jsonStr, name, 'application/json');
}
