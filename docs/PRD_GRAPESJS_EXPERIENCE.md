# PRD — KUBUILD: Core Semantic HTML Elements & GrapesJS-Inspired Modular Engine

**Product:** KUBUILD  
**Codename:** BUILDER-01  
**Document Type:** Product Requirements Document (PRD Extension)  
**Feature Focus:** Core Semantic HTML Elements (Table, List, Blockquote, Divider, Form, Video), Sector-based Style Manager, Visual Box Model, Trait Manager, State Selector (:hover), Canvas Badges & Motion Engine  
**Status:** Approved / In Review  

---

## 1. Executive Summary & Vision

### 1.1 Problem Statement
KUBUILD memiliki fondasi yang baik tetapi masih kekurangan **elemen tag HTML semantik dasar**:
- Belum ada komponen `list` (`ul`, `ol`, `li`) untuk checklist fitur atau bullet points.
- Belum ada komponen `table` (`table`, `thead`, `tbody`, `tr`, `th`, `td`) untuk tabel perbandingan harga / data spesifikasi.
- Belum ada elemen semantik seperti `blockquote`, `link`, `badge`, `divider` (`hr`), `spacer`, `video`, dan form controls.
- Struktur panel inspector masih belum modular dan belum mendukung visual box model, traits HTML, hover state, serta motion animation.

### 1.2 Product Vision
Membangun fondasi **Core Semantic HTML Elements** yang lengkap, dipadukan dengan arsitektur **GrapesJS** (Style Sectors, Visual Box Model, Trait Manager, State Selector) dan **Motion & Animation Engine Modern** (AOS & Micro-interactions) di atas dokumen React AST dan format `.stora`.

---

## 2. Core Modules Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          KUBUILD COMPREHENSIVE STACK                        │
├─────────────────────────────────────────────────────────────────────────────┤
│ 1. CORE SEMANTIC HTML COMPONENTS LIBRARY                                    │
│    - List & List Items (ul, ol, li)                                         │
│    - Table System (table, thead, tbody, tr, th, td, colSpan, rowSpan)       │
│    - Typography & Semantic (paragraph, link, blockquote, badge, code)       │
│    - Dividers & Media (divider/hr, spacer, video, icon, html-embed)         │
│    - Form Controls (form, input, textarea, select, checkbox, radio)         │
├─────────────────────────────────────────────────────────────────────────────┤
│ 2. SECTOR-BASED STYLE MANAGER & VISUAL BOX MODEL                            │
│    - Interactive Margin/Padding Box Model diagram                           │
│    - Accordion Sectors: Dimension, Typography, Decorations, Flex/Grid       │
├─────────────────────────────────────────────────────────────────────────────┤
│ 3. TRAIT MANAGER (HTML ATTRIBUTES & METADATA)                               │
│    - href, target, alt, title, placeholder, aria-labels, custom ID/Class    │
├─────────────────────────────────────────────────────────────────────────────┤
│ 4. STATE & PSEUDO-CLASS SELECTOR (:hover, :active, :focus)                  │
│    - Live hover preview & state style compilation                           │
├─────────────────────────────────────────────────────────────────────────────┤
│ 5. CANVAS NAVIGATION & QUICK ACTION BADGES                                  │
│    - Select Parent (⬆️), Move, Duplicate, Delete, Hierarchy Breadcrumbs      │
├─────────────────────────────────────────────────────────────────────────────┤
│ 6. MOTION & ANIMATION ENGINE                                                │
│    - Animate On Scroll (AOS), Hover Micro-interactions, Ambient Loops       │
├─────────────────────────────────────────────────────────────────────────────┤
│ 7. BLOCK MANAGER, ASSET MANAGER & LIVE CODE VIEWER                          │
│    - Starter Layout Blocks, Media Picker Modal, Semantic HTML/CSS Exporter  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Detailed Functional Requirements

### 3.1 Module 1: Core Semantic HTML Components Library

#### 3.1.1 List System (`list` & `list-item`)
- **`list`:**
  - Tag: `<ul>` (Unordered) atau `<ol>` (Ordered).
  - Props: `ordered` (boolean), `listStyleType` (`disc`, `circle`, `square`, `decimal`, `none`, `custom-icon`).
  - Allowed children: `list-item`.
- **`list-item`:**
  - Tag: `<li>`.
  - Props: `text` (string) atau menerima child komponen lain (Heading, Text, Icon, Button).

#### 3.1.2 Table System (`table`, `table-row`, `table-cell`)
- **`table`:**
  - Tag: `<table>`.
  - Props: `striped` (boolean), `bordered` (boolean), `compact` (boolean).
  - Allowed children: `table-row` (atau `thead`/`tbody` virtual).
- **`table-row`:**
  - Tag: `<tr>`.
  - Allowed children: `table-cell`.
- **`table-cell`:**
  - Tag: `<th>` (jika header) atau `<td>` (jika sel data biasa).
  - Props: `isHeader` (boolean), `colSpan` (number, default 1), `rowSpan` (number, default 1), `text` (string).
  - Menerima children teks atau elemen apa pun.

#### 3.1.3 Typography & Semantic Text Tags
- **`paragraph` (`<p>`):** Teks paragraf semantik dengan margin bawah terstandarisasi.
- **`link` (`<a>`):** Teks link standalone atau inline dengan atribut `href`, `target` (`_blank`/`_self`), dan `rel`.
- **`blockquote` (`<blockquote>`):** Kutipan dengan styling garis vertikal aksen di sisi kiri dan atribusi sumber kutipan.
- **`badge` (`<span>`):** Pill label kecil untuk status ("Active", "New", "Sale") atau tag kategori.
- **`code-block` (`<pre><code>`):** Wadah snippet kode dengan font monospace dan dark background.

#### 3.1.4 Dividers, Spacers & Media
- **`divider` (`<hr>`):** Garis pemisah horizontal dengan pilihan gaya (`solid`, `dashed`, `dotted`, `gradient`) dan opsi ikon/teks di tengah garis.
- **`spacer`:** Elemen kosong pengatur jarak vertikal/horizontal dengan slider `height` (default 32px).
- **`video`:** Pemutar video native HTML5 (`<video>` dengan props `src`, `poster`, `controls`, `autoplay`, `loop`, `muted`) serta mode embed YouTube/Vimeo.
- **`icon`:** Render ikon SVG vektor dari koleksi Lucide icons dengan pengatur warna dan ukuran.
- **`html-embed`:** Wadah penyematan raw HTML / iframe aman (misal Google Maps embed).

#### 3.1.5 Form Controls (Form Elements)
- **`form`:** Container `<form>` dengan props `action`, `method` (`GET`/`POST`).
- **`input`:** Input field (`text`, `email`, `number`, `tel`, `password`, `placeholder`, `required`).
- **`textarea`:** Input teks banyak baris dengan props `rows` dan `placeholder`.
- **`select`:** Dropdown menu dengan daftar opsi dinamis.
- **`checkbox` & `radio`:** Input centang dan radio button beserta label pendampingnya.

---

### 3.2 Module 2: Sector-Based Style Manager & Visual Box Model
- **Accordion Sectors:** Dimension & Display, Spacing (Box Model), Typography, Decorations (Background/Border/Shadow), Flex/Grid.
- **Visual Box Model Diagram:** Kotak berlapis interaktif untuk *Margin (luar) → Border → Padding (dalam) → Content*.

---

### 3.3 Module 3: Trait Manager (HTML Attributes)
- Pemisahan tab khusus **Settings / Traits (⚙️)** untuk atribut teknis: `href`, `target`, `alt`, `title`, `placeholder`, `aria-label`, custom `id`.

---

### 3.4 Module 4: State Selector (`:hover`, `:active`, `:focus`)
- Dropdown selector state di header Style Manager dengan live visual preview di kanvas.

---

### 3.5 Module 5: Canvas Navigation & Floating Badges
- Floating toolbar di atas elemen aktif: ⬆️ *Select Parent*, 🖐️ *Move*, 📑 *Duplicate*, 🗑️ *Delete*.
- Breadcrumbs path bar di bawah kanvas.

---

### 3.6 Module 6: Motion & Animation Engine
- **Animate On Scroll (AOS):** `fade-up`, `fade-down`, `zoom-in`, `flip-up`, `bounce-in` dengan *duration, delay, easing, & once*.
- **Hover Micro-interactions:** `lift`, `scale`, `glow`, `tilt`.
- **Ambient Loops:** `pulse`, `float`, `shimmer`.
- **Live Replay:** Tombol ▶️ Play di inspector untuk menguji animasi langsung di kanvas.

---

### 3.7 Module 7: Block Manager & Code Viewer
- Starter Layout Blocks (1 Col, 2 Col 50/50, 2 Col 30/70, 3 Col).
- Pre-composed UI Blocks (Hero, Pricing Table, Features, Testimonial, Footer).
- Live Code Viewer modal (Clean HTML & CSS).
