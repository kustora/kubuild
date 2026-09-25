---
title: 'API @kubuild/renderer'
description: 'Engine rendering React rekursif murni, compiler styling, provider konteks runtime, dan generator HTML di @kubuild/renderer.'
---

# Referensi API `@kubuild/renderer`

Paket `@kubuild/renderer` adalah engine rendering React murni yang ringan dan rekursif untuk KUBUILD. Paket ini mengubah pohon AST `PageDocument` menjadi elemen React berkinerja tinggi tanpa chrome editor, lengkap dengan resolusi token desain, kompilasi pseudo-state CSS, dan eksekusi animasi.

---

## Komponen Utama

### `<KubuildRenderer />`

Komponen renderer rekursif tingkat atas.

```tsx
import { KubuildRenderer } from '@kubuild/renderer';
import { createDefaultComponentRegistry } from '@kubuild/components';

<KubuildRenderer
  document={document}
  registry={createDefaultComponentRegistry()}
  context={{
    variables: { username: 'Budi Santoso' },
    actions: { onSubscribe: (payload) => handleSubscribe(payload) },
  }}
  mode="runtime"     // 'runtime' | 'editor' | 'preview'
  // default responsive di sini adalah 'css': media query asli memilih style tablet/mobile
  className="landing-page"
  onNodeClick={(nodeId, e) => console.log('Node diklik:', nodeId)}
  onDiagnostic={(diag) => console.warn(diag)}
/>
```

#### Properti (Props)

| Prop | Tipe | Default | Deskripsi |
| :--- | :--- | :--- | :--- |
| `document` | `PageDocument` | **wajib** | Pohon AST dokumen yang akan dirender. |
| `registry` | `ComponentRegistry` | `createDefaultComponentRegistry()` | Registry komponen pemetaan tipe node ke definisi dan renderer. |
| `context` | `RenderContext` | `undefined` | Konteks runtime host (variabel, aksi, resolver aset). |
| `viewport` | `'desktop' \| 'tablet' \| 'mobile'` | `undefined` (dianggap `'desktop'`) | Preview satu viewport. Layer-nya digabung ke style inline. Jika diberikan, mode `responsive` default menjadi `'viewport'`. |
| `responsive` | `'css' \| 'viewport'` | `'css'` untuk `mode="runtime"` tanpa `viewport`, selain itu `'viewport'` | `'css'` merender `base` inline dan menghasilkan layer breakpoint sebagai rule `@media` yang ter-scope ke `[data-kubuild-node]`, memakai `BREAKPOINTS` dari `@kubuild/schema`. Mode ini aman untuk SSR dan outputnya sama di server dan client. `'viewport'` menggabungkan layer `viewport` ke style inline, dipakai untuk editor dan preview device. |
| `mode` | `'runtime' \| 'editor' \| 'preview'` | `'runtime'` | Mode eksekusi. Pada mode `editor`, error boundary merender kotak diagnostik merah; pada mode `runtime`, error ditangani secara senyap. |
| `className` | `string` | `undefined` | Class CSS untuk wrapper div root. |
| `onNodeClick` | `(nodeId: string, event: React.MouseEvent) => void` | `undefined` | Penangan klik seleksi node. |
| `onNodePropChange` | `(nodeId: string, prop: string, value: unknown) => void` | `undefined` | Penangan edit teks langsung secara inline. |
| `onActionDispatch` | `(action: ActionBinding) => void` | `undefined` | Penangan dispatch aksi interaktif kustom. |
| `onDiagnostic` | `(diag: Diagnostic) => void` | `undefined` | Listener penangan pesan diagnostik error dan warning. |

---

## Provider Konteks

### `<RenderContextProvider />`

Menyediakan variabel runtime dan fungsi resolver aset secara ambient ke seluruh pohon komponen React.

```tsx
import { RenderContextProvider } from '@kubuild/renderer';

<RenderContextProvider
  value={{
    variables: { siteTitle: 'Acme SaaS' },
    assetProvider: {
      resolveUrl: (assetId) => `https://cdn.example.com/assets/${assetId}`,
    },
  }}
>
  <KubuildRenderer document={doc} />
</RenderContextProvider>
```

---

## Kompiler Styling & Animasi

### 1. `resolveNodeStyles(styles, viewport)`
Menggabungkan `base` dengan satu layer `viewport` (`desktop`, `tablet`, atau `mobile`) dan menghasilkan objek `style` CSS React. Inilah yang dirender inline oleh `responsive: 'viewport'`.

```typescript
import { resolveNodeStyles, collectResponsiveStylesCss } from '@kubuild/renderer';

const cssStyles = resolveNodeStyles(buttonNode.styles, 'mobile');
// Padanan untuk `responsive: 'css'`: rule @media ter-scope untuk seluruh dokumen
const mediaCss = collectResponsiveStylesCss(document);
```

### 2. `collectStateStylesCss(document)`
Mengompilasi seluruh override pseudo-state (`:hover`, `:active`, `:focus`) di seluruh dokumen menjadi CSS stylesheet terisolasi.

```typescript
import { collectStateStylesCss } from '@kubuild/renderer';

const styleSheetCss = collectStateStylesCss(document);
```

### 3. `collectAnimationStylesCss(document)`
Mengompilasi animasi keyframe dan efek entrance scroll dari `node.animation` menjadi class CSS.

```typescript
import { collectAnimationStylesCss, replayNodeAnimation } from '@kubuild/renderer';

const animCss = collectAnimationStylesCss(document);

// Memutar ulang animasi entrance elemen secara programatis
replayNodeAnimation('card-1');
```

---

## Error Boundary

### `<ComponentErrorBoundary />`

Membungkus rendering setiap node secara terisolasi. Dalam mode editor, menampilkan kotak peringatan diagnostik merah yang memuat tipe komponen dan pesan error tanpa memicu crash pada aplikasi.

---

## Generator Kode HTML

### `generateHtmlFromDocument(doc, options?)`

Merender seluruh `PageDocument` menjadi string HTML & CSS semantik mandiri tanpa perlu menjalankan React di browser:

```typescript
import { generateHtmlFromDocument } from '@kubuild/renderer';
import { createDefaultComponentRegistry } from '@kubuild/components';

const htmlString = generateHtmlFromDocument(document, {
  registry: createDefaultComponentRegistry(),
  minify: true,
  includeStyles: true,
});
```
