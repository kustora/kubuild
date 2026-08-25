---
title: Quick Start
description: Get started with integrating KUBUILD into your application.
---

Learn how to install and embed the KUBUILD visual editor or read-only renderer into your React or Next.js application.

## Installation

Install the main React wrapper package:

```bash
# Using pnpm
pnpm add @kubuild/react

# Using npm
npm install @kubuild/react

# Using yarn
yarn add @kubuild/react
```

## Embedding the Visual Editor

The `KubuildEditor` component provides the full drag-and-drop canvas, sidebars, layers panel, and property inspector.

```tsx
import React, { useState } from 'react';
import { KubuildEditor, createBlankDocument, type PageDocument } from '@kubuild/react';

export function MyPageEditor() {
  const [document, setDocument] = useState<PageDocument>(() => 
    createBlankDocument({ title: 'My Awesome Landing Page' })
  );

  const handleSave = (updatedDoc: PageDocument) => {
    console.log('Saved document:', updatedDoc);
    // Persist to database, file, or cloud storage
  };

  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <KubuildEditor
        initialDocument={document}
        onChange={setDocument}
        onSave={handleSave}
      />
    </div>
  );
}
```

## Rendering a Document (Headless Mode)

To render a published page without any builder UI chrome or editor overhead, use `KubuildRenderer`:

```tsx
import React from 'react';
import { KubuildRenderer, type PageDocument } from '@kubuild/react';

interface PageProps {
  document: PageDocument;
}

export function PublishedPage({ document }: PageProps) {
  return (
    <main className="min-h-screen w-full">
      <KubuildRenderer document={document} />
    </main>
  );
}
```

## Working with the Core Engine Directly

For backend or CLI workflows, you can manipulate documents without React using `@kubuild/core`:

```ts
import { executeCommand, insertNodeCommand, createBlankDocument } from '@kubuild/core';

let doc = createBlankDocument({ title: 'Generated Page' });

const result = executeCommand(
  doc,
  insertNodeCommand({
    parentId: doc.rootNodeId,
    type: 'Heading',
    props: { text: 'Welcome to KUBUILD!', level: 1 },
  })
);

if (result.success) {
  doc = result.document;
  console.log('Updated node count:', Object.keys(doc.nodes).length);
}
```
