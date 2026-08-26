---
title: 'Working with Tables & Data Grids'
description: 'How to build pricing tables, spreadsheets, data comparisons, and formula calculations in KUBUILD.'
---

# Working with Tables & Data Grids

KUBUILD includes dedicated tools for visual table authoring, supporting structured data grids, cell span merges, custom borders, and dynamic formula calculations.

## Inserting a Table

1. Open the **Component Palette** on the left panel.
2. Under the **Data / Content** category, drag the **Table** component onto the canvas or a container.
3. By default, a 3x3 table with a header row is created.

## Using the Table Spreadsheet Toolbar

When you select a table in the canvas:
- The **Spreadsheet Editor** toolbar appears above the table.
- You can switch between **Docked** and **Floating Window** modes.

### Operations

- **Add Column Right / Left**: Click `+ Col` to expand columns.
- **Add Row Above / Below**: Click `+ Row` to add new data rows.
- **Cell Merges (`colspan` / `rowspan`)**: Select adjacent cells and click **Merge Cells**. KUBUILD automatically handles internal cell indexing without breaking HTML table validity.
- **Header Conversion**: Click on any cell and toggle `isHeader: true` to turn it into a `<th>` with bold typography and header semantics.

## Dynamic Table Data Binding

You can populate table rows dynamically using array variables:

```json
{
  "type": "table",
  "props": {
    "dataBinding": "{{pricingPlans}}",
    "columns": [
      { "key": "name", "header": "Plan Name" },
      { "key": "price", "header": "Monthly Price" },
      { "key": "storage", "header": "Storage Limit" }
    ]
  }
}
```
