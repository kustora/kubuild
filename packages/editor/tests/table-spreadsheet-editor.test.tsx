import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { createDefaultComponentRegistry } from '@kubuild/components';
import { createBlankDocument } from '@kubuild/core';
import { TableSpreadsheetEditor, findActiveTableNode, parseCsv } from '../src/components/table-editor/table-spreadsheet-editor';
import { useEditorStore } from '../src/store';

describe('Table Spreadsheet Editor', () => {
  const registry = createDefaultComponentRegistry();

  it('findActiveTableNode finds table node from table, row, or cell selection', () => {
    const doc = createBlankDocument('Table Search Test');
    doc.document.children = [
      {
        id: 'tbl-1',
        type: 'table',
        children: [
          {
            id: 'row-1',
            type: 'table-row',
            children: [
              { id: 'cell-1', type: 'table-cell', props: { tag: 'th', text: 'Col 1' } },
            ],
          },
        ],
      },
    ];

    // Selecting table itself
    expect(findActiveTableNode(doc.document, 'tbl-1')?.id).toBe('tbl-1');
    // Selecting child table-row
    expect(findActiveTableNode(doc.document, 'row-1')?.id).toBe('tbl-1');
    // Selecting child table-cell
    expect(findActiveTableNode(doc.document, 'cell-1')?.id).toBe('tbl-1');
    // Selecting root page (non-table)
    expect(findActiveTableNode(doc.document, 'root-page')).toBeNull();
  });

  it('renders spreadsheet grid with column headers, row indices, and cell inputs', () => {
    const doc = createBlankDocument('Spreadsheet Render Test');
    const tableNode = {
      id: 'tbl-demo',
      type: 'table',
      children: [
        {
          id: 'row-1',
          type: 'table-row',
          children: [
            { id: 'cell-1', type: 'table-cell', props: { tag: 'th', text: 'Product' } },
            { id: 'cell-2', type: 'table-cell', props: { tag: 'th', text: 'Price' } },
          ],
        },
        {
          id: 'row-2',
          type: 'table-row',
          children: [
            { id: 'cell-3', type: 'table-cell', props: { tag: 'td', text: 'Basic' } },
            { id: 'cell-4', type: 'table-cell', props: { tag: 'td', text: '$19' } },
          ],
        },
      ],
    };
    doc.document.children = [tableNode];

    useEditorStore.getState().setDocument(doc);
    useEditorStore.getState().selectNode('tbl-demo');

    // Render floating mode with direct tableNode prop
    const floatingHtml = renderToString(
      <TableSpreadsheetEditor registry={registry} tableNode={tableNode} mode="floating" />
    );
    expect(floatingHtml).toContain('Table Grid');
    expect(floatingHtml).toContain('Import CSV');
    expect(floatingHtml).toContain('Product');
    expect(floatingHtml).toContain('Price');
    expect(floatingHtml).toContain('Basic');
    expect(floatingHtml).toContain('$19');
    expect(floatingHtml).toContain('+ Row');
    expect(floatingHtml).toContain('+ Column');

    // Render docked mode
    const dockedHtml = renderToString(
      <TableSpreadsheetEditor registry={registry} tableNode={tableNode} mode="docked" />
    );
    expect(dockedHtml).toContain('Table Grid');
    expect(dockedHtml).toContain('Import CSV');
    expect(dockedHtml).toContain('Product');
  });

  it('supports spreadsheet keyboard shortcut handling logic', () => {
    const doc = createBlankDocument('Spreadsheet Shortcuts Test');
    useEditorStore.getState().setDocument(doc);
    const secResult = useEditorStore.getState().insertComponent('section', registry, doc.document.id);
    const conResult = useEditorStore.getState().insertComponent('container', registry, secResult.nodeId!);
    const result = useEditorStore.getState().insertComponent('table', registry, conResult.nodeId!);
    expect(result.success).toBe(true);

    const tblNode = findActiveTableNode(useEditorStore.getState().document.document, result.nodeId!);
    expect(tblNode).toBeDefined();
    expect(tblNode?.children?.length).toBe(2);
  });

  it('parses CSV data including quotes, commas, tabs, and multiline values', () => {
    const csvData = `Plan,Price,"Features, Notes"\nStarter,$10,"Basic support, 1 user"\nPro,$29,"Priority support, 5 users"`;
    const parsed = parseCsv(csvData);

    expect(parsed.length).toBe(3);
    expect(parsed[0]).toEqual(['Plan', 'Price', 'Features, Notes']);
    expect(parsed[1]).toEqual(['Starter', '$10', 'Basic support, 1 user']);
    expect(parsed[2]).toEqual(['Pro', '$29', 'Priority support, 5 users']);
  });
});
