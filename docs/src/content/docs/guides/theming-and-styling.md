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

## Responsive Style Structure

```json
{
  "style": {
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
