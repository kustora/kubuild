---
title: 'Inspector & Styling Panel'
description: 'Visual CSS styling, responsive overrides, and component properties inspector in KUBUILD.'
---

# Inspector & Styling Panel

The **Inspector Panel** located on the right side of the workspace gives developers and designers granular control over styles, layout configurations, component props, and dynamic data bindings.

## Sections Overview

When a node is selected, the inspector organizes its settings into contextual tabs or accordions:

### 1. Component Properties & Text
- Component-specific settings (e.g., button variants, link href, image URLs, alt tags, table grid options).
- Direct text content inputs with quick variable insertion tags.

### 2. Layout & Flexbox / Grid
- **Display**: `block`, `flex`, `grid`, `inline-flex`, `inline-block`, `none`.
- **Flex Direction**: `row`, `column`, `row-reverse`, `column-reverse`.
- **Alignment**: `justify-content` (start, center, end, space-between, space-around) and `align-items` (start, center, end, stretch).
- **Gap & Wrap**: Numeric or CSS unit gap controls with flex wrapping.

### 3. Spacing Box Model
- Visual interactive margin and padding model widget.
- Individual controls for top, right, bottom, and left or unified locked values.
- Support for `px`, `rem`, `%`, `em`, and CSS variable values.

### 4. Typography
- Font Family selector with Google Fonts integrations.
- Font Size, Line Height, Letter Spacing, and Font Weight sliders.
- Text Align: `left`, `center`, `right`, `justify`.
- Text Transform: `uppercase`, `lowercase`, `capitalize`, `none`.

### 5. Colors, Backgrounds & Borders
- Solid colors, linear gradients, and background image pickers with opacity control.
- Border Width, Border Style (`solid`, `dashed`, `dotted`), Border Color, and Border Radius (individual corner rounding).
- Box Shadow presets and custom elevation values.

## Responsive Breakpoint Overrides

KUBUILD supports mobile-first and desktop-first styling overrides per node. When you change the viewport in the top toolbar to **Tablet** or **Mobile**, any styling property adjusted in the inspector will automatically be stored under the node's `responsive` property map:

```json
{
  "id": "hero-heading-1",
  "type": "Heading",
  "styles": {
    "fontSize": "48px",
    "lineHeight": "1.2",
    "color": "#0f172a"
  },
  "responsive": {
    "tablet": {
      "fontSize": "36px"
    },
    "mobile": {
      "fontSize": "28px",
      "textAlign": "center"
    }
  }
}
```

## Dynamic Data Variable Binding

Any text, image source, or component property can be bound to dynamic data using the **Variable Picker** icon (`{ }`) next to the input field. Bindings use mustache templates such as `{{customer.name}}` or `{{order.total_price}}`.
