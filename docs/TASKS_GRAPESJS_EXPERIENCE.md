# KUBUILD — Tasks & Jira Epics: Core Semantic HTML Elements & GrapesJS-Inspired Modular Engine

**Product:** KUBUILD  
**Codename:** BUILDER-01  
**Document Type:** Sprint & Backlog Tasks (Jira Format)  
**Feature Focus:** Core Semantic HTML Elements (List, Table, Blockquote, Divider, Form, Video), Sector-based Style Manager, Visual Box Model, Trait Manager, State Selector (:hover), Floating Badges, Breadcrumbs, Motion Engine  
**Key Convention:** `STORA-19X` & `STORA-2XX`  
**Status:** Ready for Sprint Planning  

---

## Ringkasan Epic & Alokasi Package

| Epic Key | Epic Name | Package Target | Jumlah Task |
| :--- | :--- | :--- | :--- |
| **EPIC-19** | Core Semantic HTML Components (List, Table, Semantic, Media, Form) | `@kubuild/components`, `@kubuild/renderer` | 6 Tasks |
| **EPIC-20** | Sector-Based Style Manager & Visual Box Model | `@kubuild/editor`, `@kubuild/schema` | 7 Tasks |
| **EPIC-21** | Trait Manager (Component Attributes & Meta) | `@kubuild/components`, `@kubuild/editor` | 4 Tasks |
| **EPIC-22** | State & Pseudo-Class Selector (`:hover`, `:active`) | `@kubuild/schema`, `@kubuild/renderer`, `@kubuild/editor` | 4 Tasks |
| **EPIC-23** | Canvas Navigation (Floating Badges & Breadcrumbs) | `@kubuild/editor`, `@kubuild/core` | 3 Tasks |
| **EPIC-24** | Block Manager & Pre-composed Templates | `@kubuild/components`, `@kubuild/editor` | 3 Tasks |
| **EPIC-25** | Asset Manager Modal & Live Code Viewer | `@kubuild/editor`, `@kubuild/renderer` | 2 Tasks |
| **EPIC-26** | Motion & Animation Engine (AOS, Hover, Loop) | `@kubuild/schema`, `@kubuild/renderer`, `@kubuild/editor` | 5 Tasks |
| **EPIC-27** | Standalone HTML & Assets Exporter Engine (`.zip` & Standalone `.html`) | `@kubuild/core`, `@kubuild/renderer`, `@kubuild/editor` | 4 Tasks |

---

# Epic 19 — Core Semantic HTML Components Library

### STORA-190
- **Epic:** Core Semantic HTML Components Library
- **Task Key:** STORA-190
- **Type:** Story
- **Summary:** Implementasikan Komponen `list` dan `list-item` (`<ul>`, `<ol>`, `<li>`)
- **Description:** Buat definisi komponen dan renderer untuk:
  - `list`: Container daftar dengan opsi tag `ul` (Unordered) dan `ol` (Ordered), prop `listStyleType` (`disc`, `circle`, `square`, `decimal`, `none`, `custom-icon`).
  - `list-item`: Item baris daftar `<li>` yang menerima teks langsung atau child komponen (Heading, Text, Icon, Button).
- **Priority:** Highest
- **Status:** Done
- **Dependencies:** None
- **Acceptance Criteria:**
  - Komponen `list` dan `list-item` terdaftar di Component Registry dan ter-render dengan tag `<ul>`/`<ol>` dan `<li>` semantik di `@kubuild/renderer`.

### STORA-191
- **Epic:** Core Semantic HTML Components Library
- **Task Key:** STORA-191
- **Type:** Story
- **Summary:** Implementasikan Komponen Tabel Lengkap (`table`, `table-row`, `table-cell`)
- **Description:** Buat sistem tabel untuk perbandingan harga dan spesifikasi teknis:
  - `table`: Container `<table>` dengan opsi style `striped`, `bordered`, `compact`.
  - `table-row`: Tag `<tr>`.
  - `table-cell`: Tag `<th>` (header) atau `<td>` (data) dengan prop `colSpan` dan `rowSpan`.
- **Priority:** Highest
- **Status:** Done
- **Dependencies:** None
- **Acceptance Criteria:**
  - Tabel dapat dibuat, diedit kolom dan barisnya, serta mendukung sel header (`<th>`) dan sel data (`<td>`) dengan `colSpan`/`rowSpan` yang valid.

### STORA-192
- **Epic:** Core Semantic HTML Components Library
- **Task Key:** STORA-192
- **Type:** Story
- **Summary:** Implementasikan Elemen Tipografi Semantik (`paragraph`, `link`, `blockquote`, `badge`, `code-block`)
- **Description:** Sediakan komponen tipografi esensial:
  - `paragraph`: Tag `<p>` murni.
  - `link`: Tag `<a>` dengan prop `href`, `target`, `rel`.
  - `blockquote`: Tag `<blockquote>` dengan garis border-left dekoratif.
  - `badge`: Tag `<span>` pill/kapsul untuk tag status atau kategori.
  - `code-block`: Tag `<pre><code>` dengan background gelap dan font monospace.
- **Priority:** High
- **Status:** Done
- **Dependencies:** None
- **Acceptance Criteria:**
  - Seluruh elemen tipografi semantik terdaftar di registry dan dapat di-drag dari sidebar editor ke dalam container apapun.

### STORA-193
- **Epic:** Core Semantic HTML Components Library
- **Task Key:** STORA-193
- **Type:** Story
- **Summary:** Implementasikan Komponen `divider` (`<hr>`) dan `spacer`
- **Description:**
  - `divider`: Garis horizontal pemisah dengan pilihan garis (`solid`, `dashed`, `dotted`, `gradient`) dan opsi teks/ikon di tengah.
  - `spacer`: Elemen pengatur jarak vertikal kosong dengan prop `height` yang dapat diatur via inspector.
- **Priority:** High
- **Status:** To Do
- **Dependencies:** None
- **Acceptance Criteria:**
  - `divider` ter-render sebagai `<hr>` atau divider ber-icon, dan `spacer` memberikan jarak vertikal sesuai ukuran piksel yang disetel.

### STORA-194
- **Epic:** Core Semantic HTML Components Library
- **Task Key:** STORA-194
- **Type:** Story
- **Summary:** Implementasikan Komponen `video`, `icon`, dan `html-embed`
- **Description:**
  - `video`: Pemutar video HTML5 native (`<video>` dengan `src`, `poster`, `controls`, `autoplay`, `loop`, `muted`) dan embed YouTube/Vimeo.
  - `icon`: Render ikon vektor SVG dari paket Lucide icons dengan pengatur warna dan ukuran.
  - `html-embed`: Komponen penyemat kode HTML / iframe kustom yang aman tersanitasi.
- **Priority:** High
- **Status:** Done
- **Dependencies:** None
- **Acceptance Criteria:**
  - Video HTML5 dan video YouTube ter-render mulus di kanvas preview; ikon Lucide tampil dengan warna/ukuran dinamis.

### STORA-195
- **Epic:** Core Semantic HTML Components Library
- **Task Key:** STORA-195
- **Type:** Story
- **Summary:** Implementasikan Form Controls Dasar (`form`, `input`, `textarea`, `select`, `checkbox`, `radio`)
- **Description:** Buat rangkaian komponen form HTML untuk lead capture dan kontak:
  - `form`: Wrapper `<form>` dengan `action` dan `method`.
  - `input`: Input field dengan tipe `text`, `email`, `number`, `password`, `placeholder`, `required`.
  - `textarea`: Textarea multi-baris.
  - `select`: Dropdown pilihan dengan options list.
  - `checkbox` & `radio`: Pilihan centang & radio dengan label.
- **Priority:** High
- **Status:** Done
- **Dependencies:** None
- **Acceptance Criteria:**
  - Pengguna dapat menyusun form kontak lengkap (Nama, Email, Pesan, Checkbox persetujuan, Tombol Kirim) di kanvas editor.

---

# Epic 20 — Sector-Based Style Manager & Visual Box Model

### STORA-201
- **Epic:** Sector-Based Style Manager & Visual Box Model
- **Task Key:** STORA-201
- **Type:** Story
- **Summary:** Implementasikan Komponen Visual Box Model Diagram
- **Description:** Buat komponen diagram visual box model berlapis (Margin luar oranye, Border tengah abu-abu, Padding dalam hijau/pink, dan Content tengah) dengan input angka di setiap sisi.
- **Priority:** Highest
- **Status:** Done
- **Dependencies:** None
- **Acceptance Criteria:**
  - Mengubah angka di kotak diagram secara instan memperbarui `marginTop/Right/Bottom/Left` atau `paddingTop/Right/Bottom/Left` pada node aktif.

### STORA-202
- **Epic:** Sector-Based Style Manager & Visual Box Model
- **Task Key:** STORA-202
- **Type:** Story
- **Summary:** Struktur Accordion Sectors di Style Manager Panel
- **Description:** Restrukturisasi panel styling menjadi accordion yang dapat dibuka/tutup: Dimension, Spacing (Box Model), Typography, Decorations, Flex/Alignment.
- **Priority:** Highest
- **Status:** Done
- **Dependencies:** STORA-201
- **Acceptance Criteria:**
  - Tiap sektor dapat dibuka-tutup dengan animasi halus dan mengingat status buka/tutup di local state.

### STORA-203
- **Epic:** Sector-Based Style Manager & Visual Box Model
- **Task Key:** STORA-203
- **Type:** Story
- **Summary:** Dimension & Display Sector Controls
- **Description:** Sediakan kontrol untuk `display`, `width`, `height`, `minWidth`, `maxWidth`, `minHeight`, `maxHeight`, dan `overflow`.
- **Priority:** High
- **Status:** Done
- **Dependencies:** STORA-202
- **Acceptance Criteria:**
  - Input ukuran mendukung unit switch (`px`, `%`, `rem`, `vw`, `vh`, `auto`).

### STORA-204
- **Epic:** Sector-Based Style Manager & Visual Box Model
- **Task Key:** STORA-204
- **Type:** Story
- **Summary:** Typography Sector Controls
- **Description:** Sediakan kontrol tipografi lengkap: font family, font size, font weight, line height, letter spacing, color picker, text align, text decoration, dan text transform.
- **Priority:** High
- **Status:** Done
- **Dependencies:** STORA-202
- **Acceptance Criteria:**
  - Perubahan tipografi diterapkan secara instan ke style node terpilih.

### STORA-205
- **Epic:** Sector-Based Style Manager & Visual Box Model
- **Task Key:** STORA-205
- **Type:** Story
- **Summary:** Decorations Sector (Background, Borders & Shadows)
- **Description:** Sediakan kontrol untuk background (color, gradient, image), border (style, width, color, radius), serta box shadow.
- **Priority:** High
- **Status:** To Do
- **Dependencies:** STORA-202
- **Acceptance Criteria:**
  - Perubahan background, border, dan shadow ter-render akurat pada kanvas.

### STORA-206
- **Epic:** Sector-Based Style Manager & Visual Box Model
- **Task Key:** STORA-206
- **Type:** Story
- **Summary:** Flexbox & Alignment Sector Controls
- **Description:** Sediakan kontrol visual saat elemen bertipe container/flex: arah flex, justify-content, align-items, flex-wrap, dan gap slider.
- **Priority:** High
- **Status:** To Do
- **Dependencies:** STORA-202
- **Acceptance Criteria:**
  - Tombol icon alignment mengubah susunan elemen anak secara instan.

### STORA-207
- **Epic:** Sector-Based Style Manager & Visual Box Model
- **Task Key:** STORA-207
- **Type:** Story
- **Summary:** CSS Positioning & Z-Index Inspector Controls
- **Description:** Tambahkan kontrol CSS Positioning di Style Manager:
  - Tipe posisi: `static`, `relative`, `absolute`, `fixed`, `sticky`.
  - Input offsets: `top`, `right`, `bottom`, `left` (dengan switch unit `px`, `%`, `rem`, `auto`).
  - Pinning Matrix visual: 4 tombol cepat untuk menempelkan ke sudut parent.
  - Input `zIndex` untuk mengatur urutan tumpukan layer.
- **Priority:** High
- **Status:** To Do
- **Dependencies:** STORA-202
- **Acceptance Criteria:**
  - Memilih `position: fixed` dengan `bottom: 20px` dan `right: 20px` membuat tombol melayang di pojok kanan bawah layar preview.
  - Input `zIndex` mengatur urutan tumpukan antar elemen secara akurat.

---


# Epic 21 — Trait Manager (Component Attributes & Meta)

### STORA-210
- **Epic:** Trait Manager (Component Attributes & Meta)
- **Task Key:** STORA-210
- **Type:** Task
- **Summary:** Definisikan Metadata Trait pada Komponen di `@kubuild/components`
- **Description:** Pisahkan definisi prop fungsional (Traits) seperti `href`, `target`, `alt`, `title`, `placeholder`, `aria-label`, dan custom `id` dari styling murni.
- **Priority:** High
- **Status:** To Do
- **Dependencies:** None
- **Acceptance Criteria:**
  - Setiap komponen memiliki daftar `traits` terdefinisi dengan tipe data dan default value yang jelas.

### STORA-211
- **Epic:** Trait Manager (Component Attributes & Meta)
- **Task Key:** STORA-211
- **Type:** Story
- **Summary:** Dedicated Traits Tab di Inspector Sidebar
- **Description:** Tambahkan tab khusus **Settings / Traits (⚙️)** di samping tab **Style (🎨)** pada panel kanan editor.
- **Priority:** High
- **Status:** To Do
- **Dependencies:** STORA-210
- **Acceptance Criteria:**
  - Tab Traits menampilkan formulir atribut teknis HTML komponen yang dipilih.

### STORA-212
- **Epic:** Trait Manager (Component Attributes & Meta)
- **Task Key:** STORA-212
- **Type:** Story
- **Summary:** Link & Target Control (Button & Links)
- **Description:** Rancang kontrol link trait dengan input URL, toggle *Open in new tab*, dan rel attributes.
- **Priority:** Medium
- **Status:** To Do
- **Dependencies:** STORA-211
- **Acceptance Criteria:**
  - Button dan link mengaplikasikan atribut `target="_blank"` saat toggle diaktifkan.

### STORA-213
- **Epic:** Trait Manager (Component Attributes & Meta)
- **Task Key:** STORA-213
- **Type:** Story
- **Summary:** Image Alt Text & Lazy Loading Traits
- **Description:** Tambahkan kontrol trait untuk image: input Alt text dan toggle loading (`lazy` / `eager`).
- **Priority:** Medium
- **Status:** To Do
- **Dependencies:** STORA-211
- **Acceptance Criteria:**
  - Tag `<img>` yang dirender memuat atribut `alt` dan `loading="lazy"` secara semantik.

---

# Epic 22 — State & Pseudo-Class Selector (`:hover`, `:active`)

### STORA-220
- **Epic:** State & Pseudo-Class Selector
- **Task Key:** STORA-220
- **Type:** Task
- **Summary:** Perluas Document Schema untuk Pseudo-States
- **Description:** Tambahkan field `states` opsional pada `ResponsiveStylesSchema` di `@kubuild/schema`.
- **Priority:** High
- **Status:** To Do
- **Dependencies:** None
- **Acceptance Criteria:**
  - Dokumen JSON memvalidasi layer style `:hover` dan backward-compatible.

### STORA-221
- **Epic:** State & Pseudo-Class Selector
- **Task Key:** STORA-221
- **Type:** Story
- **Summary:** Dropdown State Selector di Header Style Manager
- **Description:** Buat dropdown pilihan state di atas panel styling (`Default`, `:hover`, `:active`, `:focus`).
- **Priority:** High
- **Status:** To Do
- **Dependencies:** STORA-220
- **Acceptance Criteria:**
  - Mengubah background color saat di state `:hover` menyimpan warna tersebut ke key hover tanpa merusak nilai default.

### STORA-222
- **Epic:** State & Pseudo-Class Selector
- **Task Key:** STORA-222
- **Type:** Story
- **Summary:** Dynamic Hover Style Compilation di `@kubuild/renderer`
- **Description:** Perbarui renderer agar menghasilkan scoped CSS pseudo-class handler sehingga efek `:hover` dapat diuji langsung di kanvas.
- **Priority:** High
- **Status:** To Do
- **Dependencies:** STORA-221
- **Acceptance Criteria:**
  - Tombol berubah warna saat kursor melayang di atasnya pada mode preview kanvas.

### STORA-223
- **Epic:** State & Pseudo-Class Selector
- **Task Key:** STORA-223
- **Type:** Story
- **Summary:** Indikator Visual State Aktif di Style Manager
- **Description:** Berikan highlight warna oranye/kuning pada header panel saat mengedit dalam mode `:hover`.
- **Priority:** Medium
- **Status:** To Do
- **Dependencies:** STORA-221
- **Acceptance Criteria:**
  - Badge peringatan *"Editing :hover State"* muncul di atas panel inspector.

---

# Epic 23 — Canvas Navigation (Floating Badges & Breadcrumbs)

### STORA-230
- **Epic:** Canvas Navigation
- **Task Key:** STORA-230
- **Type:** Story
- **Summary:** Floating Action Badges di Atas Node Terpilih di Kanvas
- **Description:** Render toolbar kecil melayang di atas bounding box elemen aktif dengan tombol: ⬆️ *Select Parent*, 🖐️ *Move*, 📑 *Duplicate*, 🗑️ *Delete*.
- **Priority:** Highest
- **Status:** To Do
- **Dependencies:** None
- **Acceptance Criteria:**
  - Mengklik tombol ⬆️ langsung memilih parent container node tersebut.

### STORA-231
- **Epic:** Canvas Navigation
- **Task Key:** STORA-231
- **Type:** Story
- **Summary:** Bottom Hierarchy Breadcrumbs Bar
- **Description:** Tampilkan bar navigasi hierarki di bagian bawah kanvas editor: `Page > Section > Container > Columns > Button`.
- **Priority:** High
- **Status:** To Do
- **Dependencies:** None
- **Acceptance Criteria:**
  - Mengklik nama breadcrumb memilih elemen tersebut di kanvas dan inspector.

### STORA-232
- **Epic:** Canvas Navigation
- **Task Key:** STORA-232
- **Type:** Task
- **Summary:** Command Helper: `getParentNodeId` dan `getNodeAncestors` di `@kubuild/core`
- **Description:** Sediakan utilitas pencarian jalur leluhur (*ancestor path*) dan parent langsung yang efisien di package `@kubuild/core`.
- **Priority:** High
- **Status:** To Do
- **Dependencies:** None
- **Acceptance Criteria:**
  - Fungsi mengembalikan array node leluhur dari root hingga node target dalam O(N) traversal.

---

# Epic 24 — Block Manager & Pre-composed Templates

### STORA-240
- **Epic:** Block Manager & Pre-composed Templates
- **Task Key:** STORA-240
- **Type:** Story
- **Summary:** Desain Tab "Blocks" di Sidebar Kiri Editor
- **Description:** Tambahkan tab **Blocks** di samping tab Components dan Layers, menampilkan kartu thumbnail blok siap pakai per kategori.
- **Priority:** High
- **Status:** To Do
- **Dependencies:** None
- **Acceptance Criteria:**
  - Tab Blocks menampilkan grid kartu dengan nama, kategori, dan ikon/thumbnail blok.

### STORA-241
- **Epic:** Block Manager & Pre-composed Templates
- **Task Key:** STORA-241
- **Type:** Task
- **Summary:** Buat Starter Layout Blocks (1 Col, 2 Col 50/50, 2 Col 30/70, 3 Col, 4 Col)
- **Description:** Buat definisi template struktur kolom siap pakai di `@kubuild/components`.
- **Priority:** High
- **Status:** To Do
- **Dependencies:** STORA-240
- **Acceptance Criteria:**
  - Dragging blok ke kanvas langsung menyisipkan layout kolom siap isi.

### STORA-242
- **Epic:** Block Manager & Pre-composed Templates
- **Task Key:** STORA-242
- **Type:** Task
- **Summary:** Buat Pre-composed UI Blocks (Hero, Feature Card, Media Object, Pricing Table, CTA Banner)
- **Description:** Sediakan blok lengkap siap pakai dengan styling default elegan.
- **Priority:** High
- **Status:** To Do
- **Dependencies:** STORA-241
- **Acceptance Criteria:**
  - Blok dapat di-drag ke kanvas dan langsung ter-render sebagai landing page section yang menarik.

---

# Epic 25 — Asset Manager Modal & Live Code Viewer

### STORA-250
- **Epic:** Asset Manager Modal & Live Code Viewer
- **Task Key:** STORA-250
- **Type:** Story
- **Summary:** Asset Manager Modal Dialog
- **Description:** Buat modal dialog pemilihan aset media terpadu (Galeri lokal `.stora`, Input URL CDN, dan Drag-and-drop upload).
- **Priority:** Medium
- **Status:** To Do
- **Dependencies:** None
- **Acceptance Criteria:**
  - Memilih gambar di modal memperbarui `src` secara instan.

### STORA-251
- **Epic:** Asset Manager Modal & Live Code Viewer
- **Task Key:** STORA-251
- **Type:** Story
- **Summary:** Live Code Viewer Modal (Clean Semantic HTML & CSS)
- **Description:** Tambahkan tombol `< > View Code` di toolbar atas yang membuka modal popup berisi HTML semantik dan CSS terstruktur dengan tombol Copy to Clipboard.
- **Priority:** High
- **Status:** To Do
- **Dependencies:** None
- **Acceptance Criteria:**
  - Modal menampilkan kode HTML & CSS yang bersih dan akurat sesuai status dokumen aktif.

---

# Epic 26 — Motion & Animation Engine (AOS, Hover, Loop)

### STORA-260
- **Epic:** Motion & Animation Engine
- **Task Key:** STORA-260
- **Type:** Task
- **Summary:** Definisikan AnimationConfig Schema di `@kubuild/schema`
- **Description:** Tambahkan field `animation` opsional pada dokumen untuk menyimpan konfigurasi: `type`, `duration`, `delay`, `easing`, `once`, `hoverEffect`, dan `loopEffect`.
- **Priority:** High
- **Status:** To Do
- **Dependencies:** None
- **Acceptance Criteria:**
  - Skema memvalidasi properti animasi dengan default yang aman dan serializable.

### STORA-261
- **Epic:** Motion & Animation Engine
- **Task Key:** STORA-261
- **Type:** Story
- **Summary:** Animation & Motion Sector di Inspector Panel
- **Description:** Buat sektor **Motion / Animation** di panel inspector editor dengan dropdown tipe animasi, slider duration/delay, dan hover/loop segmented buttons.
- **Priority:** High
- **Status:** To Do
- **Dependencies:** STORA-260
- **Acceptance Criteria:**
  - Mengubah tipe animasi atau delay menyimpan nilai ke node yang aktif secara realtime.

### STORA-262
- **Epic:** Motion & Animation Engine
- **Task Key:** STORA-262
- **Type:** Story
- **Summary:** Tombol "Live Replay Animation" di Inspector
- **Description:** Tambahkan tombol **▶️ Play / Replay Animation** di inspector untuk memutar ulang animasi pada elemen terpilih di kanvas.
- **Priority:** Medium
- **Status:** To Do
- **Dependencies:** STORA-261
- **Acceptance Criteria:**
  - Mengklik tombol Play langsung menjalankan ulang animasi elemen di kanvas tanpa reload page.

### STORA-263
- **Epic:** Motion & Animation Engine
- **Task Key:** STORA-263
- **Type:** Story
- **Summary:** Lightweight Scroll Observer Runtime di `@kubuild/renderer`
- **Description:** Implementasikan observer runtime ringan (< 2KB) berbasis `IntersectionObserver` native dan CSS keyframes di `@kubuild/renderer`.
- **Priority:** Highest
- **Status:** To Do
- **Dependencies:** STORA-260
- **Acceptance Criteria:**
  - Elemen dengan konfigurasi animasi otomatis muncul dengan efek animasi saat di-scroll ke layar.

### STORA-264
- **Epic:** Motion & Animation Engine
- **Task Key:** STORA-264
- **Type:** Story
- **Summary:** Hover Micro-Interactions CSS Generator
- **Description:** Compile efek hover (`lift`, `scale`, `glow`, `tilt`) menjadi kelas utility transisi CSS GPU-accelerated yang mulus.
- **Priority:** High
- **Status:** To Do
- **Dependencies:** STORA-260
- **Acceptance Criteria:**
  - Tombol atau kartu dengan hover `lift` naik secara mulus sebesar 4px saat kursor diarahkan ke elemen.

---

# Epic 27 — Standalone HTML & Assets Exporter Engine (`.zip` & Standalone `.html`)

### STORA-270
- **Epic:** Standalone HTML & Assets Exporter Engine
- **Task Key:** STORA-270
- **Type:** Task
- **Summary:** HTML & CSS Static Compiler di `@kubuild/core` / `@kubuild/renderer`
- **Description:** Buat engine compiler yang mengubah `PageDocument` menjadi string HTML semantik lengkap (`<!DOCTYPE html><html>...`) dengan meta tag SEO, OpenGraph, dan stylesheet CSS murni yang menyertakan responsive media queries (`@media (max-width: 768px)` / `480px`) serta keyframes animasi.
- **Priority:** Highest
- **Status:** To Do
- **Dependencies:** None
- **Acceptance Criteria:**
  - Menghasilkan string HTML dan CSS mandiri yang valid dan bebas dari atribut internal builder (`data-kubuild-*`).

### STORA-271
- **Epic:** Standalone HTML & Assets Exporter Engine
- **Task Key:** STORA-271
- **Type:** Task
- **Summary:** Asset Bundling & Zip Packaging Engine
- **Description:** Buat utilitas pengepakan zip yang membungkus: `index.html`, `styles.css`, `script.js` (AOS runtime ringan), dan folder `assets/` berisi seluruh gambar/media lokal yang digunakan di halaman.
- **Priority:** High
- **Status:** To Do
- **Dependencies:** STORA-270
- **Acceptance Criteria:**
  - File ZIP yang di-download dapat langsung di-ekstrak dan dibuka di browser secara offline atau di-upload ke hosting tanpa aset yang hilang.

### STORA-272
- **Epic:** Standalone HTML & Assets Exporter Engine
- **Task Key:** STORA-272
- **Type:** Story
- **Summary:** Single-File Standalone HTML Exporter Mode
- **Description:** Sediakan opsi ekspor ke satu file tunggal `index.html` dengan seluruh CSS dan script di-embed inline (serta gambar di-embed sebagai Base64 atau URL absolut).
- **Priority:** Medium
- **Status:** To Do
- **Dependencies:** STORA-270
- **Acceptance Criteria:**
  - File HTML tunggal dapat didistribusikan langsung via email atau web server sederhana.

### STORA-273
- **Epic:** Standalone HTML & Assets Exporter Engine
- **Task Key:** STORA-273
- **Type:** Story
- **Summary:** Tombol "Export as HTML & Assets (ZIP)" di Editor Toolbar & Menu
- **Description:** Tambahkan tombol aksi di toolbar atas editor dan di modal export untuk mengunduh bundle HTML & Assets ZIP secara instan dengan feedback progress loading.
- **Priority:** High
- **Status:** To Do
- **Dependencies:** STORA-271
- **Acceptance Criteria:**
  - Mengklik tombol "Export as HTML & Assets" memicu kompilasi dan otomatis mendownload file `.zip` siap pakai ke komputer pengguna.

