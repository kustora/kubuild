---
title: Theming & Responsive Design
description: Managing multi-breakpoint styles, document themes, and portable design tokens.
---

KUBUILD uses a portable styling engine designed to render identically across any device without coupling to specific CSS frameworks. Styles are stored in the document as plain data — never as Tailwind classes or raw CSS — so a page renders the same in the editor canvas, the runtime renderer and exported HTML.

## The `styles` object

Every node has an optional `styles` object with up to five layers:

| Key | Applies |
| :--- | :--- |
| `base` | Every screen size. |
| `desktop` | Screens ≥ 1024px. |
| `tablet` | Screens 768px – 1023px. |
| `mobile` | Screens < 768px. |
| `states` | Pseudo-class layers keyed by selector (`":hover"`, `":focus"`, `":active"`, ...), applied on top of the resolved breakpoint styles. |

Each layer is a flat map of camelCase CSS property names to **scalar** values: a string, a number, a boolean or `null`. There are no nested objects — write `padding: "32px"` or the longhands `paddingTop`/`paddingRight`/`paddingBottom`/`paddingLeft`, not `padding: { top: ... }`. Numbers get `px` appended for length properties (`gap: 24` → `24px`); unitless properties such as `opacity`, `fontWeight`, `lineHeight`, `zIndex` and `flexGrow` stay unitless. Values are screened for injection patterns (`javascript:`, `expression(`, `@import`, ...) by the schema, so an unsafe value makes the document invalid.

Here is a complete, valid `PageDocument` using every layer:

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

On mobile the section switches from a row to a stacked column with reduced padding; on tablet only the gap shrinks.

Text lives in props, not styles. Each text-bearing component has one canonical prop (STORA-550): `text` for `heading`, `text`, `paragraph`, `link`, `badge` and `blockquote`, and `label` for `button`. Older aliases (`content`, `quote`, ...) are moved onto the canonical name by the `1.1.0 → 1.2.0` migration and still render for one minor version with a `DEPRECATED_PROP` diagnostic. `CANONICAL_TEXT_PROPS` in `@kubuild/schema` lists the rules.

## Responsive breakpoints

The ranges are disjoint: a screen gets `base` plus exactly one layer, and `tablet` does not cascade into `mobile` (nor `desktop` into smaller screens). This matches what the editor shows for each device preview.

These values live in one place, the `BREAKPOINTS` constant exported from `@kubuild/schema`. The editor, the runtime renderer and the code generator all read it. `BREAKPOINT_MEDIA_QUERIES` gives the matching media queries, and `getBreakpointForWidth(width)` maps a pixel width to a layer.

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

Upper bounds are emitted as `maxWidth + 0.98px` (`767.98px`, `1023.98px`) so fractional viewport widths on zoomed or high-DPI screens never fall between two ranges.

### How the renderer applies breakpoints

`KubuildRenderer` takes a `responsive` prop (`'css' | 'viewport'`):

- **`'css'`** — the default for published pages (`mode="runtime"` with no `viewport` prop). The `base` layer is rendered inline, and each node's `desktop`/`tablet`/`mobile` overrides become `@media` rules scoped to `[data-kubuild-node="…"]`. The browser's real width picks the layer, so resizing and rotating the device work. The output depends only on the document, so server-rendered and hydrated markup are identical.
- **`'viewport'`** — the default for the editor canvas and device previews (`mode="editor"`, or any render that passes `viewport`). The chosen layer is merged into inline styles, so each device frame previews that device no matter how wide the browser window is.

Exported HTML (`generateDocumentCss` / `generateStandaloneHtml` from `@kubuild/renderer`) emits the same overrides under the same media queries.

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

## Document theme (design tokens)

A document can carry a theme: named design tokens in four groups, stored at `PageDocument.theme` (STORA-551).

| Group | CSS custom property | Example reference |
| :--- | :--- | :--- |
| `colors` | `--kb-color-<key>` | `var(--kb-color-primary)` |
| `fonts` | `--kb-font-<key>` | `var(--kb-font-heading)` |
| `radii` | `--kb-radius-<key>` | `var(--kb-radius-md)` |
| `spacing` | `--kb-space-<key>` | `var(--kb-space-lg)` |

The renderer emits every token as a CSS custom property on the page root, and node styles reference tokens with a plain CSS `var()` string. Because the reference is an ordinary CSS value, it renders unchanged in inline styles, generated CSS and exported HTML, and a fallback works as usual (`var(--kb-color-primary, #2563eb)`). Numeric `radii` and `spacing` tokens get `px` appended.

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

Token keys are 1–64 characters of letters, digits, `-` and `_` (starting with a letter or digit). Token values are screened like style values and additionally may not contain `;`, `{`, `}`, `<`, `>`, `\` or `url(`, because they end up inside a `<style>` block in exported HTML. An unsafe token makes the document invalid.

`@kubuild/schema` exports helpers for working with tokens:

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

### Editing the theme in the editor

The Inspector's style manager has a **Page Theme** section (the `ThemePanel` component) that edits `PageDocument.theme` through the undoable `updateTheme` command, so changing a token restyles every node that references it at once. The design-tokens picker (`DesignTokensPanel`) inserts token references (`var(--kb-color-primary)`) into the selected node's styles instead of copying literal values, adding the token to the theme first if it does not exist yet.

The same command is available programmatically:

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

`updateTheme` validates the result with `ThemeSchema` and throws on unsafe keys or values. Pass `merge: false` to replace the whole theme, or `theme: null` to remove it.

### Host theme override at runtime

A multi-tenant host can re-brand a page without modifying the stored document by passing `theme` in the renderer's runtime context. It is merged token-by-token over `PageDocument.theme` at render time; unsafe keys or values in the override are dropped rather than applied.

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

The same `context` prop works on `KubuildEditor`, so the canvas previews the tenant brand while editing.
