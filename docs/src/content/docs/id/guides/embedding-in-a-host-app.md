---
title: Menyematkan KUBUILD di Aplikasi Host
description: Integrasi end-to-end editor dan renderer ke produk Anda sendiri — custom component, blok host, template, penyimpanan, imperative handle, action handler, validasi backend, dan rendering publik.
sidebar:
  order: 1
---

Panduan ini membahas integrasi nyata: builder funnel/landing page di dalam aplikasi host (misalnya front end Next.js dengan back end Node). Host memiliki data produk, penyimpanan, autentikasi, dan routing; KUBUILD memiliki dokumen halaman, editor, dan renderer.

Bagian-bagiannya, sesuai urutan perjalanan sebuah halaman:

1. **Custom component** yang merender data host (`context.variables`).
2. **Blok host** — section siap pakai di tab Blocks editor.
3. **Template** — "halaman baru dari template" dan "ganti dengan template".
4. **Editor** dengan `onSave`, pelacakan dirty, autosave, dan peringatan perubahan belum tersimpan.
5. Ref **`EditorHandle`** untuk kontrol imperatif.
6. **Action handler host**.
7. **Validasi backend** dengan `@kubuild/schema/types` dan `@kubuild/schema/validate` yang bebas zod.
8. **Rendering publik** dengan `KubuildRenderer`.

Semua contoh di bawah meng-import dari paket masing-masing (`@kubuild/schema`, `@kubuild/core`, `@kubuild/components`, `@kubuild/renderer`, `@kubuild/editor`); `@kubuild/react` mengekspor ulang semuanya bila Anda lebih suka satu import.

## 1. Custom component yang membaca `context.variables`

Custom component didaftarkan di `ComponentRegistry`. Slot `renderer` menerima komponen React; renderer memanggilnya dengan node, props yang sudah di-resolve, style hasil komputasi, `context` runtime, dan handler `onClick` (diperlukan agar editor bisa memilih node tersebut).

Kartu produk ini hanya menyimpan *key* variabel di dokumen (`productKey`) dan membaca produk sebenarnya dari `context.variables` saat render, sehingga halaman yang sama menampilkan produk yang tepat untuk setiap checkout dan data host tidak pernah tersalin ke dokumen.

<!-- docs-check: file=product-card.tsx -->
```tsx
import React from 'react';
import type { RenderContext } from '@kubuild/core';
import { ComponentRegistry, createDefaultComponentRegistry } from '@kubuild/components';
import type { Node, PageDocument } from '@kubuild/schema';

/** Props the renderer passes to every custom component `renderer`. */
export interface CustomRendererProps {
  node: Node;
  document: PageDocument;
  props: Record<string, unknown>;
  styles: React.CSSProperties;
  context?: RenderContext;
  children?: React.ReactNode;
  onClick?: (event: React.MouseEvent) => void;
}

export interface Product {
  name: string;
  price: string;
  imageUrl?: string;
}

function isProduct(value: unknown): value is Product {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Product).name === 'string' &&
    typeof (value as Product).price === 'string'
  );
}

export function ProductCard({ node, props, styles, context, onClick }: CustomRendererProps) {
  const key = typeof props.productKey === 'string' ? props.productKey : 'product';
  const product = context?.variables?.[key];

  return (
    // `data-kubuild-node` lets responsive @media rules and editor selection target this node.
    <div data-kubuild-node={node.id} style={styles} onClick={onClick}>
      {isProduct(product) ? (
        <>
          {product.imageUrl && <img src={product.imageUrl} alt={product.name} width={320} />}
          <h3>{product.name}</h3>
          <p>{product.price}</p>
        </>
      ) : (
        <p>No product bound to “{key}”.</p>
      )}
    </div>
  );
}

/** Built-in components plus the host's own. Create it once and share it. */
export function createHostRegistry(): ComponentRegistry {
  const registry = createDefaultComponentRegistry();
  registry.register({
    type: 'product-card',
    label: 'Product Card',
    category: 'custom',
    description: 'Shows the product bound to a runtime variable.',
    acceptsChildren: false,
    defaultProps: { productKey: 'product' },
    defaultStyles: { base: { padding: '24px', borderRadius: '12px', border: '1px solid #e2e8f0' } },
    propFields: [
      {
        name: 'productKey',
        label: 'Product variable',
        type: 'string',
        defaultValue: 'product',
        description: 'Key in context.variables that holds the product.',
      },
    ],
    renderer: ProductCard,
  });
  return registry;
}
```

Di editor, berikan `variableCatalog` agar canvas menampilkan kartu dengan data contoh; nilai contoh hanya untuk preview dan tidak pernah ditulis ke dokumen (lihat langkah 4).

## 2. Blok host

`BlockDefinition` adalah factory pohon node yang punya nama dan kategori. Berikan blok Anda lewat prop `blocks`; dengan `blocksMode="append"` (default) blok ditambahkan ke `STARTER_BLOCKS` bawaan (blok host dengan `id` sama menggantikan starter), dengan `blocksMode="replace"` hanya blok Anda yang tampil. Blok dikelompokkan berdasarkan `category` / `categoryLabel` di tab Blocks, `thumbnailSvg` dirender sebagai preview, dan registry yang sama dipakai oleh drag-and-drop canvas dan `ref.insertBlock(id)`.

<!-- docs-check: file=host-blocks.ts -->
```ts
import type { BlockDefinition } from '@kubuild/components';

export const productHeroBlock: BlockDefinition = {
  id: 'host-product-hero',
  name: 'Product hero',
  category: 'funnel',
  categoryLabel: 'Funnel',
  description: 'Headline, product card and a buy button.',
  thumbnailSvg:
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 24"><rect width="40" height="24" rx="3" fill="#e2e8f0"/></svg>',
  // `generateId` produces unique node ids; always use it instead of fixed ids.
  createNodeTree: (generateId = (prefix = 'node') => `${prefix}-${Math.random().toString(36).slice(2)}`) => ({
    id: generateId('section'),
    type: 'section',
    styles: {
      base: { display: 'flex', flexDirection: 'row', gap: '32px', padding: '48px' },
      mobile: { flexDirection: 'column', padding: '24px' },
    },
    children: [
      {
        id: generateId('heading'),
        type: 'heading',
        props: { text: 'Everything you need to launch', level: 1 },
      },
      { id: generateId('product'), type: 'product-card', props: { productKey: 'product' } },
      {
        id: generateId('button'),
        type: 'button',
        props: { label: 'Buy now', action: { type: 'checkout', payload: { productKey: 'product' } } },
      },
    ],
  }),
};

export const hostBlocks: BlockDefinition[] = [productHeroBlock];
```

Tombolnya memakai `props.action` legacy dengan tipe yang didefinisikan host (`checkout`); langkah 6 menunjukkan cara host menanganinya.

## 3. Template

`TemplateRecord` membungkus `PageDocument` lengkap beserta metadata katalog. `createTemplateRecord` dari `@kubuild/core` mengisi nilai default dan mengekstrak `requirements` (custom component/kapabilitas yang dibutuhkan) dari dokumen.

<!-- docs-check: file=templates.ts -->
```ts
import { createTemplateRecord } from '@kubuild/core';
import type { PageDocument, TemplateRecord } from '@kubuild/schema';

const salesPage: PageDocument = {
  schema: 'stora.page',
  version: '1.2.0',
  theme: { colors: { primary: '#2563eb' } },
  document: {
    id: 'root',
    type: 'page',
    children: [
      {
        id: 'hero',
        type: 'section',
        children: [
          { id: 'hero-title', type: 'heading', props: { text: 'Limited offer', level: 1 } },
          { id: 'hero-product', type: 'product-card', props: { productKey: 'product' } },
        ],
      },
    ],
  },
};

export const hostTemplates: TemplateRecord[] = [
  createTemplateRecord({
    id: 'tpl-sales-basic',
    name: 'Basic sales page',
    description: 'Hero with the bound product.',
    category: 'landing',
    tags: ['sales', 'product'],
    document: salesPage,
  }),
];
```

Bila prop `templates` tidak kosong, toolbar editor mendapat aksi **Templates**. Menerapkan template meminta konfirmasi lewat dialog editor, mengganti halaman dengan hasil clone (id node baru; actions, animasi, dan konfigurasi form tetap terbawa) sebagai satu langkah yang bisa di-undo, lalu memanggil `onApplyTemplate(template, doc)`. Template yang `requirements.requiredComponents`-nya tidak ada di registry ditandai dan tidak bisa diterapkan.

Galeri yang sama diekspor sebagai `TemplatePicker` untuk layar "halaman baru dari template" di luar editor (template dipreview read-only dengan `KubuildRenderer`):

```tsx
import { cloneTemplateAsPage } from '@kubuild/core';
import { TemplatePicker } from '@kubuild/editor';
import type { PageDocument } from '@kubuild/schema';
import { createHostRegistry } from './product-card';
import { hostTemplates } from './templates';

const registry = createHostRegistry();

export function NewPageDialog({ onCreate }: { onCreate: (doc: PageDocument) => void }) {
  return (
    <TemplatePicker
      templates={hostTemplates}
      registry={registry}
      context={{ variables: { product: { name: 'Sample product', price: '$49' } } }}
      applyLabel="Create page"
      onApply={(template) => onCreate(cloneTemplateAsPage(template))}
    />
  );
}
```

## 4. Editor: penyimpanan dan status dirty

<!-- docs-check: file=PageEditor.tsx -->
```tsx
import React from 'react';
import { KubuildEditor, type EditorHandle } from '@kubuild/editor';
import type { VariableCatalog } from '@kubuild/core';
import type { PageDocument } from '@kubuild/schema';
import { createHostRegistry } from './product-card';
import { hostBlocks } from './host-blocks';
import { hostTemplates } from './templates';

const registry = createHostRegistry();

const variableCatalog: VariableCatalog = [
  {
    key: 'product',
    label: 'Product',
    type: 'object',
    sampleValue: { name: 'Sample product', price: '$49' },
  },
];

export interface PageEditorProps {
  pageId: string;
  initialDocument: PageDocument;
  editorRef?: React.Ref<EditorHandle>;
}

export function PageEditor({ pageId, initialDocument, editorRef }: PageEditorProps) {
  const [dirty, setDirty] = React.useState(false);

  return (
    <div style={{ height: '100vh' }}>
      <p>{dirty ? 'Unsaved changes' : 'All changes saved'}</p>
      <KubuildEditor
        ref={editorRef}
        initialDocument={initialDocument}
        registry={registry}
        variableCatalog={variableCatalog}
        blocks={hostBlocks}
        blocksMode="append"
        templates={hostTemplates}
        onApplyTemplate={(template) => console.log('applied template', template.id)}
        onSave={async (doc) => {
          const response = await fetch(`/api/pages/${pageId}`, {
            method: 'PUT',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(doc),
          });
          // A rejection shows the editor's "error" save status and keeps the page dirty.
          if (!response.ok) throw new Error(`Save failed: ${response.status}`);
        }}
        onDirtyChange={setDirty}
        autosave={{ debounceMs: 2000 }}
        warnOnUnsavedChanges
      />
    </div>
  );
}
```

- **`onSave(doc)`** (`Promise<void> | void`) mengaktifkan tombol Save di toolbar dengan status `saving` / `saved` / `error` dan shortcut Cmd/Ctrl+S. Flag dirty baru di-reset setelah promise selesai; penyimpanan yang bersamaan diantrikan sehingga dokumen terbaru selalu tersimpan terakhir.
- **`onDirtyChange(isDirty)`** dipanggil setiap kali status dirty berubah.
- **`autosave: { debounceMs }`** menyimpan otomatis setelah edit terakhir (membutuhkan `onSave`).
- **`warnOnUnsavedChanges`** menampilkan prompt "tinggalkan situs?" dari browser selama dirty. Default-nya `true` bila `onSave` diisi; berikan `false` untuk mematikannya.
- **`onChange(doc)`** tetap dipanggil pada setiap perubahan dokumen bila Anda ingin menyalin dokumen ke tempat lain.

## 5. `EditorHandle` imperatif

`KubuildEditor` meneruskan ref bertipe `EditorHandle`:

| Method | Deskripsi |
| :--- | :--- |
| `getDocument()` | Dokumen yang sedang diedit. |
| `replaceDocument(doc, { keepHistory? })` | Mengganti dokumen tanpa remount. Divalidasi dengan `validateDocument`; mengembalikan `{ success, errors, warnings, error? }` dan tidak mengubah editor bila tidak valid. Dengan `keepHistory: true` penggantian menjadi satu langkah undo dan seleksi dipertahankan selama node-nya masih ada. |
| `insertBlock(blockOrId, targetId?, index?)` | Menyisipkan `BlockDefinition` (atau id blok di block registry) ke `targetId` (default: node terpilih, atau root halaman). Mengembalikan `{ success, nodeId?, error? }`. |
| `applyTemplate(template)` | Mengganti halaman dengan clone dari `template` (bisa di-undo). |
| `undo()` / `redo()` / `canUndo()` / `canRedo()` | Kontrol history. |
| `isDirty()` | Apakah ada perubahan yang belum tersimpan lewat `onSave`. |
| `save()` | Menjalankan `onSave` sekarang; menghasilkan `false` bila tidak ada handler atau penyimpanan gagal. |

```tsx
import React from 'react';
import type { EditorHandle } from '@kubuild/editor';
import type { PageDocument } from '@kubuild/schema';
import { PageEditor } from './PageEditor';

export function EditorScreen({ pageId, draft, published }: {
  pageId: string;
  draft: PageDocument;
  published: PageDocument;
}) {
  const editorRef = React.useRef<EditorHandle>(null);

  const revertToPublished = () => {
    const result = editorRef.current?.replaceDocument(published, { keepHistory: true });
    if (result && !result.success) console.error('Rejected:', result.errors);
  };

  return (
    <>
      <button onClick={revertToPublished}>Revert to published</button>
      <button onClick={() => editorRef.current?.insertBlock('host-product-hero')}>Add product hero</button>
      <button onClick={() => editorRef.current?.undo()}>Undo</button>
      <button onClick={() => void editorRef.current?.save()}>Save now</button>
      <PageEditor pageId={pageId} initialDocument={draft} editorRef={editorRef} />
    </>
  );
}
```

## 6. Action handler host

Halaman memicu perilaku dengan dua cara:

- **Action pipeline** (`node.actions`, format kanonis) menjalankan tipe langkah bawaan: `navigate`, `api_request`, `show_toast`, `open_modal`/`close_modal`/`toggle_modal`, `set_state`, `reset_form`, `copy_clipboard`, `track_event`, dan `custom_event`. Langkah `custom_event` men-dispatch DOM `CustomEvent` di `window` (dan menyalinnya ke `dataLayer`), yang merupakan hook paling sederhana untuk kode host; `api_request` memanggil endpoint host.
- **`props.action` legacy** (`{ type, payload }`) di-dispatch ke `context.actionRegistry`. Handler host selalu diutamakan. Bila host tidak mendaftarkan apa pun, `navigate`, `open_modal`, `close_modal`, `toggle_modal`, dan `show_toast` memakai handler bawaan (`BUILTIN_LEGACY_ACTION_TYPES`); tipe lain yang tidak terdaftar menghasilkan diagnostic `UNKNOWN_ACTION` (juga terlihat di canvas editor). Handler bawaan tidak pernah berjalan di editor, jadi mengklik tombol di sana tidak akan berpindah halaman.

Handler menerima payload yang variable binding-nya sudah di-resolve, ditambah `{ nodeId, document, variables }`:

<!-- docs-check: file=actions.ts -->
```ts
import type { ActionHandler, ActionRegistry } from '@kubuild/core';

export function createHostActionRegistry(
  startCheckout: (productId: string) => Promise<void>,
): ActionRegistry {
  const handlers = new Map<string, ActionHandler>();
  const registry: ActionRegistry = {
    get: (type) => handlers.get(type),
    register: (type, handler) => void handlers.set(type, handler),
    unregister: (type) => void handlers.delete(type),
  };

  registry.register('checkout', async (payload, { variables }) => {
    const key = typeof payload?.productKey === 'string' ? payload.productKey : 'product';
    const product = variables?.[key] as { id?: string } | undefined;
    if (product?.id) await startCheckout(product.id);
  });

  // Overrides the built-in legacy `navigate` handler, e.g. to use the host router.
  registry.register('navigate', (payload) => {
    if (typeof payload?.url === 'string') window.history.pushState({}, '', payload.url);
  });

  return registry;
}
```

`createMinimalRenderContext({ variables, assets, actions })` dari `@kubuild/renderer` membuat context dengan action registry in-memory bila Anda tidak butuh registry custom.

## 7. Memvalidasi dokumen di backend

`@kubuild/schema` membundel zod v4, dan deklarasi tipe entry utamanya merujuk zod. Backend yang memakai zod versi mayor lain (atau tanpa zod) sebaiknya memakai subpath bebas zod:

- **`@kubuild/schema/types`** — interface TypeScript murni (`PageDocument`, `Node`, `ResponsiveStyles`, `ActionPipeline`, `Theme`, `TemplateRecord`, `Manifest`, ...).
- **`@kubuild/schema/validate`** — `validateDocument`, `validateNode`, `validateTemplateRecord`, `validateManifest`, `validateTheme`, `validateProjectDocument`, dan `isValidPageDocument`. Masing-masing mengembalikan objek biasa `{ success: true, data, issues: [] } | { success: false, issues }`, dengan issue berbentuk `{ path, message, code }`.

```ts
import type { PageDocument } from '@kubuild/schema/types';
import { validateDocument } from '@kubuild/schema/validate';

export function parsePageBody(body: unknown): PageDocument {
  const result = validateDocument(body);
  if (!result.success) {
    const details = result.issues.map((issue) => `${issue.path || '(root)'}: ${issue.message}`);
    throw new Error(`Invalid page document:\n${details.join('\n')}`);
  }
  return result.data; // defaults applied, safe to store
}
```

Ini adalah pemeriksaan skema struktural (termasuk penyaringan injeksi pada style/tema). Untuk pemeriksaan component registry, child policy, siklus, dan keamanan, jalankan juga `validateDocument(doc, { componentRegistry })` dari `@kubuild/core` di tempat registry tersedia, serta `migrateDocument` untuk dokumen yang disimpan oleh versi lama.

## 8. Rendering publik dengan `KubuildRenderer`

Halaman publik dirender dengan `mode="runtime"`. Tanpa prop `viewport`, renderer memakai `responsive="css"`: style base inline ditambah rule `@media` ter-scope untuk `tablet`/`mobile`/`desktop`, sehingga lebar layar sebenarnya yang menentukan dan markup hasil SSR sama dengan hasil hidrasi di client. `context.theme` menimpa token tema dokumen per tenant tanpa mengubah dokumen yang tersimpan.

```tsx
import React from 'react';
import { KubuildRenderer } from '@kubuild/renderer';
import type { RuntimeContext } from '@kubuild/core';
import type { PageDocument } from '@kubuild/schema';
import { createHostRegistry, type Product } from './product-card';
import { createHostActionRegistry } from './actions';

const registry = createHostRegistry();

export function PublishedPage({
  doc,
  product,
  brandColor,
}: {
  doc: PageDocument;
  product: Product & { id: string };
  brandColor: string;
}) {
  const context = React.useMemo<RuntimeContext>(
    () => ({
      variables: { product },
      actionRegistry: createHostActionRegistry(async (productId) => {
        window.location.assign(`/checkout/${productId}`);
      }),
      theme: { colors: { primary: brandColor } },
      onDiagnostic: (diagnostic) => console.warn('[kubuild]', diagnostic.code, diagnostic.message),
    }),
    [product, brandColor],
  );

  return <KubuildRenderer document={doc} registry={registry} context={context} mode="runtime" />;
}
```

Gunakan **registry yang sama** di editor dan renderer agar tipe custom ter-resolve di keduanya. Untuk hosting statis, `generateStandaloneHtml(doc)` dari `@kubuild/renderer` menghasilkan halaman HTML mandiri dengan aturan breakpoint yang sama (renderer React custom tidak termasuk dalam output statis).

## Checklist

- Satu `ComponentRegistry` bersama (bawaan + tipe custom) untuk editor, renderer, `exportPackage`, dan `importPackage`.
- Data host masuk lewat `context.variables` (runtime) dan `variableCatalog` (preview editor), tidak pernah masuk ke dokumen.
- Simpan dengan `onSave`; ganti dokumen dengan `ref.replaceDocument` alih-alih remount.
- Validasi setiap dokumen yang melewati batas kepercayaan (`@kubuild/schema/validate` di server, `importPackage` untuk berkas `.stora`).
- Render halaman publik dengan `mode="runtime"` dan biarkan `responsive="css"` menangani breakpoint.
