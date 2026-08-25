---
title: Panduan Cepat
description: Mulai mengintegrasikan KUBUILD ke dalam aplikasi Anda.
---

Pelajari cara memasang dan mengintegrasikan editor visual KUBUILD atau renderer tampilan web ke dalam aplikasi React atau Next.js Anda.

## Instalasi

Pasang paket wrapper utama `@kubuild/react`:

```bash
# Menggunakan pnpm
pnpm add @kubuild/react

# Menggunakan npm
npm install @kubuild/react

# Menggunakan yarn
yarn add @kubuild/react
```

## Memasang Editor Visual (*Visual Editor*)

Komponen `KubuildEditor` menyediakan kanvas visual interaktif lengkap dengan panel drag-and-drop, manajemen layer, dan inspector properti komponen.

```tsx
import React, { useState } from 'react';
import { KubuildEditor, createBlankDocument, type PageDocument } from '@kubuild/react';

export function MyPageEditor() {
  const [document, setDocument] = useState<PageDocument>(() => 
    createBlankDocument({ title: 'Landing Page Saya' })
  );

  const handleSave = (updatedDoc: PageDocument) => {
    console.log('Dokumen tersimpan:', updatedDoc);
    // Simpan ke database, file, atau cloud storage
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

## Merender Halaman (Headless Mode)

Untuk menampilkan halaman yang sudah dipublikasikan tanpa overhead antarmuka editor, gunakan komponen `KubuildRenderer`:

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

## Menggunakan Core Engine Secara Langsung

Untuk integrasi backend, CLI, atau otomasi tanpa React, Anda dapat memanipulasi dokumen langsung menggunakan `@kubuild/core`:

```ts
import { executeCommand, insertNodeCommand, createBlankDocument } from '@kubuild/core';

let doc = createBlankDocument({ title: 'Halaman Terotomasi' });

const result = executeCommand(
  doc,
  insertNodeCommand({
    parentId: doc.rootNodeId,
    type: 'Heading',
    props: { text: 'Selamat Datang di KUBUILD!', level: 1 },
  })
);

if (result.success) {
  doc = result.document;
  console.log('Jumlah node:', Object.keys(doc.nodes).length);
}
```
