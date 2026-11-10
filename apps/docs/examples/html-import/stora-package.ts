import { importHtmlToStoraPackage } from '@kubuild/html-import';

/** Converts an HTML page straight into a shareable .stora archive. */
export async function htmlToStoraBlob(html: string): Promise<Blob> {
  const result = await importHtmlToStoraPackage(html, {
    packageName: 'Spring campaign',
    baseUrl: 'https://example.com/',
  });

  if (!result.success || !result.packageBuffer) {
    throw new Error(result.error ?? 'Could not build the .stora package');
  }

  return new Blob([new Uint8Array(result.packageBuffer)], { type: 'application/octet-stream' });
}
