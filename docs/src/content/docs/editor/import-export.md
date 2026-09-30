---
title: 'Import & Export System'
description: 'Exporting .stora packages, standalone HTML bundles, and importing external designs.'
---

# Import & Export System

KUBUILD features full import and export capabilities built directly into the editor interface.

## Export Formats

Click the **Export** button in the top toolbar to choose between multiple export formats:

### 1. `.stora` Package (ZIP Bundle)
A self-contained ZIP archive containing:
- `manifest.json`: Schema name/version, package version, builder compatibility, required components/capabilities, and the asset list with SHA-256 checksums.
- `page.json`: The full `PageDocument` with responsive styles and nodes.
- `metadata.json`: Document metadata (title, description, author, tags).
- `assets/`: Embedded images, fonts, and media assets.

### 2. Standalone HTML / CSS Bundle
Exports a clean, semantic HTML5 page with zero framework runtime requirements. All styles are compiled into an optimized CSS stylesheet, and image assets are preserved.

### 3. JSON AST
Exports the raw `PageDocument` JSON structure suitable for storing in a database or passing via REST API.

## Import Capabilities

Click the **Import** button in the top toolbar to import:
- **`.stora` / `.zip` File**: Loads the complete package and updates all local asset references.
- **JSON Document**: Validates against the KUBUILD schema before replacing or appending to the canvas.
- **HTML / Figma Paste**: Uses `@kubuild/core` importer to parse semantic HTML tags into component nodes.
- **Pre-built Templates**: Choose from built-in starter templates (Landing page, SaaS Hero, Pricing Table, Newsletter, Portfolio).

```ts
import { downloadDocumentAsJson, downloadDocumentAsStora } from '@kubuild/editor';
import { exportPackage } from '@kubuild/core';
import { generateStandaloneHtml } from '@kubuild/renderer';
import type { PageDocument } from '@kubuild/schema';

export async function exportAll(currentDoc: PageDocument) {
  // Programmatic .stora export (no download) — returns archive bytes or validation errors.
  const result = await exportPackage(currentDoc);
  if (result.success) console.log(result.archive.byteLength, 'bytes');

  // Same as the toolbar buttons: build + trigger a browser download.
  await downloadDocumentAsStora(currentDoc);
  downloadDocumentAsJson(currentDoc);

  // Standalone HTML/CSS string.
  return generateStandaloneHtml(currentDoc, { lang: 'en' });
}
```

See the [Import & Export guide](/guides/import-export/) for import options (`preflightPackage`, `importPackage`, `MissingDependencyPolicy`, `AssetCollisionStrategy`).
