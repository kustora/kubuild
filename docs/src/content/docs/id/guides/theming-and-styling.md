---
title: Tema & Desain Responsif
description: Mengelola gaya multi-breakpoint, tema dokumen, dan token desain portabel.
---

KUBUILD menggunakan mesin styling portabel yang dirancang untuk menghasilkan tampilan konsisten di berbagai perangkat tanpa ketergantungan langsung pada framework CSS tertentu. Gaya disimpan di dokumen sebagai data biasa — bukan sebagai class Tailwind atau CSS mentah — sehingga halaman tampil sama di canvas editor, renderer runtime, dan HTML hasil ekspor.

## Objek `styles`

Setiap node memiliki objek `styles` opsional dengan hingga lima layer:

| Key | Berlaku untuk |
| :--- | :--- |
| `base` | Semua ukuran layar. |
| `desktop` | Layar ≥ 1024px. |
| `tablet` | Layar 768px – 1023px. |
| `mobile` | Layar < 768px. |
| `states` | Layer pseudo-class dengan key berupa selector (`":hover"`, `":focus"`, `":active"`, ...), diterapkan di atas gaya breakpoint yang sudah di-resolve. |

Setiap layer adalah map datar dari nama properti CSS camelCase ke nilai **skalar**: string, number, boolean, atau `null`. Tidak ada objek bersarang — tulis `padding: "32px"` atau longhand `paddingTop`/`paddingRight`/`paddingBottom`/`paddingLeft`, bukan `padding: { top: ... }`. Number mendapat akhiran `px` untuk properti panjang (`gap: 24` → `24px`); properti tanpa unit seperti `opacity`, `fontWeight`, `lineHeight`, `zIndex`, dan `flexGrow` tetap tanpa unit. Nilai disaring dari pola injeksi (`javascript:`, `expression(`, `@import`, ...) oleh schema, sehingga nilai yang tidak aman membuat dokumen tidak valid.

Berikut `PageDocument` lengkap dan valid yang memakai setiap layer:

<!-- docs-check: PageDocument -->
```json
{
  "schema": "stora.page",
  "version": "1.2.0",
  "metadata": { "title": "Responsive features" },
  "document": {
    "id": "root",
    "type": "page",
    "children": [
      {
        "id": "features",
        "type": "section",
        "styles": {
          "base": {
            "display": "flex",
            "flexDirection": "row",
            "gap": "24px",
            "padding": "32px"
          },
          "tablet": { "gap": "16px" },
          "mobile": {
            "flexDirection": "column",
            "padding": "16px"
          }
        },
        "children": [
          {
            "id": "features-title",
            "type": "heading",
            "props": { "text": "Everything you need", "level": 2 },
            "styles": { "base": { "fontSize": "32px", "fontWeight": 700 }, "mobile": { "fontSize": "24px" } }
          },
          {
            "id": "features-cta",
            "type": "button",
            "props": { "label": "Start free trial" },
            "styles": {
              "base": { "backgroundColor": "#2563eb", "color": "#ffffff", "paddingTop": 12, "paddingBottom": 12 },
              "states": { ":hover": { "backgroundColor": "#1d4ed8" } }
            }
          }
        ]
      }
    ]
  }
}
```

Di mobile, section berubah dari baris menjadi kolom bertumpuk dengan padding lebih kecil; di tablet hanya gap yang mengecil.

Teks berada di props, bukan styles. Setiap komponen teks memiliki satu prop kanonis (STORA-550): `text` untuk `heading`, `text`, `paragraph`, `link`, `badge`, dan `blockquote`, serta `label` untuk `button`. Alias lama (`content`, `quote`, ...) dipindahkan ke nama kanonis oleh migrasi `1.1.0 → 1.2.0` dan masih dirender selama satu minor version dengan diagnostic `DEPRECATED_PROP`. `CANONICAL_TEXT_PROPS` di `@kubuild/schema` berisi daftar aturannya.

## Breakpoint responsif

Rentangnya tidak saling tumpang tindih. Satu layar mendapat `base` ditambah tepat satu layer, dan `tablet` tidak menurun ke `mobile` (begitu juga `desktop` ke layar yang lebih kecil). Ini sama dengan tampilan preview per device di editor.

Nilai-nilai ini hanya didefinisikan di satu tempat, yaitu konstanta `BREAKPOINTS` yang diekspor dari `@kubuild/schema`. Editor, renderer runtime, dan code generator semuanya membacanya. `BREAKPOINT_MEDIA_QUERIES` berisi media query yang sesuai, dan `getBreakpointForWidth(width)` memetakan lebar piksel ke sebuah layer.

```ts
import {
  BREAKPOINTS,
  BREAKPOINT_MEDIA_QUERIES,
  BREAKPOINT_ORDER,
  getBreakpointForWidth,
} from '@kubuild/schema';

BREAKPOINTS.mobile; // { minWidth: 0, maxWidth: 767 }
BREAKPOINTS.tablet; // { minWidth: 768, maxWidth: 1023 }
BREAKPOINTS.desktop; // { minWidth: 1024, maxWidth: null }

BREAKPOINT_MEDIA_QUERIES.tablet; // '(min-width: 768px) and (max-width: 1023.98px)'
BREAKPOINT_ORDER; // ['desktop', 'tablet', 'mobile']
getBreakpointForWidth(390); // 'mobile'
```

Batas atas ditulis sebagai `maxWidth + 0.98px` (`767.98px`, `1023.98px`) agar lebar viewport pecahan di layar yang di-zoom atau high-DPI tidak jatuh di antara dua rentang.

### Cara renderer menerapkan breakpoint

`KubuildRenderer` menerima prop `responsive` (`'css' | 'viewport'`):

- **`'css'`** — default untuk halaman publik (`mode="runtime"` tanpa prop `viewport`). Layer `base` dirender inline, dan override `desktop`/`tablet`/`mobile` setiap node menjadi rule `@media` yang ter-scope ke `[data-kubuild-node="…"]`. Lebar browser yang sebenarnya menentukan layer yang dipakai, jadi resize dan rotasi layar tetap benar. Output hanya bergantung pada dokumen, sehingga markup hasil SSR dan hidrasi identik.
- **`'viewport'`** — default untuk canvas editor dan preview device (`mode="editor"`, atau render apa pun yang memberikan `viewport`). Layer yang dipilih digabung ke style inline, sehingga setiap frame device menampilkan device tersebut berapa pun lebar jendela browser.

HTML ekspor (`generateDocumentCss` / `generateStandaloneHtml` dari `@kubuild/renderer`) menghasilkan override yang sama di bawah media query yang sama.

```tsx
import { KubuildRenderer } from '@kubuild/renderer';
import type { PageDocument } from '@kubuild/schema';

export function PublicPage({ doc }: { doc: PageDocument }) {
  // responsive="css" is implied here; shown for clarity.
  return <KubuildRenderer document={doc} mode="runtime" responsive="css" />;
}

export function MobilePreview({ doc }: { doc: PageDocument }) {
  // Passing `viewport` selects responsive="viewport": always the mobile layer.
  return <KubuildRenderer document={doc} mode="runtime" viewport="mobile" />;
}
```

## Tema dokumen (design token)

Dokumen dapat membawa tema: token desain bernama dalam empat grup, disimpan di `PageDocument.theme` (STORA-551).

| Grup | CSS custom property | Contoh referensi |
| :--- | :--- | :--- |
| `colors` | `--kb-color-<key>` | `var(--kb-color-primary)` |
| `fonts` | `--kb-font-<key>` | `var(--kb-font-heading)` |
| `radii` | `--kb-radius-<key>` | `var(--kb-radius-md)` |
| `spacing` | `--kb-space-<key>` | `var(--kb-space-lg)` |

Renderer mengeluarkan setiap token sebagai CSS custom property di root halaman, dan style node mereferensikan token dengan string CSS `var()` biasa. Karena referensinya adalah nilai CSS biasa, ia dirender tanpa perubahan di style inline, CSS hasil generate, dan HTML ekspor, dan fallback bekerja seperti biasa (`var(--kb-color-primary, #2563eb)`). Token `radii` dan `spacing` berupa number mendapat akhiran `px`.

<!-- docs-check: PageDocument -->
```json
{
  "schema": "stora.page",
  "version": "1.2.0",
  "metadata": { "title": "Themed landing page" },
  "theme": {
    "colors": { "primary": "#2563eb", "primary-contrast": "#ffffff", "surface": "#f8fafc" },
    "fonts": { "heading": "\"Inter\", sans-serif" },
    "radii": { "md": 8 },
    "spacing": { "lg": "32px" }
  },
  "document": {
    "id": "root",
    "type": "page",
    "styles": { "base": { "backgroundColor": "var(--kb-color-surface)" } },
    "children": [
      {
        "id": "hero",
        "type": "section",
        "styles": { "base": { "padding": "var(--kb-space-lg)" } },
        "children": [
          {
            "id": "hero-title",
            "type": "heading",
            "props": { "text": "Launch faster", "level": 1 },
            "styles": { "base": { "fontFamily": "var(--kb-font-heading)" } }
          },
          {
            "id": "hero-cta",
            "type": "button",
            "props": { "label": "Get started" },
            "styles": {
              "base": {
                "backgroundColor": "var(--kb-color-primary)",
                "color": "var(--kb-color-primary-contrast)",
                "borderRadius": "var(--kb-radius-md)"
              }
            }
          }
        ]
      }
    ]
  }
}
```

Key token berupa 1–64 karakter huruf, angka, `-`, dan `_` (diawali huruf atau angka). Nilai token disaring seperti nilai style dan juga tidak boleh berisi `;`, `{`, `}`, `<`, `>`, `\`, atau `url(`, karena nilainya berakhir di dalam blok `<style>` pada HTML ekspor. Token yang tidak aman membuat dokumen tidak valid.

`@kubuild/schema` mengekspor helper untuk mengelola token:

```ts
import {
  mergeThemes,
  parseThemeTokenRef,
  themeToCssVariables,
  themeTokenRef,
  type Theme,
} from '@kubuild/schema';

const theme: Theme = { colors: { primary: '#2563eb' }, radii: { md: 8 } };

themeTokenRef('colors', 'primary'); // 'var(--kb-color-primary)'
parseThemeTokenRef('var(--kb-radius-md)'); // { group: 'radii', key: 'md' }
themeToCssVariables(theme); // [['--kb-color-primary', '#2563eb'], ['--kb-radius-md', '8px']]
mergeThemes(theme, { colors: { primary: '#e11d48' } }); // later layers win per token
```

### Mengedit tema di editor

Style manager di Inspector memiliki bagian **Page Theme** (komponen `ThemePanel`) yang mengubah `PageDocument.theme` melalui command `updateTheme` yang bisa di-undo, sehingga mengubah satu token langsung mengubah tampilan semua node yang mereferensikannya. Pemilih design token (`DesignTokensPanel`) menyisipkan referensi token (`var(--kb-color-primary)`) ke style node terpilih alih-alih menyalin nilai literal, dan menambahkan token ke tema terlebih dahulu bila belum ada.

Command yang sama tersedia secara programatik:

```ts
import { updateTheme } from '@kubuild/core';
import type { PageDocument } from '@kubuild/schema';

export function rebrand(doc: PageDocument): PageDocument {
  // Merges token-by-token; a `null` token value removes that token.
  const { document } = updateTheme(doc, {
    theme: { colors: { primary: '#e11d48', legacy: null } },
  });
  return document;
}
```

`updateTheme` memvalidasi hasilnya dengan `ThemeSchema` dan melempar error untuk key atau nilai yang tidak aman. Berikan `merge: false` untuk mengganti seluruh tema, atau `theme: null` untuk menghapusnya.

### Override tema dari host saat runtime

Host multi-tenant dapat mengganti brand halaman tanpa mengubah dokumen yang tersimpan dengan memberikan `theme` di runtime context renderer. Override digabung per token di atas `PageDocument.theme` saat render; key atau nilai yang tidak aman di override dibuang, bukan diterapkan.

```tsx
import { KubuildRenderer } from '@kubuild/renderer';
import type { RuntimeContext } from '@kubuild/core';
import type { PageDocument } from '@kubuild/schema';

export function TenantPage({ doc, brandColor }: { doc: PageDocument; brandColor: string }) {
  const context: RuntimeContext = {
    theme: { colors: { primary: brandColor } },
  };
  return <KubuildRenderer document={doc} context={context} mode="runtime" />;
}
```

Prop `context` yang sama juga berlaku di `KubuildEditor`, sehingga canvas menampilkan brand tenant selama editing.
