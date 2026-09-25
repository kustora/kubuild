# KUBUILD — Tasks & Jira Epics: Host Integration Feedback (Funnel Builder)

**Product:** KUBUILD  
**Codename:** BUILDER-01  
**Document Type:** Sprint & Backlog Tasks (Jira Format)  
**Feature Focus:** Bug correctness yang merusak data, API integrasi host (blocks/templates/save/replace), runtime responsif, komponen konversi (countdown, FAQ, tabs, carousel, rating), konsistensi schema & theming, akurasi dokumentasi  
**Key Convention:** `STORA-530` s/d `STORA-556`  
**Status:** Wave 1 selesai (branch `feat/host-integration-feedback`) — 23 Done, 4 To Do  
**Sumber:** Temuan saat mengintegrasikan KUBUILD `0.7.0` sebagai page builder funnel di aplikasi host (jomsini — NestJS + Next.js), 2026-09-24. Setiap klaim di bawah sudah diverifikasi terhadap source code (file:line mengacu ke commit `c28ae4a`).

---

## Latar Belakang

Host membangun funnel builder (landing → checkout → upsell → thank-you) di atas `@kubuild/react`. Integrasi berhasil, tapi host terpaksa membuat beberapa workaround yang seharusnya ditangani library:

- Template halaman dibangun sebagai `PageDocument` utuh di sisi host karena editor tidak menerima blok/template dari host.
- Komponen `countdown` dibuat sendiri sebagai custom component karena tidak ada bawaan.
- Tipe `Node`/`PageDocument` didefinisikan ulang di backend host karena `.d.ts` `@kubuild/schema` bergantung pada zod v4 sedangkan host memakai zod v3.
- Status "dirty" dan penyimpanan dilacak manual lewat `onChange` + ref karena tidak ada `onSave`.
- Halaman publik tidak benar-benar responsif di HP karena runtime renderer tidak menghasilkan media query.

Dokumen ini memecah perbaikannya menjadi epic yang bisa dikerjakan per package.

## Ringkasan Epic & Alokasi Package

| Epic Key | Epic Name | Package Target | Jumlah Task |
| :--- | :--- | :--- | :--- |
| **EPIC-57** | Correctness Bugs (data loss & silent failures) | `@kubuild/core`, `@kubuild/renderer`, `@kubuild/components` | 5 Tasks |
| **EPIC-58** | Host Integration API (blocks, templates, save, replace) | `@kubuild/editor`, `@kubuild/react`, `@kubuild/components` | 5 Tasks |
| **EPIC-59** | Responsive Runtime Rendering | `@kubuild/renderer` | 3 Tasks |
| **EPIC-60** | Conversion Components (sales/funnel pages) | `@kubuild/components`, `@kubuild/renderer` | 7 Tasks |
| **EPIC-61** | Schema Consistency, Theming & Types | `@kubuild/schema`, `@kubuild/core`, `@kubuild/editor` | 4 Tasks |
| **EPIC-62** | Documentation Accuracy | `docs/` | 3 Tasks |

## Urutan Pengerjaan yang Disarankan

1. **STORA-530** (data loss) → **STORA-532** → **STORA-531** — bug yang merusak dokumen atau gagal diam-diam.
2. **STORA-535** + **STORA-536** — membuka jalan untuk library section/template dari host.
3. **STORA-540** — menentukan apakah halaman publik tampil benar di HP.
4. Sisanya sesuai prioritas masing-masing task.

---

# Epic 57 — Correctness Bugs (`@kubuild/core`, `@kubuild/renderer`, `@kubuild/components`)

### STORA-530
- **Epic:** Correctness Bugs
- **Task Key:** STORA-530
- **Type:** Bug
- **Summary:** `cloneTemplateAsPage` menghapus `actions`, `animation`, dan `formConfig` dari setiap node
- **Description:** `cloneTreeWithFreshIds` (`packages/core/src/io/template-utils.ts:283-301`) hanya menyalin `id`, `type`, `props`, `styles`, `children`. Semua field `Node` lain (`actions`, `animation`, `formConfig` — lihat `packages/schema/src/document.ts:259-286`) hilang tanpa peringatan. Akibatnya template yang berisi form submit pipeline atau tombol dengan action rusak begitu di-clone menjadi halaman — padahal clone-on-use adalah alur utama template di PRD §11–13.
- **Priority:** Highest
- **Status:** Done
- **Package:** `@kubuild/core`
- **Dependencies:** None
- **Acceptance Criteria:**
  - Clone menyalin seluruh field node (deep clone), hanya `id` yang diganti.
  - Referensi internal yang memakai node id (mis. `modalNodeId` di step `open_modal`, `formId` di `reset_form`, target di `ActionPipeline`) di-remap ke id baru; referensi ke node di luar subtree dibiarkan.
  - Unit test: template dengan form + `trigger: 'submit'` pipeline + animation → hasil clone identik kecuali id, dan pipeline tetap jalan di renderer.

### STORA-531
- **Epic:** Correctness Bugs
- **Task Key:** STORA-531
- **Type:** Bug
- **Summary:** Komponen terdaftar tanpa renderer tampil sebagai "Unknown Component"
- **Description:** `switch`, `file-upload`, `radio-group`, `radio-item`, dan `button-submit` didaftarkan oleh `createDefaultComponentRegistry()` (`packages/components/src/definitions/index.ts`) dan muncul di panel komponen editor, tetapi tidak ada `case` untuk tipe-tipe ini di `packages/renderer/src/renderers/` sehingga jatuh ke placeholder fallback (`render-node-content.tsx:1386`). User bisa drop komponen yang tidak pernah bisa dipakai.
- **Priority:** High
- **Status:** Done
- **Package:** `@kubuild/renderer`, `@kubuild/components`
- **Dependencies:** None
- **Acceptance Criteria:**
  - Setiap tipe punya renderer editor + runtime yang terintegrasi dengan `form-context` (nilai terdaftar via `name`, validasi `required`), **atau** disembunyikan dari registry default sampai renderer siap.
  - `button-submit`: renderer menghormati `loadingText`, `showSpinner`, `autoDisableOnSubmit` selama pipeline submit berjalan.
  - Test otomatis: setiap tipe di `createDefaultComponentRegistry()` harus punya renderer (test gagal bila ada tipe tanpa renderer).

### STORA-532
- **Epic:** Correctness Bugs
- **Task Key:** STORA-532
- **Type:** Bug
- **Summary:** `api_request` pada submit form tidak mengirim data form kecuali `body` diisi eksplisit
- **Description:** Runner hanya memakai `payload.body` (`packages/renderer/src/action-runners/api-request.ts:371-374`); bila kosong, request dikirim tanpa body (`:158-159`). Blok bawaan `form-contact-us` (`packages/components/src/blocks/forms.ts:95-106`) tidak mengisi `body`, sehingga form contoh bawaan pun mengirim request kosong. Developer harus tahu menulis `body: "{{form}}"`.
- **Priority:** Highest
- **Status:** Done
- **Package:** `@kubuild/renderer`, `@kubuild/components`
- **Dependencies:** None
- **Acceptance Criteria:**
  - Bila pipeline dipicu `trigger: 'submit'` dan `payload.body` tidak didefinisikan, runner mengirim nilai form (`context.form`) dengan `bodyFormat` yang dipilih. `body: null` eksplisit tetap berarti "tanpa body".
  - Blok `form-contact-us`, `form-newsletter`, `form-lead-gen` mengirim data form secara default.
  - Action Builder menampilkan hint "Default: seluruh data form" pada field body untuk pipeline submit.
  - Test: submit form tanpa `body` → fetch menerima field form.

### STORA-533
- **Epic:** Correctness Bugs
- **Task Key:** STORA-533
- **Type:** Bug
- **Summary:** Legacy `props.action` gagal diam-diam (`UNKNOWN_ACTION`) — termasuk di starter fixture sendiri
- **Description:** `dispatchAction` (`packages/renderer/src/render-context.tsx:302-333`) mewajibkan host mendaftarkan handler di `context.actionRegistry`; tanpa itu hanya diagnostic `UNKNOWN_ACTION` yang terjadi. Starter fixture (`packages/schema/src/fixtures/starter-page.json:127`) memakai `props.action = { type: 'navigate' }`, sehingga tombol di halaman starter tidak melakukan apa pun di host yang tidak mendaftarkan handler.
- **Priority:** High
- **Status:** Done
- **Package:** `@kubuild/renderer`, `@kubuild/schema`
- **Dependencies:** None
- **Acceptance Criteria:**
  - Handler bawaan untuk tipe legacy yang punya padanan runner (`navigate`, `open_modal`, `close_modal`, `show_toast`) — host tetap bisa override lewat `actionRegistry`.
  - Starter fixture dimigrasikan ke `node.actions` (pipeline) sebagai format kanonis.
  - Diagnostic `UNKNOWN_ACTION` tetap muncul untuk tipe yang benar-benar tidak dikenal, dan terlihat di mode editor (bukan hanya callback `onDiagnostic`).

### STORA-534
- **Epic:** Correctness Bugs
- **Task Key:** STORA-534
- **Type:** Test
- **Summary:** Regression suite untuk bug Epic 57
- **Description:** Tambahkan test yang mengunci perilaku STORA-530 s/d STORA-533 agar tidak regresi saat refactor berikutnya.
- **Priority:** High
- **Status:** Done
- **Package:** `@kubuild/core`, `@kubuild/renderer`
- **Dependencies:** STORA-530, STORA-531, STORA-532, STORA-533
- **Acceptance Criteria:**
  - Test integrasi renderer: render starter fixture + blok form bawaan → klik/submit menghasilkan navigasi/request yang benar.
  - Test "registry coverage" dari STORA-531 berjalan di CI.

---

# Epic 58 — Host Integration API (`@kubuild/editor`, `@kubuild/react`)

### STORA-535
- **Epic:** Host Integration API
- **Task Key:** STORA-535
- **Type:** Story
- **Summary:** Prop `blocks` pada `KubuildEditor` — host dapat menyuplai blok/section sendiri
- **Description:** `BlocksPanel` sudah menerima `blocks?` dan `onInsertBlock?` (`packages/editor/src/components/panels/blocks-panel.tsx:10-12`), tetapi `LeftSidebar` tidak meneruskannya (`left-sidebar.tsx:127`). Drag-and-drop canvas (`canvas.tsx:985`) dan `store.insertBlock(id)` (`store.ts:1006`) mencari id **hanya** di `STARTER_BLOCKS`. Host tidak punya cara menambah section library (hero, FAQ, testimoni, order form) — padahal `BlockDefinition` sudah didesain untuk itu.
- **Priority:** Highest
- **Status:** Done
- **Package:** `@kubuild/editor`, `@kubuild/react`
- **Dependencies:** None
- **Acceptance Criteria:**
  - `KubuildEditorProps.blocks?: BlockDefinition[]` dan `blocksMode?: 'append' | 'replace'` (default `append` ke `STARTER_BLOCKS`).
  - Satu sumber kebenaran "block registry" di store; `LeftSidebar`, canvas drop, dan `insertBlock(id)` semuanya membaca dari registry ini.
  - Kategori baru dari host (`category`/`categoryLabel`) tampil sebagai grup di Blocks tab; `thumbnailSvg` dirender.
  - Playground mendemokan satu blok custom dari host.

### STORA-536
- **Epic:** Host Integration API
- **Task Key:** STORA-536
- **Type:** Story
- **Summary:** Prop `templates` + Template Picker untuk "halaman baru dari template" dan "ganti template"
- **Description:** Schema `TemplateRecord` (`packages/schema/src/template.ts:82-100`) dan helper `cloneTemplateAsPage`, `validateTemplate`, `extractTemplateRequirements` sudah ada di core, tetapi tidak ada UI maupun prop editor yang memakainya; playground membuat halaman baru dengan `createBlankDocument` (`apps/stora-playground/src/App.tsx:225`). Host funnel butuh picker per tipe halaman (landing/checkout/upsell/thank-you).
- **Priority:** High
- **Status:** Done
- **Package:** `@kubuild/editor`, `@kubuild/react`
- **Dependencies:** STORA-530
- **Acceptance Criteria:**
  - `KubuildEditorProps.templates?: TemplateRecord[]` + callback `onApplyTemplate?`.
  - Komponen `TemplatePicker` (juga diekspor untuk dipakai host di luar editor): grid kartu thumbnail + nama + deskripsi + kategori/tags, filter kategori, preview read-only via `KubuildRenderer`.
  - Aksi "Ganti dengan template" di toolbar: konfirmasi pakai dialog editor (bukan `confirm()`), bisa di-undo lewat history.
  - Template dengan `requirements.requiredComponents` yang tidak ada di registry ditandai dan tidak bisa diterapkan.

### STORA-537
- **Epic:** Host Integration API
- **Task Key:** STORA-537
- **Type:** Story
- **Summary:** `onSave`, status dirty bawaan, dan shortcut Cmd/Ctrl+S
- **Description:** `KubuildEditorProps` hanya punya `onChange(doc)` (`packages/editor/src/components/layout/editor.tsx:83`). Setiap host harus membuat ulang logika dirty-tracking + tombol simpan + shortcut.
- **Priority:** Medium
- **Status:** Done
- **Package:** `@kubuild/editor`
- **Dependencies:** None
- **Acceptance Criteria:**
  - `onSave?: (doc: PageDocument) => Promise<void> | void`; editor menampilkan status `saving`/`saved`/`error` dan menangani Cmd/Ctrl+S.
  - `isDirty` di-expose (lewat callback `onDirtyChange` dan ref) dan di-reset setelah `onSave` berhasil.
  - Opsional `autosave?: { debounceMs: number }`.
  - Peringatan `beforeunload` bila dirty (bisa dimatikan).

### STORA-538
- **Epic:** Host Integration API
- **Task Key:** STORA-538
- **Type:** Story
- **Summary:** Imperative handle: `replaceDocument`, `getDocument`, `insertBlock`
- **Description:** `initialDocument` hanya men-seed editor sekali; mengganti dokumen dari luar (mis. setelah menerapkan template di server, atau revert ke versi published) memaksa host me-remount editor dan kehilangan history/selection.
- **Priority:** Medium
- **Status:** Done
- **Package:** `@kubuild/editor`, `@kubuild/react`
- **Dependencies:** STORA-535
- **Acceptance Criteria:**
  - `forwardRef` pada `KubuildEditor` dengan `EditorHandle { getDocument(); replaceDocument(doc, { keepHistory?: boolean }); insertBlock(block | id, targetId?); undo(); redo(); }`.
  - `replaceDocument` memvalidasi dokumen (`validateDocument`) dan menolak dengan diagnostic bila tidak valid.
  - Test: replace → undo mengembalikan dokumen sebelumnya bila `keepHistory: true`.

### STORA-539
- **Epic:** Host Integration API
- **Task Key:** STORA-539
- **Type:** Docs
- **Summary:** Guide "Embedding KUBUILD in a host app" end-to-end
- **Description:** Satu guide yang menunjukkan integrasi nyata: custom component yang membaca `context.variables` (contoh: blok produk), host blocks, templates, `onSave`, imperative handle, action handler host, dan rendering publik dengan `KubuildRenderer`.
- **Priority:** Medium
- **Status:** To Do
- **Package:** `docs/`
- **Dependencies:** STORA-535, STORA-536, STORA-537, STORA-538
- **Acceptance Criteria:**
  - Guide EN + `id/` dengan contoh kode yang di-typecheck di CI (lihat STORA-556).

---

# Epic 59 — Responsive Runtime Rendering (`@kubuild/renderer`)

### STORA-540
- **Epic:** Responsive Runtime Rendering
- **Task Key:** STORA-540
- **Type:** Story
- **Summary:** Runtime renderer menghasilkan media query untuk `styles.tablet` / `styles.mobile`
- **Description:** `resolveNodeStyles` (`packages/renderer/src/styles.ts:137-146`) menggabungkan `base` dengan style untuk **satu** `viewport` prop (default `'desktop'`, `renderer.tsx:97,107`). Tidak ada `@media` di runtime — padahal `code-generator.ts:561-566` sudah bisa menghasilkannya untuk ekspor. Akibatnya halaman publik tampil versi desktop di HP kecuali host menebak viewport sendiri (dan salah saat resize/rotate, serta tidak cocok dengan SSR). Untuk landing page yang mayoritas dibuka dari mobile, ini masalah utama.
- **Priority:** Highest
- **Status:** Done
- **Package:** `@kubuild/renderer`
- **Dependencies:** None
- **Acceptance Criteria:**
  - Mode baru `responsive: 'css'` (default untuk `mode="runtime"`): base style inline/scoped + override tablet/mobile sebagai rule `@media` ter-scope ke `[data-kubuild-node="…"]`, memakai breakpoint yang sama dengan editor & code generator (satu konstanta bersama).
  - Mode lama `viewport` tetap ada untuk canvas editor (preview per device).
  - SSR-safe: output style identik di server dan client (tidak ada hydration mismatch).
  - Test visual/unit: node dengan `styles.mobile.gridTemplateColumns` berubah pada lebar < 768px tanpa prop `viewport`.

### STORA-541
- **Epic:** Responsive Runtime Rendering
- **Task Key:** STORA-541
- **Type:** Story
- **Summary:** Satukan definisi breakpoint (docs, editor, renderer, code generator)
- **Description:** Docs menyebut desktop ≥1024, tablet 768–1023, mobile <768; code generator memakai `max-width: 1024px` dan `max-width: 640px`. Nilai ini harus satu sumber.
- **Priority:** Medium
- **Status:** Done
- **Package:** `@kubuild/schema`, `@kubuild/renderer`, `@kubuild/editor`
- **Dependencies:** STORA-540
- **Acceptance Criteria:**
  - `BREAKPOINTS` diekspor dari `@kubuild/schema` dan dipakai editor, renderer, code generator.
  - Docs diperbarui agar sesuai.

### STORA-542
- **Epic:** Responsive Runtime Rendering
- **Task Key:** STORA-542
- **Type:** Test
- **Summary:** Test responsif runtime + perbandingan dengan output ekspor
- **Description:** Pastikan rendering runtime dan HTML hasil code generator menghasilkan layout yang sama per breakpoint.
- **Priority:** Medium
- **Status:** Done
- **Package:** `@kubuild/renderer`
- **Dependencies:** STORA-540, STORA-541
- **Acceptance Criteria:**
  - Snapshot CSS runtime vs code generator untuk fixture multi-breakpoint.

---

# Epic 60 — Conversion Components (`@kubuild/components`, `@kubuild/renderer`)

> Konteks: halaman jualan/funnel hampir selalu butuh komponen di bawah. Saat ini tidak ada satupun di `packages/components/src/definitions/`; host harus membangunnya sendiri sebagai custom component.

### STORA-543
- **Epic:** Conversion Components
- **Task Key:** STORA-543
- **Type:** Story
- **Summary:** Komponen `countdown`
- **Description:** Timer urgensi untuk tawaran terbatas. Host saat ini membuat versi sendiri (deadline per pengunjung disimpan di `sessionStorage`, beku di mode editor).
- **Priority:** High
- **Status:** Done
- **Package:** `@kubuild/components`, `@kubuild/renderer`
- **Dependencies:** None
- **Acceptance Criteria:**
  - Mode `evergreen` (durasi per pengunjung, disimpan di storage dengan fallback aman bila storage throw) dan `fixed` (tanggal/jam target + timezone).
  - Format: `mm:ss`, `hh:mm:ss`, `d h m s`; label dan teks kedaluwarsa bisa diatur.
  - Aksi saat habis: sembunyikan, tampilkan teks, atau jalankan `ActionPipeline` (trigger baru `expire`).
  - Di mode editor timer tidak berjalan (menampilkan durasi penuh); aksesibel (`role="timer"`).

### STORA-544
- **Epic:** Conversion Components
- **Task Key:** STORA-544
- **Type:** Story
- **Summary:** Komponen `accordion` / FAQ di atas `collapsible`
- **Description:** `collapsible` ada, tetapi FAQ butuh grup item dengan mode "satu terbuka saja", ikon, dan markup yang ramah SEO.
- **Priority:** High
- **Status:** Done
- **Package:** `@kubuild/components`, `@kubuild/renderer`
- **Dependencies:** None
- **Acceptance Criteria:**
  - `accordion` (container) + `accordion-item` (judul + konten children), opsi `allowMultiple`, `defaultOpenIndex`.
  - Keyboard & ARIA (`aria-expanded`, `aria-controls`).
  - Opsi output JSON-LD `FAQPage` untuk runtime.

### STORA-545
- **Epic:** Conversion Components
- **Task Key:** STORA-545
- **Type:** Story
- **Summary:** Komponen `tabs`
- **Description:** Tab untuk varian produk, spesifikasi, perbandingan paket.
- **Priority:** Medium
- **Status:** Done
- **Package:** `@kubuild/components`, `@kubuild/renderer`
- **Dependencies:** None
- **Acceptance Criteria:**
  - `tabs` + `tab-panel`, pola ARIA tabs, tab aktif bisa diatur di editor.

### STORA-546
- **Epic:** Conversion Components
- **Task Key:** STORA-546
- **Type:** Story
- **Summary:** Komponen `carousel` (gambar & testimoni)
- **Description:** Galeri produk dan slider testimoni.
- **Priority:** Medium
- **Status:** Done
- **Package:** `@kubuild/components`, `@kubuild/renderer`
- **Dependencies:** STORA-540
- **Acceptance Criteria:**
  - Slide = children; opsi autoplay, loop, dots, arrows; swipe di touch device; menghormati `prefers-reduced-motion`.

### STORA-547
- **Epic:** Conversion Components
- **Task Key:** STORA-547
- **Type:** Story
- **Summary:** Komponen `rating` (bintang)
- **Description:** Host saat ini menyusun 5 node `icon` "Star" satu per satu.
- **Priority:** Low
- **Status:** Done
- **Package:** `@kubuild/components`, `@kubuild/renderer`
- **Dependencies:** None
- **Acceptance Criteria:**
  - Props `value` (mendukung setengah bintang), `max`, `size`, `color`, label aksesibel ("4.5 dari 5").

### STORA-548
- **Epic:** Conversion Components
- **Task Key:** STORA-548
- **Type:** Story
- **Summary:** Komponen `divider` dan `spacer`
- **Description:** Saat ini host memakai `flex` kosong dengan `height` sebagai spacer.
- **Priority:** Low
- **Status:** Done
- **Package:** `@kubuild/components`, `@kubuild/renderer`
- **Dependencies:** None
- **Acceptance Criteria:**
  - `divider` (garis, style solid/dashed, label tengah opsional); `spacer` (tinggi responsif per breakpoint).

### STORA-549
- **Epic:** Conversion Components
- **Task Key:** STORA-549
- **Type:** Story
- **Summary:** Starter blocks untuk section penjualan
- **Description:** Tambahkan ke `STARTER_BLOCKS` section siap pakai yang memakai komponen Epic 60: FAQ, testimoni (carousel + rating), countdown banner, jaminan/garansi, trust badges, perbandingan paket.
- **Priority:** Medium
- **Status:** Done
- **Package:** `@kubuild/components`
- **Dependencies:** STORA-543, STORA-544, STORA-546, STORA-547
- **Acceptance Criteria:**
  - Kategori baru `sales` di Blocks tab; setiap blok valid terhadap `validateDocument` dengan `strictChildPolicy`.

---

# Epic 61 — Schema Consistency, Theming & Types (`@kubuild/schema`, `@kubuild/core`, `@kubuild/editor`)

### STORA-550
- **Epic:** Schema Consistency, Theming & Types
- **Task Key:** STORA-550
- **Type:** Story
- **Summary:** Nama prop kanonis untuk komponen teks + migrasi dokumen
- **Description:** Renderer menerima dua nama untuk prop yang sama: `text`/`paragraph` membaca `text ?? content` (`render-node-content.tsx:217-247`), `badge` membaca `text ?? label` (`:381-382`), `blockquote` membaca `quote ?? text` (`:325-335`). Editor inline edit selalu menulis `text` (mis. `:242`, `:259`). Dokumen lama dengan `content` jadi punya dua prop setelah diedit, dan penulis template/host harus menebak nama mana yang benar.
- **Priority:** Medium
- **Status:** Done
- **Package:** `@kubuild/schema`, `@kubuild/core`, `@kubuild/renderer`
- **Dependencies:** None
- **Acceptance Criteria:**
  - Tetapkan satu nama kanonis per komponen (didokumentasikan di definisi komponen).
  - Migrasi dokumen di `migrateDocument` (naikkan `CURRENT_SCHEMA_VERSION`) yang memindahkan alias ke nama kanonis.
  - Renderer tetap membaca alias selama satu minor version, dengan diagnostic `DEPRECATED_PROP`.

### STORA-551
- **Epic:** Schema Consistency, Theming & Types
- **Task Key:** STORA-551
- **Type:** Story
- **Summary:** Theme / design token tersimpan di dokumen
- **Description:** `PageDocument` tidak punya field theme (`packages/schema/src/document.ts:331-337`). `DesignTokensPanel` (`packages/editor/src/components/style-manager/design-tokens-panel.tsx:20-35`) hanya menyalin nilai literal ke node yang dipilih, token tidak disimpan. Host multi-tenant perlu mengganti warna brand satu kali untuk seluruh halaman/template.
- **Priority:** High
- **Status:** Done
- **Package:** `@kubuild/schema`, `@kubuild/renderer`, `@kubuild/editor`
- **Dependencies:** None
- **Acceptance Criteria:**
  - `PageDocument.theme?: { colors, fonts, radii, spacing }` (tervalidasi, aman dari injeksi CSS seperti style lain).
  - Style node dapat mereferensikan token (`var(--kb-color-primary)` atau `{ type: 'token', key }`); renderer mengeluarkan CSS custom properties di root.
  - Panel Theme di editor untuk mengubah token dokumen; `DesignTokensPanel` menyisipkan referensi token, bukan nilai literal.
  - Host dapat menyuplai theme override lewat `RuntimeContext` (mis. warna brand per tenant) tanpa mengubah dokumen.

### STORA-552
- **Epic:** Schema Consistency, Theming & Types
- **Task Key:** STORA-552
- **Type:** Story
- **Summary:** Entry point tipe tanpa zod: `@kubuild/schema/types`
- **Description:** `@kubuild/schema` bergantung pada `zod ^4.4.3` (`packages/schema/package.json:52`) dan `.d.ts`-nya merujuk namespace `z.core` milik zod v4. Host yang masih memakai zod v3 tidak bisa meng-import tipe `Node`/`PageDocument` (compile error), sehingga harus mendefinisikan ulang tipe secara manual — rawan drift.
- **Priority:** Medium
- **Status:** Done
- **Package:** `@kubuild/schema`
- **Dependencies:** None
- **Acceptance Criteria:**
  - Subpath export `@kubuild/schema/types` berisi interface TypeScript murni (tanpa import zod) untuk `PageDocument`, `Node`, `ResponsiveStyles`, `ActionPipeline`, `TemplateRecord`, dll.
  - Test tipe memastikan interface murni setara dengan `z.infer<…>` dari schema (mis. `expectTypeOf`).
  - Validator runtime tersedia tanpa zod di sisi pemanggil (mis. `validateDocument(doc)` mengembalikan hasil biasa), agar backend zod v3 bisa memvalidasi tanpa konflik versi.

### STORA-553
- **Epic:** Schema Consistency, Theming & Types
- **Task Key:** STORA-553
- **Type:** Bug
- **Summary:** `CORE_BUILTIN_COMPONENTS` basi — turunkan dari registry
- **Description:** Daftar statis di `packages/core/src/io/template-utils.ts:16-40` masih memuat `'column'` (tidak ada lagi di definisi komponen) dan bisa tidak sinkron dengan `createDefaultComponentRegistry()`. Daftar ini dipakai untuk `extractTemplateRequirements`, sehingga requirement template bisa salah.
- **Priority:** Medium
- **Status:** Done
- **Package:** `@kubuild/core`, `@kubuild/components`
- **Dependencies:** None
- **Acceptance Criteria:**
  - Satu sumber daftar tipe bawaan (diekspor dari `@kubuild/components` atau di-generate saat build) dipakai core.
  - Test memastikan daftar core == tipe di registry default.

---

# Epic 62 — Documentation Accuracy (`docs/`)

### STORA-554
- **Epic:** Documentation Accuracy
- **Task Key:** STORA-554
- **Type:** Bug
- **Summary:** Guide import/export merujuk fungsi yang tidak ada
- **Description:** `docs/src/content/docs/guides/import-export.md:13,16` meng-import `exportToStoraPackage` / `importFromStoraPackage` dari `@kubuild/editor`; tidak ada di `packages/*/src`. Fungsi sebenarnya: `exportPackage` / `exportStoraPackage` (`packages/core/src/io/exporter.ts:310,523`) dan `importPackage` / `importStoraPackage` / `preflightPackage` (`importer.ts:910,1205,361`), plus helper editor `downloadDocumentAsStora` / `downloadDocumentAsJson` (`packages/editor/src/utils/export-utils.ts:66,89`).
- **Priority:** High
- **Status:** To Do
- **Package:** `docs/`
- **Dependencies:** None
- **Acceptance Criteria:**
  - Guide EN + `id/` memakai API yang benar, termasuk opsi `MissingDependencyPolicy` dan `AssetCollisionStrategy`.

### STORA-555
- **Epic:** Documentation Accuracy
- **Task Key:** STORA-555
- **Type:** Bug
- **Summary:** Guide theming memakai shape style yang tidak sesuai schema
- **Description:** `docs/src/content/docs/guides/theming-and-styling.md:21` memakai key `"style"` dan objek padding bersarang, sedangkan schema memakai `styles: { base, desktop, tablet, mobile, states }` dengan nilai skalar (`packages/schema/src/document.ts:192-201`). Contoh dari docs gagal validasi.
- **Priority:** Medium
- **Status:** To Do
- **Package:** `docs/`
- **Dependencies:** STORA-551 (bila theme ditambahkan, guide ditulis ulang sekaligus)
- **Acceptance Criteria:**
  - Semua contoh JSON di guide lolos `validateDocument`.

### STORA-556
- **Epic:** Documentation Accuracy
- **Task Key:** STORA-556
- **Type:** Test
- **Summary:** Contoh kode & JSON di docs dijalankan sebagai test di CI
- **Description:** Drift di STORA-554/555 terjadi karena contoh docs tidak pernah dieksekusi. Ekstrak blok kode `ts`/`tsx`/`json` dari `docs/src/content/docs/**` dan jalankan di CI.
- **Priority:** Medium
- **Status:** To Do
- **Package:** `docs/`, root CI
- **Dependencies:** STORA-554, STORA-555
- **Acceptance Criteria:**
  - Blok `ts`/`tsx` di-typecheck terhadap package workspace; blok `json` bertanda `PageDocument` divalidasi dengan `validateDocument`.
  - CI gagal bila ada contoh docs yang tidak lolos.

---

## Lampiran — Workaround Host Saat Ini (bisa dihapus setelah task selesai)

| Workaround di host | Dihapus oleh |
| :--- | :--- |
| Template halaman dibangun sebagai `PageDocument` utuh di backend host, dipilih lewat picker buatan host | STORA-535, STORA-536 |
| Custom component `countdown` buatan host | STORA-543 |
| Tipe `Node` / `PageDocument` didefinisikan ulang di backend (zod v3) | STORA-552 |
| Dirty tracking manual via `onChange` + ref + tombol simpan sendiri | STORA-537 |
| Form checkout di template tanpa `api_request` karena body harus ditulis manual | STORA-532 |
| Spacer dari `flex` kosong, rating dari 5 node `icon` | STORA-547, STORA-548 |
