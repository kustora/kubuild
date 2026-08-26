---
title: 'Direct Inline Text Editing'
description: 'In-canvas text editing and formatting in the KUBUILD visual builder.'
---

# Direct Inline Text Editing

KUBUILD provides inline text editing on canvas elements without having to switch focus to side inspectors.

## How It Works

1. **Activate Edit Mode**: Double-click any element with a `text` or `children` string property (such as `Heading`, `Text`, `Button`, `ListItem`, `Badge`, etc.).
2. **Type & Format**: The canvas overlays a content-editable inline container preserving the element's exact font size, line-height, letter spacing, font weight, and color.
3. **Rich Text Formatting**: Use the floating quick-formatting toolbar to apply **Bold**, *Italic*, <u>Underline</u>, text color highlights, and font weight adjustments.
4. **Commit Changes**: Click outside the element, press `Escape`, or hit `Enter` (for single-line headings/buttons) to commit the updated content directly into the document AST and history stack.

## Supported Node Types

Direct text editing is automatically enabled for components that implement string or rich-text content, including:

- `Heading` (`text` / `level` 1–6)
- `Text` / Paragraph (`text`)
- `Button` (`label` / `text`)
- `ListItem` (`text`)
- `Badge` (`label`)
- `Table` Cells (`data.cells[row][col]`)

## Inline Formatting Toolbar

When selecting text within an active inline editing session, a contextual micro-toolbar appears above the selection providing instant actions:

- **Bold (`Cmd+B` / `Ctrl+B`)**: Toggles `font-weight: 700` or wraps in `<strong>`.
- **Italic (`Cmd+I` / `Ctrl+I`)**: Toggles `font-style: italic` or wraps in `<em>`.
- **Underline (`Cmd+U` / `Ctrl+U`)**: Toggles `text-decoration: underline`.
- **Variable Insertion**: Insert dynamic placeholders such as `{{user.name}}` directly into the text stream.

## Programmatic Interaction

When developing custom components that support inline text editing, define the component definition with the `editableTextProp` metadata:

```ts
import { ComponentDefinition } from '@kubuild/components';

export const CustomHeroDefinition: ComponentDefinition = {
  type: 'CustomHero',
  name: 'Custom Hero',
  category: 'Marketing',
  editableTextProp: 'title', // Tells the editor which property to edit inline
  defaultProps: {
    title: 'Transform your workflow today',
    subtitle: 'Powerful visual editing tools built for modern teams.',
  },
  // ...
};
```
