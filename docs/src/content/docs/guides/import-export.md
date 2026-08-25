---
title: Exporting & Importing .stora Packages
description: How to serialize, export, share, and import portable .stora template packages.
---

KUBUILD enables full portability through `.stora` packages.

## Exporting a Page Document

To export a document to a downloadable `.stora` archive in the browser or backend:

```ts
import { exportToStoraPackage } from '@kubuild/editor';

async function handleExport(document: PageDocument) {
  const blob = await exportToStoraPackage(document, {
    packageName: 'My SaaS Template',
    author: 'Kustora User',
  });

  // Trigger browser download
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'my-template.stora';
  a.click();
}
```

## Importing a .stora Package Safely

Importing validates the manifest, sanitizes SVGs, and runs migration:

```ts
import { importFromStoraPackage } from '@kubuild/editor';

async function handleFileSelect(file: File) {
  try {
    const importedDocument = await importFromStoraPackage(file);
    console.log('Successfully imported:', importedDocument.metadata.title);
  } catch (err) {
    console.error('Failed to import .stora package:', err);
  }
}
```
