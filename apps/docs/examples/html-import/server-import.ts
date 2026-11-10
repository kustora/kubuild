import { importHtml, type HtmlImportOptions } from '@kubuild/html-import';
import type { AssetReference, PageDocument } from '@kubuild/schema';

// Your own storage layer (S3, R2, Supabase Storage, ...).
declare function uploadFromUrl(url: string): Promise<{ id: string; url: string; mimeType: string }>;
declare function saveDraft(doc: PageDocument): Promise<void>;

const ALLOWED_CSS_HOSTS = new Set(['example.com', 'cdn.example.com', 'fonts.googleapis.com']);

const options: HtmlImportOptions = {
  // Resolves relative <link href>, <img src>, srcset, poster and url(...) values.
  baseUrl: 'https://example.com/campaigns/spring/',

  // Extra CSS applied after the page's own <style>/<link> sheets (raw CSS or URLs).
  stylesheets: ['body { font-family: Inter, sans-serif; }'],

  // External stylesheets are only read through this hook. Return null to skip one.
  fetchStylesheet: async (url) => {
    if (!ALLOWED_CSS_HOSTS.has(new URL(url).hostname)) return null;
    const res = await fetch(url);
    return res.ok ? res.text() : null;
  },

  // Rehost images and videos into your storage. Return null to keep the resolved URL.
  assetResolver: async ({ url, type }): Promise<AssetReference | string | null> => {
    if (type !== 'image' && type !== 'video') return null;
    const stored = await uploadFromUrl(url);
    return { type: 'asset', assetId: stored.id, mimeType: stored.mimeType, fallbackUrl: stored.url };
  },

  limits: { maxNodeCount: 2000, maxDocumentSizeBytes: 2 * 1024 * 1024 },
  metadata: { title: 'Spring campaign', tags: ['imported'] },
  theme: { colors: { primary: '#2563eb' } },
  fallback: 'embed', // keep unmapped elements as sanitized html-embed nodes
};

export async function importFromUpload(html: string) {
  const result = await importHtml(html, options);

  if (!result.success || !result.document) {
    return { ok: false as const, error: result.error, diagnostics: result.report.diagnostics };
  }

  await saveDraft(result.document);
  return { ok: true as const, report: result.report };
}
