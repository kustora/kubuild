# KUBUILD — TODO HTML Import

**Product:** KUBUILD  
**CODE NAME:** BUILDER-01  
**Document Type:** TODO  
**Status:** Draft  
**Konvensi key:** `STORA-6##` (blok 600–649 dicadangkan untuk HTML import). Semua item awal berstatus `To Do`.

## Target

User/host dapat mengubah HTML statis (string, file `.html`, atau `.zip` berisi HTML + asset) menjadi `PageDocument` valid yang dapat diedit di builder dan diexport sebagai `.stora`. HTML diperlakukan sebagai **untrusted input** (ARCHITECTURE §31): tidak ada eksekusi JavaScript, semua URL/style divalidasi, hasil akhir lolos `PageDocumentSchema` + `validateDocumentSecurity`.

Tidak termasuk scope: render halaman SPA/JS-driven, import multi-page project, animasi `@keyframes`, pseudo-element `::before/::after`, eksekusi `<script>`.

## Arsitektur ringkas

```
schema → core → html-import   (package baru, sejajar components; core tetap pure)

HTML string (+ CSS eksternal, baseUrl)
  → 1. Parse (parse5, tanpa DOMParser — jalan di Node & browser)
  → 2. Sanitize berbasis AST
  → 3. CSS cascade (css-tree + css-select) → per-element StyleDefinition, @media → breakpoint, :hover → states
  → 4. Map element → Node (rule registry, extensible)
  → 5. Normalize (collapse wrapper, strip default styles, ID deterministik, depth limit)
  → 6. Asset (resolve URL relatif, rehost via assetResolver, font → theme)
  → 7. Validate (PageDocumentSchema + validateDocumentSecurity)
  → PageDocument + HtmlImportReport → (opsional) exportStoraPackage
```

## Urutan fase

| Fase | Epic                        | Selesai bila                                                                  |
| ---- | --------------------------- | ----------------------------------------------------------------------------- |
| H0   | Foundation                  | Package `@kubuild/html-import` ada, API contract & report type terdefinisi.   |
| H1   | Parse & sanitize            | HTML untrusted menjadi AST aman, tanpa script/handler/URL berbahaya.          |
| H2   | CSS cascade                 | Tiap elemen punya ResponsiveStyles hasil cascade, termasuk breakpoint/states. |
| H3   | Element mapping             | Elemen umum landing page terpetakan ke built-in component; sisanya fallback.  |
| H4   | Normalize, asset, validate  | Output `PageDocument` valid, ringkas, asset ter-resolve, lolos security.      |
| H5   | Editor integration          | User dapat import HTML dan paste HTML ke canvas dengan undo.                  |
| H6   | Quality & docs              | Round-trip, fixture nyata, dan security fixture terlindungi test; docs ada.   |
| H7   | Lanjutan (post-MVP)         | Tailwind support, browser-snapshot mode.                                      |

---

# Phase H0 — Foundation

## Epic: HTML Import Foundation

### STORA-600

- **Epic:** HTML Import Foundation
- **Task Key:** STORA-600
- **Type:** Task
- **Summary:** Scaffold package `@kubuild/html-import`
- **Description:** Buat package baru di `packages/html-import` (tsup + tsc declaration, vitest, eslint) mengikuti pola package lain. Dependency hanya `@kubuild/schema` dan `@kubuild/core` plus parser pure JS (`parse5`, `css-tree`, `css-select` atau adapter yang setara). Tidak boleh bergantung ke React, `renderer`, `editor`, atau DOM global.
- **Priority:** Highest
- **Status:** Done
- **Dependencies:** -
- **Acceptance Criteria:**
  - `pnpm run build`, `test`, `typecheck`, `lint` lulus untuk package baru via Turbo.
  - Tidak ada perubahan dependency di `@kubuild/core`; rule `no-restricted-imports` core tetap lulus.
  - Package dapat di-import dari Node (tanpa jsdom) dan dari browser bundle.
  - Output `.d.ts` kompatibel consumer NodeNext (extension `.js` + `.d.cts`).

### STORA-601

- **Epic:** HTML Import Foundation
- **Task Key:** STORA-601
- **Type:** Task
- **Summary:** Definisikan public API dan `HtmlImportReport`
- **Description:** Tetapkan signature `importHtml(html, options)` → `{ document, report }` dan `htmlToNodes(html, options)` → `{ nodes, report }`. Options: `baseUrl`, `stylesheets`, `fetchStylesheet`, `assetResolver`, `rules`, `limits` (`DocumentSecurityLimits`), `metadata`. Report berisi diagnostics berkode (mirip `PreflightDiagnostic`): `ELEMENT_DROPPED`, `ELEMENT_FALLBACK_EMBED`, `CSS_UNSUPPORTED_SELECTOR`, `CSS_UNSUPPORTED_PROPERTY`, `CSS_MEDIA_APPROXIMATED`, `ASSET_UNRESOLVED`, `URL_BLOCKED`, `DEPTH_FLATTENED`, `LIMIT_EXCEEDED`, plus statistik (node count, fallback count, fidelity score).
- **Priority:** Highest
- **Status:** Done
- **Dependencies:** STORA-600
- **Acceptance Criteria:**
  - Tipe API dan diagnostic code diexport dan terdokumentasi via TSDoc.
  - Setiap diagnostic membawa lokasi sumber (path element / line bila tersedia) dan severity `error | warning | info`.
  - Fungsi tidak pernah throw untuk input HTML jelek; error fatal dilaporkan sebagai result failure.

---

# Phase H1 — Parse & Sanitize

## Epic: Untrusted HTML Intake

### STORA-602

- **Epic:** Untrusted HTML Intake
- **Task Key:** STORA-602
- **Type:** Task
- **Summary:** Parse HTML ke AST dengan input limit
- **Description:** Parse string HTML (full document atau fragment) memakai parser spec-compliant. Ekstrak `<title>`, `<meta name="description">`, `lang`, `<style>`, `<link rel="stylesheet">`, dan `<body>` sebagai root konten. Terapkan limit ukuran input sebelum parsing.
- **Priority:** Highest
- **Status:** Done
- **Dependencies:** STORA-601
- **Acceptance Criteria:**
  - Full document dan fragment sama-sama didukung.
  - HTML malformed (tag tidak tertutup, nesting salah) tetap menghasilkan AST sesuai algoritma parsing HTML5.
  - Input melebihi `maxDocumentSizeBytes` ditolak sebelum parsing.
  - `title`/`description` masuk ke `DocumentMetadata`.

### STORA-603

- **Epic:** Untrusted HTML Intake
- **Task Key:** STORA-603
- **Type:** Task
- **Summary:** Sanitizer berbasis AST (allowlist)
- **Description:** Ganti pendekatan regex (`sanitizeHtml` di core) dengan sanitizer AST berbasis allowlist tag & atribut untuk jalur HTML import. Buang `script`, `noscript`, `object`, `embed`, `applet`, `base`, `meta[http-equiv]`, `template`, semua atribut `on*`, `srcdoc`, `formaction`. Semua `href`/`src`/`action`/`poster`/`srcset` divalidasi dengan `isSafeUrl` dari core.
- **Priority:** Highest
- **Status:** Done
- **Dependencies:** STORA-602
- **Acceptance Criteria:**
  - Payload XSS umum (event handler, `javascript:` ter-encode/ber-whitespace, `data:text/html`, SVG `<script>`/`onload`, `<a xlink:href>`) tidak lolos.
  - Setiap elemen/atribut yang dibuang tercatat di report (`ELEMENT_DROPPED`, `URL_BLOCKED`).
  - Sanitizer diexport agar bisa dipakai ulang oleh fallback `html-embed`.

---

# Phase H2 — CSS Cascade

## Epic: Style Resolution

### STORA-604

- **Epic:** Style Resolution
- **Task Key:** STORA-604
- **Type:** Task
- **Summary:** Kumpulkan dan parse stylesheet
- **Description:** Kumpulkan CSS dari `<style>`, `style=""` inline, `options.stylesheets`, dan `<link rel="stylesheet">` lewat `fetchStylesheet` milik host (tanpa fetch bawaan). Parse dengan CSS parser toleran; `@import` diabaikan dan dilaporkan.
- **Priority:** High
- **Status:** Done
- **Dependencies:** STORA-602
- **Acceptance Criteria:**
  - Urutan source order dipertahankan untuk cascade.
  - `@import`, `expression()`, `url(javascript:)`, dan pola `DANGEROUS_STYLE_VALUE_PATTERN` dibuang dan dilaporkan.
  - Tanpa `fetchStylesheet`, `<link>` eksternal dilaporkan `ASSET_UNRESOLVED`, bukan error fatal.

### STORA-605

- **Epic:** Style Resolution
- **Task Key:** STORA-605
- **Type:** Task
- **Summary:** Selector matching + specificity cascade per elemen
- **Description:** Untuk tiap elemen, match semua rule (css-select) lalu resolve deklarasi berdasarkan specificity, source order, `!important`, dan inline style. Konversi property ke camelCase `StyleDefinition`. Resolve `var(--x)` dari custom property `:root` bila nilainya statis. Inheritance hanya untuk property teks (color, font-*, line-height, text-align, letter-spacing) dan hanya bila nilai berbeda dari parent node hasil mapping.
- **Priority:** Highest
- **Status:** Done
- **Dependencies:** STORA-604
- **Acceptance Criteria:**
  - Test cascade: specificity, `!important`, inline vs stylesheet, source order.
  - Shorthand (`margin`, `padding`, `border`, `background`, `font`) dipertahankan atau di-expand konsisten dengan style yang dibaca renderer.
  - Selector tidak didukung (`:has`, `:nth-*` kompleks, dsb.) dilaporkan `CSS_UNSUPPORTED_SELECTOR` dan dilewati.

### STORA-606

- **Epic:** Style Resolution
- **Task Key:** STORA-606
- **Type:** Task
- **Summary:** Map `@media` ke breakpoint dan pseudo-class ke `states`
- **Description:** Rule di dalam `@media (max-width|min-width)` dipetakan ke `base`/`desktop`/`tablet`/`mobile` memakai `BREAKPOINTS` dari schema (nearest match). Media non-width (`print`, `prefers-*`) diabaikan. `:hover`, `:focus`, `:active`, `:focus-visible` dipetakan ke `styles.states`.
- **Priority:** High
- **Status:** Done
- **Dependencies:** STORA-605
- **Acceptance Criteria:**
  - Breakpoint custom (mis. `max-width: 900px`) dipetakan ke breakpoint terdekat dan dilaporkan `CSS_MEDIA_APPROXIMATED`.
  - Override per breakpoint hanya menyimpan delta terhadap `base`.
  - Hasil render renderer per breakpoint sesuai dengan HTML asli untuk fixture responsif sederhana.

---

# Phase H3 — Element Mapping

## Epic: HTML → Node Mapping

### STORA-607

- **Epic:** HTML → Node Mapping
- **Task Key:** STORA-607
- **Type:** Task
- **Summary:** Rule registry untuk mapping elemen
- **Description:** Definisikan `HtmlMappingRule { id, priority, match(el, computedStyle, ctx), convert(el, ctx) → Node | Node[] | null }` dan engine yang mengevaluasi rule berdasar priority. Host dapat menambah/override rule lewat `options.rules` untuk component custom.
- **Priority:** Highest
- **Status:** Done
- **Dependencies:** STORA-601
- **Acceptance Criteria:**
  - Rule host dapat override rule default dengan priority lebih tinggi.
  - Mapping hanya menghasilkan `type` yang ada di `BUILTIN_COMPONENT_TYPES` atau yang dideklarasikan host.
  - Engine tidak bergantung ke `@kubuild/components` (cukup `@kubuild/schema`).

### STORA-608

- **Epic:** HTML → Node Mapping
- **Task Key:** STORA-608
- **Type:** Task
- **Summary:** Default rule: layout & typography
- **Description:** `section/header/footer/main/nav/article/aside` → `section`; `div` dengan `display:flex` → `flex`, `display:grid` → `grid`, lainnya → `container`; `h1–h6` → `heading` (`level`); `p` → `paragraph`; text node lepas di container → `text`; `blockquote`, `pre/code` → `code-block`, `hr` → `divider`, `a` → `link`. Props mengikuti `canonical-props` (gunakan mapping kebalikan dari `renderer/src/code-generator.ts`).
- **Priority:** Highest
- **Status:** Done
- **Dependencies:** STORA-607, STORA-605
- **Acceptance Criteria:**
  - Whitespace text di-collapse sesuai aturan HTML; text kosong tidak menjadi node.
  - Untuk setiap tipe di tabel, output `generateHtml` → import menghasilkan tipe yang sama.

### STORA-609

- **Epic:** HTML → Node Mapping
- **Task Key:** STORA-609
- **Type:** Spike
- **Summary:** Putuskan strategi rich inline text
- **Description:** Tentukan cara menangani inline markup (`<p>Halo <b>dunia</b> <a href>link</a></p>`): (a) simpan sebagai inline HTML tersanitasi di prop `paragraph`/`text` bila renderer mendukung, (b) pecah jadi beberapa node `text`/`link` dalam `flex` inline, atau (c) flatten ke plain text. Cek dukungan inline editor dan renderer saat ini.
- **Priority:** High
- **Status:** Done
- **Dependencies:** STORA-608
- **Acceptance Criteria:**
  - Keputusan tertulis (ADR singkat di docs) beserta dampak ke inline editor dan schema.
  - Bila butuh perubahan schema, tiket lanjutan dibuat dengan migration path.

### STORA-610

- **Epic:** HTML → Node Mapping
- **Task Key:** STORA-610
- **Type:** Task
- **Summary:** Default rule: media, form, list, table
- **Description:** `img`/`picture` → `image` (pilih src terbaik dari `srcset`), `video` → `video`, `iframe` YouTube/Vimeo → `video`; `form/input/textarea/select/checkbox/radio/button[type=submit]` → komponen form (+ `formConfig` dasar tanpa action eksekusi); `a`/`button` bergaya tombol (padding + background) → `button`; `ul/ol/li` → `list/list-item`; `table/tr/td/th` → `table/table-row/table-cell`; `svg` sederhana → `icon` atau `html-embed`.
- **Priority:** High
- **Status:** Done
- **Dependencies:** STORA-608
- **Acceptance Criteria:**
  - `alt`, `aria-label`, `name`, `placeholder`, `required`, `type` input terbawa ke props.
  - `form[action]` eksternal tidak dieksekusi; dilaporkan sebagai info agar host mengatur action.
  - Heuristik "link sebagai button" terdokumentasi dan dapat dimatikan via options.

### STORA-611

- **Epic:** HTML → Node Mapping
- **Task Key:** STORA-611
- **Type:** Task
- **Summary:** Fallback `html-embed` untuk elemen tak terpetakan
- **Description:** Elemen tanpa rule cocok (mis. `iframe` lain, `canvas`, SVG kompleks, custom element) diubah menjadi `html-embed` berisi outerHTML yang sudah disanitasi (STORA-603) dengan style inline hasil cascade. Elemen yang sama sekali tidak aman dibuang.
- **Priority:** High
- **Status:** Done
- **Dependencies:** STORA-603, STORA-607
- **Acceptance Criteria:**
  - Setiap fallback tercatat `ELEMENT_FALLBACK_EMBED` dan menurunkan fidelity score.
  - Opsi `fallback: 'embed' | 'drop'` tersedia.

---

# Phase H4 — Normalize, Asset, Validate

## Epic: Document Assembly

### STORA-612

- **Epic:** Document Assembly
- **Task Key:** STORA-612
- **Type:** Task
- **Summary:** Normalisasi tree
- **Description:** Collapse wrapper `div` tanpa style bermakna dengan satu child, gabungkan text berurutan, buang style yang identik dengan `defaultStyles` component atau nilai default CSS, generate ID deterministik (pakai util ID core), dan flatten saat kedalaman mendekati `maxTreeDepth`.
- **Priority:** High
- **Status:** Done
- **Dependencies:** STORA-608
- **Acceptance Criteria:**
  - Tree hasil import dari fixture nyata tidak melebihi `maxTreeDepth` (32) dan `maxNodeCount`.
  - Import HTML yang sama dua kali menghasilkan document identik (deterministik).
  - Flatten dilaporkan `DEPTH_FLATTENED`.

### STORA-613

- **Epic:** Document Assembly
- **Task Key:** STORA-613
- **Type:** Task
- **Summary:** Resolve dan rehost asset
- **Description:** Resolve URL relatif terhadap `baseUrl`. Kumpulkan asset dari `img src/srcset`, `video poster/src`, `url()` di style, `@font-face`. Panggil `assetResolver` host untuk rehost/menghasilkan `AssetReference`. Google Fonts `<link>`/`@font-face` dipetakan ke `theme.fonts`.
- **Priority:** High
- **Status:** Done
- **Dependencies:** STORA-604, STORA-610
- **Acceptance Criteria:**
  - Asset tanpa resolver tetap memakai URL absolut yang lolos `isSafeUrl`.
  - Asset gagal dilaporkan `ASSET_UNRESOLVED` tanpa menggagalkan import.
  - Ekstensi berbahaya (`isDangerousAssetFilename`) ditolak.

### STORA-614

- **Epic:** Document Assembly
- **Task Key:** STORA-614
- **Type:** Task
- **Summary:** Validasi akhir dan export `.stora`
- **Description:** Rakit `PageDocument` (root `page`, `CURRENT_SCHEMA_VERSION`, metadata), jalankan `PageDocumentSchema` + `validateDocumentSecurity`. Sediakan helper `importHtmlToStoraPackage` yang memanggil `exportStoraPackage` dari core.
- **Priority:** Highest
- **Status:** Done
- **Dependencies:** STORA-612, STORA-613
- **Acceptance Criteria:**
  - Document yang gagal validasi tidak pernah dikembalikan sebagai sukses.
  - `.stora` hasil helper lolos `preflightPackage` dan `importPackage` tanpa error.

### STORA-615

- **Epic:** Document Assembly
- **Task Key:** STORA-615
- **Type:** Task
- **Summary:** Input `.zip` (HTML + asset lokal)
- **Description:** Terima archive berisi `index.html` + CSS + asset. Reuse safety check importer `.stora` (zip-slip `isDangerousPath`, `checkZipBomb`, size limit). CSS dan asset lokal di-resolve dari archive, lalu diteruskan ke `assetResolver`.
- **Priority:** Medium
- **Status:** To Do
- **Dependencies:** STORA-614
- **Acceptance Criteria:**
  - Archive berbahaya (zip-slip, zip bomb, ekstensi executable) ditolak sebelum parsing.
  - Entry HTML dipilih dari `index.html` atau satu-satunya file `.html`; ambigu → error jelas.

---

# Phase H5 — Editor Integration

## Epic: HTML Import UX

### STORA-616

- **Epic:** HTML Import UX
- **Task Key:** STORA-616
- **Type:** Task
- **Summary:** Dialog "Import HTML" di editor
- **Description:** Dialog di `@kubuild/editor`: upload `.html`/`.zip` atau paste HTML, jalankan import, tampilkan preview + `HtmlImportReport` (warning, fallback, fidelity), lalu buka sebagai document baru via callback host. Re-export lewat `@kubuild/react`.
- **Priority:** High
- **Status:** To Do
- **Dependencies:** STORA-614
- **Acceptance Criteria:**
  - Import gagal tidak mengubah draft aktif.
  - User dapat membatalkan setelah melihat report.
  - Teks UI melalui i18n editor.

### STORA-617

- **Epic:** HTML Import UX
- **Task Key:** STORA-617
- **Type:** Task
- **Summary:** Paste HTML ke canvas sebagai node
- **Description:** Saat clipboard berisi `text/html` (dan bukan payload internal KUBUILD), jalankan `htmlToNodes` lalu insert ke selection via command `INSERT_NODE` dalam satu history transaction.
- **Priority:** Medium
- **Status:** To Do
- **Dependencies:** STORA-616
- **Acceptance Criteria:**
  - Paste dapat di-undo dalam satu langkah.
  - Node hasil paste mematuhi aturan `acceptsChildren` parent; bila tidak bisa, insert ke parent terdekat yang valid.
  - Paste image dari clipboard tetap memakai handler yang ada.

### STORA-618

- **Epic:** HTML Import UX
- **Task Key:** STORA-618
- **Type:** Task
- **Summary:** Demo import HTML di playground
- **Description:** Tambahkan alur import HTML di `apps/stora-playground` dengan mock `assetResolver` dan beberapa sample HTML.
- **Priority:** Low
- **Status:** To Do
- **Dependencies:** STORA-616
- **Acceptance Criteria:**
  - Sample HTML dapat diimport, diedit, dan diexport `.stora` end-to-end.

---

# Phase H6 — Quality & Docs

## Epic: HTML Import Quality

### STORA-619

- **Epic:** HTML Import Quality
- **Task Key:** STORA-619
- **Type:** Test
- **Summary:** Round-trip test `generateHtml` → `importHtml`
- **Description:** Untuk fixture document di `@kubuild/schema`, generate HTML standalone via `renderer/code-generator`, import kembali, lalu bandingkan dengan `round-trip-comparator`. Test ditaruh di package yang boleh bergantung ke renderer (mis. test-only devDependency atau package e2e) agar `html-import` tidak bergantung ke renderer di runtime.
- **Priority:** High
- **Status:** To Do
- **Dependencies:** STORA-614
- **Acceptance Criteria:**
  - Struktur node, tipe, props utama, dan style per breakpoint ekivalen secara semantik.
  - Perbedaan yang diizinkan (ID, wrapper) terdokumentasi di comparator options.

### STORA-620

- **Epic:** HTML Import Quality
- **Task Key:** STORA-620
- **Type:** Test
- **Summary:** Fixture HTML nyata + security fixture
- **Description:** Kumpulkan fixture: landing page CSS biasa, Bootstrap, export Webflow/Framer statis, HTML hasil AI. Snapshot `HtmlImportReport` dan statistik. Tambahkan fixture serangan: XSS atribut/URL/SVG, CSS injection, nesting sangat dalam, node sangat banyak, input sangat besar.
- **Priority:** High
- **Status:** To Do
- **Dependencies:** STORA-614
- **Acceptance Criteria:**
  - Semua security fixture ditolak/disanitasi dan lolos `validateDocumentSecurity`.
  - Waktu import fixture landing page tipikal < 1 detik di Node.

### STORA-621

- **Epic:** HTML Import Quality
- **Task Key:** STORA-621
- **Type:** Task
- **Summary:** Dokumentasi HTML import
- **Description:** Tulis guide di `apps/docs`: API, options, mapping table, keterbatasan (no JS, CSS yang didukung), custom rule, report codes, dan contoh integrasi host.
- **Priority:** Medium
- **Status:** To Do
- **Dependencies:** STORA-616
- **Acceptance Criteria:**
  - Contoh code di docs dicompile/typecheck terhadap API aktual.

---

# Phase H7 — Lanjutan (post-MVP)

## Epic: Fidelity Extensions

### STORA-622

- **Epic:** Fidelity Extensions
- **Task Key:** STORA-622
- **Type:** Task
- **Summary:** Dukungan Tailwind utility class
- **Description:** Banyak HTML hasil AI memakai Tailwind CDN tanpa stylesheet. Opsi: (a) mapper class Tailwind → `StyleDefinition` termasuk prefix responsif (`sm:`/`md:`/`lg:`) → breakpoint dan `hover:` → states, atau (b) host mengirim CSS hasil compile. Pilih lewat spike singkat sebelum implementasi.
- **Priority:** Medium
- **Status:** To Do
- **Dependencies:** STORA-606
- **Acceptance Criteria:**
  - Class utility umum (spacing, flex, grid, typography, color, radius, shadow) terpetakan.
  - Class tidak dikenal dilaporkan, bukan diam-diam hilang.
  - Tidak ada runtime Tailwind di document; hasil tetap portable style object.

### STORA-623

- **Epic:** Fidelity Extensions
- **Task Key:** STORA-623
- **Type:** Task
- **Summary:** Browser-snapshot mode (editor only)
- **Description:** Mode alternatif di editor: render HTML tersanitasi di iframe sandbox (tanpa `allow-scripts`) pada 3 lebar viewport, ambil `getComputedStyle`, diff per breakpoint, lalu buang nilai default. Dipakai saat cascade statis tidak cukup akurat.
- **Priority:** Low
- **Status:** To Do
- **Dependencies:** STORA-616
- **Acceptance Criteria:**
  - Iframe sandbox tidak mengizinkan script maupun same-origin.
  - Style hasil snapshot tidak lebih gemuk dari hasil mode statis untuk fixture yang sama (setelah strip default).
