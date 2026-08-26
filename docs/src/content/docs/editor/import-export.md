---
title: 'Import & Export System'
description: 'Exporting .stora packages, standalone HTML bundles, and importing external designs.'
---

# Import & Export System

KUBUILD features full import and export capabilities built directly into the editor interface.

## Export Formats

Click the **Export** button in the top toolbar to choose between multiple export formats:

### 1. `.stora` Package (ZIP Bundle)
A self-contained archive containing:
- `manifest.json`: Package version, title, description, schema compatibility, and dependencies.
- `document.json`: The full document AST with responsive definitions and nodes.
- `assets/`: Embedded images, fonts, and media assets.
- `preview.png` / `thumbnail.webp`: Snapshot previews of the document.

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

```tsx
import { exportDocumentAsStoraPackage, exportDocumentAsHtml } from '@kubuild/editor';

// Programmatic export example
const blob = await exportDocumentAsStoraPackage(currentDoc);
const htmlString = await exportDocumentAsHtml(currentDoc);
```
