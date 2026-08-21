
# PRD — KUBUILD

**Product:** KUBUILD  
**CODE NAME:** BUILDER-01  
**Builder Library:** `kubuild`  
**Document Type:** Product Requirements Document  
**Status:** Draft  

---

## 1. Product Overview

**KUBUILD** adalah platform untuk membuat, mengedit, menyimpan, membagikan, serta menggunakan kembali landing page secara visual.

Core builder dari KUBUILD akan dikembangkan sebagai library bernama **`kubuild`**.

`kubuild` bertanggung jawab terhadap proses pembuatan dan rendering halaman

### Prinsip utama

> **Create → Customize → Export → Share → Import → Customize → Publish**

KUBUILD tidak bergantung pada CMS atau backend tertentu.

---

# 2. Product Vision

KUBUILD bertujuan menjadi **platform portable web page builder** yang memungkinkan siapa pun membuat landing page secara visual dan membagikannya dalam format yang dapat diedit kembali.

Setiap halaman yang dibuat harus dapat:

- Dibuat dari scratch
- Dibuat menggunakan template
- Diedit secara visual
- Dipreview
- Diexport
- Diimport kembali
- Dibagikan kepada pengguna lain
- Digunakan sebagai template
- Dirender menjadi halaman web

---

# 3. Product Architecture

Secara konseptual:

```
                    KUBUILD
                         │
                         │ uses
                         ▼
                     kubuild
                         │
          ┌──────────────┼──────────────┐
          │              │              │
       Builder        Renderer       Exporter
          │              │              │
          └──────────────┼──────────────┘
                         │
                         ▼
                  Page Document
                         │
                         ▼
                    .stora Package
```

`kubuild` harus bersifat **framework/library oriented**

Dengan demikian:

```
kubuild
   │
   ├── KUBUILD
   ├── Application A
   ├── Application B
   └── Application C
```

dapat menggunakan engine yang sama.

---

# 4. Target Users

## 4.1 Page Creator

Pengguna yang ingin membuat landing page tanpa harus melakukan coding.

Kebutuhan:

- Visual builder
- Template
- Components
- Responsive editing
- Preview
- Export/import

---

## 4.2 Template Creator

Pengguna yang ingin membuat template dan membagikannya kepada komunitas.

Kebutuhan:

- Membuat template
- Menambahkan metadata
- Preview template
- Export template
- Publish template
- Versioning

---

## 4.3 Developer

Developer yang ingin mengintegrasikan `kubuild` ke aplikasi mereka.

Kebutuhan:

- Install library
- Register custom component
- Menyediakan variables
- Menyediakan actions
- Menyediakan asset provider
- Menggunakan renderer

---

# 5. Core Business Flow

## 5.1 Create Page

User memilih:

```
Create Page
│
├── Blank Page
├── Template
└── Import .stora
```

### Blank Page

```
Create
  ↓
Blank Document
  ↓
Builder
```

### Template

```
Create
  ↓
Template Library
  ↓
Select Template
  ↓
Preview
  ↓
Use Template
  ↓
Create Page
  ↓
Builder
```

### Import

```
Create
  ↓
Import .stora
  ↓
Validate Package
  ↓
Check Compatibility
  ↓
Import Assets
  ↓
Create Page
  ↓
Builder
```

---

# 6. Builder Flow

Setelah page dibuat, user masuk ke builder.

```
Page
 │
 ▼
Builder
 │
 ├── Add Component
 ├── Move Component
 ├── Delete Component
 ├── Duplicate Component
 ├── Edit Content
 ├── Edit Style
 ├── Configure Variables
 └── Configure Responsive
```

Semua perubahan dilakukan terhadap **Draft Document**.

---

# 7. Preview Flow

User dapat melihat hasil halaman sebelum dipublish.

```
Builder
   │
   ▼
Preview
   │
   ├── Desktop
   ├── Tablet
   └── Mobile
```

Preview harus menggunakan renderer yang sama atau engine rendering yang kompatibel dengan production renderer agar hasil preview dan halaman final konsisten.

# 8. Export Flow

User dapat melakukan:

```
Export
  ↓
Build Page Package
  ↓
Collect Document
  ↓
Collect Assets
  ↓
Collect Metadata
  ↓
Collect Variable Definitions
  ↓
Generate .stora
```

Output:

```
my-landing.stora
```

Format `.stora` harus bersifat portable.

---

# 9. Import Flow

User menerima file:

```
my-landing.stora
```

Kemudian:

```
Import
  ↓
Read Manifest
  ↓
Validate Schema
  ↓
Check Version
  ↓
Check Dependencies
  ↓
Extract Assets
  ↓
Load Document
  ↓
Open Builder
```

Jika package membutuhkan capability yang tidak tersedia:

```
Missing Requirement

This page requires:
- Component X
- Capability Y

[Install]
[Import Anyway]
[Cancel]
```

---

# 10. `.stora` Package

`.stora` merupakan format portable untuk menyimpan halaman.

Struktur awal:

```
my-landing.stora
│
├── manifest.json
├── page.json
├── metadata.json
└── assets/
    ├── image.webp
    ├── logo.svg
    └── background.webp
```

### `manifest.json`

Berisi:

- Schema version
- Package version
- Builder compatibility
- Dependencies
- Required capabilities

### `page.json`

Berisi document tree halaman.

### `metadata.json`

Berisi:

- Page title
- Author
- Description
- Created date
- Updated date
- Template information

### `assets/`

Berisi seluruh asset yang dibutuhkan halaman.

---

# 11. Template System

Template adalah sebuah page document yang dapat digunakan sebagai basis page baru.

Flow:

```
Page
  ↓
Save as Template
  ↓
Template Metadata
  ↓
Template
```

Template memiliki:

```
Name
Description
Category
Tags
Thumbnail
Preview
Author
Version
Document
Assets
```

---

# 12. Template Usage

Template asli tidak boleh dimodifikasi ketika digunakan.

Flow:

```
Template
   │
   ▼
Clone
   │
   ▼
New Page
   │
   ▼
User Customization
```

Dengan demikian:

```
Template A
│
├── User Page 1
├── User Page 2
└── User Page 3
```

semuanya merupakan instance terpisah.

---

# 13. Community Template Flow

Community creator dapat membuat template sendiri.

```
Creator
  ↓
Create Page
  ↓
Customize
  ↓
Save as Template
  ↓
Add Metadata
  ↓
Preview
  ↓
Export / Submit
```

Untuk marketplace:

```
Submit Template
  ↓
Validation
  ↓
Review
  ↓
Publish
  ↓
Community Marketplace
```

---

# 14. Dynamic Content

`kubuild` tidak boleh memiliki ketergantungan terhadap database atau backend tertentu.

Dynamic content menggunakan **Variable System**.

Contoh:

```
{{ site.name }}

{{ site.description }}

{{ product.name }}

{{ product.price }}
```

Document menyimpan reference:

```
{
  "type": "heading",
  "props": {
    "text": {
      "type": "variable",
      "key": "site.name"
    }
  }
}
```

`kubuild` tidak mengetahui sumber data tersebut.

---

# 15. Runtime Variables

Consumer menyediakan data pada saat rendering.

Contoh:

```
renderer.render({
  document,
  context: {
    variables: {
      site: {
        name: "My Website",
        description: "My description"
      }
    }
  }
});
```

Renderer melakukan:

```
{{ site.name }}
       ↓
variables.site.name
       ↓
My Website
```

Dengan demikian `kubuild` tetap backend-agnostic.

---

# 16. Collection / Repeating Content

Dynamic collection dapat menggunakan array variable.

Contoh:

```
{
  "products": [
    {
      "name": "Product A",
      "price": 10000
    },
    {
      "name": "Product B",
      "price": 20000
    }
  ]
}
```

Builder dapat membuat:

```
Collection
│
├── Data Source: products
│
└── Item
    ├── Image
    ├── {{ item.name }}
    └── {{ item.price }}
```

Renderer akan menghasilkan:

```
Product A
Product B
```

---

# 17. Consumer Integration

Aplikasi yang menggunakan `kubuild` menyediakan environment/runtime.

```
Consumer Application
│
├── kubuild
│
├── Variables
├── Assets
├── Actions
└── Custom Components
```

Sedangkan `kubuild` menyediakan:

```
kubuild
│
├── Document Engine
├── Builder
├── Renderer
├── Template Engine
├── Importer
└── Exporter
```

---

# 18. Custom Components

Consumer dapat mendaftarkan component tambahan.

Contoh:

```
builder.registerComponent({
  type: "custom.product-card",
  component: ProductCard
});
```

Component tersebut dapat digunakan oleh Builder dan Renderer.

Core `kubuild` tidak perlu mengetahui implementasi component tersebut.

---

# 19. Action System

Dynamic content tidak hanya membutuhkan data, tetapi juga interaksi.

Contoh:

```
Button
  ↓
Action
  ↓
Submit Form
```

atau:

```
Button
  ↓
Action
  ↓
Navigate
```

atau:

```
Button
  ↓
Action
  ↓
Custom Consumer Action
```

Consumer menyediakan handler:

```
registerAction({
  type: "custom-action",
  execute: async (payload) => {
    // consumer implementation
  }
});
```

---

# 20. Asset System

`kubuild` tidak mengontrol storage.

Builder menggunakan abstraction:

```
Asset Provider
│
├── upload()
├── delete()
├── resolve()
└── list()
```

Consumer dapat menggunakan:

```
S3
Cloudflare R2
Local Storage
CDN
Custom API
```

---

# 21. Renderer

Renderer menerima:

```
Document
+
Runtime Context
+
Component Registry
```

dan menghasilkan:

```
Rendered Page
```

Flow:

```
Document
   │
   ▼
Renderer
   │
   ├── Resolve Components
   ├── Resolve Variables
   ├── Resolve Styles
   └── Resolve Actions
   │
   ▼
Rendered Page
```

Renderer tidak memiliki UI editor.

---

# 22. Builder vs Renderer

### Builder

Digunakan saat membuat halaman.

```
Builder
├── Canvas
├── Components
├── Inspector
├── Layers
├── Responsive Controls
├── Undo/Redo
└── Preview
```

### Renderer

Digunakan saat menampilkan halaman.

```
Renderer
├── Document
├── Components
├── Variables
├── Styles
└── Runtime
```

Keduanya menggunakan document format yang sama.

---

# 23. Versioning

Document wajib memiliki schema version.

Contoh:

```
{
  "schema": "stora.page",
  "version": "1.0"
}
```

Ketika schema berubah:

```
v1
 ↓
Migration
 ↓
v2
 ↓
Current Document
```

File `.stora` versi lama harus tetap dapat diimport selama masih berada dalam compatibility window yang didukung.

---

# 24. Community Ecosystem

Ekosistem jangka panjang:

```
Stora Community
│
├── Templates
├── Sections
├── Themes
├── Components
└── Plugins
```

Prioritas pengembangan:

```
Template
  ↓
Section
  ↓
Theme
  ↓
Component
  ↓
Plugin
```

Template dan theme sebaiknya bersifat data-driven terlebih dahulu.

Arbitrary JavaScript dari community tidak diperbolehkan dalam template standar karena risiko keamanan.

---

# 25. Core MVP

MVP `kubuild` harus mendukung:

- Document model
- Node system
- Component registry
- Basic components
- Canvas
- Drag & drop
- Selection
- Inspector
- Styling
- Responsive editing
- Undo/redo
- Save/load document
- Preview
- Renderer
- Variable system
- `.stora` export
- `.stora` import

---

# 26. MVP Business Loop

MVP dianggap berhasil apabila user dapat menyelesaikan flow berikut:

```
Create Page
     ↓
Build Landing Page
     ↓
Customize
     ↓
Preview
     ↓
Export .stora
     ↓
Share File
     ↓
Another User
     ↓
Import .stora
     ↓
Open Builder
     ↓
Customize
     ↓
Export / Publish
```

**Tidak boleh ada informasi struktur halaman yang hilang selama proses export → import.**

---

# 27. Future Business Flow

Setelah MVP stabil:

```
Creator
   ↓
Create
   ↓
Save as Template
   ↓
Publish
   ↓
Marketplace
   ↓
Downloads
   ↓
Ratings
   ↓
Creator Profile
   ↓
Community
```

Kemudian:

```
Community
   ↓
Template Marketplace
   ↓
Free / Paid Templates
   ↓
Creator Revenue
   ↓
Stora Platform Revenue
```

---

# 28. Non-Goals MVP

MVP **tidak** mencakup:

- Full CMS
- E-commerce backend
- Database management
- Authentication system untuk website hasil build
- Arbitrary custom JavaScript
- Plugin marketplace
- Paid template marketplace
- Advanced animations
- Full visual programming
- SEO management yang kompleks
- Multi-user collaborative editing
- Version control berbasis Git

Fitur tersebut dapat ditambahkan setelah core builder terbukti stabil.

---

# 29. Success Criteria

### Product

User dapat membuat landing page tanpa coding.

### Portability

Page dapat:

```
Export → Share → Import
```

tanpa kehilangan struktur.

### Developer

`kubuild` dapat digunakan oleh aplikasi lain tanpa ketergantungan terhadap Stora.page backend.

### Community

Creator dapat membuat dan membagikan template menggunakan format yang sama dengan page biasa.

### Architecture

Builder dan Renderer menggunakan **document specification yang sama**.

---

# 30. Prinsip Arsitektur Utama

```
                    KUBUILD
                       │
       ┌───────────────┼────────────────┐
       │               │                │
    Document         Builder          Renderer
       │
       ├── Components
       ├── Styles
       ├── Variables
       ├── Collections
       ├── Actions
       └── Assets
                       │
                       ▼
                  .STORA FORMAT
                       │
              ┌────────┴────────┐
              ▼                 ▼
           Export              Import
              │                 │
              └────────┬────────┘
                       ▼
                 Portable Page
```

**Prinsip paling penting:** `kubuild` harus menjadi **engine yang independen**, sedangkan **Stora.page adalah platform/consumer** yang memanfaatkan engine tersebut. `.stora` menjadi format portable yang menghubungkan builder, renderer, template, dan komunitas.