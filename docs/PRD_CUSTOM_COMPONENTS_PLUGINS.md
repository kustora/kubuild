# PRD — KUBUILD: Custom Components & Plugin Extensibility System

**Product:** KUBUILD  
**Codename:** BUILDER-01  
**Document Type:** Product Requirements Document (PRD Extension)  
**Feature Focus:** Custom Component SDK (`defineComponent`), Plugin Architecture (`definePlugin`), Plugin Manager & Lifecycle Engine, UI Extension Slots (Sidebar, Toolbar, Inspector), Sandboxing & Capability Verification, and Plugin Developer Experience (DX)  
**Target Packages:** `@kubuild/schema`, `@kubuild/core`, `@kubuild/components`, `@kubuild/renderer`, `@kubuild/editor`, `@kubuild/react`, `create-kubuild-plugin` (CLI)  
**Status:** Approved / Ready for Implementation  

---

## 1. Executive Summary & Vision

### 1.1 Problem Statement
KUBUILD saat ini memiliki arsitektur komponen berbasis `ComponentRegistry` dan daftar komponen bawaan (Layout, Typography, Media, Forms). Namun, untuk membuka ekosistem integrasi yang luas ke pihak ketiga (developer internal perusahaan, pembuat plugin komunitas, SaaS partner, agen e-commerce/marketing), builder membutuhkan sistem extensibility yang terstandarisasi:
1. **Pembuatan Komponen Kustom Terlalu Rigid**: Developer luar belum memiliki SDK utilitas (`defineComponent`) yang membungkus schema prop, kontrol form inspector, React runtime renderer, dan code generator secara type-safe dalam satu file modular.
2. **Ketiadaan Sistem Plugin Multi-Dimensi**: Ekstensi tidak hanya butuh menambah komponen, tetapi juga sering kali membutuhkan:
   - Aksi kustom (*custom actions*, e.g., Stripe Checkout, Supabase query, Zapier webhook).
   - Panel kustom di sidebar (*custom sidebar tabs*, e.g., AI Assistant, Unsplash image picker, Icon finder).
   - Tombol kustom di toolbar (*toolbar actions*, e.g., "Publish to Shopify", "Audit SEO").
   - Sektor kontrol kustom di inspector panel kanan.
   - Variabel data kustom (*dynamic data provider*).
3. **Pemberitahuan & Fallback Dokumen Tanpa Plugin**: Jika pengguna mengimpor dokumen `.stora` yang mengandung komponen kustom dari plugin yang belum terpasang di host app, renderer rentan crash atau memunculkan halaman kosong tanpa indikator fallback yang aman.
4. **Isolasi Keamanan Input Template**: Template dari luar harus diverifikasi kapabilitasnya (*requiredCapabilities*) agar tidak menjalankan kode arbitrer yang tidak diizinkan.

### 1.2 Product Vision
Menjadikan KUBUILD sebagai **Extensible Web Builder Engine** paling terbuka dan mudah dikembangkan di ekosistem web modern (selevel dengan ekosistem plugin Strapi, Figma, Tiptap, dan VSCode), di mana pengembang dapat membuat, mendistribusikan via NPM, dan memasang plugin atau komponen kustom hanya dengan 1 baris kode, tanpa merusak stabilitas dokumen portabel `.stora`.

### 1.3 Target Personas
1. **Host App Developer**: Developer yang mengintegrasikan `KubuildEditor` ke dalam CMS, SaaS internal, atau aplikasi mereka dan ingin memasang plugin resmi maupun buatan sendiri dengan mudah (`plugins={[stripePlugin(), aiWriterPlugin()]}`).
2. **Component & Plugin Author**: Developer pihak ketiga / komunitas yang ingin membuat komponen independen (misal: Lottie Player, Mapbox Map, Chart.js, Spline 3D) atau plugin lengkap dan mendistribusikannya via NPM.
3. **End-User / Marketer / Designer**: Pengguna builder yang menikmati kemudahan drag-and-drop komponen baru, menggunakan AI writer di sidebar, dan melakukan checkout e-commerce tanpa perlu memikirkan kode di baliknya.

---

## 2. Arsitektur Extensibility Matrix

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                   KUBUILD PLUGIN & EXTENSIBILITY SYSTEM                     │
├─────────────────────────────────────────────────────────────────────────────┤
│ 1. SCHEMA & CONTRACT LAYER (@kubuild/schema)                                │
│    - PluginManifestSchema (name, version, minEngineVersion, capabilities)   │
│    - ComponentPropFieldSchema & CustomSectorSchema                          │
│    - RequiredCapabilities tracking in PageDocument & Manifest               │
├─────────────────────────────────────────────────────────────────────────────┤
│ 2. CORE EXTENSIBILITY & LIFECYCLE ENGINE (@kubuild/core)                    │
│    - PluginManager: registry loader, hook dispatcher, conflict resolver     │
│    - Hook System: onInit, onDocumentChange, onNodeInsert, onBeforeExport    │
│    - Dynamic Variable & Action Registry mergers                             │
├─────────────────────────────────────────────────────────────────────────────┤
│ 3. COMPONENT AUTHORING SDK (@kubuild/components)                            │
│    - defineComponent<TProps>() helper with full TS inference                │
│    - defineBlock() template presets generator                               │
│    - Inspector Control Descriptors (string, select, color, media, action)   │
├─────────────────────────────────────────────────────────────────────────────┤
│ 4. RENDERER & FALLBACK RUNTIME (@kubuild/renderer)                          │
│    - Dynamic Component Resolution with Safe Error Boundary per-node         │
│    - MissingComponentFallback: informative UI badge for uninstalled plugins │
│    - Custom Action Handler execution pipeline                               │
├─────────────────────────────────────────────────────────────────────────────┤
│ 5. VISUAL EDITOR SLOTS & PANELS (@kubuild/editor)                           │
│    - LeftSidebar Tabs Slot: custom tab injection (AI, Media, Icons)         │
│    - Toolbar Actions Slot: custom header buttons & menus                    │
│    - Inspector Sector Slot: custom styling & trait sections                 │
│    - Modal & Floating Overlay Injection APIs                                │
├─────────────────────────────────────────────────────────────────────────────┤
│ 6. UNIFIED PUBLIC API & DISTRIBUSI (@kubuild/react & CLI)                   │
│    - <KubuildEditor plugins={[...]} customComponents={[...]} />             │
│    - npm create kubuild-plugin (scaffolding CLI starter kit)                │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Spesifikasi Detail Fitur

### 3.1 Custom Component Authoring SDK (`defineComponent`)

`defineComponent` adalah interface deklaratif untuk mendefinisikan satu komponen mandiri lengkap dengan metadata builder, kontrol inspector, runtime render, dan ekspor kode.

```typescript
export interface DefineComponentConfig<TProps = Record<string, unknown>> {
  /** Identifier unik tipe komponen (e.g. "lottie-player", "custom-chart") */
  type: string;
  /** Nama human-readable di palette komponen (e.g. "Lottie Animation") */
  label: string;
  /** Kategori komponen di palette: 'layout' | 'typography' | 'media' | 'form' | 'interactive' | 'data' | 'custom' */
  category: ComponentCategory;
  /** Deskripsi singkat fungsi komponen untuk tooltip */
  description?: string;
  /** Icon visual (nama icon Lucide atau custom ReactNode SVG) */
  icon?: string | React.ReactNode;
  /** Apakah komponen ini dapat memiliki child nodes (container) */
  acceptsChildren?: boolean;
  /** Batasan tipe child yang diizinkan (jika acceptsChildren = true) */
  allowedChildren?: string[];
  /** Batasan parent yang dilarang */
  disallowedParents?: string[];
  /** Nilai default props saat komponen pertama kali di-drag ke canvas */
  defaultProps?: Partial<TProps>;
  /** Nilai default styles saat di-insert */
  defaultStyles?: ResponsiveStyles;
  /** Template child nodes otomatis (misal: accordion default berisi 2 items) */
  defaultChildren?: ComponentDefaultChildSpec[];
  /** Definisi form kontrol otomatis untuk inspector panel kanan */
  propFields?: ComponentFieldDefinition[];
  /** Trait fungsional (href, target, alt, id, aria-label) */
  traits?: ComponentTraits;
  /** Fungsi validasi props */
  validateProps?: (props: Record<string, unknown>) => boolean | string[];
  /** Komponen React murni untuk rendering di canvas dan web output */
  renderer?: React.ComponentType<ComponentRenderProps<TProps>>;
  /** Handler konversi ke clean code (React JSX / HTML) untuk fitur Live Code Viewer & Export */
  toCode?: (ctx: ComponentToCodeContext<TProps>) => string;
  /** Kapabilitas khusus yang dibutuhkan host runtime (e.g. ['assetProvider', 'auth']) */
  capabilities?: string[];
}
```

---

### 3.2 Spesifikasi Kontrak Plugin (`definePlugin`)

Plugin membungkus serangkaian ekstensi ke dalam satu modul terpadu yang dapat dipasang ke editor dan renderer.

```typescript
export interface KubuildPlugin {
  /** Nama unik plugin (mengikuti format scoped npm, e.g. "kubuild-plugin-stripe") */
  name: string;
  /** Versi semver plugin */
  version: string;
  /** Deskripsi plugin */
  description?: string;
  /** Daftar komponen kustom yang didaftarkan oleh plugin ini */
  components?: ComponentDefinition[];
  /** Daftar preset blok siap pakai yang ditambahkan ke palette "Blocks" */
  blocks?: BlockDefinition[];
  /** Daftar runtime action handlers kustom (e.g. "stripe_pay", "send_telegram") */
  actions?: Record<string, ActionHandler>;
  /** Tab baru yang diinjeksikan ke Left Sidebar editor */
  sidebarTabs?: Array<{
    id: string;
    label: string;
    icon: React.ReactNode;
    badge?: string | number;
    render: (context: PluginSidebarContext) => React.ReactNode;
  }>;
  /** Tombol atau dropdown menu baru yang diinjeksikan ke Toolbar atas */
  toolbarActions?: Array<{
    id: string;
    render: (context: PluginToolbarContext) => React.ReactNode;
  }>;
  /** Sektor kontrol kustom yang diinjeksikan ke Inspector kanan */
  customStyleSectors?: Array<{
    id: string;
    title: string;
    render: (context: PluginInspectorContext) => React.ReactNode;
  }>;
  /** Dynamic Variables catalog yang disediakan oleh plugin (e.g. e-commerce cart variables) */
  variables?: VariableCatalog;
  /** Lifecycle event hooks */
  hooks?: {
    onInit?: (context: PluginEngineContext) => void | Promise<void>;
    onDestroy?: () => void;
    onDocumentChange?: (doc: PageDocument, prevDoc: PageDocument) => void;
    onNodeInsert?: (node: Node, parentId?: string) => Node | void;
    onNodeDelete?: (nodeId: string) => void;
    onBeforeExport?: (doc: PageDocument) => PageDocument;
    onImportSanitize?: (node: Node) => Node;
  };
}
```

---

### 3.3 Plugin Manager & Engine Integration

Di dalam `@kubuild/core`, dibuat kelas `PluginManager` yang bertanggung jawab untuk:
1. **Registrasi & Validasi**: Memvalidasi integritas plugin, mendeteksi bentrokan nama komponen (*type collision*), dan mencegah duplikasi registrasi.
2. **Merging Registries**: Menggabungkan komponen ke `ComponentRegistry`, blok ke `BlockRegistry`, dan aksi ke `ActionRegistry`.
3. **Dispatching Hooks**: Memanggil lifecycle hooks (`onInit`, `onDocumentChange`, `onNodeInsert`, `onBeforeExport`) secara berurutan (*sequential waterfall*).
4. **UI Extension Registry**: Menyediakan daftar tab sidebar, toolbar actions, dan inspector sectors untuk dirender oleh `@kubuild/editor`.

---

### 3.4 Missing Plugin Fallback & Safe Error Boundary

Ketika dokumen `.stora` diimpor pada host yang tidak memiliki plugin tertentu:
- **Renderer Tidak Crash**: Komponen yang tidak ditemukan di `ComponentRegistry` akan di-render menggunakan `<MissingComponentFallback node={node} />`.
- **Informative Canvas Banner**: Menampilkan nama komponen, tipe (`type: "stripe-button"`), serta tombol atau alert: *"Plugin 'kubuild-plugin-stripe' is required to render this element"*.
- **Preservasi Node Data**: Data node, props, styles, dan children tetap dipertahankan di dalam dokumen AST tanpa terhapus atau termodifikasi saat user menyimpan halaman.

---

### 3.5 Developer Experience (DX) & CLI Scaffolding

Untuk memudahkan developer komunitas membuat plugin dalam hitungan detik:
1. **CLI Starter**: `npm create kubuild-plugin@latest [nama-plugin]`
   - Opsi template:
     - `template-component`: Single custom component package.
     - `template-full-plugin`: Full plugin dengan sidebar tab, custom action, dan inspector controls.
     - `template-block-pack`: Kumpulan layout & block presets.
2. **Hot-Reloading Playground**: Paket plugin menyertakan dev runner lokal berbasis Vite yang langsung menjalankan `KubuildEditor` dengan plugin aktif untuk live testing.
3. **Automated Export & Testing**: Setup standar Vitest dan tsup untuk bundle CJS + ESM + TypeScript `.d.ts`.

---

## 4. Kebutuhan Non-Fungsional (NFR)

1. **Zero-Overhead & Tree-shaking**: Jika host app tidak menggunakan plugin, ukuran bundle `@kubuild/core` dan `@kubuild/editor` tidak mengalami peningkatan beban runtime.
2. **Strict Invariant Rules**:
   - `@kubuild/core` tetap pure TypeScript tanpa dependency React/DOM.
   - Definisi plugin di level core bersifat deklaratif; renderer dan React UI slots dihubungkan melalui adapter di `@kubuild/components` dan `@kubuild/editor`.
3. **Type Safety & Autocomplete**: Semua API (`defineComponent`, `definePlugin`, `PluginSidebarContext`, `PluginToolbarContext`) memiliki generic typing yang ketat.
4. **Security & Untrusted Input**: Plugin dilarang menjalankan fungsi eval/string script langsung dari payload JSON yang tidak terverifikasi.

---

## 5. Roadmap Rilis

- **Phase 1 (Sprint 1)**: Schema extensions, Component Authoring SDK (`defineComponent`), dan Core `PluginManager`.
- **Phase 2 (Sprint 2)**: UI Extension Slots di `@kubuild/editor` (Sidebar tabs, Toolbar actions, Custom Inspector Sectors).
- **Phase 3 (Sprint 3)**: Safe Fallback Renderer, Missing Capability Diagnostics, dan Action Runner Integration.
- **Phase 4 (Sprint 4)**: CLI Scaffolding (`create-kubuild-plugin`), Dokumentasi Resmi, dan 3 Contoh Plugin Referensi (Lottie, Stripe, AI Writer).
