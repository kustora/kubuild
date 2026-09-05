import React, { useMemo } from 'react';
import { Node } from '@kubuild/schema';
import { CanvasRect } from './smart-guides';
import { parseGridColumns } from '../style-manager/grid-controls';

export interface GridGuidelinesOverlayProps {
  node: Node;
  selectedRect: CanvasRect;
  viewport?: 'desktop' | 'tablet' | 'mobile';
  zoom?: number;
  containerRef?: React.RefObject<HTMLElement | null>;
}

function parseGapPx(value: unknown, fallback = 16): number {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'number') return Math.max(0, value);
  const parsed = parseFloat(String(value));
  return isNaN(parsed) ? fallback : Math.max(0, parsed);
}

function parseRowsCount(templateRows: unknown, fallback = 2): number {
  if (!templateRows || typeof templateRows !== 'string') return fallback;
  const str = templateRows.trim();
  const repeatMatch = str.match(/repeat\(\s*(\d+)\s*,/i);
  if (repeatMatch) {
    return parseInt(repeatMatch[1], 10) || fallback;
  }
  const tokens = str.split(/\s+/).filter(Boolean);
  if (tokens.length > 0 && !tokens.some((t) => t.includes('('))) {
    return Math.min(Math.max(tokens.length, 1), 24);
  }
  return fallback;
}

/**
 * Canvas Grid Guidelines Overlay (STORA-114).
 * When a Grid container node is selected (type === 'grid' or display === 'grid'),
 * renders a visual dashed grid overlay showing column tracks and row tracks with gaps
 * over the selected element.
 */
export const GridGuidelinesOverlay: React.FC<GridGuidelinesOverlayProps> = ({
  node,
  selectedRect,
  viewport = 'desktop',
}) => {
  const baseStyles = (node.styles?.base as Record<string, unknown> | undefined) || {};
  const viewportStyles = (node.styles?.[viewport] as Record<string, unknown> | undefined) || {};
  const styles = { ...baseStyles, ...viewportStyles };

  const { numColumns, numRows, colGap, rowGap } = useMemo(() => {
    const rawCols = styles.gridTemplateColumns;
    const colsCount = parseGridColumns(rawCols) || Number(node.props?.columns) || 3;
    const numCols = Math.max(1, Math.min(colsCount, 24));

    const childCount = node.children?.length ?? 0;
    const computedRows = Math.max(1, Math.ceil(childCount / numCols));
    const rawRows = styles.gridTemplateRows;
    const numRows = parseRowsCount(rawRows, childCount > 0 ? computedRows : 2);

    const cGap = parseGapPx(styles.columnGap ?? styles.gap ?? node.props?.gap, 16);
    const rGap = parseGapPx(styles.rowGap ?? styles.gap ?? node.props?.gap, 16);

    return {
      numColumns: numCols,
      numRows: Math.max(1, Math.min(numRows, 24)),
      colGap: cGap,
      rowGap: rGap,
    };
  }, [styles, node.props, node.children]);

  // Generate cells
  const cells = useMemo(() => {
    const list: Array<{ col: number; row: number }> = [];
    for (let r = 1; r <= numRows; r++) {
      for (let c = 1; c <= numColumns; c++) {
        list.push({ col: c, row: r });
      }
    }
    return list;
  }, [numColumns, numRows]);

  const columnTracks = useMemo(() => {
    return Array.from({ length: numColumns }, (_, i) => i + 1);
  }, [numColumns]);

  const rowTracks = useMemo(() => {
    return Array.from({ length: numRows }, (_, i) => i + 1);
  }, [numRows]);

  return (
    <div
      data-testid="grid-guidelines-overlay"
      aria-hidden="true"
      role="presentation"
      style={{
        position: 'absolute',
        pointerEvents: 'none',
        top: selectedRect.top,
        left: selectedRect.left,
        width: selectedRect.width,
        height: selectedRect.height,
        display: 'grid',
        gridTemplateColumns: `repeat(${numColumns}, minmax(0, 1fr))`,
        gridTemplateRows: `repeat(${numRows}, minmax(0, 1fr))`,
        columnGap: `${colGap}px`,
        rowGap: `${rowGap}px`,
        zIndex: 35,
        boxSizing: 'border-box',
      }}
    >
      {/* Column Track Guidelines Indicators */}
      {columnTracks.map((colIdx) => (
        <div
          key={`col-track-${colIdx}`}
          data-testid="grid-column-track"
          data-column-index={colIdx}
          style={{
            position: 'absolute',
            top: -18,
            left: `calc(${(colIdx - 1) * (100 / numColumns)}% + 2px)`,
            fontSize: '9px',
            fontFamily: 'monospace',
            fontWeight: 600,
            color: '#2563eb',
            backgroundColor: 'rgba(239, 246, 255, 0.95)',
            border: '1px solid #93c5fd',
            borderRadius: '2px',
            padding: '1px 4px',
            lineHeight: 1,
            whiteSpace: 'nowrap',
            zIndex: 36,
          }}
        >
          {`Col ${colIdx}`}
        </div>
      ))}

      {/* Row Track Guidelines Indicators */}
      {rowTracks.map((rowIdx) => (
        <div
          key={`row-track-${rowIdx}`}
          data-testid="grid-row-track"
          data-row-index={rowIdx}
          style={{
            position: 'absolute',
            left: -32,
            top: `calc(${(rowIdx - 1) * (100 / numRows)}% + 2px)`,
            fontSize: '9px',
            fontFamily: 'monospace',
            fontWeight: 600,
            color: '#2563eb',
            backgroundColor: 'rgba(239, 246, 255, 0.95)',
            border: '1px solid #93c5fd',
            borderRadius: '2px',
            padding: '1px 3px',
            lineHeight: 1,
            whiteSpace: 'nowrap',
            zIndex: 36,
          }}
        >
          {`R${rowIdx}`}
        </div>
      ))}

      {/* Visual Dashed Grid Cells */}
      {cells.map(({ col, row }) => (
        <div
          key={`cell-${col}-${row}`}
          data-testid="grid-cell-guide"
          data-column={col}
          data-row={row}
          style={{
            position: 'relative',
            border: '1px dashed #3b82f6',
            backgroundColor: 'rgba(59, 130, 246, 0.04)',
            boxSizing: 'border-box',
            minHeight: '20px',
            overflow: 'hidden',
          }}
        >
          <span
            data-testid="grid-cell-coords"
            style={{
              position: 'absolute',
              top: 2,
              left: 2,
              fontSize: '9px',
              fontFamily: 'monospace',
              color: '#1d4ed8',
              backgroundColor: 'rgba(239, 246, 255, 0.9)',
              padding: '1px 3px',
              borderRadius: '2px',
              lineHeight: 1,
              userSelect: 'none',
            }}
          >
            {`${col},${row}`}
          </span>
        </div>
      ))}

      {/* Visual Gap Indicators when colGap or rowGap > 0 */}
      {(colGap > 0 || rowGap > 0) && (
        <div
          data-testid="grid-gap-indicator"
          style={{
            position: 'absolute',
            bottom: 2,
            right: 2,
            fontSize: '8px',
            fontFamily: 'monospace',
            color: '#d97706',
            backgroundColor: 'rgba(254, 243, 199, 0.9)',
            border: '1px solid #fcd34d',
            padding: '1px 4px',
            borderRadius: '2px',
            zIndex: 37,
          }}
        >
          {`Gap: ${colGap}px${colGap !== rowGap ? ` / ${rowGap}px` : ''}`}
        </div>
      )}
    </div>
  );
};
