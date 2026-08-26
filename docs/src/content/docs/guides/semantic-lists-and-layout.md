---
title: 'Semantic Lists & Layout Hierarchies'
description: 'Building accessible bulleted/numbered lists, multi-column layouts, and responsive flex containers.'
---

# Semantic Lists & Layout Hierarchies

Accessible and clean DOM hierarchies are core to KUBUILD's rendering output.

## Layout Hierarchy Rules

KUBUILD enforces strict structural hierarchy constraints:

```
Page (Root)
└── Section (Full-width row)
    └── Container / Columns (Constrained width wrapper)
        └── Content Nodes (Heading, Text, Button, Table, List, Box)
```

- A `page` is always the root and cannot be nested inside another element.
- `section` represents full-width vertical blocks (e.g. Hero, Features, Pricing, Footer).
- `container` and `columns` constrain max-width and define responsive column splits.
- Content elements (`heading`, `text`, `image`, `button`, etc.) sit inside containers.

## Semantic Lists

KUBUILD provides native semantic list primitives:

- **`unordered-list`**: Compiles to accessible `<ul>` with customizable bullet markers (dots, checks, dashes, or none).
- **`ordered-list`**: Compiles to `<ol>` with decimal, roman, or alphabetical numbering.
- **`list-item`**: Compiles to `<li>` supporting nested inline text, icons, and badges.

### Adding List Items in the Canvas

1. Drag an `Unordered List` or `Ordered List` component onto a container.
2. Double-click any item to edit text inline.
3. Press `Enter` at the end of a list item to instantly create the next list item.
4. Press `Backspace` on an empty item to delete it.
