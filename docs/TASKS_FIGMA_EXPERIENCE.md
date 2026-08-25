# KUBUILD — Tasks & Jira Epics: Figma-Grade Layout & Design Engine

**Product:** KUBUILD  
**Codename:** BUILDER-01  
**Document Type:** Sprint & Backlog Tasks (Jira Format)  
**Feature Focus:** Auto Layout (Flexbox), Visual CSS Grid, Canvas Direct Manipulation, Responsive Cascade & Figma Inspector  
**Key Convention:** `STORA-1XX`  
**Status:** Ready for Sprint Planning  

---

## Ringkasan Epic & Alokasi Package

| Epic Key | Epic Name | Package Target | Jumlah Task |
| :--- | :--- | :--- | :--- |
| **EPIC-10** | Auto Layout (Flexbox) & Sizing Modes | `@kubuild/schema`, `@kubuild/components`, `@kubuild/editor` | 6 Tasks |
| **EPIC-11** | Visual CSS Grid Engine | `@kubuild/components`, `@kubuild/editor`, `@kubuild/renderer` | 5 Tasks |
| **EPIC-12** | Direct Canvas Manipulation (Handles, Spacing, Guides) | `@kubuild/editor` | 6 Tasks |
| **EPIC-13** | Canvas Navigation, Pan/Zoom & Multi-Select | `@kubuild/editor` | 4 Tasks |
| **EPIC-14** | Responsive Cascade & Fluid Breakpoint Experience | `@kubuild/editor`, `@kubuild/renderer` | 4 Tasks |
| **EPIC-15** | Figma-Grade Design Inspector & Effects | `@kubuild/editor`, `@kubuild/schema` | 5 Tasks |

---

# Epic 10 — Auto Layout (Flexbox) & Sizing Modes

### STORA-101
- **Epic:** Auto Layout (Flexbox) & Sizing Modes
- **Task Key:** STORA-101
- **Type:** Task
- **Summary:** Perluas schema StyleDefinition untuk Flexbox & Sizing constraints
- **Description:** Tambahkan validasi dan type definition untuk properti Flexbox (`flexDirection`, `flexWrap`, `justifyContent`, `alignItems`, `alignContent`, `gap`, `rowGap`, `columnGap`, `flexGrow`, `flexShrink`, `flexBasis`, `alignSelf`) dan sizing mode (`width`, `height`, `minWidth`, `maxWidth`, `minHeight`, `maxHeight`, `fit-content`, `100%`) di `@kubuild/schema`.
- **Priority:** Highest
- **Status:** To Do
- **Dependencies:** None
- **Acceptance Criteria:**
  - `StyleDefinitionSchema` memvalidasi semua properti flex & gap tanpa melempar error sanitasi.
  - Unit test schema memverifikasi parsing kombinasi nilai flexbox dan validasi nilai aman.

### STORA-102
- **Epic:** Auto Layout (Flexbox) & Sizing Modes
- **Task Key:** STORA-102
- **Type:** Task
- **Summary:** Buat definisi komponen `flex` (Frame) di Component Registry
- **Description:** Buat `flexDefinition` di `@kubuild/components` sebagai container Auto Layout generik yang mendukung child apapun, dengan default styles `display: flex`, `flexDirection: column`, `gap: 16px`, dan kategori `layout`.
- **Priority:** Highest
- **Status:** To Do
- **Dependencies:** STORA-101
- **Acceptance Criteria:**
  - Komponen `flex` terdaftar di `createDefaultComponentRegistry()`.
  - Mendukung nesting child fleksibel dan memiliki icon Auto Layout di editor sidebar.

### STORA-103
- **Epic:** Auto Layout (Flexbox) & Sizing Modes
- **Task Key:** STORA-103
- **Type:** Story
- **Summary:** Buat Auto Layout Inspector Panel dengan 9-Point Alignment Matrix
- **Description:** Rancang kontrol visual di Inspector Panel editor untuk:
  - Direction toggle (Horizontal Row vs Vertical Column vs Wrap).
  - 9-point visual alignment matrix (Top-Left, Center, Space-Between, Bottom-Right, dll.).
  - Gap slider dan input angka dengan unit switch (`px`, `rem`).
- **Priority:** High
- **Status:** To Do
- **Dependencies:** STORA-102
- **Acceptance Criteria:**
  - Mengubah alignment di matrix 9 titik secara instan memperbarui `justifyContent` dan `alignItems` pada node terpilih.
  - Tombol toggle arah flex mengubah `flexDirection` dengan feedback UI aktif.

### STORA-104
- **Epic:** Auto Layout (Flexbox) & Sizing Modes
- **Task Key:** STORA-104
- **Type:** Story
- **Summary:** Implementasikan Child Sizing Mode Control (Hug, Fill, Fixed)
- **Description:** Tambahkan dropdown / segmented button pada child elemen di dalam Flex container untuk mengatur:
  - **Hug Contents:** `width: auto` / `flex: 0 0 auto`.
  - **Fill Container:** `width: 100%` / `flex: 1 1 0%`.
  - **Fixed:** `width: X px`.
- **Priority:** High
- **Status:** To Do
- **Dependencies:** STORA-103
- **Acceptance Criteria:**
  - Memilih "Fill Container" membuat elemen anak meregang memenuhi ruang kosong parent flex.
  - Memilih "Hug Contents" menciutkan ukuran elemen sesuai isi anaknya.

### STORA-105
- **Epic:** Auto Layout (Flexbox) & Sizing Modes
- **Task Key:** STORA-105
- **Type:** Story
- **Summary:** Command & Shortcut Wrap into Auto Layout Frame (`Cmd+G`)
- **Description:** Buat command di `@kubuild/core` dan shortcut keyboard di editor (`Cmd+G` / `Ctrl+G`) untuk membungkus node yang dipilih ke dalam container `flex` baru secara otomatis.
- **Priority:** Medium
- **Status:** To Do
- **Dependencies:** STORA-102
- **Acceptance Criteria:**
  - Menekan `Cmd+G` saat elemen dipilih membuat parent `flex` baru dan memindahkan elemen ke dalamnya tanpa merusak posisi.
  - Undo (`Cmd+Z`) mengembalikan struktur pohon ke semula secara presisi.

### STORA-106
- **Epic:** Auto Layout (Flexbox) & Sizing Modes
- **Task Key:** STORA-106
- **Type:** Story
- **Summary:** Command & Shortcut Ungroup Auto Layout Frame (`Cmd+Shift+G`)
- **Description:** Buat command untuk membongkar container `flex` terpilih, memindahkan seluruh children ke parent di atasnya, dan menghapus container tersebut.
- **Priority:** Medium
- **Status:** To Do
- **Dependencies:** STORA-105
- **Acceptance Criteria:**
  - Menekan `Cmd+Shift+G` mengeluarkan seluruh elemen anak ke level parent dan menghapus frame pembungkus.

---

# Epic 11 — Visual CSS Grid Engine

### STORA-110
- **Epic:** Visual CSS Grid Engine
- **Task Key:** STORA-110
- **Type:** Task
- **Summary:** Perluas schema StyleDefinition untuk CSS Grid & Grid Child Item
- **Description:** Tambahkan properti CSS Grid (`gridTemplateColumns`, `gridTemplateRows`, `gridAutoFlow`, `gridColumn`, `gridRow`, `gridColumnStart`, `gridColumnEnd`, `gridRowStart`, `gridRowEnd`, `colSpan`, `rowSpan`) ke skema style.
- **Priority:** High
- **Status:** To Do
- **Dependencies:** STORA-101
- **Acceptance Criteria:**
  - Schema mengizinkan ekspresi CSS Grid standar (`repeat(12, 1fr)`, `minmax(200px, 1fr)`, dll.).

### STORA-111
- **Epic:** Visual CSS Grid Engine
- **Task Key:** STORA-111
- **Type:** Task
- **Summary:** Buat definisi komponen `grid` di Component Registry
- **Description:** Buat `gridDefinition` di `@kubuild/components` dengan default 3 kolom (`repeat(3, minmax(0, 1fr))`), gap `16px`, dan dukungan konfigurasi responsif.
- **Priority:** High
- **Status:** To Do
- **Dependencies:** STORA-110
- **Acceptance Criteria:**
  - Komponen `grid` terdaftar dan dapat menerima komponen anak apapun.

### STORA-112
- **Epic:** Visual CSS Grid Engine
- **Task Key:** STORA-112
- **Type:** Story
- **Summary:** Visual Grid Track Builder di Inspector Panel
- **Description:** Sediakan UI visual untuk menambah/mengurangi jumlah kolom (1-12 kolom), mengubah ukuran track per kolom (`1fr`, `2fr`, `auto`, `px`), dan mengatur row/col gap.
- **Priority:** High
- **Status:** To Do
- **Dependencies:** STORA-111
- **Acceptance Criteria:**
  - User dapat mengklik tombol slider kolom untuk mengubah layout dari 2 kolom ke 3, 4, atau 12 kolom secara langsung.

### STORA-113
- **Epic:** Visual CSS Grid Engine
- **Task Key:** STORA-113
- **Type:** Story
- **Summary:** Child Column Span & Row Span Controls
- **Description:** Ketika elemen di dalam Grid dipilih, Inspector menampilkan kontrol `Column Span` (1 s/d jumlah kolom maksimum) dan `Row Span`.
- **Priority:** Medium
- **Status:** To Do
- **Dependencies:** STORA-112
- **Acceptance Criteria:**
  - Mengubah `colSpan: 2` membuat elemen membentang selebar 2 kolom grid.

### STORA-114
- **Epic:** Visual CSS Grid Engine
- **Task Key:** STORA-114
- **Type:** Story
- **Summary:** Overlay Garis Panduan Grid Visual di Kanvas
- **Description:** Saat container Grid dipilih, tampilkan garis putus-putus overlay penanda track kolom dan baris di atas kanvas editor.
- **Priority:** Medium
- **Status:** To Do
- **Dependencies:** STORA-112
- **Acceptance Criteria:**
  - Overlay grid muncul secara akurat sesuai posisi dan gap kolom aktual.

---

# Epic 12 — Direct Canvas Manipulation (Handles, Spacing, Guides)

### STORA-120
- **Epic:** Direct Canvas Manipulation
- **Task Key:** STORA-120
- **Type:** Story
- **Summary:** Implementasikan 8-Point Visual Resize Handles di Bounding Box
- **Description:** Tambahkan 8 handle interaktif (4 sudut dan 4 sisi) pada bounding box elemen yang sedang aktif di kanvas editor. Saat ditarik (dragged), hitung perubahan ukuran piksel dan commit ke style `width` / `height`.
- **Priority:** Highest
- **Status:** To Do
- **Dependencies:** None
- **Acceptance Criteria:**
  - Dragging handle kanan/kiri mengubah lebar elemen secara realtime.
  - Dragging handle atas/bawah mengubah tinggi elemen.
  - Menahan tombol `Shift` saat drag sudut mempertahankan rasio aspek.
  - Tooltip ukuran (`W: 300px H: 200px`) tampil selama dragging.

### STORA-121
- **Epic:** Direct Canvas Manipulation
- **Task Key:** STORA-121
- **Type:** Story
- **Summary:** Interactive On-Canvas Padding Drag Sliders
- **Description:** Render zona padding semi-transparan (warna pink/ungu) di dalam bounding box elemen yang dipilih. Pengguna dapat menarik handle tepi padding untuk menambah/mengurangi padding secara visual.
- **Priority:** High
- **Status:** To Do
- **Dependencies:** STORA-120
- **Acceptance Criteria:**
  - Menarik handle padding atas menambah `paddingTop` secara langsung dan memperbarui style.
  - Menahan `Option`/`Alt` saat drag mengubah kedua sisi berlawanan secara simetris (kiri-kanan / atas-bawah).

### STORA-122
- **Epic:** Direct Canvas Manipulation
- **Task Key:** STORA-122
- **Type:** Story
- **Summary:** Interactive On-Canvas Gap Drag Slider
- **Description:** Untuk container Auto Layout dan Grid, tampilkan handle slider kecil di celah antara elemen-elemen anak untuk mengatur `gap` langsung di kanvas.
- **Priority:** Medium
- **Status:** To Do
- **Dependencies:** STORA-103
- **Acceptance Criteria:**
  - Menarik handle celah memperbarui nilai `gap` secara halus pada container parent.

### STORA-123
- **Epic:** Direct Canvas Manipulation
- **Task Key:** STORA-123
- **Type:** Story
- **Summary:** Smart Alignment Guides & Snapping Engine
- **Description:** Implementasikan engine kalkulasi bounding box untuk menampilkan garis panduan alignment (warna magenta/cyan) saat tepi atau titik tengah elemen sejajar dengan sibling atau parent terdekat.
- **Priority:** High
- **Status:** To Do
- **Dependencies:** STORA-120
- **Acceptance Criteria:**
  - Garis snapping muncul saat tepi elemen berjarak ≤ 5px dari tepi elemen tetangga.
  - Pergerakan drag menempel (snap) ke garis panduan tersebut.

### STORA-124
- **Epic:** Direct Canvas Manipulation
- **Task Key:** STORA-124
- **Type:** Story
- **Summary:** Distance Meter saat Menahan Tombol `Alt`/`Option`
- **Description:** Ketika elemen dipilih dan pengguna menekan `Alt` lalu mengarahkan kursor ke elemen lain, tampilkan garis ukur piksel berlabel jarak horizontal dan vertikal antar elemen.
- **Priority:** Medium
- **Status:** To Do
- **Dependencies:** STORA-120
- **Acceptance Criteria:**
  - Garis ukur jarak dan badge angka piksel tampil presisi mirip perilaku Figma.

### STORA-125
- **Epic:** Direct Canvas Manipulation
- **Task Key:** STORA-125
- **Type:** Task
- **Summary:** Optimasi Performa Canvas Drag Overlay (60 FPS)
- **Description:** Pastikan seluruh kalkulasi drag handle, guide snapping, dan distance meter menggunakan `requestAnimationFrame` dan CSS transform layer untuk mencegah re-render DOM yang berat.
- **Priority:** High
- **Status:** To Do
- **Dependencies:** STORA-120, STORA-123
- **Acceptance Criteria:**
  - Dragging resize dan padding berjalan mulus tanpa lag (frame rate ≥ 55 FPS).

---

# Epic 13 — Canvas Navigation, Pan/Zoom & Multi-Select

### STORA-130
- **Epic:** Canvas Navigation, Pan/Zoom & Multi-Select
- **Task Key:** STORA-130
- **Type:** Story
- **Summary:** Fitur Pan Canvas Bebas (`Space + Drag` / Middle Click)
- **Description:** Buat kanvas editor dapat digeser bebas ke segala arah saat menahan tombol `Space` dan melakukan klik-drag, atau dengan mengklik-drag tombol tengah mouse.
- **Priority:** High
- **Status:** To Do
- **Dependencies:** None
- **Acceptance Criteria:**
  - Kursor berubah menjadi ikon tangan (`grab`/`grabbing`) saat `Space` ditekan.
  - Kanvas bergerak halus mengikuti pergerakan pointer.

### STORA-131
- **Epic:** Canvas Navigation, Pan/Zoom & Multi-Select
- **Task Key:** STORA-131
- **Type:** Story
- **Summary:** Fitur Zoom Canvas Bebas (`Cmd + Wheel` & Presets)
- **Description:** Implementasikan zoom in/out kanvas dari 25% hingga 200% menggunakan roda mouse (`Cmd + Wheel`) dan tombol preset zoom di toolbar (`Fit to Screen`, `100%`, `50%`, dll.).
- **Priority:** High
- **Status:** To Do
- **Dependencies:** STORA-130
- **Acceptance Criteria:**
  - Zoom berpusat pada posisi kursor mouse pengguna.
  - Bounding box dan selection overlay tetap terhitung presisi pada level zoom berapapun.

### STORA-132
- **Epic:** Canvas Navigation, Pan/Zoom & Multi-Select
- **Task Key:** STORA-132
- **Type:** Story
- **Summary:** Multi-Selection via `Shift + Click`
- **Description:** Perbarui store editor untuk mendukung seleksi banyak node (`selectedNodeIds: string[]`). Pengguna dapat menahan `Shift` untuk menambah/mengurangi node yang dipilih.
- **Priority:** Medium
- **Status:** To Do
- **Dependencies:** None
- **Acceptance Criteria:**
  - Bounding box gabungan membungkus semua elemen terpilih.
  - Aksi delete (`Backspace`) atau duplicate (`Cmd+D`) mengeksekusi semua elemen terpilih sekaligus.

### STORA-133
- **Epic:** Canvas Navigation, Pan/Zoom & Multi-Select
- **Task Key:** STORA-133
- **Type:** Story
- **Summary:** Marquee Drag Selection Box di Kanvas
- **Description:** Klik dan drag di area kosong kanvas membuat kotak seleksi persegi panjang (marquee box) yang otomatis menyeleksi seluruh elemen yang bersentuhan.
- **Priority:** Low
- **Status:** To Do
- **Dependencies:** STORA-132
- **Acceptance Criteria:**
  - Seluruh node yang bersinggungan dengan kotak seleksi otomatis masuk ke status terpilih.

---

# Epic 14 — Responsive Cascade & Fluid Breakpoint Experience

### STORA-140
- **Epic:** Responsive Cascade & Fluid Breakpoint Experience
- **Task Key:** STORA-140
- **Type:** Story
- **Summary:** Indikator Visual Style Inheritance di Inspector Panel
- **Description:** Bedakan tampilan properti di Inspector berdasarkan status warisannya:
  - Nilai turunan dari `base` (desktop) berlabel abu-abu dengan watermark nilai asli.
  - Nilai yang telah dioverride di breakpoint aktif (misal `mobile`) diberi titik biru/oranye tebal.
- **Priority:** High
- **Status:** To Do
- **Dependencies:** None
- **Acceptance Criteria:**
  - User dapat mengetahui dengan sekali pandang apakah suatu nilai padding/font adalah warisan atau override lokal.

### STORA-141
- **Epic:** Responsive Cascade & Fluid Breakpoint Experience
- **Task Key:** STORA-141
- **Type:** Story
- **Summary:** Aksi "Reset to Inherited" pada Properti Style
- **Description:** Tambahkan tombol klik kanan atau ikon reset kecil di samping properti yang dioverride untuk menghapus override pada breakpoint aktif dan mengembalikannya ke nilai warisan.
- **Priority:** Medium
- **Status:** To Do
- **Dependencies:** STORA-140
- **Acceptance Criteria:**
  - Mengklik reset menghapus key tersebut dari layer breakpoint aktif dan menerapkan ulang nilai dari parent layer.

### STORA-142
- **Epic:** Responsive Cascade & Fluid Breakpoint Experience
- **Task Key:** STORA-142
- **Type:** Story
- **Summary:** Interactive Fluid Viewport Width Resizer Handle
- **Description:** Tambahkan pegangan drag vertikal di tepi kanan frame preview kanvas, memungkinkan pengguna menarik frame untuk melihat layout pada berbagai lebar piksel spesifik (320px – 1440px).
- **Priority:** Medium
- **Status:** To Do
- **Dependencies:** None
- **Acceptance Criteria:**
  - Dragging pegangan mengubah lebar frame kanvas secara mulus dan menampilkan badge piksel aktual (misal `768px - Tablet`).

### STORA-143
- **Epic:** Responsive Cascade & Fluid Breakpoint Experience
- **Task Key:** STORA-143
- **Type:** Story
- **Summary:** Side-by-Side Multi-Device Preview Mode
- **Description:** Sediakan mode tampilan kanvas di mana frame Desktop, Tablet, dan Mobile ditampilkan berdampingan secara bersamaan mirip frame di Figma.
- **Priority:** Low
- **Status:** To Do
- **Dependencies:** STORA-131
- **Acceptance Criteria:**
  - Pengguna dapat melihat ketiga ukuran layar secara simultan saat melakukan navigasi kanvas.

---

# Epic 15 — Figma-Grade Design Inspector & Effects

### STORA-150
- **Epic:** Figma-Grade Design Inspector & Effects
- **Task Key:** STORA-150
- **Type:** Story
- **Summary:** Independent 4-Corner Border Radius Control
- **Description:** Buat kontrol border radius di Inspector dengan tombol ekspansi 4 sudut (`borderTopLeftRadius`, `borderTopRightRadius`, `borderBottomRightRadius`, `borderBottomLeftRadius`).
- **Priority:** High
- **Status:** To Do
- **Dependencies:** None
- **Acceptance Criteria:**
  - Input tunggal mengubah ke-4 sudut sekaligus; saat tombol 4-sudut diaktifkan, masing-masing sudut dapat diatur terpisah.

### STORA-151
- **Epic:** Figma-Grade Design Inspector & Effects
- **Task Key:** STORA-151
- **Type:** Story
- **Summary:** Advanced Color & Gradient Picker Component
- **Description:** Buat kontrol color picker canggih dengan slider Alpha/Opacity, input HEX/RGBA/HSL, dan Linear/Radial Gradient editor dengan color stops yang dapat digeser dan diubah warnanya.
- **Priority:** High
- **Status:** To Do
- **Dependencies:** None
- **Acceptance Criteria:**
  - Menghasilkan string CSS gradient valid (misal `linear-gradient(135deg, #2563eb 0%, #9333ea 100%)`) yang ter-render sempurna di preview.

### STORA-152
- **Epic:** Figma-Grade Design Inspector & Effects
- **Task Key:** STORA-152
- **Type:** Story
- **Summary:** Shadows & Blur Effects Inspector (Drop Shadow & Glassmorphism)
- **Description:** Tambahkan kontrol efek di Inspector untuk mengatur:
  - Drop Shadow & Inner Shadow (X, Y, Blur, Spread, Color, Inset).
  - Backdrop Blur / Background Filter (untuk efek glassmorphism modern).
- **Priority:** Medium
- **Status:** To Do
- **Dependencies:** None
- **Acceptance Criteria:**
  - Efek shadow dan backdrop blur langsung terlihat di kanvas preview dan diekspor ke format `.stora`.

### STORA-153
- **Epic:** Figma-Grade Design Inspector & Effects
- **Task Key:** STORA-153
- **Type:** Story
- **Summary:** Advanced Typography Control Matrix
- **Description:** Sediakan kontrol tipografi lengkap: font family selector, weight selector (100–900), line-height, letter-spacing, text-transform (uppercase/lowercase), dan text-align.
- **Priority:** High
- **Status:** To Do
- **Dependencies:** None
- **Acceptance Criteria:**
  - Seluruh properti tipografi tersimpan di skema style dan ter-render konsisten di semua viewport.

### STORA-154
- **Epic:** Figma-Grade Design Inspector & Effects
- **Task Key:** STORA-154
- **Type:** Story
- **Summary:** Global Design Tokens (Color & Typography Styles)
- **Description:** Izinkan pengguna menyimpan swatch warna dan gaya tipografi ke dalam daftar Style Reusable di level dokumen, dan mengaitkannya ke berbagai elemen di halaman.
- **Priority:** Medium
- **Status:** To Do
- **Dependencies:** STORA-151, STORA-153
- **Acceptance Criteria:**
  - Mengubah warna pada token global otomatis memperbarui semua elemen yang terikat pada token tersebut.
