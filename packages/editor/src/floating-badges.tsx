import React from 'react';
import { PageDocument } from '@kubuild/schema';
import { ComponentRegistry } from '@kubuild/components';
import { findNodeById, getParentNodeId } from '@kubuild/core';
import { useEditorStore } from './store';

export interface FloatingActionBadgesProps {
  selectedNodeId: string;
  document: PageDocument;
  registry: ComponentRegistry;
  selectedRect: {
    top: number;
    left: number;
    width: number;
    height: number;
  };
  onDragStart?: (e: React.DragEvent) => void;
}

/**
 * Floating Action Badges rendered above the active bounding box on the canvas — STORA-230.
 * Includes:
 *  - Component Type / Tag Badge
 *  - ⬆️ Select Parent
 *  - 🖐️ Move Handle
 *  - 📑 Duplicate
 *  - 🗑️ Delete
 */
export const FloatingActionBadges: React.FC<FloatingActionBadgesProps> = ({
  selectedNodeId,
  document,
  registry,
  selectedRect,
  onDragStart,
}) => {
  const { selectNode, duplicateComponent, deleteComponent } = useEditorStore();

  const node = findNodeById(document.document, selectedNodeId);
  if (!node) return null;

  const isRoot = node.id === document.document.id;
  const parentId = getParentNodeId(document.document, node.id);
  const definition = registry.get(node.type);
  const label = definition?.label || node.type;

  // Position badge directly above the bounding box top, clamped within canvas viewport
  const topPos = selectedRect.top >= 28 ? selectedRect.top - 26 : selectedRect.top;
  const leftPos = selectedRect.left;

  return (
    <div
      data-testid="floating-action-badges"
      className="absolute flex items-center bg-blue-600 text-white rounded shadow-md text-xs font-medium z-50 select-none overflow-hidden"
      style={{
        top: `${topPos}px`,
        left: `${leftPos}px`,
        pointerEvents: 'auto',
        transform: selectedRect.top < 28 ? 'translateY(0)' : 'translateY(-100%)',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Element Tag Label */}
      <span
        data-testid="floating-badge-label"
        className="px-2 py-1 bg-blue-700 font-semibold tracking-wide flex items-center gap-1"
      >
        {label}
      </span>

      {/* ⬆️ Select Parent Button */}
      {parentId && (
        <button
          type="button"
          data-testid="floating-badge-select-parent"
          title="Select Parent (⬆)"
          aria-label="Select Parent"
          onClick={() => selectNode(parentId)}
          className="px-1.5 py-1 hover:bg-blue-500 active:bg-blue-700 transition flex items-center justify-center border-l border-blue-500/40 text-[11px]"
        >
          <span aria-hidden="true">⬆️</span>
        </button>
      )}

      {/* 🖐️ Move Handle */}
      {!isRoot && (
        <div
          data-testid="floating-badge-move"
          title="Move / Drag"
          aria-label="Move"
          draggable={true}
          onDragStart={onDragStart}
          className="px-1.5 py-1 hover:bg-blue-500 active:bg-blue-700 cursor-grab active:cursor-grabbing transition flex items-center justify-center border-l border-blue-500/40 text-[11px]"
        >
          <span aria-hidden="true">🖐️</span>
        </div>
      )}

      {/* 📑 Duplicate Button */}
      {!isRoot && (
        <button
          type="button"
          data-testid="floating-badge-duplicate"
          title="Duplicate (⌘D)"
          aria-label="Duplicate"
          onClick={() => duplicateComponent(node.id, registry)}
          className="px-1.5 py-1 hover:bg-blue-500 active:bg-blue-700 transition flex items-center justify-center border-l border-blue-500/40 text-[11px]"
        >
          <span aria-hidden="true">📑</span>
        </button>
      )}

      {/* 🗑️ Delete Button */}
      {!isRoot && (
        <button
          type="button"
          data-testid="floating-badge-delete"
          title="Delete (Backspace / Del)"
          aria-label="Delete"
          onClick={() => deleteComponent(node.id)}
          className="px-1.5 py-1 hover:bg-red-500 active:bg-red-700 transition flex items-center justify-center border-l border-blue-500/40 text-[11px]"
        >
          <span aria-hidden="true">🗑️</span>
        </button>
      )}
    </div>
  );
};
