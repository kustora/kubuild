
# KUBUILD — TODO MVP

**Product:** KUBUILD  
**CODE NAME:** BUILDER-01  
**Builder Library:** `kubuild`  
**Document Type:** TODO
**Status:** Draft  
**Konvensi key:** `STORA-###`. Semua item awal berstatus `To Do`.

## Target MVP

User dapat membuat landing page dari blank/template, mengedit component secara visual, memakai variable runtime, preview responsif, lalu export file `.stora`. Pengguna lain dapat import file itu, membuka kembali di editor, dan mengedit tanpa struktur halaman atau referensi asset hilang.

Tidak termasuk MVP: CMS lengkap, auth, database platform, marketplace, arbitrary JavaScript, plugin marketplace, pembayaran, atau workflow review komunitas.

## Urutan fase dan dependency utama

| Fase | Epic                   | Selesai bila                                                             |
| ---- | ---------------------- | ------------------------------------------------------------------------ |
| 0    | Project setup          | Monorepo, package contract              |
| 1    | Schema/document engine | Document tervalidasi, termigrasi, dan dapat diedit melalui command.      |
| 2    | Component registry     | Core components memiliki schema dan metadata editor.                     |
| 3    | Renderer               | Document dirender konsisten di preview dan runtime.                      |
| 4    | Builder editor         | User dapat menyusun dan mengubah page dengan undo/redo.                  |
| 5    | Variables/data binding | Nilai runtime dan collection dirender tanpa backend coupling.            |
| 6    | Import/export `.stora` | Package portable dapat round-trip dengan validasi.                       |
| 7    | Template system        | Template dapat dibuat, dicari, di-clone, dan tidak berubah saat dipakai. |
| 8    | Testing/quality        | Jalur MVP, compat, accessibility, dan quality gate terlindungi test.     |
| 9    | Playground/docs        | Developer dapat mencoba dan mengintegrasikan kubuild dari dokumentasi.   |
| 10   | AI provider & in-editor assistant | AI chat, prompt-to-page, dan enhance-selection ter-embed di editor lewat command engine, tanpa mengubah manual editing sebagai jalur utama. |

---

# Phase 0 — Project Setup

## Epic: Foundation and Package Boundaries

### STORA-001

- **Epic:** Foundation and Package Boundaries
- **Task Key:** STORA-001
- **Type:** Task
- **Summary:** Buat monorepo kubuild dan aplikasi referensi Stora.page
- **Description:** Inisialisasi workspace TypeScript dengan package `core`, `components`, `renderer`, `editor`, `react`, dan app `stora-playground`. Tetapkan package manager, build orchestration, lint, format, serta path alias bersama.
- **Priority:** Highest
- **Status:** Done
- **Dependencies:** None
- **Acceptance Criteria:**
  - Monorepo memiliki package boundary eksplisit dan semua package dapat di-build dari root.
  - `stora-playground` merender halaman starter memakai package workspace, bukan source copy.
  - Root commands untuk typecheck, lint, test, dan build terdokumentasi serta sukses di mesin bersih.

### STORA-002

- **Epic:** Foundation and Package Boundaries
- **Task Key:** STORA-002
- **Type:** Task
- **Summary:** Tetapkan public API dan aturan dependency antar package
- **Description:** Definisikan export map, naming `@kubuild/*`, aturan import, semantic versioning, dan ownership API. `core` tidak boleh mengimpor React atau API Stora.page.
- **Priority:** Highest
- **Status:** Done
- **Dependencies:** STORA-001
- **Acceptance Criteria:**
  - Diagram dependency package tersedia di repository.
  - `core` build tanpa dependency React, browser DOM, database, atau HTTP client.
  - Import internal lint rule menolak import melawan arah dependency.

### STORA-003

- **Epic:** Foundation and Package Boundaries
- **Task Key:** STORA-003
- **Type:** Task
- **Summary:** Pasang CI quality gate dan release checks
- **Description:** Jalankan install terkunci, typecheck, lint, unit test, build, dan pemeriksaan perubahan public API pada pull request.
- **Priority:** High
- **Status:** Done
- **Dependencies:** STORA-001, STORA-002
- **Acceptance Criteria:**
  - Pipeline gagal saat lint, typecheck, test, atau build gagal.
  - Lockfile dipakai pada install CI.
  - Setiap package menghasilkan artefak build dan declaration type.

### STORA-004

- **Epic:** Foundation and Package Boundaries
- **Task Key:** STORA-004
- **Type:** Task
- **Summary:** Sediakan fixture starter page dan asset lokal
- **Description:** Buat document landing page kecil beserta asset lokal untuk renderer, editor, export/import, dan test e2e.
- **Priority:** Medium
- **Status:** Done
- **Dependencies:** STORA-001
- **Acceptance Criteria:**
  - Fixture memuat section, heading, text, image, dan button.
  - Fixture dapat di-load oleh test tanpa network.
  - Asset fixture punya identifier stabil dan lisensi internal/placeholder jelas.

---

# Phase 1 — Schema / Document Engine

## Epic: Portable Page Document

### STORA-010

- **Epic:** Portable Page Document
- **Task Key:** STORA-010
- **Type:** Task
- **Summary:** Rancang schema Page Document v1
- **Description:** Definisikan root document, node, node id, `type`, `props`, `style`, `children`, metadata, asset references, dan `schemaVersion`. Pisahkan serializable document dari UI/editor state.
- **Priority:** Highest
- **Status:** Done
- **Dependencies:** STORA-002
- **Acceptance Criteria:**
  - TypeScript type dan JSON Schema mendefinisikan document v1 yang sama.
  - Root wajib punya `schema: "stora.page"`, versi schema, dan satu root page node.
  - Node id unik, deterministic saat supplied, dan tidak bergantung pada React key.
  - Contoh starter fixture tervalidasi.

### STORA-011

- **Epic:** Portable Page Document
- **Task Key:** STORA-011
- **Type:** Task
- **Summary:** Implementasikan validator document dan error diagnostic
- **Description:** Validasi schema global, node shape, child policy, ID duplikat, component type tidak dikenal, dan reference asset/variable secara struktural. Kembalikan errors dengan path JSON yang dapat ditampilkan UI.
- **Priority:** Highest
- **Status:** Done
- **Dependencies:** STORA-010
- **Acceptance Criteria:**
  - Document valid menghasilkan result sukses tanpa mutasi input.
  - Invalid document menghasilkan code, message, dan JSON path, misalnya `/root/children/1`.
  - Duplicate id dan cycle tree ditolak.
  - Test mencakup minimal satu case untuk tiap kelas error.

### STORA-012

- **Epic:** Portable Page Document
- **Task Key:** STORA-012
- **Type:** Task
- **Summary:** Buat immutable command engine untuk edit document
- **Description:** Tambahkan command `insertNode`, `moveNode`, `updateProps`, `updateStyle`, `removeNode`, dan `duplicateNode`. Semua command mengembalikan document baru dan event perubahan terstruktur.
- **Priority:** Highest
- **Status:** Done
- **Dependencies:** STORA-010, STORA-011
- **Acceptance Criteria:**
  - Enam command tersedia lewat public API `@kubuild/core`.
  - `moveNode` mencegah pemindahan node ke descendant sendiri.
  - `duplicateNode` membuat id baru untuk seluruh subtree dan mempertahankan props/style.
  - Input document tidak berubah pada setiap command.

### STORA-013

- **Epic:** Portable Page Document
- **Task Key:** STORA-013
- **Type:** Task
- **Summary:** Tambahkan history undo/redo berbasis command
- **Description:** Simpan snapshot atau inverse command dalam history engine generik; editor hanya menjadi consumer. Definisikan batas history dan reset saat document baru dimuat.
- **Priority:** High
- **Status:** Done
- **Dependencies:** STORA-012
- **Acceptance Criteria:**
  - Undo dan redo memulihkan document identik untuk insert, move, update, delete, dan duplicate.
  - Aksi baru setelah undo menghapus redo stack.
  - Batas history configurable dan default-nya diuji.

### STORA-014

- **Epic:** Portable Page Document
- **Task Key:** STORA-014
- **Type:** Task
- **Summary:** Implementasikan migrasi schema document
- **Description:** Buat registry migrasi dari versi lama ke current schema, dengan API dry-run dan diagnostic untuk jalur migrasi yang tidak tersedia.
- **Priority:** High
- **Status:** Done
- **Dependencies:** STORA-010, STORA-011
- **Acceptance Criteria:**
  - `migrateDocument()` mengubah fixture versi lama ke v1 tanpa mengubah semantic page.
  - Document current tidak mengalami perubahan isi saat dimigrasi.
  - Versi tanpa migration path gagal dengan error compatibility terstruktur.

### STORA-015

- **Epic:** Portable Page Document
- **Task Key:** STORA-015
- **Type:** Task
- **Summary:** Definisikan interface asset provider dan action registry
- **Description:** Definisikan kontrak host untuk upload, delete, resolve, list asset, serta action handler runtime. Tidak ada implementasi storage atau business action milik Stora.page dalam core.
- **Priority:** High
- **Status:** Done
- **Dependencies:** STORA-002, STORA-010
- **Acceptance Criteria:**
  - Kontrak typed mendukung asset id, MIME type, URL resolve, dan metadata minimal.
  - Kontrak action menerima `type`, payload serializable, dan context runtime.
  - `core` tidak membuat network request atau menyimpan credential.

---

# Phase 2 — Component Registry

## Epic: Component Contract and Core Library

### STORA-020

- **Epic:** Component Contract and Core Library
- **Task Key:** STORA-020
- **Type:** Task
- **Summary:** Definisikan kontrak component registry
- **Description:** Buat registry yang memetakan component type ke renderer, prop schema, child policy, default props, label, icon, dan inspector metadata. Registry dipakai bersama editor dan renderer.
- **Priority:** Highest
- **Status:** Done
- **Dependencies:** STORA-010, STORA-011
- **Acceptance Criteria:**
  - API register, get, list, dan unregister tersedia dan typed.
  - Duplicate type ditolak kecuali mode explicit replace dipilih.
  - Registry dapat memvalidasi props dan batas child component.
  - Renderer maupun editor memakai instance/contract registry sama.

### STORA-021

- **Epic:** Component Contract and Core Library
- **Task Key:** STORA-021
- **Type:** Task
- **Summary:** Implementasikan layout components: page, section, container, columns
- **Description:** Buat component fondasi dengan default style, batas nesting, dan responsive style fields.
- **Priority:** Highest
- **Status:** Done
- **Dependencies:** STORA-020
- **Acceptance Criteria:**
  - User dapat membentuk page dengan section > container > columns dari document valid.
  - Component child policy mencegah content node menjadi root page atau page berada di dalam page.
  - Layout desktop, tablet, dan mobile memakai style override yang tervalidasi.

### STORA-022

- **Epic:** Component Contract and Core Library
- **Task Key:** STORA-022
- **Type:** Task
- **Summary:** Implementasikan content components: heading, text, image, button
- **Description:** Tambahkan props minimal, default, prop schema, inspector metadata, dan renderer React untuk component MVP.
- **Priority:** Highest
- **Status:** Done
- **Dependencies:** STORA-020, STORA-021
- **Acceptance Criteria:**
  - Heading, text, image, dan button dapat ditambah ke fixture dan dirender.
  - Image memakai asset reference atau URL yang tervalidasi; alt text tersedia.
  - Button mendukung label, link/action reference, state disabled, dan semantic `<button>` atau `<a>` sesuai konfigurasi.

### STORA-023

- **Epic:** Component Contract and Core Library
- **Task Key:** STORA-023
- **Type:** Task
- **Summary:** Tambahkan style token dan responsive style schema
- **Description:** Definisikan token/format untuk spacing, color, typography, background, border, width, alignment, dan breakpoint override. Batasi gaya ke serializable values aman.
- **Priority:** High
- **Status:** Done
- **Dependencies:** STORA-020
- **Acceptance Criteria:**
  - Style schema menolak function, arbitrary CSS string berbahaya, dan nilai non-serializable.
  - Satu node dapat memiliki base style dan override desktop/tablet/mobile.
  - Renderer mengaplikasikan override pada breakpoint target.

### STORA-024

- **Epic:** Component Contract and Core Library
- **Task Key:** STORA-024
- **Type:** Task
- **Summary:** Buat extension contract untuk custom consumer component
- **Description:** Dokumentasikan cara host mendaftarkan custom component dengan schema, renderer, category, capability, dan serializable props.
- **Priority:** Medium
- **Status:** Done
- **Dependencies:** STORA-020, STORA-015
- **Acceptance Criteria:**
  - Sample `custom.product-card` terdaftar tanpa patch source core.
  - Document yang memuat component custom dapat tervalidasi saat registry disediakan.
  - Manifest requirement component custom dapat diekstrak untuk export/import.

---

# Phase 3 — Renderer

## Epic: Runtime and Preview Renderer

### STORA-030

- **Epic:** Runtime and Preview Renderer
- **Task Key:** STORA-030
- **Type:** Task
- **Summary:** Implementasikan recursive document renderer
- **Description:** Buat renderer React yang mengubah document tree menjadi element tree lewat registry. Tangani unknown component dan error boundary secara aman tanpa crash seluruh page.
- **Priority:** Highest
- **Status:** Done
- **Dependencies:** STORA-011, STORA-020, STORA-022
- **Acceptance Criteria:**
  - Fixture starter page menghasilkan markup berisi setiap core component.
  - Child dirender dalam urutan document.
  - Unknown component menghasilkan placeholder diagnostic di editor mode dan fallback aman di runtime mode.
  - Renderer tidak memerlukan state editor.

### STORA-031

- **Epic:** Runtime and Preview Renderer
- **Task Key:** STORA-031
- **Type:** Task
- **Summary:** Implementasikan context runtime untuk registry, variables, assets, dan actions
- **Description:** Buat `RenderContext` immutable yang mengalir ke component renderer. Host dapat menyediakan resolver tanpa coupling ke Stora.page.
- **Priority:** High
- **Status:** Done
- **Dependencies:** STORA-030, STORA-015
- **Acceptance Criteria:**
  - Component dapat resolve asset dan action melalui context.
  - Context tidak mengubah document saat render.
  - Context minimal dapat di-inject pada test dan playground tanpa network.

### STORA-032

- **Epic:** Runtime and Preview Renderer
- **Task Key:** STORA-032
- **Type:** Task
- **Summary:** Tambahkan action dispatch runtime yang aman
- **Description:** Renderer meneruskan interaksi user ke registered action handler. Document hanya menyimpan action type/payload serializable; tidak menjalankan JavaScript dari document.
- **Priority:** High
- **Status:** Done
- **Dependencies:** STORA-031, STORA-022
- **Acceptance Criteria:**
  - Button dengan registered `navigate` action memanggil handler dengan payload resolved.
  - Action tidak dikenal tidak dieksekusi dan mengirim diagnostic.
  - Tidak ada `eval`, `Function`, atau inject script dari props/document.

### STORA-033

- **Epic:** Runtime and Preview Renderer
- **Task Key:** STORA-033
- **Type:** Task
- **Summary:** Buat preview viewport adapter
- **Description:** Sediakan container preview desktop, tablet, mobile yang memakai document renderer sama dengan production runtime; beda hanya chrome/editor overlay.
- **Priority:** High
- **Status:** Done
- **Dependencies:** STORA-030, STORA-023
- **Acceptance Criteria:**
  - Preview dapat beralih antar tiga viewport tanpa mengubah document.
  - Component output dan binding hasilnya sama antara preview dan runtime test fixture.
  - Ukuran viewport dan breakpoint configurable oleh host.

---

# Phase 4 — Builder Editor

## Epic: Visual Editing Experience

### STORA-040

- **Epic:** Visual Editing Experience
- **Task Key:** STORA-040
- **Type:** Task
- **Summary:** Buat editor state controller
- **Description:** Satukan document draft, selection, hover, clipboard, history, command dispatch, dirty state, dan event `onChange`. State UI tidak ikut diserialisasi ke page document.
- **Priority:** Highest
- **Status:** To Do
- **Dependencies:** STORA-012, STORA-013, STORA-030
- **Acceptance Criteria:**
  - Editor dapat load document, dispatch command, expose current selection, dan emit document baru.
  - Selection/hover tidak muncul pada hasil serialize document.
  - Dirty state berubah setelah edit dan reset saat save/load eksplisit.

### STORA-041

- **Epic:** Visual Editing Experience
- **Task Key:** STORA-041
- **Type:** Task
- **Summary:** Implementasikan canvas selection, hover, dan keyboard navigation
- **Description:** Tambahkan overlay non-destructive pada renderer editor untuk memilih node, melihat hover, berpindah tree via keyboard, dan menghapus node terpilih.
- **Priority:** High
- **Status:** To Do
- **Dependencies:** STORA-040, STORA-033
- **Acceptance Criteria:**
  - Klik node memilih tepat satu node dan inspector menerima node itu.
  - Escape menghapus selection; Delete/Backspace menghapus node non-root setelah guard.
  - Navigasi keyboard dapat memilih parent, child, dan sibling tanpa mouse.

### STORA-042

- **Epic:** Visual Editing Experience
- **Task Key:** STORA-042
- **Type:** Task
- **Summary:** Implementasikan element panel dan insert component
- **Description:** Tampilkan component registry berdasarkan category; user memilih insertion target valid dan menambahkan node default lewat command engine.
- **Priority:** High
- **Status:** To Do
- **Dependencies:** STORA-040, STORA-020, STORA-022
- **Acceptance Criteria:**
  - Panel memuat core component dari registry, bukan hard-coded list terpisah.
  - Insert menolak parent/child combination tidak valid dengan pesan jelas.
  - Node baru memakai default props yang lolos validasi dan langsung terseleksi.

### STORA-043

- **Epic:** Visual Editing Experience
- **Task Key:** STORA-043
- **Type:** Task
- **Summary:** Implementasikan drag-and-drop reorder dan reparent
- **Description:** User dapat memindahkan node pada canvas/layer panel. Gunakan drop indicator, validasi child policy, dan command `moveNode` tunggal agar history konsisten.
- **Priority:** High
- **Status:** To Do
- **Dependencies:** STORA-040, STORA-041, STORA-042
- **Acceptance Criteria:**
  - User dapat reorder sibling dan memindahkan node ke container valid.
  - Drop ke descendant sendiri atau parent invalid ditolak sebelum document berubah.
  - Satu operasi drag menghasilkan satu history entry yang bisa undo/redo.

### STORA-044

- **Epic:** Visual Editing Experience
- **Task Key:** STORA-044
- **Type:** Task
- **Summary:** Buat inspector props dan style berbasis component schema
- **Description:** Generate form inspector dari metadata registry untuk content, asset, action, base style, dan responsive overrides. Perubahan melewati validation dan command engine.
- **Priority:** Highest
- **Status:** To Do
- **Dependencies:** STORA-040, STORA-020, STORA-023
- **Acceptance Criteria:**
  - Heading text, image asset/alt, button label/action, dan spacing dapat diedit pada UI.
  - Invalid value tidak masuk document dan error terlihat dekat field.
  - Mengubah mode breakpoint hanya menulis style override untuk breakpoint aktif.

### STORA-045

- **Epic:** Visual Editing Experience
- **Task Key:** STORA-045
- **Type:** Task
- **Summary:** Tambahkan duplicate, delete, copy/paste, undo, dan redo controls
- **Description:** Bangun control editor memakai command/history engine; clipboard memuat subtree portable dan membersihkan ID ketika paste.
- **Priority:** Medium
- **Status:** To Do
- **Dependencies:** STORA-040, STORA-041, STORA-013
- **Acceptance Criteria:**
  - Duplicate, delete, paste, undo, dan redo bekerja pada nested subtree.
  - Paste menghasilkan id unik dan menolak destination invalid.
  - Keyboard shortcuts memiliki tooltip dan tidak aktif bila aksi tidak mungkin.

### STORA-046

- **Epic:** Visual Editing Experience
- **Task Key:** STORA-046
- **Type:** Task
- **Summary:** Implementasikan layers panel dan responsive preview control
- **Description:** Tampilkan tree document, status selection, expand/collapse, reorder, serta switch desktop/tablet/mobile yang mengendalikan canvas preview.
- **Priority:** Medium
- **Status:** To Do
- **Dependencies:** STORA-041, STORA-043, STORA-033
- **Acceptance Criteria:**
  - Layers panel merefleksikan tree setelah semua edit command.
  - Klik layer dan klik canvas menyinkronkan selection.
  - Switch viewport tidak mengubah draft document sampai user benar-benar mengedit responsive style.

---

# Phase 5 — Variables and Data Binding

## Epic: Dynamic Runtime Content

### STORA-050

- **Epic:** Dynamic Runtime Content
- **Task Key:** STORA-050
- **Type:** Task
- **Summary:** Definisikan expression binding dan variable context v1
- **Description:** Gunakan binding object serializable, misalnya `{ type: "variable", key: "site.name" }`, bukan string evaluation. Definisikan lookup nested path, missing-value policy, dan static fallback.
- **Priority:** Highest
- **Status:** To Do
- **Dependencies:** STORA-010, STORA-031
- **Acceptance Criteria:**
  - Binding `site.name` resolve dari runtime context ke nilai scalar.
  - Missing key mengikuti fallback/empty policy terdokumentasi tanpa throw.
  - Resolver menolak executable expression, prototype traversal, dan function value.

### STORA-051

- **Epic:** Dynamic Runtime Content
- **Task Key:** STORA-051
- **Type:** Task
- **Summary:** Integrasikan bindings ke component props renderer
- **Description:** Resolver berjalan sebelum component menerima props render. Props dapat statis atau binding dengan type checking dari component schema.
- **Priority:** High
- **Status:** To Do
- **Dependencies:** STORA-050, STORA-030, STORA-022
- **Acceptance Criteria:**
  - Heading, text, image, dan button dapat memakai static value atau variable binding pada prop yang kompatibel.
  - Output runtime dan preview fixture memakai resolver sama.
  - Incompatible resolved type menghasilkan diagnostic dan fallback aman.

### STORA-052

- **Epic:** Dynamic Runtime Content
- **Task Key:** STORA-052
- **Type:** Task
- **Summary:** Implementasikan collection node dengan scoped item context
- **Description:** Tambahkan component `collection` yang menerima array runtime dari variable key, merender template child untuk setiap item, dan memberikan scope `item` serta index.
- **Priority:** High
- **Status:** To Do
- **Dependencies:** STORA-050, STORA-051, STORA-021
- **Acceptance Criteria:**
  - Array `products` dengan tiga item menghasilkan tiga subtree dalam urutan input.
  - Binding `item.name` dan `item.price` resolve hanya di scope collection.
  - Nilai non-array menghasilkan empty state/diagnostic tanpa crash.

### STORA-053

- **Epic:** Dynamic Runtime Content
- **Task Key:** STORA-053
- **Type:** Task
- **Summary:** Tambahkan variable picker dan preview data adapter di editor
- **Description:** Host memberikan catalog variable dan sample values. Inspector menawarkan binding hanya untuk prop compatible, sementara preview memakai sample context tanpa menyimpan data rahasia ke document.
- **Priority:** Medium
- **Status:** To Do
- **Dependencies:** STORA-044, STORA-050, STORA-051
- **Acceptance Criteria:**
  - User dapat memilih `site.name` untuk heading dan melihat sample value di canvas.
  - Editor dapat mengganti binding kembali ke static value.
  - Export document tidak mengandung sample runtime data kecuali user menambahkannya sebagai static prop.

### STORA-054

- **Epic:** Dynamic Runtime Content
- **Task Key:** STORA-054
- **Type:** Task
- **Summary:** Definisikan action payload bindings
- **Description:** Izinkan action payload menggunakan binding aman, misalnya `item.id`, agar button di collection dapat meneruskan context item ke host action handler.
- **Priority:** Medium
- **Status:** Done
- **Dependencies:** STORA-050, STORA-032, STORA-052
- **Acceptance Criteria:**
  - Button dalam collection dapat mengirim resolved `item.id` ke handler test.
  - Payload static dan binding dapat digabung dalam object serializable.
  - Action payload dengan path invalid tidak menjalankan handler dengan nilai tak terduga.

---

# Phase 6 — Import / Export `.stora`

## Epic: Portable Package Lifecycle

### STORA-060

- **Epic:** Portable Package Lifecycle
- **Task Key:** STORA-060
- **Type:** Task
- **Summary:** Definisikan manifest `.stora` dan struktur package v1
- **Description:** Tetapkan archive berisi `manifest.json`, `page.json`, `metadata.json`, dan `assets/`. Manifest memuat package version, schema compatibility, components, capabilities, asset inventory, checksum, dan creator-safe metadata.
- **Priority:** Highest
- **Status:** Done
- **Dependencies:** STORA-010, STORA-015, STORA-024
- **Acceptance Criteria:**
  - JSON Schema manifest dipublikasikan bersama type TypeScript.
  - Manifest dapat menyatakan component custom dan capability required.
  - Tidak ada token, credential, endpoint privat, atau runtime sample data diwajibkan/ditulis ke manifest.

### STORA-061

- **Epic:** Portable Package Lifecycle
- **Task Key:** STORA-061
- **Type:** Task
- **Summary:** Implementasikan exporter `.stora`
- **Description:** Validasi document, collect asset reference, tulis manifest/page/metadata, lalu buat archive `.stora`. Asset bytes diperoleh melalui interface host atau fallback ditandai external.
- **Priority:** Highest
- **Status:** Done
- **Dependencies:** STORA-060, STORA-011, STORA-015
- **Acceptance Criteria:**
  - Export valid menghasilkan archive dengan file wajib dan directory `assets/` bila ada asset local.
  - Manifest asset inventory cocok dengan file archive dan checksum-nya.
  - Export gagal dengan diagnostic bila document invalid atau asset required tidak dapat dikumpulkan.

### STORA-062

- **Epic:** Portable Package Lifecycle
- **Task Key:** STORA-062
- **Type:** Task
- **Summary:** Implementasikan importer `.stora` dengan preflight validation
- **Description:** Baca archive tanpa menjalankan code, cek size/path safety, manifest, checksum, schema version, component/capability requirements, lalu extract document/assets ke adapter host.
- **Priority:** Highest
- **Status:** Done
- **Dependencies:** STORA-060, STORA-011, STORA-014, STORA-015
- **Acceptance Criteria:**
  - Import menolak archive tanpa manifest/page, checksum mismatch, zip-slip path, atau size limit terlewati.
  - Import mengembalikan daftar missing components/capabilities sebelum mutasi host dimulai.
  - Document versi lama dimigrasi sebelum dibuka editor bila migration path tersedia.

### STORA-063

- **Epic:** Portable Package Lifecycle
- **Task Key:** STORA-063
- **Type:** Task
- **Summary:** Tambahkan import policy untuk dependency dan conflict asset
- **Description:** Definisikan mode `cancel`, `import-with-placeholder`, dan `install-or-register-before-import` untuk capability/component hilang. Host menentukan strategy penamaan asset conflict.
- **Priority:** High
- **Status:** Done
- **Dependencies:** STORA-062, STORA-024
- **Acceptance Criteria:**
  - Import preview menampilkan component/capability missing dengan key spesifik.
  - Mode placeholder mempertahankan node dan props asli agar dapat dipulihkan kemudian.
  - Asset collision tidak menimpa asset host tanpa explicit strategy.

### STORA-064

- **Epic:** Portable Package Lifecycle
- **Task Key:** STORA-064
- **Type:** Task
- **Summary:** Buat round-trip compatibility suite
- **Description:** Verifikasi export lalu import menghasilkan semantic document, metadata, asset reference, bindings, action references, dan dependencies yang ekivalen.
- **Priority:** Highest
- **Status:** Done
- **Dependencies:** STORA-061, STORA-062, STORA-052, STORA-054
- **Acceptance Criteria:**
  - Starter page dan page dengan collection/action berhasil export-import.
  - Comparator mengabaikan hanya field transient yang terdokumentasi, misalnya generated asset host id.
  - Test gagal jika node order, props, style, binding, action, atau asset mapping hilang.

### STORA-065

- **Epic:** Portable Package Lifecycle
- **Task Key:** STORA-065
- **Type:** Task
- **Summary:** Integrasikan create-from-import flow di Stora.page reference app
- **Description:** Tambahkan UI pilih file, preflight report, policy decision, progress, dan pembukaan document berhasil ke editor draft.
- **Priority:** Medium
- **Status:** Done
- **Dependencies:** STORA-062, STORA-063, STORA-040
- **Acceptance Criteria:**
  - User dapat memilih `.stora`, melihat error/preflight, lalu membuka hasil import valid di builder.
  - Kegagalan import tidak mengubah draft aktif.
  - Imported page dapat diedit dan diexport kembali.

---

# Phase 7 — Template System

## Epic: Reusable Page Templates

### STORA-070

- **Epic:** Reusable Page Templates
- **Task Key:** STORA-070
- **Type:** Task
- **Summary:** Definisikan template record dan metadata v1
- **Description:** Template record mencakup id, nama, deskripsi, kategori, tags, thumbnail, author, version, document package/reference, dan timestamps. Tidak mencakup marketplace review atau pembayaran.
- **Priority:** High
- **Status:** Done
- **Dependencies:** STORA-010, STORA-060
- **Acceptance Criteria:**
  - Metadata template tervalidasi dan serializable.
  - Thumbnail mengacu ke asset atau URL yang aman.
  - Document template dapat menyatakan component/capability requirements.

### STORA-071

- **Epic:** Reusable Page Templates
- **Task Key:** STORA-071
- **Type:** Task
- **Summary:** Implementasikan save draft as template dan clone as new page
- **Description:** Export snapshot draft sebagai template lalu clone ke page baru dengan node id baru. Template source tidak boleh berubah ketika clone diedit.
- **Priority:** High
- **Status:** Done
- **Dependencies:** STORA-070, STORA-012, STORA-061
- **Acceptance Criteria:**
  - Save as template meminta metadata wajib dan menyimpan snapshot valid.
  - Use template menghasilkan document baru dengan seluruh node id berbeda.
  - Edit/undo pada page clone tidak mengubah source template.

### STORA-072

- **Epic:** Reusable Page Templates
- **Task Key:** STORA-072
- **Type:** Task
- **Summary:** Buat template library MVP dan create-from-template flow
- **Description:** Tampilkan template local/reference dalam grid dengan category/tag filter, preview, dependency warning, dan tombol use template menuju builder.
- **Priority:** Medium
- **Status:** To Do
- **Dependencies:** STORA-071, STORA-033, STORA-063
- **Acceptance Criteria:**
  - User dapat filter template berdasarkan category dan tag.
  - Preview memakai renderer sama dengan editor/runtime.
  - Template yang dependency-nya hilang menampilkan warning sebelum clone.

### STORA-073

- **Epic:** Reusable Page Templates
- **Task Key:** STORA-073
- **Type:** Task
- **Summary:** Tambahkan template version metadata tanpa auto-update instance
- **Description:** Simpan version semantic pada template snapshot. Page clone mencatat template origin/version sebagai metadata optional; tidak ada automatic update pada document instance.
- **Priority:** Low
- **Status:** To Do
- **Dependencies:** STORA-071
- **Acceptance Criteria:**
  - Template baru dapat diberi version baru tanpa mengubah previous snapshot.
  - Page clone mempertahankan origin template/version pada metadata.
  - Tidak ada background update atau perubahan document instance saat template source berubah.

---

# Phase 8 — Testing and Quality

## Epic: Reliability, Safety, and Release Readiness

### STORA-080

- **Epic:** Reliability, Safety, and Release Readiness
- **Task Key:** STORA-080
- **Type:** Task
- **Summary:** Tambahkan unit test suite core, registry, dan renderer
- **Description:** Cover validation, commands, history, migration, component policy, bindings, collection, action dispatch, dan renderer fallback.
- **Priority:** Highest
- **Status:** To Do
- **Dependencies:** STORA-014, STORA-032, STORA-054
- **Acceptance Criteria:**
  - Semua public behavior kritis memiliki test deterministik tanpa network.
  - Test mencakup malformed document dan unknown component/action.
  - CI mengumpulkan coverage package core/renderer sesuai threshold disepakati tim.

### STORA-081

- **Epic:** Reliability, Safety, and Release Readiness
- **Task Key:** STORA-081
- **Type:** Task
- **Summary:** Buat integration test editor untuk workflow builder MVP
- **Description:** Otomatiskan create blank, add components, edit inspector, reorder, responsive style, undo/redo, preview, dan save/load document.
- **Priority:** Highest
- **Status:** To Do
- **Dependencies:** STORA-046, STORA-053
- **Acceptance Criteria:**
  - Test mereproduksi user flow MVP dari blank page sampai preview.
  - Test memverifikasi document hasil setiap milestone, bukan hanya screenshot.
  - Drag/reorder dan keyboard undo/redo diuji pada browser supported.

### STORA-082

- **Epic:** Reliability, Safety, and Release Readiness
- **Task Key:** STORA-082
- **Type:** Task
- **Summary:** Buat end-to-end test portable package round-trip
- **Description:** Jalankan create/edit/export, buka pada clean host registry, preflight/import, lalu edit dan export ulang.
- **Priority:** Highest
- **Status:** To Do
- **Dependencies:** STORA-064, STORA-065, STORA-081
- **Acceptance Criteria:**
  - E2E berjalan dari UI/editor atau public APIs pada clean fixture host.
  - Hasil import dapat dirender sama secara semantic dengan page awal.
  - Case missing dependency dan malformed archive memverifikasi tidak ada partial page tersimpan.

### STORA-083

- **Epic:** Reliability, Safety, and Release Readiness
- **Task Key:** STORA-083
- **Type:** Task
- **Summary:** Audit keamanan document, action, dan archive input
- **Description:** Tetapkan limit ukuran/depth/node count, sanitize URL/asset policy, prohibited keys, action allowlist, dan archive extraction safety.
- **Priority:** Highest
- **Status:** Done
- **Dependencies:** STORA-062, STORA-032, STORA-050
- **Acceptance Criteria:**
  - Test menolak XSS-oriented props/URL sesuai policy host, prototype path, zip-slip, zip bomb limit, dan executable payload.
  - Document tidak dapat mengeksekusi JavaScript saat render atau import.
  - Security limits configurable dan default-nya terdokumentasi.

### STORA-084

- **Epic:** Reliability, Safety, and Release Readiness
- **Task Key:** STORA-084
- **Type:** Task
- **Summary:** Tambahkan accessibility dan visual regression baseline
- **Description:** Pastikan core components punya semantic markup/alt text/focus behavior. Capture baseline desktop/tablet/mobile untuk fixture penting.
- **Priority:** High
- **Status:** Done
- **Dependencies:** STORA-033, STORA-044
- **Acceptance Criteria:**
  - Core button, image, heading, dan text memenuhi aturan accessibility dasar yang dapat diuji otomatis.
  - Editor selection overlay tidak masuk accessibility tree runtime.
  - Visual regression mencakup tiga viewport untuk fixture starter dan collection.

### STORA-085

- **Epic:** Reliability, Safety, and Release Readiness
- **Task Key:** STORA-085
- **Type:** Task
- **Summary:** Tetapkan compatibility matrix dan MVP release checklist
- **Description:** Dokumentasikan browser support, React/peer dependency range, schema/package compatibility window, known limitations, dan checklist release.
- **Priority:** Medium
- **Status:** To Do
- **Dependencies:** STORA-003, STORA-082, STORA-083, STORA-084
- **Acceptance Criteria:**
  - Matrix menjelaskan versi schema yang bisa import/export oleh versi package MVP.
  - Checklist memerlukan green CI, package round-trip E2E, security suite, dan manual smoke test.
  - Known non-goals MVP terlihat bagi consumer package.

---

# Phase 9 — Playground and Documentation

## Epic: Developer Adoption and Reference Host

### STORA-090

- **Epic:** Developer Adoption and Reference Host
- **Task Key:** STORA-090
- **Type:** Task
- **Summary:** Bangun playground interaktif kubuild
- **Description:** Buat app lokal yang mendemonstrasikan builder, runtime renderer, responsive preview, variable samples, asset adapter mock, action mock, dan export/import fixture.
- **Priority:** High
- **Status:** To Do
- **Dependencies:** STORA-065, STORA-072, STORA-081
- **Acceptance Criteria:**
  - Playground membuka starter page di editor dan runtime side-by-side.
  - User dapat mengganti variable sample dan melihat render berubah tanpa edit document.
  - Playground dapat mengekspor dan mengimpor fixture `.stora` lokal.

### STORA-091

- **Epic:** Developer Adoption and Reference Host
- **Task Key:** STORA-091
- **Type:** Task
- **Summary:** Tulis quickstart integrasi kubuild untuk consumer React
- **Description:** Dokumentasikan install, component registry, renderer, editor, runtime context, asset provider, action handler, variable catalog, dan common errors.
- **Priority:** High
- **Status:** To Do
- **Dependencies:** STORA-090, STORA-024, STORA-031
- **Acceptance Criteria:**
  - Developer dapat menjalankan renderer simple dari fresh React app mengikuti quickstart.
  - Dokumentasi memuat contoh custom component dan custom action tanpa backend khusus Stora.page.
  - Semua code snippet diuji atau diambil dari fixture yang dibuild CI.

### STORA-092

- **Epic:** Developer Adoption and Reference Host
- **Task Key:** STORA-092
- **Type:** Task
- **Summary:** Dokumentasikan format document dan `.stora` untuk interoperabilitas
- **Description:** Publikasikan document schema, binding model, style/responsive rules, manifest, import errors, migration policy, dan security constraints.
- **Priority:** High
- **Status:** To Do
- **Dependencies:** STORA-014, STORA-060, STORA-063, STORA-083
- **Acceptance Criteria:**
  - Docs memiliki contoh valid untuk static page, variable binding, collection, custom component requirement, dan manifest.
  - Docs menyatakan field mana yang portable dan mana yang host-specific.
  - Docs menjelaskan policy missing dependency serta compatibility/migration behavior.

### STORA-093

- **Epic:** Developer Adoption and Reference Host
- **Task Key:** STORA-093
- **Type:** Task
- **Summary:** Buat panduan operasi Stora.page MVP
- **Description:** Tulis panduan user untuk create blank, memakai template, mengedit, preview responsif, export, import, dan recovery error validation. Ini reference UX, bukan implementasi CMS.
- **Priority:** Medium
- **Status:** To Do
- **Dependencies:** STORA-065, STORA-072, STORA-082
- **Acceptance Criteria:**
  - Panduan mencakup jalur happy path create-to-export-to-import.
  - Panduan menampilkan tindakan user untuk schema mismatch, missing component, asset failure, dan invalid package.
  - Screenshot/GIF hanya memakai UI yang sudah ada pada playground/reference app.

---

# Phase 10 — AI Provider & In-Editor Assistant

Referensi produk: `docs/PRD.md` §31. `@kubuild/ai` (engine, adapters, client, react hooks) sudah ada sebagai package terpisah — fase ini fokus mengintegrasikannya ke `@kubuild/editor`/`@kubuild/react` lewat command engine yang sudah ada, plus membereskan gap yang ditemukan di package tersebut.

## Epic: AI Provider Integration Foundation

### STORA-500

- **Epic:** AI Provider Integration Foundation
- **Task Key:** STORA-500
- **Type:** Task
- **Summary:** Tambahkan dependency `@kubuild/ai` ke `@kubuild/editor` dan `@kubuild/react`
- **Description:** Daftarkan `@kubuild/ai` (`./react` dan `./client` entry) sebagai dependency package `editor`, lalu re-export lewat `@kubuild/react`. Arah dependency baru (`editor → ai`) tidak boleh melanggar aturan `no-restricted-imports` yang membatasi `core`; `@kubuild/ai` sendiri tetap hanya bergantung ke `core`/`schema`.
- **Priority:** Highest
- **Status:** To Do
- **Dependencies:** None
- **Acceptance Criteria:**
  - `pnpm --filter @kubuild/editor build` sukses dengan `@kubuild/ai` sebagai dependency baru.
  - ESLint `no-restricted-imports` tetap lulus untuk `packages/core/**` (tidak ada import baru ke arah luar dari core).
  - `@kubuild/react` mengekspor ulang hooks `useAiGenerator`/`useAiChat` tanpa consumer perlu install `@kubuild/ai` terpisah.

### STORA-501

- **Epic:** AI Provider Integration Foundation
- **Task Key:** STORA-501
- **Type:** Task
- **Summary:** Definisikan `AiEditorConfig` mengikuti pola `EditorConfig` yang sudah ada
- **Description:** Tambahkan tipe config (provider adapter/endpoint, feature flag aktif/nonaktif per fitur AI, default panel mode) sebagai prop opsional baru di `KubuildEditorProps`, konsisten dengan pola `registry`/`context`/`config` yang sudah ada. Host (consumer) yang menyuplai provider/API key — editor tidak hardcode provider apa pun.
- **Priority:** Highest
- **Status:** To Do
- **Dependencies:** STORA-500
- **Acceptance Criteria:**
  - `KubuildEditor` berjalan normal tanpa error saat prop AI config tidak diberikan (fitur AI default nonaktif/hidden).
  - Config AI mendukung setidaknya: aktif/nonaktif fitur chat, aktif/nonaktif fitur generate, dan default panel mode.
  - Tipe `AiEditorConfig` diekspor dari `@kubuild/editor` dan `@kubuild/react`.

### STORA-502

- **Epic:** AI Provider Integration Foundation
- **Task Key:** STORA-502
- **Type:** Task
- **Summary:** Sambungkan `selectedNodeId` dan snapshot document dari editor store ke context AI
- **Description:** Setiap request `useAiChat`/`useAiGenerator` yang dipicu dari dalam editor menyertakan `selectedNodeId` aktif dan document aktif (`AiChatRequest.currentDocument`/`selectedNodeId` sudah didukung tipe-nya di `@kubuild/ai`), tanpa menyalin logic store secara terpisah.
- **Priority:** High
- **Status:** To Do
- **Dependencies:** STORA-500, STORA-501
- **Acceptance Criteria:**
  - Mengganti selection di canvas otomatis mengubah context yang dikirim ke chat berikutnya.
  - Snapshot document yang dikirim tidak menyertakan data sample/preview-only dari `variableCatalog` (STORA-053).
  - Unit test memverifikasi payload request berubah sesuai `selectedNodeId` saat ini.

## Epic: In-Editor AI Chat Panel

### STORA-503

- **Epic:** In-Editor AI Chat Panel
- **Task Key:** STORA-503
- **Type:** Task
- **Summary:** Bangun AI Chat Panel dengan mode `docked | floating | hidden`
- **Description:** Panel baru mengikuti pola panel existing (`navigatorMode`, `tableSpreadsheetMode` di `EditorState`) — state `aiChatMode` baru di store, docked di sisi kanan/kiri atau floating di atas canvas seperti `TableSpreadsheetEditor`.
- **Priority:** Highest
- **Status:** To Do
- **Dependencies:** STORA-501
- **Acceptance Criteria:**
  - Panel dapat di-toggle antara docked, floating, dan hidden tanpa reload editor.
  - Layout panel lain (inspector, layers, sidebar) tidak rusak saat AI Chat Panel docked bersamaan.
  - State panel tidak ikut ke dalam `PageDocument` (UI-only, sama seperti panel lain).

### STORA-504

- **Epic:** In-Editor AI Chat Panel
- **Task Key:** STORA-504
- **Type:** Task
- **Summary:** Tambah toggle "AI Chat" di toolbar dan `EditorToolbarConfig`
- **Description:** Tombol toolbar baru untuk membuka/menutup AI Chat Panel, dengan flag `showAiChatToggle` di `EditorToolbarConfig` mengikuti pola `showNavigatorToggle` yang sudah ada.
- **Priority:** Medium
- **Status:** To Do
- **Dependencies:** STORA-503
- **Acceptance Criteria:**
  - Toggle hilang dari toolbar bila `showAiChatToggle: false` atau fitur AI nonaktif di `AiEditorConfig`.
  - Toggle mencerminkan state panel aktif (highlight saat panel terbuka).

### STORA-505

- **Epic:** In-Editor AI Chat Panel
- **Task Key:** STORA-505
- **Type:** Task
- **Summary:** UI riwayat pesan chat (bubble user/assistant, loading, error)
- **Description:** Render `messages` dari `useAiChat` sebagai bubble chat, termasuk state loading (indikator mengetik) dan error state (retry action) sesuai `cancel()`/error handling yang sudah ada di hook.
- **Priority:** High
- **Status:** To Do
- **Dependencies:** STORA-503
- **Acceptance Criteria:**
  - Pesan user dan assistant terbedakan secara visual dan urut secara kronologis.
  - Error dari `useAiChat` (network/provider) tampil sebagai pesan error dengan opsi retry, bukan silent fail.
  - Loading state hilang otomatis begitu respons/​stream selesai atau di-cancel.

### STORA-506

- **Epic:** In-Editor AI Chat Panel
- **Task Key:** STORA-506
- **Type:** Task
- **Summary:** Indikator context aktif di chat input ("membahas: #button-1")
- **Description:** Saat ada `selectedNodeId`, chat input menampilkan chip/badge node yang sedang jadi context, dengan opsi user melepas context tersebut sebelum mengirim pesan.
- **Priority:** Medium
- **Status:** To Do
- **Dependencies:** STORA-502, STORA-505
- **Acceptance Criteria:**
  - Chip context hilang otomatis saat selection di canvas dikosongkan.
  - User dapat mengirim pesan tanpa context node (general question) meski ada selection aktif.

## Epic: Prompt-to-Page Generation

### STORA-507

- **Epic:** Prompt-to-Page Generation
- **Task Key:** STORA-507
- **Type:** Task
- **Summary:** Wire `streamPage` ke command engine editor
- **Description:** Tiap `AiStreamEvent` bertipe `section` dari `useAiGenerator.streamPage` di-dispatch sebagai `insertNode` (lewat `dispatch`/`insertComponent` di store, bukan mutasi document langsung) ke document aktif, section demi section sesuai urutan datang.
- **Priority:** Highest
- **Status:** To Do
- **Dependencies:** STORA-502
- **Acceptance Criteria:**
  - Prompt "buatkan landing page" menghasilkan document dengan minimal page → section → komponen anak, tervalidasi oleh `@kubuild/core`.
  - Setiap section yang gagal validasi tidak menghentikan section lain yang sudah berhasil di-generate (partial success, dilaporkan sebagai diagnostic).
  - Event `error` dari stream tidak meninggalkan document dalam state parsial yang invalid.

### STORA-508

- **Epic:** Prompt-to-Page Generation
- **Task Key:** STORA-508
- **Type:** Task
- **Summary:** Progressive preview saat generate berjalan
- **Description:** Canvas menampilkan placeholder loading untuk section yang sedang di-generate dan langsung merender section begitu event-nya masuk, memakai renderer yang sama dengan preview manual (bukan preview terpisah).
- **Priority:** High
- **Status:** To Do
- **Dependencies:** STORA-507
- **Acceptance Criteria:**
  - User melihat halaman terbentuk bertahap, bukan menunggu semua section selesai baru muncul.
  - Placeholder loading hilang tanpa flicker begitu section asli ter-render.

### STORA-509

- **Epic:** Prompt-to-Page Generation
- **Task Key:** STORA-509
- **Type:** Task
- **Summary:** Validasi & sanitasi output AI sebelum dispatch ke document
- **Description:** Sebelum tiap node/section hasil AI di-dispatch, jalankan jalur yang sama dengan import `.stora`: schema validation (`PageDocumentSchema`/`normalizeAndValidate*` yang sudah ada di `@kubuild/ai`) plus `validateDocumentSecurity` dari `@kubuild/core`. Tidak ada node hasil AI yang masuk document tanpa lolos validasi ini.
- **Priority:** Highest
- **Status:** To Do
- **Dependencies:** STORA-507
- **Acceptance Criteria:**
  - Node dengan prop/style yang tidak lolos schema ditolak dan dilaporkan sebagai diagnostic ke host (`onDiagnostic`), bukan silent-inserted.
  - Security limit yang sama dengan import (depth, jumlah node, dsb.) berlaku juga untuk output generate AI.
  - Test mereproduksi payload AI malformed (missing id, flat style vs breakpoint object) dan memverifikasi normalizer membetulkannya atau menolaknya dengan jelas.

### STORA-510

- **Epic:** Prompt-to-Page Generation
- **Task Key:** STORA-510
- **Type:** Task
- **Summary:** Generate sebagai satu batch history entry yang bisa di-undo sekali klik
- **Description:** Seluruh section yang masuk dari satu sesi `streamPage` tergabung jadi satu grup di `DocumentHistoryManager`, sehingga satu kali `undo()` mengembalikan document ke kondisi sebelum generate, bukan meng-undo section satu per satu.
- **Priority:** High
- **Status:** To Do
- **Dependencies:** STORA-507
- **Acceptance Criteria:**
  - Setelah generate multi-section, satu kali klik Undo mengosongkan seluruh hasil generate.
  - `canUndo`/`canRedo` tetap konsisten dengan aksi manual yang dilakukan setelah generate.

## Epic: Selection-Aware Ask & Enhance

### STORA-511

- **Epic:** Selection-Aware Ask & Enhance
- **Task Key:** STORA-511
- **Type:** Task
- **Summary:** Aksi "Ask AI about this component" dari inspector/canvas
- **Description:** Tombol/menu di `InspectorPanel` atau floating badge canvas yang membuka AI Chat Panel dengan context node terpilih sudah ter-attach (lihat STORA-506), tanpa user perlu mengetik ulang identitas node.
- **Priority:** High
- **Status:** To Do
- **Dependencies:** STORA-505, STORA-506
- **Acceptance Criteria:**
  - Klik aksi ini membuka panel (jika tertutup) dan mem-fokus chat input dengan context node sudah terpasang.
  - Aksi tidak tersedia saat tidak ada node terpilih atau fitur AI nonaktif di config.

### STORA-512

- **Epic:** Selection-Aware Ask & Enhance
- **Task Key:** STORA-512
- **Type:** Task
- **Summary:** Wire `refactorNode` untuk instruksi enhance dari node terpilih
- **Description:** Instruksi user ("buat lebih menonjol", "ubah jadi gaya minimalis") dikirim ke `useAiGenerator.refactorNode` bersama node dan context document, menghasilkan kandidat node baru tanpa langsung mengubah document.
- **Priority:** Highest
- **Status:** To Do
- **Dependencies:** STORA-502, STORA-511
- **Acceptance Criteria:**
  - Hasil `refactorNode` tervalidasi lewat jalur yang sama seperti STORA-509 sebelum ditampilkan sebagai kandidat.
  - Node asli tidak berubah sampai user secara eksplisit meng-apply hasilnya (lihat STORA-514).

### STORA-513

- **Epic:** Selection-Aware Ask & Enhance
- **Task Key:** STORA-513
- **Type:** Task
- **Summary:** Diff preview before/after untuk hasil enhance di chat
- **Description:** Tampilkan perbandingan ringkas (props/styles yang berubah) antara node asli dan kandidat hasil AI langsung di dalam chat, dengan tombol **Apply** dan **Discard**.
- **Priority:** High
- **Status:** To Do
- **Dependencies:** STORA-512
- **Acceptance Criteria:**
  - Diff menyoroti field yang berubah saja (bukan dump seluruh objek node).
  - Discard tidak meninggalkan jejak apa pun di document atau history.

### STORA-514

- **Epic:** Selection-Aware Ask & Enhance
- **Task Key:** STORA-514
- **Type:** Task
- **Summary:** Apply hasil enhance lewat command engine
- **Description:** Tombol Apply memanggil `updateNodeProps`/`updateNodeStyle` (atau command replace-subtree baru jika struktur berubah) di store editor — path yang sama persis dengan edit manual — sehingga tercatat di `DocumentHistoryManager`.
- **Priority:** Highest
- **Status:** To Do
- **Dependencies:** STORA-513
- **Acceptance Criteria:**
  - Setelah Apply, `undo()` mengembalikan node ke kondisi sebelum enhance.
  - Apply gagal (mis. validasi prop registry gagal) menampilkan error yang sama formatnya dengan `formatCommandError` yang sudah ada, tidak crash editor.

## Epic: Streaming & Chat Hardening

### STORA-515

- **Epic:** Streaming & Chat Hardening
- **Task Key:** STORA-515
- **Type:** Task
- **Summary:** Implementasikan token-level streaming untuk `chat()`
- **Description:** `KubuildAiEngine.chat()` saat ini single request/response. Tambahkan varian streaming (`chatStream()` atau `stream: true` pada `chat()`) yang meneruskan `stream: true` ke adapter provider (OpenAI/Anthropic/Gemini) dan meng-emit token/partial chunk lewat mekanisme SSE yang sama dengan `streamPage`.
- **Priority:** High
- **Status:** To Do
- **Dependencies:** None
- **Acceptance Criteria:**
  - Response chat tampil progresif (token/partial chunk), bukan menunggu jawaban penuh.
  - Adapter yang belum mendukung streaming di level API fallback ke non-streaming tanpa error.
  - Test menutupi partial-chunk parsing di `KubuildAiClient` untuk mode chat.

### STORA-516

- **Epic:** Streaming & Chat Hardening
- **Task Key:** STORA-516
- **Type:** Task
- **Summary:** Update `useAiChat` untuk konsumsi stream dan render partial response realtime
- **Description:** Hook `useAiChat` menambah dukungan callback partial-token (mirip `AiStreamCallbacks` di `useAiGenerator`), dan AI Chat Panel (STORA-505) merender token yang masuk secara realtime ke bubble assistant yang sedang aktif.
- **Priority:** High
- **Status:** To Do
- **Dependencies:** STORA-515, STORA-505
- **Acceptance Criteria:**
  - Bubble assistant ter-update per chunk tanpa re-render seluruh riwayat chat.
  - `cancel()` yang sudah ada tetap berfungsi menghentikan stream chat yang sedang berjalan.

### STORA-517

- **Epic:** Streaming & Chat Hardening
- **Task Key:** STORA-517
- **Type:** Task
- **Summary:** Putuskan nasib `AiChatResponse.suggestedAction` (implement atau hapus)
- **Description:** Field ini sudah ada di tipe tapi tidak pernah diisi oleh engine. Keputusan produk: implementasikan (mis. AI dapat menyarankan aksi "generate section baru" langsung dari chat) atau hapus dari tipe publik untuk mencegah consumer bergantung pada field yang selalu kosong.
- **Priority:** Medium
- **Status:** To Do
- **Dependencies:** None
- **Acceptance Criteria:**
  - Jika diimplementasi: minimal satu jenis `suggestedAction` (mis. "insert section ini ke document") dapat di-trigger dari chat panel lewat command engine.
  - Jika dihapus: tidak ada breaking change diam-diam — dicatat di changelog `@kubuild/ai`.

### STORA-518

- **Epic:** Streaming & Chat Hardening
- **Task Key:** STORA-518
- **Type:** Task
- **Summary:** Bersihkan `console.log` debug di `server/engine.ts`
- **Description:** Beberapa `console.log` tertinggal di `KubuildAiEngine` (generatePage/streamPage/chat) tidak digate oleh opsi `debug`/`logger` yang sudah ada di constructor. Rapikan agar semua logging lewat `logger` yang dikonfigurasi, senyap secara default.
- **Priority:** Medium
- **Status:** To Do
- **Dependencies:** None
- **Acceptance Criteria:**
  - Tidak ada `console.log` langsung tersisa di `packages/ai/src/server/engine.ts`.
  - Log tetap dapat diaktifkan lewat opsi `debug: true` atau `logger` custom untuk kebutuhan development.

## Epic: Safety, Rate-Limiting & Persistence

### STORA-519

- **Epic:** Safety, Rate-Limiting & Persistence
- **Task Key:** STORA-519
- **Type:** Task
- **Summary:** Sediakan hook auth/rate-limit di `createAiHandler`
- **Description:** `createAiHandler` saat ini tidak punya auth/rate-limiting bawaan. Tambahkan opsi middleware/hook (mis. `beforeRequest`) yang dipanggil sebelum request diteruskan ke engine, supaya host dapat menyisipkan auth/rate-limit sendiri tanpa fork handler.
- **Priority:** High
- **Status:** To Do
- **Dependencies:** None
- **Acceptance Criteria:**
  - Host dapat menolak request (mis. 401/429) sebelum mencapai provider LLM lewat hook ini.
  - Tanpa hook diisi, behavior handler tetap backward-compatible dengan sebelumnya.

### STORA-520

- **Epic:** Safety, Rate-Limiting & Persistence
- **Task Key:** STORA-520
- **Type:** Task
- **Summary:** Persist riwayat chat per document lewat storage adapter opsional
- **Description:** `useAiChat` saat ini murni React state, hilang saat reload. Sediakan interface storage adapter opsional (`loadHistory`/`saveHistory`) yang host dapat implementasikan (localStorage, backend Stora.page, dsb.) tanpa `@kubuild/ai` bergantung ke storage tertentu.
- **Priority:** Medium
- **Status:** To Do
- **Dependencies:** STORA-505
- **Acceptance Criteria:**
  - Tanpa adapter diisi, behavior tetap seperti sekarang (in-memory saja).
  - Dengan adapter contoh (localStorage) di playground, riwayat chat bertahan setelah reload halaman.

### STORA-521

- **Epic:** Safety, Rate-Limiting & Persistence
- **Task Key:** STORA-521
- **Type:** Task
- **Summary:** Terapkan security limit yang sama dengan import `.stora` pada output generate AI
- **Description:** Reuse `validateDocumentSecurity` (depth limit, node count limit, payload size) dari `@kubuild/core` untuk memvalidasi setiap document/section hasil AI sebelum dispatch — mencegah prompt yang menghasilkan tree raksasa atau nested-loop merusak editor.
- **Priority:** Highest
- **Status:** To Do
- **Dependencies:** STORA-509
- **Acceptance Criteria:**
  - Prompt yang secara sengaja diarahkan menghasilkan tree sangat dalam/lebar ditolak dengan diagnostic yang jelas, bukan membuat editor freeze.
  - Limit yang dipakai identik (bukan duplikat terpisah) dengan limit import `.stora` yang sudah ada.

## Epic: Testing & Docs

### STORA-522

- **Epic:** Testing & Docs
- **Task Key:** STORA-522
- **Type:** Test
- **Summary:** E2E: prompt kosong → generate → edit manual → tetap valid
- **Description:** Test mereproduksi Flow A dari PRD §31.3: mulai dari blank document, generate lewat prompt, lalu lakukan edit manual (drag/insert/update style) di atas hasil generate, pastikan document tetap valid sepanjang jalur.
- **Priority:** High
- **Status:** To Do
- **Dependencies:** STORA-507, STORA-509, STORA-510
- **Acceptance Criteria:**
  - Test lulus tanpa mock command engine — memakai command engine `@kubuild/core` yang sesungguhnya.
  - Document hasil akhir lulus `validateDocument`.

### STORA-523

- **Epic:** Testing & Docs
- **Task Key:** STORA-523
- **Type:** Test
- **Summary:** E2E: select → ask → enhance → apply → undo
- **Description:** Test mereproduksi Flow B dan C dari PRD §31.3 end-to-end: select node, tanya AI, minta enhance, apply hasilnya, lalu undo — memverifikasi node kembali ke kondisi semula persis.
- **Priority:** High
- **Status:** To Do
- **Dependencies:** STORA-512, STORA-514
- **Acceptance Criteria:**
  - Setelah undo, node identik (deep-equal) dengan kondisi sebelum enhance.
  - Discard (tanpa apply) tidak meninggalkan entry apa pun di history undo/redo.

### STORA-524

- **Epic:** Testing & Docs
- **Task Key:** STORA-524
- **Type:** Task
- **Summary:** Dokumentasikan integrasi AI provider untuk consumer
- **Description:** Tulis quickstart untuk consumer (mis. Stora.page): cara menyuplai provider/API key lewat `AiEditorConfig`, shape config, catatan keamanan (API key tidak boleh exposed ke client bila memakai provider berbayar langsung, disarankan lewat backend proxy `createAiHandler`).
- **Priority:** Medium
- **Status:** To Do
- **Dependencies:** STORA-501, STORA-519
- **Acceptance Criteria:**
  - Quickstart mencakup contoh minimal: aktifkan AI chat + generate di `KubuildEditor` dengan satu provider.
  - Dokumentasi eksplisit menyatakan API key provider tidak boleh diletakkan di client-side config secara langsung untuk provider berbayar; jalur yang direkomendasikan adalah proxy lewat `createAiHandler` di server consumer.

---

## Definition of Done per Task

- Implementasi berada pada package yang benar dan tidak melanggar dependency rules.
- Typecheck, lint, test relevan, dan build sukses.
- Public API, schema, dan behavior error yang berubah diperbarui di dokumentasi/fixture.
- Acceptance criteria diverifikasi lewat automated test bila feasible; sisanya melalui smoke test terdokumentasi.
- Tidak ada coupling ke database, auth, storage, atau action business Stora.page pada `@kubuild/core`/renderer.

## MVP Exit Gate

MVP siap bila semua item `Highest` selesai, item `High` yang langsung diperlukan oleh STORA-082 selesai, dan jalur berikut lulus E2E:

```text
Blank Page
  -> add/edit/reorder core components
  -> bind sample variable and collection
  -> desktop/tablet/mobile preview
  -> export .stora
  -> import on clean host
  -> inspect/edit same document
  -> export again without semantic data loss
```
