import { importHtml, type HtmlImportDiagnostic } from '@kubuild/html-import';

// Typical AI-generated page: Tailwind from the Play CDN, no stylesheet at all.
const html = `<!doctype html>
<html>
  <head>
    <script src="https://cdn.tailwindcss.com"></script>
    <script>
      tailwind.config = { theme: { extend: { colors: { brand: '#10b981' } } } };
    </script>
  </head>
  <body>
    <section class="flex flex-col gap-4 px-6 py-16 md:flex-row">
      <h1 class="text-4xl md:text-5xl font-bold text-gray-900">Ship pages faster</h1>
      <a href="/start" class="rounded-lg bg-brand px-4 py-2 text-white hover:bg-emerald-700 ring-2">
        Start
      </a>
    </section>
  </body>
</html>`;

export async function importTailwindPage() {
  // 'auto' is the default; it is spelled out here for clarity.
  const result = await importHtml(html, { tailwind: 'auto' });
  if (!result.success || !result.document) {
    throw new Error(result.error ?? 'HTML import failed');
  }

  // Classes the mapper could not translate (here: ring-2) are reported, not guessed.
  const unmapped = result.report.diagnostics
    .filter((d: HtmlImportDiagnostic) => d.code === 'CSS_UNSUPPORTED_SELECTOR')
    .filter((d) => d.details?.source === 'tailwind')
    .map((d) => `${String(d.details?.className)}: ${String(d.details?.reason)}`);

  return { document: result.document, unmapped };
}
