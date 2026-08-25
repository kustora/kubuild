# PRD — KUBUILD: Figma-Grade Visual Layout & Design Engine

**Product:** KUBUILD  
**Codename:** BUILDER-01  
**Document Type:** Product Requirements Document (PRD Extension)  
**Feature Focus:** Figma-Grade UI/UX Experience, Auto Layout (Flexbox), Visual CSS Grid, Canvas Direct Manipulation & Responsive Cascade  
**Status:** Approved / In Review  

---

## 1. Executive Summary & Vision

### 1.1 Problem Statement
Saat ini, penyusunan layout web builder tradisional sering kali kaku, bergantung pada form input properti satu per satu di sidebar, dan membatasi kreativitas desainer/developer. Pengguna terbiasa dengan kemudahan, kecepatan, dan fluiditas alat desain modern seperti **Figma** (Auto Layout, visual resize, drag spacing, alignment matrix 9 titik, dan smart alignment guides). 

### 1.2 Product Vision
Mentransformasi builder `kubuild` menjadi **Figma-grade web builder engine**, di mana pengguna dapat:
1. Menyusun layout semudah Auto Layout di Figma (Direction, Gap, Hug/Fill/Fixed sizing, Alignment Matrix).
2. Menggunakan **Visual CSS Grid** untuk layout multi-kolom kompleks tanpa menulis CSS manual.
3. Melakukan **Direct Canvas Manipulation** (resize handle 8 titik, on-canvas padding/gap slider, smart alignment guides, pan & zoom kanvas).
4. Mengelola **Responsivitas & Breakpoint Cascade** secara visual tanpa takut merusak layout antar ukuran layar.
5. Menikmati **Figma-grade Design Inspector** (4-corner radius independen, color & gradient stops, multi-shadow, blur/glassmorphism).

---

## 2. User Personas & Core Use Cases

### 2.1 Personas
- **UI/UX Designer:** Terbiasa dengan workflow Figma (Auto-layout, frames, constraints, token). Ingin mendesain landing page dengan interaksi visual yang sama tanpa hambatan teknis.
- **Frontend / Fullstack Developer:** Ingin kontrol presisi atas Flexbox & Grid, CSS units (`px`, `rem`, `%`, `fr`, `auto`), serta struktur DOM yang bersih dan terprediksi.
- **Marketer / Non-technical Creator:** Membutuhkan kemudahan drag-and-drop intuitif, visual snapping, dan template responsif siap pakai.

### 2.2 Core User Stories
- *Sebagai pengguna*, saya ingin memilih container dan mengubah arah layout (Horizontal/Vertical) serta alignment dengan matrix 9 titik seperti di Figma.
- *Sebagai pengguna*, saya ingin mengatur elemen anak menjadi **Hug Contents**, **Fill Container**, atau **Fixed Size** dengan 1 klik.
- *Sebagai pengguna*, saya ingin menarik handle resize langsung di kanvas untuk mengubah ukuran elemen dan melihat snapping garis bantu (Smart Guides).
- *Sebagai pengguna*, saya ingin mengubah padding dan gap langsung dengan menarik handle visual di atas kanvas.
- *Sebagai pengguna*, saya ingin melihat inheritance style responsif (Desktop → Tablet → Mobile) dengan indikator warna yang jelas mana yang merupakan override.
- *Sebagai pengguna*, saya ingin menyeleksi beberapa elemen (`Shift+Click` / marquee box) lalu membungkusnya menjadi Auto Layout Frame dengan shortcut `Cmd+G`.

---

## 3. Core Architectural Pillars

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          KUBUILD FIGMA-GRADE STACK                          │
├─────────────────────────────────────────────────────────────────────────────┤
│ 1. AUTO LAYOUT & GRID ENGINE                                                │
│    Flexbox matrix, Hug/Fill/Fixed constraints, 12-col visual CSS grid       │
├─────────────────────────────────────────────────────────────────────────────┤
│ 2. DIRECT CANVAS MANIPULATION                                               │
│    8-point transform handles, on-canvas spacing sliders, smart snap guides  │
├─────────────────────────────────────────────────────────────────────────────┤
│ 3. RESPONSIVE CASCADE & FLUID BREAKPOINTS                                   │
│    Visual style inheritance, draggable viewport frame, override resets      │
├─────────────────────────────────────────────────────────────────────────────┤
│ 4. FIGMA-GRADE DESIGN INSPECTOR                                             │
│    4-corner independent radius, gradient stops, shadow/blur glassmorphism   │
├─────────────────────────────────────────────────────────────────────────────┤
│ 5. CANVAS NAVIGATION & SELECTION                                            │
│    Pan & Zoom (Space+Drag, Cmd+Wheel), Marquee multi-select, Group (Cmd+G)  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Functional Requirements

### 4.1 Module 1: Layout Engine — Auto Layout (Flexbox) & Visual CSS Grid

#### 4.1.1 Auto Layout (Flexbox)
- **Direction:** Row (Horizontal), Column (Vertical), Row-Reverse, Column-Reverse.
- **Wrap Mode:** No-Wrap, Wrap, Wrap-Reverse.
- **Alignment Matrix (9-Box Grid):**
  - Horizontal & Vertical alignment visual controller (Top-Left, Top-Center, Top-Right, Center-Left, Center, Center-Right, Bottom-Left, Bottom-Center, Bottom-Right).
  - Justify-content options: `flex-start`, `center`, `flex-end`, `space-between`, `space-around`, `space-evenly`.
  - Align-items options: `flex-start`, `center`, `flex-end`, `stretch`, `baseline`.
- **Gap & Spacing:**
  - Gap terpadu atau terpisah (`rowGap`, `columnGap`).
  - Unit support: `px`, `rem`, `%`, `em`.
- **Sizing Constraints (Child Sizing Modes):**
  - **Hug Contents:** Lebar/tinggi otomatis menyesuaikan konten anak (`width: auto`, `flex: 0 0 auto` atau `fit-content`).
  - **Fill Container:** Melebar/memanjang mengisi sisa ruang container induk (`flex: 1 1 0%` / `width: 100%`).
  - **Fixed:** Ukuran pasti dalam nilai eksplisit (contoh: `320px`, `50vw`).

#### 4.1.2 Visual CSS Grid
- **Container Level:**
  - Visual column builder (preset 2, 3, 4, 6, 12 kolom atau custom fr tracks `1fr 2fr 1fr`).
  - Auto-fit / Auto-fill responsive grid (`repeat(auto-fit, minmax(240px, 1fr))`).
  - Grid gaps (`gap`, `rowGap`, `columnGap`).
- **Item Level:**
  - Column Span (`colSpan`: 1 sampai 12).
  - Row Span (`rowSpan`: 1 sampai 6).
  - Visual drag-to-span pada grid overlay di kanvas.

---

### 4.2 Module 2: Direct Canvas Manipulation (On-Canvas UX)

#### 4.2.1 8-Point Visual Transform & Resize Handles
- Ketika sebuah elemen dipilih, bounding box menampilkan 8 handle interaktif (4 sudut + 4 tepi tengah).
- Drag handle tepi kiri/kanan mengubah `width` (atau `maxWidth`).
- Drag handle tepi atas/bawah mengubah `height` (atau `minHeight`).
- Drag handle sudut dengan `Shift` mempertahankan rasio aspek (aspect ratio locked).
- Tooltip realtime menampilkan dimensi piksel aktual saat dragging (`W: 420px  H: 240px`).

#### 4.2.2 On-Canvas Spacing & Gap Sliders
- Indikator padding visual (warna ungu/pink transparan di dalam container) yang memiliki handle drag di ke-4 sisi untuk mengubah padding secara langsung.
- Indikator gap visual antar elemen Flex/Grid dengan handle slider langsung di celah elemen.

#### 4.2.3 Smart Guides & Snapping
- Saat melakukan drag/reorder atau resize elemen, garis panduan warna cyan/magenta muncul secara otomatis ketika:
  - Tepi kiri, tengah, atau kanan sejajar dengan elemen lain atau container induk.
  - Tepi atas, tengah, atau bawah sejajar dengan elemen lain atau container induk.
- Snapping threshold: 5px dengan haptic/visual snap feedback.

#### 4.2.4 Distance Meter (Hold Alt/Option)
- Saat elemen aktif dipilih dan pengguna menekan tombol `Alt` / `Option` sambil mengarahkan kursor ke elemen lain:
  - Tampilkan garis ukur berlabel angka piksel jarak antar batas bounding box kedua elemen.

#### 4.2.5 Canvas Pan & Zoom Engine
- **Pan Tool:** Tahan `Space` + klik & drag kursor, atau middle-click drag untuk menggeser kanvas bebas.
- **Zoom Tool:** `Cmd / Ctrl + Mouse Wheel` atau tombol zoom level (`50%`, `75%`, `100%`, `125%`, `150%`, `Fit to Screen`).
- Navigasi kanvas tetap smooth 60 FPS menggunakan CSS transform GPU-accelerated.

---

### 4.3 Module 3: Responsive Cascade & Fluid Breakpoint Engine

#### 4.3.1 Breakpoint Cascade Rules
- Urutan warisan: `base` (Desktop) → `tablet` (≤ 768px) → `mobile` (≤ 480px).
- Setiap perubahan properti di breakpoint turunan hanya menyimpan override differensial (tidak menduplikasi seluruh object style).

#### 4.3.2 Visual Inheritance & Reset Indicators
- Di Inspector Panel:
  - Properti yang diwariskan dari `base` ditampilkan dengan warna teks netral + placeholder nilai warisannya.
  - Properti yang memiliki nilai override di breakpoint aktif ditandai dengan dot indikator warna biru/oranye.
  - Tombol aksi *"Reset to Inherited"* untuk menghapus override secara instan.

#### 4.3.3 Draggable Fluid Viewport Frame
- Handle di sisi kanan frame kanvas yang dapat ditarik bebas untuk mengetes responsivitas fluid pada ukuran piksel kustom (misal: 320px hingga 1920px).

---

### 4.4 Module 4: Figma-Grade Visual Design Inspector

#### 4.4.1 Typography Matrix
- Font Family selector (Google Fonts / System Fonts).
- Font Weight (100–900 / Thin to Black).
- Font Size & Line Height (dengan unit switch: `px`, `rem`, `%`, `em`).
- Letter Spacing & Text Transform (Uppercase, Lowercase, Capitalize, Normal).
- Text Alignment (Left, Center, Right, Justify).

#### 4.4.2 Independent 4-Corner Radius
- Single radius input dengan tombol ekspansi ke 4 sudut independen:
  `[Top-Left, Top-Right, Bottom-Right, Bottom-Left]`.

#### 4.4.3 Fills, Gradients & Strokes
- Solid Color Picker dengan dukungan opacity/alpha slider dan input HEX/RGBA/HSL.
- Gradient Editor: Linear Gradient (derajat arah angle picker) & Radial Gradient dengan multiple color stops yang dapat digeser.
- Stroke/Border: Width independen per sisi (Top, Right, Bottom, Left), Style (Solid, Dashed, Dotted), dan Border Color.

#### 4.4.4 Effects (Shadows & Blurs)
- Drop Shadow & Inner Shadow (X offset, Y offset, Blur, Spread, Color, Inset toggle).
- Layer Blur & Backdrop Blur (Glassmorphism effect).

---

### 4.5 Module 5: Selection, Grouping & Keyboard Shortcuts

- **Multi-Selection:** `Shift + Click` pada kanvas atau Layers tree, atau drag box marquee selection di kanvas.
- **Group into Auto Layout Frame:** Shortcut `Cmd+G` / `Ctrl+G` membungkus elemen terpilih ke dalam container `flex` baru.
- **Ungroup:** Shortcut `Cmd+Shift+G` / `Ctrl+Shift+G` mengeluarkan elemen anak dan menghapus container pembungkusnya.
- **Duplicate:** Shortcut `Cmd+D` menduplikasi elemen aktif dengan posisi cerdas.
- **Nudge:** Tombol panah (`Arrow Keys`) menggeser/mengatur urutan; `Shift + Arrow` menggeser dengan increment 10px.

---

## 5. Non-Functional Requirements & Invariants

1. **Pure TypeScript Core:** Seluruh komputasi style resolver, tree mutation, dan bounding box layout calculation di `@kubuild/core` dan `@kubuild/schema` harus tetap bebas dari dependensi DOM/React.
2. **Deterministic & Portable Schema:** Penambahan fitur Auto Layout dan Grid disimpan murni sebagai CSS-compatible properties di dalam `PageDocument` JSON. File `.stora` tetap backward-compatible.
3. **Performance (60 FPS):** Interaksi drag resize, pan/zoom, dan hover distance meter tidak boleh memicu re-render seluruh React tree dokumen; overlay kanvas harus memanfaatkan GPU render layers (`transform`, `will-change`).
4. **Clean DOM Output:** Renderer tidak boleh menghasilkan wrapper div berlebih atau tag sampah; output HTML/CSS yang dihasilkan harus semantik dan optimal untuk SEO & Web Vitals.

---

## 6. Success Metrics & Validation

- **Design Speed:** Waktu yang dibutuhkan untuk membuat layout landing page responsif 3-kolom berkurang > 60% dibanding sistem form lama.
- **Figma Familiarity Score:** Pengguna yang terbiasa dengan Figma dapat langsung menggunakan Auto Layout dan Resize Handles tanpa memerlukan tutorial ekstensif.
- **Zero Schema Breaking:** Dokumen template `.stora` versi lama tetap dapat dibuka dan termigrasi dengan sukses ke skema baru tanpa kehilangan styling.
