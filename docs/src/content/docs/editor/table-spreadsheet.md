---
title: 'Table & Spreadsheet Visual Editor'
description: 'Spreadsheet-grade visual table builder, cell formatting, merges, and formula support.'
---

# Table & Spreadsheet Visual Editor

KUBUILD includes a visual spreadsheet and data grid editor for designing responsive pricing tables, data comparison charts, invoice templates, and structured layouts without writing raw HTML `<table>` markup.

## Activation & Modes

When a `Table` component is selected in the canvas or layers tree, the Table Spreadsheet toolbar and editor panel become active.

The editor supports two modes:
- **Docked Mode**: Embedded directly beneath or beside the canvas.
- **Floating Window Mode**: A movable, resizable spreadsheet modal hovering above the canvas for full-width multi-column editing.

```tsx
import { TableSpreadsheetEditor } from '@kubuild/editor';

<TableSpreadsheetEditor
  registry={registry}
  tableNode={activeTableNode}
  mode="floating" // 'floating' | 'docked' | 'hidden'
  onToggleMode={() => toggleSpreadsheetMode()}
  onClose={() => closeSpreadsheet()}
/>
```

## Spreadsheet Operations

### 1. Row & Column Management
- **Add Row Above / Below**: Insert new empty rows at any position.
- **Add Column Left / Right**: Insert new table columns.
- **Delete Row / Column**: Safely remove rows or columns while re-indexing merges.
- **Header Row / Column Toggles**: Convert standard `<td>` cells into semantic `<th>` header tags with custom styling.

### 2. Cell Selection & Multi-Cell Merging
- Click and drag across a grid selection to select a range of cells.
- **Merge Cells**: Combines the bounding box into a single cell with proper `colspan` and `rowspan` attributes.
- **Unmerge Cells**: Restores merged blocks back into standard uniform cells.

### 3. Visual Cell Formatting
- **Cell Alignment**: Horizontal (`left`, `center`, `right`) and Vertical (`top`, `middle`, `bottom`).
- **Cell Background & Borders**: Independent background fill and border styles per cell or selection.
- **Typography & Wrap**: Bold, italic, font sizing, and white-space wrap settings.

### 4. Formulas & Data Bindings
- Support for inline variable interpolation: `{{item.price | currency}}` or `{{pricing[index].plan}}`.
- Summary calculations and aggregate rows (e.g. `SUM`, `AVG`).
