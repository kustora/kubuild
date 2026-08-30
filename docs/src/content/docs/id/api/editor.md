---
title: 'API @kubuild/editor'
description: 'Referensi API lengkap untuk komponen visual builder, konfigurasi modularitas EditorConfig, store, dan utilitas di @kubuild/editor.'
---

# Referensi API `@kubuild/editor`

Paket `@kubuild/editor` mengekspor seluruh rangkaian visual builder: canvas, responsive viewport, panel komponen & blocks, navigator hirarki layer, inspector style manager, spreadsheet table editor, dan sistem konfigurasi modularitas (`EditorConfig`).

---

## Komponen Utama

### `<KubuildEditor />`

Komponen pembungkus visual builder tingkat atas yang mengintegrasikan toolbar, sidebar kiri, canvas, overlay melayang, dan panel inspector dengan dukungan kustomisasi penuh melalui prop `config`.

```tsx
import { KubuildEditor } from '@kubuild/editor';

<KubuildEditor
  initialDocument={document}
  registry={componentRegistry}
  context={runtimeContext}
  variableCatalog={variableCatalog}
  onChange={(doc) => handleSave(doc)}
  onDiagnostic={(diag) => console.warn(diag)}
  config={{
    toolbar: { showExportImport: false },
    sidebar: { availableTabs: ['components', 'layers'] },
    inspector: { allowedStyleSectors: ['typography', 'decorations'] },
  }}
  className="h-screen"
/>
```

#### Properti (Props)

| Prop | Tipe | Default | Deskripsi |
| :--- | :--- | :--- | :--- |
| `initialDocument` | `PageDocument` | `undefined` | Dokumen awal untuk dimuat ke dalam editor store. |
| `registry` | `ComponentRegistry` | `createDefaultComponentRegistry()` | Registry komponen yang memuat definisi node dan renderer. |
| `context` | `RuntimeContext` | `undefined` | Konteks runtime host (variabel, aksi, aset). |
| `variableCatalog` | `VariableCatalog` | `[]` | Katalog variabel untuk autocomplete dan interpolasi binding mustache. |
| `onChange` | `(doc: PageDocument) => void` | `undefined` | Callback yang dipicu pada setiap mutasi dokumen. |
| `onDiagnostic` | `(diag: Diagnostic) => void` | `undefined` | Penangan event diagnostik dan pesan error validasi. |
| `config` | `EditorConfig` | `undefined` | Konfigurasi modularitas dan visibilitas elemen editor. |
| `className` | `string` | `undefined` | Class CSS opsional untuk container pembungkus editor. |

---

## API Konfigurasi (`EditorConfig`)

Prop `config` memungkinkan aplikasi host menentukan modul, tab, dan kontrol UI mana saja yang ditampilkan di editor.

### `EditorConfig`

```typescript
export interface EditorConfig {
  toolbar?: boolean | EditorToolbarConfig;
  sidebar?: boolean | EditorSidebarConfig;
  canvas?: EditorCanvasConfig;
  inspector?: boolean | EditorInspectorConfig;
}
```

### `EditorToolbarConfig`

| Kolom | Tipe | Default | Deskripsi |
| :--- | :--- | :--- | :--- |
| `showTitle` | `boolean` | `true` | Menampilkan badge judul halaman di toolbar. |
| `showNavigatorToggle` | `boolean` | `true` | Menampilkan tombol buka/tutup Navigator (layers tree). |
| `showHistory` | `boolean` | `true` | Menampilkan tombol Undo & Redo. |
| `showClipboard` | `boolean` | `true` | Menampilkan tombol Copy, Paste, Duplicate, dan Delete. |
| `showCodeViewer` | `boolean` | `true` | Menampilkan tombol pemicu modal "View Code" (`< >`). |
| `showExportImport` | `boolean` | `true` | Menampilkan tombol aksi Import & Export (.stora / JSON). |
| `showViewportSwitcher` | `boolean` | `true` | Menampilkan pemilih breakpoint Desktop / Tablet / Mobile. |
| `showSelectionStatus` | `boolean` | `true` | Menampilkan badge ID elemen yang sedang dipilih. |
| `customActions` | `React.ReactNode` | `undefined` | Node/tombol React kustom yang dirender di toolbar. |

### `EditorSidebarConfig`

| Kolom | Tipe | Default | Deskripsi |
| :--- | :--- | :--- | :--- |
| `enabled` | `boolean` | `true` | Mengaktifkan atau menyembunyikan sidebar kiri secara keseluruhan. |
| `defaultTab` | `'components' \| 'blocks' \| 'layers'` | `'components'` | Tab yang aktif saat editor pertama kali dirender. |
| `availableTabs` | `Array<'components' \| 'blocks' \| 'layers'>` | `['components', 'blocks', 'layers']` | Daftar tab yang diizinkan untuk navigasi pengguna. |

### `EditorCanvasConfig`

| Kolom | Tipe | Default | Deskripsi |
| :--- | :--- | :--- | :--- |
| `showBreadcrumbs` | `boolean` | `true` | Menampilkan breadcrumbs hirarki DOM di bawah canvas. |
| `showFloatingBadges` | `boolean` | `true` | Menampilkan badge aksi cepat di atas elemen canvas terpilih. |

### `EditorInspectorConfig`

| Kolom | Tipe | Default | Deskripsi |
| :--- | :--- | :--- | :--- |
| `enabled` | `boolean` | `true` | Mengaktifkan atau menyembunyikan panel inspector kanan. |
| `showProps` | `boolean` | `true` | Menampilkan input properties fungsional komponen. |
| `showTraits` | `boolean` | `true` | Menampilkan tab atribut semantik HTML (`href`, `alt`, `aria-label`, dll.). |
| `showStyles` | `boolean` | `true` | Menampilkan accordion Style Manager visual. |
| `showStateSelector` | `boolean` | `true` | Menampilkan pemilih layer pseudo-state (`:hover`, `:active`, `:focus`). |
| `allowedStyleSectors` | `StyleSectorId[]` | `undefined` | Daftar sektor style yang diizinkan (`'dimension'`, `'spacing'`, `'typography'`, `'decorations'`, `'flex'`, `'motion'`). Jika tidak disetel, semua sektor tampil. |

### Fungsi Helper: `resolveEditorConfig(config?)`

Menggabungkan konfigurasi dari host dengan fallback default dan mengembalikan objek `ResolvedEditorConfig` yang strongly-typed.

---

## Sub-Komponen

### `<EditorToolbar />`

Bar atas editor yang memuat informasi dokumen, aksi riwayat (undo/redo), clipboard, dan tombol import/export.

```tsx
import { EditorToolbar } from '@kubuild/editor';

<EditorToolbar
  registry={registry}
  config={{ showExportImport: false }}
/>
```

---

### `<LeftSidebar />`

Container sidebar dengan navigasi tab antara Components (elemen dasar), Blocks (seksi template pre-composed), dan Layers (hirarki tree).

```tsx
import { LeftSidebar } from '@kubuild/editor';

<LeftSidebar
  registry={registry}
  config={{
    defaultTab: 'components',
    availableTabs: ['components', 'layers'],
  }}
/>
```

---

### `<EditorCanvas />`

Viewport visual yang merender halaman via `@kubuild/renderer` lengkap dengan area drop target, bounding box seleksi langsung, badge aksi melayang, dan navigasi keyboard.

```tsx
import { EditorCanvas } from '@kubuild/editor';

<EditorCanvas
  registry={registry}
  context={runtimeContext}
  viewport="desktop" // 'desktop' | 'tablet' | 'mobile'
  onDiagnostic={onDiagnostic}
  config={{ showFloatingBadges: true }}
/>
```

---

### `<InspectorPanel />`

Panel kanan untuk mengedit properti dan styling visual elemen. Merender input props komponen, traits semantik HTML, box model margin/padding, kontrol tipografi, dan animasi CSS motion.

```tsx
import { InspectorPanel } from '@kubuild/editor';

<InspectorPanel
  registry={registry}
  document={doc}
  selectedNodeId="node-123"
  config={{
    showTraits: false,
    allowedStyleSectors: ['typography', 'decorations'],
  }}
/>
```

---

### `<StyleManagerAccordion />`

Accordion sektor styling CSS visual. Mendukung pewarisan breakpoint (`base`, `tablet`, `mobile`) dan styling layer interaktif pseudo-state.

```tsx
import { StyleManagerAccordion } from '@kubuild/editor';

<StyleManagerAccordion
  styles={activeStyles}
  animation={nodeAnimation}
  allowedSectors={['dimension', 'typography', 'motion']}
  onCommitStyle={(prop, val) => handleStyleUpdate(prop, val)}
  onCommitAnimation={(anim) => handleAnimUpdate(anim)}
  breakpoint="base"
/>
```

---

### `<TableSpreadsheetEditor />`

Editor spreadsheet grid interaktif khusus komponen tabel. Memungkinkan penambahan/penghapusan kolom & baris, pengaturan table header, dan edit cell data secara visual.

```tsx
import { TableSpreadsheetEditor } from '@kubuild/editor';

<TableSpreadsheetEditor
  registry={registry}
  tableNode={tableNode}
  mode="floating" // 'floating' | 'docked' | 'hidden'
  onToggleMode={() => {}}
  onClose={() => {}}
/>
```

---

## Store & Hook

### Hook `useEditorStore()`

Hook store Zustand untuk mengakses state editor, seleksi node, riwayat history, dan dispatcher command mutasi.

```typescript
import { useEditorStore } from '@kubuild/editor';

const {
  document,
  selectedNodeId,
  hoveredNodeId,
  viewport,
  isDirty,
  canUndo,
  canRedo,
  clipboard,
  navigatorMode,
  tableSpreadsheetMode,
  setDocument,
  selectNode,
  hoverNode,
  setViewport,
  insertComponent,
  deleteComponent,
  duplicateComponent,
  moveComponent,
  updateNodeProps,
  updateNodeStyle,
  updateNodeStateStyle,
  updateNodeAnimation,
  undo,
  redo,
  copyNode,
  pasteNode,
} = useEditorStore();
```

---

## Utilitas Export & Import

```typescript
import {
  downloadDocumentAsStora,
  downloadDocumentAsJson,
  exportDocumentAsStoraPackage,
  exportDocumentAsHtml,
} from '@kubuild/editor';

// Download package .stora langsung di browser
await downloadDocumentAsStora(doc, 'halaman-saya.stora', { componentRegistry: registry });

// Download schema dokumen mentah page.json
downloadDocumentAsJson(doc, 'page.json');

// Menghasilkan file zip Blob untuk upload backend atau cloud storage
const blob = await exportDocumentAsStoraPackage(doc, { componentRegistry: registry });

// Merender output HTML & CSS mandiri yang semantik
const html = await exportDocumentAsHtml(doc, {
  registry,
  minify: true,
  inlineStyles: true,
});
```
