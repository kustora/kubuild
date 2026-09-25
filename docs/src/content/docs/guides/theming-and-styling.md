---
title: Theming & Responsive Design
description: Managing multi-breakpoint styles, custom palettes, and portable design tokens.
---

KUBUILD uses a portable styling engine designed to render identically across any device without coupling to specific CSS frameworks.

## Responsive Breakpoints

KUBUILD supports four responsive breakpoint tiers:

1. **`base`**: Default styles applied across all screen sizes.
2. **`desktop`**: Overrides active on screens $\ge 1024\text{px}$.
3. **`tablet`**: Overrides active on screens between $768\text{px}$ and $1023\text{px}$.
4. **`mobile`**: Overrides active on screens $< 768\text{px}$.

The ranges are disjoint: a screen gets `base` plus exactly one layer, and `tablet` does not cascade into `mobile` (nor `desktop` into smaller screens). This matches what the editor shows for each device preview.

These values live in one place, the `BREAKPOINTS` constant exported from `@kubuild/schema`. The editor, the runtime renderer and the code generator all read it. `BREAKPOINT_MEDIA_QUERIES` gives the matching media queries (`(min-width: 1024px)`, `(min-width: 768px) and (max-width: 1023.98px)`, `(max-width: 767.98px)`), and `getBreakpointForWidth(width)` maps a pixel width to a layer.

```ts
import { BREAKPOINTS, BREAKPOINT_MEDIA_QUERIES, getBreakpointForWidth } from '@kubuild/schema';

BREAKPOINTS.tablet; // { minWidth: 768, maxWidth: 1023 }
getBreakpointForWidth(390); // 'mobile'
```

### How the renderer applies breakpoints

- **Published pages** (`<KubuildRenderer mode="runtime" />` with no `viewport` prop) use `responsive: 'css'`. The `base` layer is rendered inline, and each node's `desktop`/`tablet`/`mobile` overrides become `@media` rules scoped to `[data-kubuild-node="…"]`. The browser's real width picks the layer, so resizing and rotating the device work. The output depends only on the document, so server-rendered and hydrated markup are identical.
- **Editor canvas and device previews** (`mode="editor"`, or any render that passes `viewport`) use `responsive: 'viewport'`. The chosen layer is merged into inline styles, so each device frame previews that device no matter how wide the browser window is.
- **Exported HTML** (`generateDocumentCss` / `generateStandaloneHtml`) emits the same overrides under the same media queries.

Pass `responsive="css"` or `responsive="viewport"` to override the default.

## Responsive Style Structure

```json
{
  "styles": {
    "base": {
      "display": "flex",
      "flexDirection": "row",
      "gap": "24px",
      "padding": { "top": "32px", "right": "32px", "bottom": "32px", "left": "32px" }
    },
    "mobile": {
      "flexDirection": "column",
      "padding": { "top": "16px", "right": "16px", "bottom": "16px", "left": "16px" }
    }
  }
}
```

On mobile viewports, the layout automatically switches from a row layout to a stacked column layout with reduced padding.
