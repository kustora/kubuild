import { importHtml } from '@kubuild/html-import';
import type { PageDocument } from '@kubuild/schema';

const html = `<!doctype html>
<html>
  <head>
    <title>Spring Launch</title>
    <style>
      .hero { display: flex; flex-direction: column; gap: 16px; padding: 64px 24px; }
      .hero h1 { font-size: 48px; color: #0f172a; }
      @media (max-width: 767px) { .hero h1 { font-size: 32px; } }
      .cta:hover { background-color: #1d4ed8; }
    </style>
  </head>
  <body>
    <section class="hero">
      <h1>Ship pages faster</h1>
      <p>Import your existing landing page and keep editing it visually.</p>
      <a class="cta" href="/signup">Get started</a>
    </section>
  </body>
</html>`;

export async function importLandingPage(): Promise<PageDocument> {
  // importHtml never throws: failures come back as `success: false`.
  const result = await importHtml(html);

  if (!result.success || !result.document) {
    throw new Error(result.error ?? 'HTML import failed');
  }

  const { nodeCount, fidelityScore } = result.report.stats;
  console.log(`${nodeCount} nodes, fidelity ${fidelityScore}/100`);

  return result.document; // a validated PageDocument, ready to save or edit
}
