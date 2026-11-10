import {
  HTML_IMPORT_DIAGNOSTIC_CODES,
  type HtmlImportDiagnosticCode,
  type HtmlImportReport,
} from '@kubuild/html-import';

export interface ImportSummary {
  fidelityScore: number;
  counts: Record<HtmlImportDiagnosticCode, number>;
  blocking: string[];
  needsReview: boolean;
}

/** Condenses an import report into something a host UI can show before saving. */
export function summarizeReport(report: HtmlImportReport): ImportSummary {
  const counts = Object.fromEntries(HTML_IMPORT_DIAGNOSTIC_CODES.map((code) => [code, 0])) as Record<
    HtmlImportDiagnosticCode,
    number
  >;
  for (const diagnostic of report.diagnostics) {
    counts[diagnostic.code] += 1;
  }

  const blocking = report.diagnostics
    .filter((d) => d.severity === 'error')
    .map((d) => (d.location?.tagName ? `<${d.location.tagName}> ${d.message}` : d.message));

  return {
    fidelityScore: report.stats.fidelityScore,
    counts,
    blocking,
    // Embeds and dropped elements are where the import differs most from the source page.
    needsReview: report.stats.fidelityScore < 90 || counts.URL_BLOCKED > 0,
  };
}
