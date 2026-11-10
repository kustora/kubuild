import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Node, PageDocument } from '@kubuild/schema';
import { createDefaultComponentRegistry } from '@kubuild/components';
import {
  createBlankDocument,
  exportStoraPackage,
  preflightPackage,
  importPackage,
  validateDocument,
} from '@kubuild/core';
import { useEditorStore } from '@kubuild/editor';
import { importHtml } from '@kubuild/html-import';
import { SAMPLE_HTML_TEMPLATES } from '../src/sample-html-templates';

/**
 * Helper to recursively search for a node matching a predicate in a Node tree.
 */
function findNode(node: Node, predicate: (n: Node) => boolean): Node | null {
  if (predicate(node)) return node;
  if (node.children && Array.isArray(node.children)) {
    for (const child of node.children) {
      const found = findNode(child, predicate);
      if (found) return found;
    }
  }
  return null;
}

describe('STORA-618: E2E HTML Import -> Edit in Store -> Export .stora -> Re-import Flow', () => {
  const registry = createDefaultComponentRegistry();
  const supportedCapabilities = ['assetProvider', 'actionRegistry', 'variableRegistry', 'dataProvider'];

  beforeEach(() => {
    useEditorStore.getState().setDocument(createBlankDocument('HTML Import E2E Initial'));
  });

  it('executes full round-trip: importHtml -> load in store -> edit node props -> exportStoraPackage -> preflight & importPackage', async () => {
    const sampleHtml = `
      <header style="background-color: #0f172a; padding: 20px 24px; color: #ffffff;">
        <div style="display: flex; justify-content: space-between; align-items: center; max-width: 1200px; margin: 0 auto;">
          <div style="font-weight: 700; font-size: 20px;">BrandLogo</div>
          <nav style="display: flex; gap: 16px;">
            <a href="/about" style="color: #cbd5e1; text-decoration: none;">About</a>
            <a href="/pricing" style="color: #cbd5e1; text-decoration: none;">Pricing</a>
          </nav>
        </div>
      </header>
      <main>
        <section class="hero-section" style="background-color: #1e293b; padding: 64px 24px; text-align: center;">
          <div class="flex-container" style="display: flex; flex-direction: column; align-items: center; gap: 16px; max-width: 800px; margin: 0 auto;">
            <h1 id="hero-title" style="font-size: 40px; font-weight: 800; color: #f8fafc; margin: 0;">Build Faster with Stora</h1>
            <p id="hero-subtitle" style="font-size: 18px; color: #94a3b8; margin: 0;">Declarative page builder with untrusted HTML import and lossless export.</p>
            <div style="display: flex; gap: 12px; margin-top: 8px;">
              <button id="cta-button" style="background-color: #2563eb; color: #ffffff; padding: 12px 24px; border-radius: 8px; font-weight: 600; border: none; cursor: pointer;">Get Started</button>
            </div>
            <img src="https://images.unsplash.com/hero.jpg" alt="Platform preview" style="max-width: 100%; border-radius: 8px; margin-top: 16px;" />
          </div>
        </section>
      </main>
    `.trim();

    // 1. Mock asset resolver
    const mockResolver = vi.fn(
      async (asset: { url: string; type: 'image' | 'video' | 'font' | 'other' }) => {
        if (asset.type === 'image') {
          return 'https://cdn.example.com/resolved-hero.png';
        }
        return asset.url;
      },
    );

    // 2. Import HTML string via @kubuild/html-import
    const importResult = await importHtml(sampleHtml, {
      assetResolver: mockResolver,
      metadata: {
        title: 'Imported Landing Page',
        description: 'E2E demo page imported from static HTML',
      },
    });

    expect(importResult.success).toBe(true);
    expect(importResult.document).toBeDefined();
    expect(importResult.report).toBeDefined();
    expect(importResult.report.stats.fidelityScore).toBeGreaterThan(0);
    expect(mockResolver).toHaveBeenCalled();

    const importedDoc = importResult.document!;
    expect(importedDoc.metadata.title).toBe('Imported Landing Page');
    expect(importedDoc.document.children && importedDoc.document.children.length).toBeGreaterThan(0);

    // 3. Load document into editor Zustand store
    useEditorStore.getState().setDocument(importedDoc);
    const storeState = useEditorStore.getState();
    expect(storeState.document.metadata.title).toBe('Imported Landing Page');

    // 4. Locate heading node and perform an edit via updateNodeProps
    const headingNode = findNode(storeState.document.document, (n) => n.type === 'heading');
    expect(headingNode).toBeDefined();
    expect(headingNode?.id).toBeDefined();

    const editResult = useEditorStore
      .getState()
      .updateNodeProps(headingNode!.id, { text: 'Edited Title: Stora Studio Pro' }, registry);

    expect(editResult.success).toBe(true);

    const docAfterEdit = useEditorStore.getState().document;
    const editedHeading = findNode(docAfterEdit.document, (n) => n.id === headingNode!.id);
    expect(editedHeading?.props?.text).toBe('Edited Title: Stora Studio Pro');

    // Also edit button prop if present
    const buttonNode = findNode(docAfterEdit.document, (n) => n.type === 'button');
    if (buttonNode) {
      const buttonEdit = useEditorStore
        .getState()
        .updateNodeProps(buttonNode.id, { text: 'Claim Your Access' }, registry);
      expect(buttonEdit.success).toBe(true);
    }

    // Document validity check
    const validation = validateDocument(useEditorStore.getState().document, {
      componentRegistry: registry,
    });
    expect(validation.valid).toBe(true);

    // 5. Call exportStoraPackage on the edited document
    const exportResult = await exportStoraPackage(useEditorStore.getState().document, {
      componentRegistry: registry,
    });

    expect(exportResult.success).toBe(true);
    expect(exportResult.archive).toBeInstanceOf(Uint8Array);
    expect(exportResult.archive!.byteLength).toBeGreaterThan(0);

    // 6. Run preflightPackage on the exported package buffer
    const preflight = await preflightPackage(exportResult.archive!, {
      componentRegistry: registry,
      supportedCapabilities,
    });

    expect(preflight.canImport).toBe(true);
    const errorDiagnostics = preflight.diagnostics.filter((d) => d.severity === 'error');
    expect(errorDiagnostics).toHaveLength(0);
    expect(preflight.manifest).toBeDefined();

    // 7. Run importPackage on the exported package buffer to complete round-trip
    const importPackageResult = await importPackage(exportResult.archive!, {
      componentRegistry: registry,
      supportedCapabilities,
    });

    expect(importPackageResult.success).toBe(true);
    expect(importPackageResult.document).toBeDefined();

    const roundTrippedDoc: PageDocument = importPackageResult.document!;
    expect(roundTrippedDoc.metadata.title).toBe('Imported Landing Page');

    const roundTrippedHeading = findNode(
      roundTrippedDoc.document,
      (n) => n.id === headingNode!.id,
    );
    expect(roundTrippedHeading).toBeDefined();
    expect(roundTrippedHeading?.props?.text).toBe('Edited Title: Stora Studio Pro');
  });

  it('successfully imports and validates all curated sample HTML templates from playground', async () => {
    expect(SAMPLE_HTML_TEMPLATES.length).toBeGreaterThanOrEqual(3);

    for (const template of SAMPLE_HTML_TEMPLATES) {
      const res = await importHtml(template.html, {
        metadata: { title: template.name },
      });

      expect(res.success).toBe(true);
      expect(res.document).toBeDefined();
      expect(res.report.stats.fidelityScore).toBeGreaterThan(0);

      const doc = res.document!;
      expect(doc.metadata.title).toBe(template.name);
      expect(doc.document.children && doc.document.children.length).toBeGreaterThan(0);

      // Validate against schema + security
      const validation = validateDocument(doc, { componentRegistry: registry });
      expect(validation.valid).toBe(true);

      // Export each sample to .stora package and test preflight
      const pkg = await exportStoraPackage(doc, { componentRegistry: registry });
      expect(pkg.success).toBe(true);
      expect(pkg.archive).toBeDefined();
      expect(pkg.archive).toBeInstanceOf(Uint8Array);

      const preflight = await preflightPackage(pkg.archive!, {
        componentRegistry: registry,
        supportedCapabilities,
      });
      expect(preflight.canImport).toBe(true);
      expect(preflight.diagnostics.filter((d) => d.severity === 'error')).toHaveLength(0);
    }
  });
});
