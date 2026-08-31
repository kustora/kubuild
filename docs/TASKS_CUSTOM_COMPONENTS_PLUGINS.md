# KUBUILD — Tasks & Jira Epics: Custom Components & Plugin Extensibility System

**Product:** KUBUILD  
**Codename:** BUILDER-01  
**Document Type:** Sprint & Backlog Tasks (Jira Format)  
**Feature Focus:** Custom Component SDK (`defineComponent`), Plugin Architecture (`definePlugin`), Plugin Manager & Lifecycle Engine, UI Extension Slots (Sidebar, Toolbar, Inspector), Sandboxing & Missing Plugin Fallbacks, and CLI Scaffolding  
**Key Convention:** `STORA-400` s/d `STORA-460`  
**Status:** Ready for Sprint Planning  

---

## Ringkasan Epic & Alokasi Package

| Epic Key | Epic Name | Package Target | Jumlah Task |
| :--- | :--- | :--- | :--- |
| **EPIC-40** | Plugin & Extensibility Schema Contracts | `@kubuild/schema` | 4 Tasks |
| **EPIC-41** | Core Plugin Manager & Extensibility Lifecycle | `@kubuild/core` | 6 Tasks |
| **EPIC-42** | Component Authoring SDK (`defineComponent`) | `@kubuild/components` | 5 Tasks |
| **EPIC-43** | Dynamic Renderer & Missing Plugin Fallback | `@kubuild/renderer` | 5 Tasks |
| **EPIC-44** | Editor UI Extension Slots & Custom Panels | `@kubuild/editor` | 6 Tasks |
| **EPIC-45** | Unified React Entrypoint & Plugin Loader | `@kubuild/react` | 4 Tasks |
| **EPIC-46** | CLI Scaffolding & Reference Example Plugins | `create-kubuild-plugin`, `apps/stora-playground` | 5 Tasks |

---

# Epic 40 — Plugin & Extensibility Schema Contracts (`@kubuild/schema`)

### STORA-400
- **Epic:** Plugin & Extensibility Schema Contracts
- **Task Key:** STORA-400
- **Type:** Story
- **Summary:** Definisikan Schema Zod untuk Plugin Manifest & Capability Contracts
- **Description:** Buat tipe dan schema Zod untuk `PluginManifestSchema` yang memvalidasi metadata plugin: `id`, `name`, `version`, `minEngineVersion`, `author`, `homepage`, `requiredCapabilities`, dan `provides` (components, blocks, actions, panels).
- **Priority:** Highest
- **Package:** `@kubuild/schema`
- **Dependencies:** None
- **Acceptance Criteria:**
  - File `packages/schema/src/plugin.ts` mengekspor schema Zod dan TypeScript types untuk plugin manifest.
  - Unit tests memverifikasi validasi semver, naming convention, dan deteksi missing required fields.

### STORA-401
- **Epic:** Plugin & Extensibility Schema Contracts
- **Task Key:** STORA-401
- **Type:** Story
- **Summary:** Definisikan Schema Prop Field & Inspector Control Descriptors
- **Description:** Perluas schema `ComponentFieldDefinition` untuk mendukung tipe field baru yang lebih ekspresif bagi third-party builder (e.g. `slider`, `toggle`, `code_editor`, `custom_picker`, `rich_select`, `dynamic_array`).
- **Priority:** High
- **Package:** `@kubuild/schema`
- **Dependencies:** None
- **Acceptance Criteria:**
  - Definisi prop control descriptor diperluas dengan field validation, min/max range, step, dan visual grouping.

### STORA-402
- **Epic:** Plugin & Extensibility Schema Contracts
- **Task Key:** STORA-402
- **Type:** Story
- **Summary:** Standarisasi Format Ekstensi pada PageDocument & Manifest `.stora`
- **Description:** Tambahkan metadata `usedPlugins?: Array<{ id: string; version: string }>` dan `requiredCapabilities?: string[]` di dalam `PageDocumentSchema` dan `.stora` package manifest agar host dapat memvalidasi kecocokan plugin saat import.
- **Priority:** High
- **Package:** `@kubuild/schema`
- **Dependencies:** STORA-400
- **Acceptance Criteria:**
  - Saat document diekspor, daftar plugin dan kapabilitas yang dipakai tercatat secara otomatis di metadata dokumen.

### STORA-403
- **Epic:** Plugin & Extensibility Schema Contracts
- **Task Key:** STORA-403
- **Type:** Test
- **Summary:** Unit Tests & JSON Schema Export untuk Plugin Schemas
- **Description:** Buat test suite komprehensif untuk validasi schema plugin dan perbarui generator `json-schema.ts`.
- **Priority:** Medium
- **Package:** `@kubuild/schema`
- **Dependencies:** STORA-400, STORA-401, STORA-402
- **Acceptance Criteria:**
  - Seluruh test di `@kubuild/schema` lulus 100% dan JSON schema terupdate.

---

# Epic 41 — Core Plugin Manager & Extensibility Lifecycle (`@kubuild/core`)

### STORA-410
- **Epic:** Core Plugin Manager & Extensibility Lifecycle
- **Task Key:** STORA-410
- **Type:** Story
- **Summary:** Buat Kelas `PluginManager` & Inisialisasi Plugin Lifecycle
- **Description:** Implementasikan class `PluginManager` yang bertanggung jawab memuat daftar plugin, memvalidasi dependensi antar plugin, mencegah duplikasi identifier, dan mengeksekusi hook lifecycle `onInit` dan `onDestroy`.
- **Priority:** Highest
- **Package:** `@kubuild/core`
- **Dependencies:** STORA-400
- **Acceptance Criteria:**
  - `PluginManager.register(plugin)` berhasil mendaftarkan plugin dan melempar error informatif jika ada duplikasi ID plugin.
  - Hook `onInit` dipanggil secara asinkron dengan context engine (`PluginEngineContext`).

### STORA-411
- **Epic:** Core Plugin Manager & Extensibility Lifecycle
- **Task Key:** STORA-411
- **Type:** Story
- **Summary:** Implementasikan Hook Dispatcher untuk Document & Node Lifecycle
- **Description:** Buat dispatcher event hook: `onDocumentChange`, `onNodeInsert`, `onNodeDelete`, dan `onBeforeExport`. Modifikasi command engine agar memanggil hook ini ketika terjadi perubahan AST.
- **Priority:** Highest
- **Package:** `@kubuild/core`
- **Dependencies:** STORA-410
- **Acceptance Criteria:**
  - Plugin dapat memodifikasi atau menyaring node saat di-insert melalui hook `onNodeInsert`.
  - Mutasi node tetap mematuhi aturan immutable command tree `@kubuild/core`.

### STORA-412
- **Epic:** Core Plugin Manager & Extensibility Lifecycle
- **Task Key:** STORA-412
- **Type:** Story
- **Summary:** Implementasikan Action Registry & Handler Resolver di Core
- **Description:** Buat abstraction `ActionRegistry` untuk mendaftarkan dan mengeksekusi custom action handlers yang didaftarkan oleh plugin (e.g. integrasi pembayaran, webhook dispatch).
- **Priority:** High
- **Package:** `@kubuild/core`
- **Dependencies:** STORA-410
- **Acceptance Criteria:**
  - Action types yang didaftarkan oleh plugin dapat diakses dan dieksekusi melalui `RuntimeContext.executeAction(type, payload)`.

### STORA-413
- **Epic:** Core Plugin Manager & Extensibility Lifecycle
- **Task Key:** STORA-413
- **Type:** Story
- **Summary:** Dynamic Variable Catalog Merging dari Plugins
- **Description:** Buat mekanisme untuk menggabungkan `VariableCatalog` yang disediakan oleh plugin ke dalam runtime context builder secara otomatis.
- **Priority:** Medium
- **Package:** `@kubuild/core`
- **Dependencies:** STORA-410
- **Acceptance Criteria:**
  - Variabel yang didaftarkan plugin langsung muncul di variable picker dan context resolver.

### STORA-414
- **Epic:** Core Plugin Manager & Extensibility Lifecycle
- **Task Key:** STORA-414
- **Type:** Story
- **Summary:** Document Capability Validator & Missing Plugin Diagnostics
- **Description:** Buat fungsi utility `validateDocumentCapabilities(doc, activePlugins)` yang menghasilkan daftar `Diagnostic` jika dokumen membutuhkan plugin atau kapabilitas yang tidak aktif.
- **Priority:** High
- **Package:** `@kubuild/core`
- **Dependencies:** STORA-402, STORA-410
- **Acceptance Criteria:**
  - Mengembalikan daftar diagnostic error/warning jika ditemukan komponen atau aksi dari plugin yang hilang.

### STORA-415
- **Epic:** Core Plugin Manager & Extensibility Lifecycle
- **Task Key:** STORA-415
- **Type:** Test
- **Summary:** Unit Tests untuk PluginManager & Hook Dispatcher
- **Description:** Buat unit tests untuk skenario: multiple plugins, conflict resolution, async onInit, hook filtering, dan capability checking.
- **Priority:** High
- **Package:** `@kubuild/core`
- **Dependencies:** STORA-410, STORA-411, STORA-414
- **Acceptance Criteria:**
  - Code coverage di atas 95% untuk modul plugin core.

---

# Epic 42 — Component Authoring SDK (`@kubuild/components`)

### STORA-420
- **Epic:** Component Authoring SDK
- **Task Key:** STORA-420
- **Type:** Story
- **Summary:** Implementasikan Helper Utilitas `defineComponent<TProps>()`
- **Description:** Buat helper function `defineComponent<TProps>(config)` yang memberikan type inference penuh untuk props, default values, traits, validation, dan React renderer.
- **Priority:** Highest
- **Package:** `@kubuild/components`
- **Dependencies:** STORA-401
- **Acceptance Criteria:**
  - Developer dapat mendefinisikan custom component dengan autocompletion lengkap di TypeScript.
  - Objek output mengimplementasikan `ComponentDefinition` standar yang kompatibel dengan `ComponentRegistry`.

### STORA-421
- **Epic:** Component Authoring SDK
- **Task Key:** STORA-421
- **Type:** Story
- **Summary:** Implementasikan Helper Utilitas `defineBlock()`
- **Description:** Buat helper function `defineBlock(config)` untuk membuat template preset blok yang menggabungkan beberapa node dan default style dalam satu kesatuan yang dapat di-drag dari sidebar "Blocks".
- **Priority:** High
- **Package:** `@kubuild/components`
- **Dependencies:** STORA-420
- **Acceptance Criteria:**
  - Blok yang didefinisikan dapat langsung dimasukkan ke canvas sebagai sub-tree utuh.

### STORA-422
- **Epic:** Component Authoring SDK
- **Task Key:** STORA-422
- **Type:** Story
- **Summary:** Standarisasi Trait & Inspector Form Controls untuk Komponen Pihak Ketiga
- **Description:** Tambahkan utilitas pembuat field inspector otomatis (`createField.string()`, `createField.select()`, `createField.color()`, dll.) untuk menyederhanakan pembuatan konfigurasi inspector.
- **Priority:** High
- **Package:** `@kubuild/components`
- **Dependencies:** STORA-420
- **Acceptance Criteria:**
  - Author komponen tidak perlu menulis objek field JSON secara manual, cukup memakai builder API type-safe.

### STORA-423
- **Epic:** Component Authoring SDK
- **Task Key:** STORA-423
- **Type:** Story
- **Summary:** Export & Code Generation Hook (`toCode`) pada Component Definition
- **Description:** Berikan slot deklaratif `toCode?: (ctx) => string` pada `ComponentDefinition` agar custom component dapat menghasilkan Clean React JSX / HTML saat diekspor melalui Live Code Viewer.
- **Priority:** Medium
- **Package:** `@kubuild/components`
- **Dependencies:** STORA-420
- **Acceptance Criteria:**
  - Code generator di `@kubuild/renderer` otomatis menggunakan `toCode` dari definisi komponen kustom.

### STORA-424
- **Epic:** Component Authoring SDK
- **Task Key:** STORA-424
- **Type:** Test
- **Summary:** Vitest Test Suite untuk Custom Component SDK
- **Description:** Validasi pembuatan komponen kustom, inferensi tipe TypeScript, validasi props kustom, dan penggabungan dengan default registry.
- **Priority:** High
- **Package:** `@kubuild/components`
- **Dependencies:** STORA-420, STORA-421, STORA-422
- **Acceptance Criteria:**
  - Seluruh test di `@kubuild/components` lolos 100%.

---

# Epic 43 — Dynamic Renderer & Missing Plugin Fallback (`@kubuild/renderer`)

### STORA-430
- **Epic:** Dynamic Renderer & Missing Plugin Fallback
- **Task Key:** STORA-430
- **Type:** Story
- **Summary:** Integrasikan Plugin Component Resolution ke dalam React Renderer
- **Description:** Perbarui `RenderNode` di `@kubuild/renderer` agar memetakan node kustom dari registry plugin ke React Component Renderer yang sesuai dengan props resolution & responsive styles.
- **Priority:** Highest
- **Package:** `@kubuild/renderer`
- **Dependencies:** STORA-410, STORA-420
- **Acceptance Criteria:**
  - Custom component dari plugin ter-render dengan sempurna di Canvas dan Preview mode.

### STORA-431
- **Epic:** Dynamic Renderer & Missing Plugin Fallback
- **Task Key:** STORA-431
- **Type:** Story
- **Summary:** Buat Komponen `<MissingComponentFallback />`
- **Description:** Buat UI fallback yang informatif dan aman ketika tipe node tidak ditemukan di registry (karena plugin belum terpasang). Tampilkan icon peringatan, tipe komponen, dan pesan bantuan tanpa memecahkan layout halaman.
- **Priority:** Highest
- **Package:** `@kubuild/renderer`
- **Dependencies:** STORA-430
- **Acceptance Criteria:**
  - Canvas tidak blank atau throw error unhandled exception saat merender unknown node.
  - Node tetap dapat di-select, di-move, atau di-delete di editor.

### STORA-432
- **Epic:** Dynamic Renderer & Missing Plugin Fallback
- **Task Key:** STORA-432
- **Type:** Story
- **Summary:** Isolated Per-Node Error Boundary untuk Custom Components
- **Description:** Bungkus setiap eksekusi renderer komponen kustom pihak ketiga dengan React Error Boundary terisolasi, sehingga error runtime di 1 komponen kustom tidak men-crash seluruh kanvas builder.
- **Priority:** High
- **Package:** `@kubuild/renderer`
- **Dependencies:** STORA-430
- **Acceptance Criteria:**
  - Jika renderer komponen pihak ketiga melempar crash runtime, canvas menampilkan placeholder error terisolasi pada kotak node tersebut saja.

### STORA-433
- **Epic:** Dynamic Renderer & Missing Plugin Fallback
- **Task Key:** STORA-433
- **Type:** Story
- **Summary:** Dynamic Action Handler Execution Pipeline
- **Description:** Hubungkan Action Pipeline executor di `@kubuild/renderer` dengan handler aksi yang didaftarkan oleh plugin.
- **Priority:** High
- **Package:** `@kubuild/renderer`
- **Dependencies:** STORA-412
- **Acceptance Criteria:**
  - Trigger event (click/submit) pada komponen berhasil memanggil action handler plugin.

### STORA-434
- **Epic:** Dynamic Renderer & Missing Plugin Fallback
- **Task Key:** STORA-434
- **Type:** Test
- **Summary:** Test Suite Renderer untuk Dynamic Plugins & Error Boundaries
- **Description:** Buat test case untuk komponen kustom normal, error throwing component, dan missing node fallback.
- **Priority:** High
- **Package:** `@kubuild/renderer`
- **Dependencies:** STORA-430, STORA-431, STORA-432
- **Acceptance Criteria:**
  - Vitest test suite di `@kubuild/renderer` lulus 100%.

---

# Epic 44 — Editor UI Extension Slots & Custom Panels (`@kubuild/editor`)

### STORA-440
- **Epic:** Editor UI Extension Slots & Custom Panels
- **Task Key:** STORA-440
- **Type:** Story
- **Summary:** Implementasikan Left Sidebar Custom Tabs Slot
- **Description:** Perbarui `LeftSidebar` di `@kubuild/editor` agar mendukung penambahan tab kustom dari plugin (e.g. "AI Generator", "Media Library", "Icon Search"). Sediakan `PluginSidebarContext` yang memberi akses ke `insertNode`, `selectedNode`, dan `document`.
- **Priority:** Highest
- **Package:** `@kubuild/editor`
- **Dependencies:** STORA-410
- **Acceptance Criteria:**
  - Tab kustom dari plugin muncul di sidebar sebelah kiri dengan icon dan badge yang dapat diklik.
  - Panel kustom plugin dapat menyisipkan node ke dalam canvas secara reaktif.

### STORA-441
- **Epic:** Editor UI Extension Slots & Custom Panels
- **Task Key:** STORA-441
- **Type:** Story
- **Summary:** Implementasikan Toolbar Actions Extension Slot
- **Description:** Perbarui `EditorToolbar` agar merender tombol aksi kustom dari plugin di sebelah kanan/tengah toolbar dengan akses ke context editor.
- **Priority:** High
- **Package:** `@kubuild/editor`
- **Dependencies:** STORA-410
- **Acceptance Criteria:**
  - Aksi kustom dari plugin (misal tombol "AI Audit", "Sync to CMS") dapat dirender dan diklik di toolbar.

### STORA-442
- **Epic:** Editor UI Extension Slots & Custom Panels
- **Task Key:** STORA-442
- **Type:** Story
- **Summary:** Implementasikan Custom Inspector Sectors & Controls
- **Description:** Perbarui `InspectorPanel` di panel kanan agar dapat menampilkan sektor styling atau kontrol fungsional kustom yang didaftarkan oleh plugin saat node tertentu dipilih.
- **Priority:** High
- **Package:** `@kubuild/editor`
- **Dependencies:** STORA-410, STORA-420
- **Acceptance Criteria:**
  - Sektor kustom muncul secara kontekstual di inspector panel kanan dan dapat memperbarui props/style node.

### STORA-443
- **Epic:** Editor UI Extension Slots & Custom Panels
- **Task Key:** STORA-443
- **Type:** Story
- **Summary:** Dynamic Palette Integration untuk Custom Components & Blocks
- **Description:** Komponen dan blok kustom dari plugin secara otomatis muncul di panel "Components" dan "Blocks" dengan icon, label, dan kategori yang sesuai tanpa perlu konfigurasi manual.
- **Priority:** High
- **Package:** `@kubuild/editor`
- **Dependencies:** STORA-420, STORA-421
- **Acceptance Criteria:**
  - Komponen pihak ketiga dapat di-drag atau di-klik untuk ditambahkan ke canvas.

### STORA-444
- **Epic:** Editor UI Extension Slots & Custom Panels
- **Task Key:** STORA-444
- **Type:** Story
- **Summary:** Missing Plugin Warning Banner di Editor Canvas
- **Description:** Tampilkan floating banner di bagian atas canvas jika dokumen yang dibuka memiliki node yang membutuhkan plugin yang belum terpasang.
- **Priority:** Medium
- **Package:** `@kubuild/editor`
- **Dependencies:** STORA-414, STORA-431
- **Acceptance Criteria:**
  - Pengguna melihat banner: *"This page contains components from uninstalled plugins (e.g. stripe-button)"*.

### STORA-445
- **Epic:** Editor UI Extension Slots & Custom Panels
- **Task Key:** STORA-445
- **Type:** Test
- **Summary:** Integration Tests untuk Editor UI Slots & Plugin Actions
- **Description:** Test suite visual editor untuk registrasi custom tabs, custom toolbar actions, dan mutasi state dokumen dari plugin.
- **Priority:** High
- **Package:** `@kubuild/editor`
- **Dependencies:** STORA-440, STORA-441, STORA-442, STORA-443
- **Acceptance Criteria:**
  - Semua test di `@kubuild/editor` lolos 100%.

---

# Epic 45 — Unified React Entrypoint & Plugin Loader (`@kubuild/react`)

### STORA-450
- **Epic:** Unified React Entrypoint & Plugin Loader
- **Task Key:** STORA-450
- **Type:** Story
- **Summary:** Tambahkan Prop `plugins` & `customComponents` pada `<KubuildEditor />`
- **Description:** Modifikasi komponen utama `KubuildEditor` di `@kubuild/react` agar menerima prop `plugins?: KubuildPlugin[]` dan `customComponents?: ComponentDefinition[]` dan otomatis menginisialisasi `PluginManager`.
- **Priority:** Highest
- **Package:** `@kubuild/react`
- **Dependencies:** STORA-410, STORA-440
- **Acceptance Criteria:**
  - Consumer host cukup mem-pass array `plugins={[myPlugin()]}` ke `<KubuildEditor />`.

### STORA-451
- **Epic:** Unified React Entrypoint & Plugin Loader
- **Task Key:** STORA-451
- **Type:** Story
- **Summary:** Tambahkan Prop `plugins` pada `<KubuildRenderer />`
- **Description:** Modifikasi komponen `<KubuildRenderer />` agar menerima prop `plugins` dan otomatis mendaftarkan custom component renderers dan action handlers ke runtime renderer.
- **Priority:** Highest
- **Package:** `@kubuild/react`
- **Dependencies:** STORA-430, STORA-450
- **Acceptance Criteria:**
  - Output renderer di website publik dapat merender custom component secara identik dengan kanvas editor.

### STORA-452
- **Epic:** Unified React Entrypoint & Plugin Loader
- **Task Key:** STORA-452
- **Type:** Story
- **Summary:** Re-export Plugin SDK & Utilities dari `@kubuild/react`
- **Description:** Re-export `definePlugin`, `defineComponent`, `defineBlock`, `createPluginManager`, dan types terkait dari root `@kubuild/react` untuk memudahkan konsumsi oleh developer.
- **Priority:** Medium
- **Package:** `@kubuild/react`
- **Dependencies:** STORA-450
- **Acceptance Criteria:**
  - Pengembang dapat mengimpor seluruh builder dan SDK cukup dari satu package `@kubuild/react`.

### STORA-453
- **Epic:** Unified React Entrypoint & Plugin Loader
- **Task Key:** STORA-453
- **Type:** Test
- **Summary:** End-to-End Typecheck & Unit Test `@kubuild/react`
- **Description:** Pastikan type definitions dan bundle ekspor bekerja dengan sempurna di mode CJS dan ESM.
- **Priority:** High
- **Package:** `@kubuild/react`
- **Dependencies:** STORA-450, STORA-451, STORA-452
- **Acceptance Criteria:**
  - `pnpm run typecheck` dan `pnpm run build` sukses tanpa error.

---

# Epic 46 — CLI Scaffolding & Reference Example Plugins (`create-kubuild-plugin`, Playground)

### STORA-460
- **Epic:** CLI Scaffolding & Reference Example Plugins
- **Task Key:** STORA-460
- **Type:** Story
- **Summary:** Buat Scaffolding Tool `create-kubuild-plugin` CLI
- **Description:** Buat CLI tool interaktif berbasis Node.js (`npm create kubuild-plugin`) yang men-generate boilerplate project plugin siap pakai dengan TypeScript, Vite dev runner, Vitest, dan tsup config.
- **Priority:** High
- **Package:** `packages/create-kubuild-plugin`
- **Dependencies:** STORA-452
- **Acceptance Criteria:**
  - Perintah `npm create kubuild-plugin my-plugin` menghasilkan struktur direktori standar yang langsung dapat dijalankan dengan `pnpm dev`.

### STORA-461
- **Epic:** CLI Scaffolding & Reference Example Plugins
- **Task Key:** STORA-461
- **Type:** Story
- **Summary:** Buat Reference Plugin 1: `kubuild-plugin-lottie`
- **Description:** Buat contoh plugin resmi berupa Lottie Animation Player dengan kontrol URL, autoplay, speed, dan inspector fields.
- **Priority:** High
- **Package:** `apps/stora-playground`, `packages/components`
- **Dependencies:** STORA-420
- **Acceptance Criteria:**
  - Komponen Lottie dapat di-drag di playground, dikonfigurasi kecepatannya di inspector, dan di-render animasinya secara mulus.

### STORA-462
- **Epic:** CLI Scaffolding & Reference Example Plugins
- **Task Key:** STORA-462
- **Type:** Story
- **Summary:** Buat Reference Plugin 2: `kubuild-plugin-ai-assistant`
- **Description:** Buat contoh plugin dengan Sidebar Tab untuk AI Content & Layout Generator yang dapat menyisipkan node sections otomatis ke dalam dokumen.
- **Priority:** High
- **Package:** `apps/stora-playground`
- **Dependencies:** STORA-440
- **Acceptance Criteria:**
  - Tab AI Assistant muncul di playground, dapat menerima prompt teks, dan men-generate blok layout ke canvas.

### STORA-463
- **Epic:** CLI Scaffolding & Reference Example Plugins
- **Task Key:** STORA-463
- **Type:** Story
- **Summary:** Dokumentasi & Tutorial Authoring: "How to Build a KUBUILD Plugin"
- **Description:** Buat dokumentasi komprehensif di `docs/CUSTOM_COMPONENTS_AND_PLUGINS_GUIDE.md` dengan panduan langkah-demi-langkah, best practices, dan referensi API lengkap.
- **Priority:** High
- **Package:** `docs`
- **Dependencies:** STORA-460, STORA-461, STORA-462
- **Acceptance Criteria:**
  - Dokumen panduan tersedia dengan contoh kode yang jelas dan dapat diakses oleh publik.

### STORA-464
- **Epic:** CLI Scaffolding & Reference Example Plugins
- **Task Key:** STORA-464
- **Type:** Test
- **Summary:** End-to-End Validation di `apps/stora-playground`
- **Description:** Uji coba seluruh ekosistem plugin di dalam playground aplikasi: pasang plugin, buka template, edit di canvas, simpan ke `.stora`, ekspor ke clean code, dan jalankan di preview renderer.
- **Priority:** Highest
- **Package:** `apps/stora-playground`
- **Dependencies:** Semua task sebelumnya
- **Acceptance Criteria:**
  - Seluruh alur kerja Create -> Customize with Plugins -> Export -> Import -> Render berjalan tanpa kendala.
