import React, { useState, useRef, useEffect } from 'react';
import { Node } from '@kubuild/schema';
import { ComponentRegistry } from '@kubuild/components';
import { findNodeById, getAncestorChain, deepClone } from '@kubuild/core';
import { useEditorStore } from './store';
import { ComponentIcon } from './icons';

export interface TableSpreadsheetEditorProps {
  registry: ComponentRegistry;
  tableNode?: Node | null;
  mode?: 'floating' | 'docked';
  onClose?: () => void;
  onToggleMode?: () => void;
  className?: string;
}

export function findActiveTableNode(documentRoot: Node, selectedNodeId: string | null): Node | null {
  if (!selectedNodeId) return null;
  const node = findNodeById(documentRoot, selectedNodeId);
  if (!node) return null;
  if (node.type === 'table') return node;

  const ancestors = getAncestorChain(documentRoot, selectedNodeId);
  for (let i = ancestors.length - 1; i >= 0; i--) {
    const anc = findNodeById(documentRoot, ancestors[i]);
    if (anc && anc.type === 'table') {
      return anc;
    }
  }
  return null;
}

const COLUMN_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentVal = '';
  let insideQuotes = false;

  const str = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    const nextChar = str[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        currentVal += '"';
        i++;
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if ((char === ',' || char === '\t' || char === ';') && !insideQuotes) {
      currentRow.push(currentVal.trim());
      currentVal = '';
    } else if (char === '\n' && !insideQuotes) {
      currentRow.push(currentVal.trim());
      if (currentRow.some((c) => c.length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentVal = '';
    } else {
      currentVal += char;
    }
  }

  if (currentVal.length > 0 || currentRow.length > 0) {
    currentRow.push(currentVal.trim());
    if (currentRow.some((c) => c.length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
}

function getColumnLabel(index: number): string {
  if (index < 26) return COLUMN_LETTERS[index];
  const first = COLUMN_LETTERS[Math.floor(index / 26) - 1];
  const second = COLUMN_LETTERS[index % 26];
  return `${first}${second}`;
}

export const TableSpreadsheetEditor: React.FC<TableSpreadsheetEditorProps> = ({
  registry,
  tableNode: propTableNode,
  mode = 'floating',
  onClose,
  onToggleMode,
  className = '',
}) => {
  const {
    document,
    selectedNodeId,
    selectNode,
    insertComponent,
    deleteComponent,
    updateNodeProps,
    dispatch,
  } = useEditorStore();

  const tableNode = propTableNode ?? findActiveTableNode(document.document, selectedNodeId);

  // CSV Import State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [csvInputText, setCsvInputText] = useState('');
  const [hasHeaderRow, setHasHeaderRow] = useState(true);
  const [importMode, setImportMode] = useState<'replace' | 'append'>('replace');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setCsvInputText(content);
        setIsImportModalOpen(true);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleExecuteImport = () => {
    if (!csvInputText.trim() || !tableNode) return;
    const parsedRows = parseCsv(csvInputText);
    if (parsedRows.length === 0) return;

    const parsedMaxCols = Math.max(...parsedRows.map((r) => r.length));

    const newRowNodes: Node[] = parsedRows.map((row, rowIdx) => {
      const isHeader = hasHeaderRow && (importMode === 'replace' ? rowIdx === 0 : false);
      const rowId = `row_${Date.now()}_${rowIdx}_${Math.random().toString(36).substring(2, 7)}`;
      const cells: Node[] = Array.from({ length: parsedMaxCols }).map((_, colIdx) => ({
        id: `cell_${Date.now()}_${rowIdx}_${colIdx}_${Math.random().toString(36).substring(2, 7)}`,
        type: 'table-cell',
        props: {
          tag: isHeader ? 'th' : 'td',
          text: row[colIdx] ?? '',
        },
      }));

      return {
        id: rowId,
        type: 'table-row',
        children: cells,
      };
    });

    dispatch((doc) => {
      const nextDoc = deepClone(doc);
      const tbl = findNodeById(nextDoc.document, tableNode.id);
      if (!tbl) {
        throw new Error('Table not found');
      }
      if (importMode === 'replace') {
        tbl.children = newRowNodes;
      } else {
        tbl.children = [...(tbl.children || []), ...newRowNodes];
      }
      return {
        document: nextDoc,
        event: {
          type: 'NODE_INSERTED',
          timestamp: new Date().toISOString(),
          nodeId: tableNode.id,
        },
      };
    });

    setIsImportModalOpen(false);
    setCsvInputText('');
  };

  // Floating window position
  const [pos, setPos] = useState({ x: 260, y: 120 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ startX: number; startY: number; posX: number; posY: number }>({
    startX: 0,
    startY: 0,
    posX: 260,
    posY: 120,
  });

  const handleHeaderMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button, input, select, textarea')) return;
    setIsDragging(true);
    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      posX: pos.x,
      posY: pos.y,
    };
  };

  useEffect(() => {
    if (!isDragging) return;
    const handleMouseMove = (e: MouseEvent) => {
      const dx = e.clientX - dragStartRef.current.startX;
      const dy = e.clientY - dragStartRef.current.startY;
      setPos({
        x: Math.max(10, Math.min(window.innerWidth - 350, dragStartRef.current.posX + dx)),
        y: Math.max(10, Math.min(window.innerHeight - 150, dragStartRef.current.posY + dy)),
      });
    };
    const handleMouseUp = () => {
      setIsDragging(false);
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  if (!tableNode) return null;

  const rows = (tableNode.children || []).filter((child) => child.type === 'table-row');
  const maxCols = Math.max(
    1,
    ...rows.map((row) => (row.children || []).filter((c) => c.type === 'table-cell').length),
  );

  // Table operations
  const handleAddRow = () => {
    const result = insertComponent('table-row', registry, tableNode.id);
    if (result.success && result.nodeId) {
      for (let i = 0; i < maxCols; i++) {
        insertComponent('table-cell', registry, result.nodeId);
      }
    }
  };

  const handleAddColumn = () => {
    if (rows.length === 0) {
      const result = insertComponent('table-row', registry, tableNode.id);
      if (result.success && result.nodeId) {
        insertComponent('table-cell', registry, result.nodeId);
      }
      return;
    }

    rows.forEach((row, rowIdx) => {
      const isHeaderRow = rowIdx === 0 && row.children?.[0]?.props?.tag === 'th';
      const cellResult = insertComponent('table-cell', registry, row.id);
      if (cellResult.success && cellResult.nodeId && isHeaderRow) {
        updateNodeProps(cellResult.nodeId, { tag: 'th', text: `Header ${maxCols + 1}` }, registry);
      }
    });
  };

  const handleDeleteColumn = (colIndex: number) => {
    if (maxCols <= 1) return;
    rows.forEach((row) => {
      const cells = (row.children || []).filter((c) => c.type === 'table-cell');
      if (cells[colIndex]) {
        deleteComponent(cells[colIndex].id);
      }
    });
  };

  // Input references for keyboard navigation
  const inputRefs = useRef<Map<string, HTMLInputElement>>(new Map());

  const focusCell = (r: number, c: number) => {
    const targetRow = rows[r];
    if (!targetRow) return;
    const targetCells = (targetRow.children || []).filter((ch) => ch.type === 'table-cell');
    const targetCell = targetCells[c];
    if (targetCell) {
      selectNode(targetCell.id);
      const inputEl = inputRefs.current.get(`${r},${c}`);
      if (inputEl) {
        inputEl.focus();
        inputEl.select?.();
      }
    }
  };

  const handleCellKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    rowIdx: number,
    colIdx: number,
  ) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      if (e.shiftKey) {
        // Shift+Tab: Move to previous cell
        if (colIdx > 0) {
          focusCell(rowIdx, colIdx - 1);
        } else if (rowIdx > 0) {
          const prevRowCells = (rows[rowIdx - 1]?.children || []).filter(
            (ch) => ch.type === 'table-cell',
          );
          focusCell(rowIdx - 1, Math.max(0, prevRowCells.length - 1));
        }
      } else {
        // Tab: Move to next cell
        if (colIdx < maxCols - 1) {
          focusCell(rowIdx, colIdx + 1);
        } else if (rowIdx < rows.length - 1) {
          focusCell(rowIdx + 1, 0);
        } else {
          // At the very last cell -> Create new row and focus first cell
          const result = insertComponent('table-row', registry, tableNode.id);
          if (result.success && result.nodeId) {
            for (let i = 0; i < maxCols; i++) {
              insertComponent('table-cell', registry, result.nodeId);
            }
            setTimeout(() => focusCell(rowIdx + 1, 0), 40);
          }
        }
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) {
        // Shift+Enter: Move to cell above
        if (rowIdx > 0) {
          focusCell(rowIdx - 1, colIdx);
        }
      } else {
        // Enter: Move to cell below or create new row if on last row
        if (rowIdx < rows.length - 1) {
          focusCell(rowIdx + 1, colIdx);
        } else {
          const result = insertComponent('table-row', registry, tableNode.id);
          if (result.success && result.nodeId) {
            for (let i = 0; i < maxCols; i++) {
              insertComponent('table-cell', registry, result.nodeId);
            }
            setTimeout(() => focusCell(rowIdx + 1, colIdx), 40);
          }
        }
      }
    } else if (e.key === 'ArrowUp') {
      if (rowIdx > 0) {
        e.preventDefault();
        focusCell(rowIdx - 1, colIdx);
      }
    } else if (e.key === 'ArrowDown') {
      if (rowIdx < rows.length - 1) {
        e.preventDefault();
        focusCell(rowIdx + 1, colIdx);
      }
    }
  };

  const isFloating = mode === 'floating';

  const content = (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Hidden file input for CSV */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,text/csv,text/plain"
        onChange={handleFileUpload}
        className="hidden"
      />

      {/* CSV Import Modal */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <span className="p-1.5 bg-emerald-100 text-emerald-700 rounded-lg">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="8" y1="13" x2="16" y2="13" />
                    <line x1="8" y1="17" x2="16" y2="17" />
                  </svg>
                </span>
                <div>
                  <h3 className="text-sm font-semibold text-slate-800">Import CSV into Table</h3>
                  <p className="text-xs text-slate-500">Upload file or paste CSV / TSV text directly</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsImportModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 flex flex-col gap-3">
              <div>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-slate-50 hover:bg-slate-100 border border-slate-300 border-dashed rounded-lg text-xs font-medium text-slate-700 transition"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  <span>Select / Upload .csv File</span>
                </button>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Or Paste CSV / Tab-Separated Data:
                </label>
                <textarea
                  rows={5}
                  value={csvInputText}
                  onChange={(e) => setCsvInputText(e.target.value)}
                  placeholder="Header 1, Header 2, Header 3&#10;Value 1, Value 2, Value 3&#10;Value 4, Value 5, Value 6"
                  className="w-full text-xs font-mono p-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none bg-slate-50 text-slate-900"
                />
              </div>

              {/* Options */}
              <div className="grid grid-cols-2 gap-3 pt-1 border-t border-slate-100 text-xs">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={hasHeaderRow}
                    onChange={(e) => setHasHeaderRow(e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="text-slate-700 font-medium">First row is Header (&lt;th&gt;)</span>
                </label>

                <div className="flex items-center gap-3">
                  <span className="text-slate-500">Mode:</span>
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input
                      type="radio"
                      name="csv-import-mode"
                      checked={importMode === 'replace'}
                      onChange={() => setImportMode('replace')}
                      className="text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="text-slate-700">Replace</span>
                  </label>
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input
                      type="radio"
                      name="csv-import-mode"
                      checked={importMode === 'append'}
                      onChange={() => setImportMode('append')}
                      className="text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="text-slate-700">Append</span>
                  </label>
                </div>
              </div>

              {/* Live Preview info */}
              {csvInputText.trim() && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 text-xs text-emerald-800 flex items-center justify-between">
                  <span>
                    Detected: {parseCsv(csvInputText).length} rows,{' '}
                    {Math.max(0, ...parseCsv(csvInputText).map((r) => r.length))} columns
                  </span>
                  <span className="font-semibold text-emerald-700">Ready to import</span>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-2 px-4 py-3 bg-slate-50 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setIsImportModalOpen(false)}
                className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-200 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!csvInputText.trim()}
                onClick={handleExecuteImport}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:pointer-events-none rounded-lg shadow-sm transition"
              >
                Import to Table
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toolbar / Actions inside Spreadsheet */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-slate-100/90 border-b border-slate-200 text-xs select-none">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-700 flex items-center gap-1.5">
            <ComponentIcon iconOrType="table" size={14} />
            <span>Table Grid ({rows.length} × {maxCols})</span>
          </span>
          <span className="text-[10px] text-slate-400 font-mono">#{tableNode.id}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setIsImportModalOpen(true)}
            title="Import CSV data into table"
            className="flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded shadow-xs transition"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            <span>Import CSV</span>
          </button>
          <button
            type="button"
            onClick={handleAddRow}
            className="flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-blue-600 bg-white hover:bg-blue-50 border border-slate-300 rounded shadow-xs transition"
          >
            <span>+ Row</span>
          </button>
          <button
            type="button"
            onClick={handleAddColumn}
            className="flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-blue-600 bg-white hover:bg-blue-50 border border-slate-300 rounded shadow-xs transition"
          >
            <span>+ Column</span>
          </button>
          {onToggleMode && (
            <button
              type="button"
              onClick={onToggleMode}
              title={isFloating ? 'Dock to inspector panel' : 'Make floating window'}
              className="p-1 text-slate-500 hover:text-blue-600 hover:bg-slate-200 rounded transition"
            >
              {isFloating ? (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect width="18" height="18" x="3" y="3" rx="2" />
                  <path d="M9 3v18" />
                </svg>
              ) : (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect width="14" height="14" x="7" y="7" rx="2" />
                  <path d="M17 3H5a2 2 0 0 0-2 2v12" />
                </svg>
              )}
            </button>
          )}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              title="Close Spreadsheet view"
              className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition text-xs font-bold"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Spreadsheet Grid Table */}
      <div className="flex-1 overflow-auto p-2 bg-slate-50">
        <table className="border-collapse w-full text-xs bg-white border border-slate-300 shadow-xs">
          <thead>
            <tr className="bg-slate-100 border-b border-slate-300 text-slate-500 select-none">
              <th className="w-9 p-1 text-center font-mono text-[10px] bg-slate-200/80 border-r border-slate-300">
                #
              </th>
              {Array.from({ length: maxCols }).map((_, colIdx) => (
                <th
                  key={colIdx}
                  className="p-1 text-center font-mono text-[11px] font-semibold border-r border-slate-300 group min-w-[100px]"
                >
                  <div className="flex items-center justify-between px-1">
                    <span className="mx-auto">{getColumnLabel(colIdx)}</span>
                    {maxCols > 1 && (
                      <button
                        type="button"
                        onClick={() => handleDeleteColumn(colIdx)}
                        title={`Delete Column ${getColumnLabel(colIdx)}`}
                        className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-600 px-0.5 text-[10px] rounded"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </th>
              ))}
              <th className="w-8 p-1 text-center text-slate-400 font-normal">
                <button
                  type="button"
                  onClick={handleAddColumn}
                  title="Add Column"
                  className="hover:text-blue-600 font-bold"
                >
                  +
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIdx) => {
              const cells = (row.children || []).filter((c) => c.type === 'table-cell');
              const isSelectedRow = row.id === selectedNodeId;

              return (
                <tr
                  key={row.id}
                  className={`border-b border-slate-200 ${
                    isSelectedRow ? 'bg-blue-50/40' : 'hover:bg-slate-50/60'
                  }`}
                >
                  {/* Row Number Header */}
                  <td
                    onClick={() => selectNode(row.id)}
                    title="Click to select row"
                    className="p-1 text-center font-mono text-[10px] text-slate-500 bg-slate-100 border-r border-slate-300 select-none cursor-pointer hover:bg-blue-100 hover:text-blue-700"
                  >
                    {rowIdx + 1}
                  </td>

                  {/* Row Cells */}
                  {Array.from({ length: maxCols }).map((_, colIdx) => {
                    const cell = cells[colIdx];
                    if (!cell) {
                      return (
                        <td
                          key={`empty-${colIdx}`}
                          className="p-1 border-r border-slate-200 bg-slate-50/50 text-center"
                        >
                          <button
                            type="button"
                            onClick={() => insertComponent('table-cell', registry, row.id)}
                            className="text-[10px] text-blue-500 hover:underline"
                          >
                            + Add Cell
                          </button>
                        </td>
                      );
                    }

                    const isHeaderCell = cell.props?.tag === 'th';
                    const isSelectedCell = cell.id === selectedNodeId;
                    const cellText = typeof cell.props?.text === 'string' ? cell.props.text : '';

                    return (
                      <td
                        key={cell.id}
                        onClick={() => selectNode(cell.id)}
                        className={`p-1 border-r border-slate-200 transition relative group ${
                          isSelectedCell
                            ? 'ring-2 ring-blue-500 ring-inset bg-blue-50/80 z-10'
                            : isHeaderCell
                              ? 'bg-slate-100/70 font-semibold'
                              : 'bg-white'
                        }`}
                      >
                        <div className="flex items-center gap-1">
                          <input
                            ref={(el) => {
                              if (el) {
                                inputRefs.current.set(`${rowIdx},${colIdx}`, el);
                              } else {
                                inputRefs.current.delete(`${rowIdx},${colIdx}`);
                              }
                            }}
                            type="text"
                            value={cellText}
                            onChange={(e) =>
                              updateNodeProps(cell.id, { text: e.target.value }, registry)
                            }
                            onKeyDown={(e) => handleCellKeyDown(e, rowIdx, colIdx)}
                            onFocus={() => selectNode(cell.id)}
                            placeholder={isHeaderCell ? 'Header...' : 'Data...'}
                            className={`w-full bg-transparent border-0 focus:outline-none focus:ring-0 text-xs px-1 py-0.5 rounded text-slate-900 ${
                              isHeaderCell ? 'font-semibold text-slate-800' : ''
                            }`}
                          />
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              updateNodeProps(
                                cell.id,
                                { tag: isHeaderCell ? 'td' : 'th' },
                                registry,
                              );
                            }}
                            title={`Current: ${isHeaderCell ? 'Header (TH)' : 'Data (TD)'}. Click to switch.`}
                            className={`opacity-0 group-hover:opacity-100 text-[9px] px-1 py-0.5 rounded font-mono uppercase transition ${
                              isHeaderCell
                                ? 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                          >
                            {isHeaderCell ? 'TH' : 'TD'}
                          </button>
                        </div>
                      </td>
                    );
                  })}

                  {/* Row Delete Action */}
                  <td className="p-1 text-center border-l border-slate-200">
                    <button
                      type="button"
                      onClick={() => deleteComponent(row.id)}
                      title={`Delete Row ${rowIdx + 1}`}
                      className="text-slate-400 hover:text-red-600 p-0.5 rounded text-xs"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );

  if (isFloating) {
    return (
      <div
        style={{ left: `${pos.x}px`, top: `${pos.y}px` }}
        onMouseDown={handleHeaderMouseDown}
        className={`fixed z-40 min-w-[380px] max-w-[620px] bg-white/95 backdrop-blur-md rounded-xl shadow-2xl border border-slate-300 flex flex-col max-h-[460px] overflow-hidden ${className}`}
      >
        {content}
      </div>
    );
  }

  return (
    <div className={`flex flex-col border border-slate-200 rounded-lg overflow-hidden bg-white shadow-xs ${className}`}>
      {content}
    </div>
  );
};
