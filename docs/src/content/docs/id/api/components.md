---
title: 'API @kubuild/components'
description: 'ComponentRegistry, skema ComponentDefinition, sistem Semantic HTML Traits, dan pustaka komponen standar di @kubuild/components.'
---

# Referensi API `@kubuild/components`

Paket `@kubuild/components` menyediakan engine registrasi komponen, kebijakan validasi nesting hirarki parent-child, definisi traits semantik HTML, skema prop fields untuk inspector, dan template seksi blok komposit bawaan untuk KUBUILD.

---

## Registry Komponen

### `ComponentRegistry<TRenderer>`

Katalog tipe-aman (type-safe) yang mengelola semua definisi komponen terdaftar, styling default, aturan penempatan node, dan mapping renderer opsional.

```typescript
import { ComponentRegistry, createDefaultComponentRegistry } from '@kubuild/components';

// Inisialisasi registry bawaan dengan seluruh komponen standar KUBUILD
const registry = createDefaultComponentRegistry();

// Memeriksa komponen terdaftar
const isRegistered = registry.has('button');
const buttonDef = registry.get('button');

// Mengambil semua komponen atau menyaring berdasarkan kategori
const allComponents = registry.list();
const layoutComponents = registry.listByCategory('layout');

// Validasi aturan hierarki penempatan elemen
const policy = registry.canInsertChild('container', 'button');
if (!policy.valid) {
  console.error('Penempatan tidak valid:', policy.errors);
}
```

#### Method Registry

| Method | Parameter | Mengembalikan | Deskripsi |
| :--- | :--- | :--- | :--- |
| `register(def, allowOverride?)` | `ComponentDefinition`, `boolean` | `void` | Mendaftarkan definisi komponen. Melempar error jika tipe sudah ada kecuali `allowOverride` bernilai true. |
| `unregister(type)` | `string` | `boolean` | Menghapus komponen dari registry berdasarkan identifier tipe. |
| `get(type)` | `string` | `ComponentDefinition \| undefined` | Mengambil objek definisi komponen berdasarkan nama tipenya. |
| `has(type)` | `string` | `boolean` | Memeriksa apakah suatu tipe komponen sudah terdaftar. |
| `list()` | `tidak ada` | `ComponentDefinition[]` | Mengembalikan array seluruh definisi komponen terdaftar. |
| `listByCategory(category)` | `ComponentCategory` | `ComponentDefinition[]` | Menyaring komponen berdasarkan kategori (`'layout'`, `'typography'`, `'media'`, `'form'`, `'interactive'`, `'data'`, `'custom'`). |
| `canInsertChild(parentType, childType)` | `string, string` | `{ valid: boolean; errors: string[] }` | Memvalidasi apakah elemen `childType` boleh disisipkan ke dalam `parentType` berdasarkan aturan nesting. |

---

## Skema `ComponentDefinition`

Menjelaskan semua metadata yang diperlukan oleh editor builder dan visual renderer mengenai suatu jenis komponen.

```typescript
export interface ComponentDefinition<TRenderer = unknown> {
  /** Identifier unik tipe komponen ('heading', 'button', 'pricing-card') */
  type: string;
  /** Label nama yang tampil pada panel komponen di editor */
  label: string;
  /** Kategori fungsional komponen */
  category: 'layout' | 'typography' | 'media' | 'form' | 'interactive' | 'data' | 'custom';
  /** Nama icon opsional untuk palet antarmuka builder */
  icon?: string;
  /** Deskripsi tooltip dan pratinjau komponen */
  description?: string;
  /** Apakah komponen ini dapat menampung elemen anak (children) */
  acceptsChildren?: boolean;
  /** Whitelist jenis komponen anak yang diizinkan */
  allowedChildren?: string[];
  /** Blacklist jenis komponen induk yang dilarang */
  disallowedParents?: string[];
  /** Nilai properti default saat pertama kali dibuat */
  defaultProps?: Record<string, unknown>;
  /** Styling responsive default (base, tablet, mobile) */
  defaultStyles?: ResponsiveStyles;
  /** Struktur tree node anak bawaan yang disisipkan secara otomatis */
  defaultChildren?: ComponentDefaultChildSpec[];
  /** Definisi field inspector untuk render kontrol properti otomatis */
  propFields?: ComponentFieldDefinition[];
  /** Metadata traits semantik HTML (href, target, alt, id, aria-label, dll.) */
  traits?: ComponentTraits;
  /** Fungsi validasi kustom untuk props node */
  validateProps?: (props: Record<string, unknown>) => boolean | string[];
  /** Kapabilitas runtime host yang dibutuhkan (misal: 'assetProvider', 'actionRegistry') */
  capabilities?: string[];
  /** Slot pemetaan komponen renderer */
  renderer?: TRenderer;
}
```

### `ComponentFieldDefinition`

Mendefinisikan input kontrol pada panel inspector tanpa perlu menulis UI React kustom per-komponen:

```typescript
export interface ComponentFieldDefinition {
  name: string;
  label: string;
  type: 'string' | 'textarea' | 'number' | 'boolean' | 'select' | 'color' | 'image' | 'action' | 'json';
  defaultValue?: unknown;
  options?: Array<{ label: string; value: unknown }>;
  description?: string;
}
```

---

## Sistem Semantic HTML Traits

Traits adalah representasi atribut fungsional dan semantik HTML (`href`, `target`, `alt`, `id`, `aria-label`, dll.) yang dipisahkan secara tegas dari styling visual.

```typescript
import {
  idTrait,
  titleTrait,
  hrefTrait,
  targetTrait,
  srcTrait,
  altTrait,
  loadingTrait,
  ariaLabelTrait,
  buttonTypeTrait,
  actionTrait,
  methodTrait,
} from '@kubuild/components';

// Menentukan traits untuk komponen Link Card kustom
const linkCardTraits = [
  idTrait(),
  hrefTrait({ defaultValue: '#' }),
  targetTrait(),
  ariaLabelTrait(),
];
```

#### Helper Traits yang Tersedia

- **Atribut Umum**: `idTrait()`, `titleTrait()`, `ariaLabelTrait()`, `tagTrait()`
- **Link & Navigasi**: `hrefTrait()`, `targetTrait()`, `relTrait()`
- **Media**: `srcTrait()`, `altTrait()`, `loadingTrait()`, `posterTrait()`, `controlsTrait()`, `autoplayTrait()`, `loopTrait()`, `mutedTrait()`
- **Formulir**: `fieldNameTrait()`, `placeholderTrait()`, `requiredTrait()`, `disabledTrait()`, `readOnlyTrait()`, `valueTrait()`, `actionTrait()`, `methodTrait()`, `buttonTypeTrait()`, `inputTypeTrait()`
- **Tabel**: `colSpanTrait()`, `rowSpanTrait()`

---

## Katalog Komponen Bawaan

KUBUILD menyertakan lebih dari 25+ komponen standar siap pakai:

| Kategori | Tipe Komponen | Deskripsi |
| :--- | :--- | :--- |
| **Layout** | `page`, `section`, `container`, `columns` | Container tata letak dengan responsive max-width dan flexbox/grid multi-kolom. |
| **Tipografi** | `heading`, `text`, `paragraph`, `blockquote`, `badge`, `code-block` | Heading `<h1>`–`<h6>`, paragraf, blok kode program, dan badge label. |
| **Interaktif** | `button`, `link` | Tombol aksi dengan berbagai varian dan tautan link navigasi. |
| **Media** | `image`, `video`, `icon`, `html-embed` | Gambar responsif terintegrasi aset, embed YouTube/Vimeo, icon Lucide, dan embed HTML langsung. |
| **Form** | `form`, `input`, `textarea`, `select`, `checkbox`, `radio` | Input form native dengan aturan validasi dan penangan submit aksi. |
| **Data & List** | `collection`, `list`, `list-item`, `table`, `table-row`, `table-cell` | Koleksi data berulang runtime, list ordered/unordered, dan tabel data spreadsheet. |

---

## Blok Komposit Starter (`STARTER_BLOCKS`)

Paket `@kubuild/components` mengekspor template seksi multi-node siap pakai:

```typescript
import { STARTER_BLOCKS } from '@kubuild/components';

// Kategori tersedia: 'layout' | 'sections' | 'ui' | 'pricing' | 'cta'
const heroBlock = STARTER_BLOCKS.find((b) => b.id === 'section-hero');
```

---

## Contoh Mendaftarkan Komponen Kustom

```typescript
import { ComponentRegistry, idTrait, ariaLabelTrait } from '@kubuild/components';

export function registerNotificationBanner(registry: ComponentRegistry) {
  registry.register({
    type: 'notification-banner',
    label: 'Notification Banner',
    category: 'custom',
    icon: 'bell',
    acceptsChildren: false,
    defaultProps: {
      message: 'Pembaruan sistem baru tersedia!',
      badgeText: 'Baru',
      type: 'info',
    },
    defaultStyles: {
      base: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '12px 16px',
        backgroundColor: '#eff6ff',
        border: '1px solid #bfdbfe',
        borderRadius: '8px',
      },
    },
    propFields: [
      { name: 'message', label: 'Pesan', type: 'string' },
      { name: 'badgeText', label: 'Teks Badge', type: 'string' },
      {
        name: 'type',
        label: 'Tipe Banner',
        type: 'select',
        options: [
          { label: 'Info', value: 'info' },
          { label: 'Warning', value: 'warning' },
          { label: 'Success', value: 'success' },
        ],
      },
    ],
    traits: [
      idTrait(),
      ariaLabelTrait(),
    ],
  });
}
```
