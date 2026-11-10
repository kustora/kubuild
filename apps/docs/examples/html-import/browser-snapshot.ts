// Browser only: needs a real DOM to create the measurement frames.
import { importHtmlWithBrowserSnapshot } from '@kubuild/editor';
import type { HtmlImportOptions } from '@kubuild/html-import';
import type { PageDocument } from '@kubuild/schema';

export async function importWithSnapshot(
  html: string,
  options: HtmlImportOptions = {},
): Promise<PageDocument> {
  const result = await importHtmlWithBrowserSnapshot(html, options, {
    // Optional: viewport width measured per breakpoint (must stay inside its range).
    widths: { desktop: 1440, tablet: 820, mobile: 390 },
    timeoutMs: 5000, // per frame
  });

  if (!result.snapshotApplied) {
    // No DOM, a frame timed out, … : the static cascade was used instead.
    console.warn('Browser snapshot unavailable:', result.snapshotError);
  }
  if (!result.success || !result.document) {
    throw new Error(result.error ?? 'HTML import failed');
  }
  return result.document;
}
