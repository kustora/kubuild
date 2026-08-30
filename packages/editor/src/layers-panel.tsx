import React, { useEffect, useState, useRef } from 'react';
import { Node } from '@kubuild/schema';
import { ComponentRegistry } from '@kubuild/components';
import { findNodeById, findNodeLocation, isDescendantOf, getAncestorChain } from '@kubuild/core';
import { useEditorStore } from './store';
import { ComponentIcon } from './icons';
import { ChevronDown, ChevronRight, X, GripVertical } from 'lucide-react';

export interface LayersPanelProps {
  registry: ComponentRegistry;
  className?: string;
}

interface DropCandidate {
  parentId: string;
  index?: number;
  position: 'before' | 'after' | 'inside';
}

export const LayersPanel: React.FC<LayersPanelProps> = ({ registry, className }) => {
  const {
    document,
    selectedNodeId,
    hoveredNodeId,
    navigatorMode,
    setNavigatorMode,
    selectNode,
    hoverNode,
    moveComponent,
  } = useEditorStore();

  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set([document.document.id]));
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropCandidate, setDropCandidate] = useState<DropCandidate | null>(null);

  // Floating window position state
  const [pos, setPos] = useState({ x: 280, y: 70 });
  const [isDraggingWindow, setIsDraggingWindow] = useState(false);
  const dragStartRef = useRef<{ startX: number; startY: number; posX: number; posY: number }>({
    startX: 0,
    startY: 0,
    posX: 280,
    posY: 70,
  });

  const handleHeaderMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    setIsDraggingWindow(true);
    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      posX: pos.x,
      posY: pos.y,
    };
  };

  useEffect(() => {
    if (!isDraggingWindow) return;
    const handleMouseMove = (e: MouseEvent) => {
      const dx = e.clientX - dragStartRef.current.startX;
      const dy = e.clientY - dragStartRef.current.startY;
      setPos({
        x: Math.max(10, Math.min(window.innerWidth - 280, dragStartRef.current.posX + dx)),
        y: Math.max(10, Math.min(window.innerHeight - 120, dragStartRef.current.posY + dy)),
      });
    };
    const handleMouseUp = () => {
      setIsDraggingWindow(false);
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingWindow]);

  useEffect(() => {
    if (!selectedNodeId) return;
    const ancestors = getAncestorChain(document.document, selectedNodeId);
    if (ancestors.length === 0) return;
    setExpandedIds((prev) => {
      let changed = false;
      const next = new Set(prev);
      for (const id of ancestors) {
        if (!next.has(id)) {
          next.add(id);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [selectedNodeId, document]);

  const toggleExpanded = (nodeId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  };

  const handleRowDragStart = (e: React.DragEvent, node: Node) => {
    if (node.id === document.document.id) {
      e.preventDefault();
      return;
    }
    e.stopPropagation();
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', node.id);
    setDraggingId(node.id);
    selectNode(node.id);
  };

  const handleRowDragOver = (e: React.DragEvent, node: Node) => {
    if (!draggingId) return;
    e.stopPropagation();

    const draggedNode = findNodeById(document.document, draggingId);
    if (!draggedNode || isDescendantOf(draggedNode, node.id)) {
      setDropCandidate(null);
      e.dataTransfer.dropEffect = 'none';
      return;
    }

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const ratio = rect.height > 0 ? (e.clientY - rect.top) / rect.height : 0.5;

    const targetDef = registry.get(node.type);
    const acceptsChildren = !!targetDef?.acceptsChildren;

    let candidate: DropCandidate | null = null;

    if (acceptsChildren && ratio > 0.25 && ratio < 0.75) {
      const policy = registry.canInsertChild(node.type, draggedNode.type);
      if (policy.valid) {
        candidate = { parentId: node.id, position: 'inside' };
      }
    }

    if (!candidate) {
      const loc = findNodeLocation(document.document, node.id);
      if (loc && loc.parent) {
        const policy = registry.canInsertChild(loc.parent.type, draggedNode.type);
        if (policy.valid) {
          if (ratio <= 0.5) {
            candidate = { parentId: loc.parent.id, index: loc.index, position: 'before' };
          } else {
            candidate = { parentId: loc.parent.id, index: loc.index + 1, position: 'after' };
          }
        }
      }
    }

    if (candidate) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      setDropCandidate(candidate);
    } else {
      setDropCandidate(null);
      e.dataTransfer.dropEffect = 'none';
    }
  };

  const handleRowDrop = (e: React.DragEvent) => {
    if (!draggingId || !dropCandidate) return;
    e.preventDefault();
    e.stopPropagation();

    moveComponent(draggingId, dropCandidate.parentId, registry, dropCandidate.index);
    setDraggingId(null);
    setDropCandidate(null);
  };

  const handleRowDragEnd = () => {
    setDraggingId(null);
    setDropCandidate(null);
  };

  const renderRow = (node: Node, depth: number): React.ReactNode => {
    const hasChildren = !!node.children?.length;
    const isExpanded = expandedIds.has(node.id);
    const isSelected = node.id === selectedNodeId;
    const isHovered = node.id === hoveredNodeId;
    const isRoot = node.id === document.document.id;
    const isDropTarget = dropCandidate?.position === 'inside' && dropCandidate.parentId === node.id;

    return (
      <div key={node.id}>
        <div
          data-kubuild-layer={node.id}
          draggable={!isRoot}
          style={{ paddingLeft: depth * 14 + 6 }}
          onClick={(e) => {
            e.stopPropagation();
            selectNode(node.id);
          }}
          onMouseEnter={() => hoverNode(node.id)}
          onMouseLeave={() => hoverNode(null)}
          onDragStart={(e) => handleRowDragStart(e, node)}
          onDragOver={(e) => handleRowDragOver(e, node)}
          onDrop={handleRowDrop}
          onDragEnd={handleRowDragEnd}
          className={`flex items-center gap-1 py-1 pr-2 text-xs cursor-pointer rounded-sm border-l-2 ${
            isSelected
              ? 'bg-blue-50 border-blue-500 text-blue-700 font-medium'
              : isHovered
                ? 'bg-slate-50 border-slate-300'
                : 'border-transparent text-slate-700'
          } ${isDropTarget ? 'ring-1 ring-inset ring-green-500' : ''}`}
        >
          {hasChildren ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggleExpanded(node.id);
              }}
              aria-label={isExpanded ? 'Collapse' : 'Expand'}
              className="w-4 shrink-0 text-slate-400 hover:text-slate-700 flex items-center justify-center"
            >
              {isExpanded ? (
                <ChevronDown className="w-3 h-3" aria-hidden="true" />
              ) : (
                <ChevronRight className="w-3 h-3" aria-hidden="true" />
              )}
            </button>
          ) : (
            <span className="w-4 shrink-0" />
          )}
          <span className="shrink-0 text-slate-400">
            <ComponentIcon iconOrType={registry.get(node.type)?.icon ?? node.type} size={13} />
          </span>
          <span className="truncate">{registry.get(node.type)?.label ?? node.type}</span>
          <span className="text-slate-400 truncate text-[10px]">#{node.id}</span>
        </div>
        {hasChildren && isExpanded && node.children!.map((child) => renderRow(child, depth + 1))}
      </div>
    );
  };

  if (navigatorMode === 'hidden') {
    return null;
  }

  const isFloating = navigatorMode === 'floating';

  const panelContent = (
    <div className="flex-1 overflow-y-auto p-1.5 text-xs">
      {renderRow(document.document, 0)}
    </div>
  );

  const header = (
    <div
      onMouseDown={isFloating ? handleHeaderMouseDown : undefined}
      className={`flex items-center justify-between px-3 py-2 border-b border-slate-200/90 select-none ${
        isFloating ? 'cursor-grab active:cursor-grabbing bg-slate-50/90 rounded-t-xl' : 'bg-slate-50'
      }`}
    >
      <div className="flex items-center gap-1.5 font-semibold text-xs text-slate-700">
        {isFloating && <GripVertical className="w-3 h-3 text-slate-400 mr-0.5" aria-hidden="true" />}
        <ComponentIcon iconOrType="layout" size={13} />
        <span>Navigator</span>
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => setNavigatorMode(isFloating ? 'docked' : 'floating')}
          title={isFloating ? 'Dock to sidebar' : 'Make floating'}
          className="p-1 text-slate-400 hover:text-blue-600 rounded hover:bg-slate-200/50 transition"
        >
          {isFloating ? (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect width="18" height="18" x="3" y="3" rx="2" />
              <path d="M9 3v18" />
            </svg>
          ) : (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect width="14" height="14" x="7" y="7" rx="2" />
              <path d="M17 3H5a2 2 0 0 0-2 2v12" />
            </svg>
          )}
        </button>
        <button
          type="button"
          onClick={() => setNavigatorMode('hidden')}
          title="Hide Navigator"
          className="p-1 text-slate-400 hover:text-red-600 rounded hover:bg-red-50 transition"
        >
          <X className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
      </div>
    </div>
  );

  if (isFloating) {
    return (
      <div
        style={{ left: `${pos.x}px`, top: `${pos.y}px` }}
        className={`fixed z-50 w-72 bg-white/95 backdrop-blur-md rounded-xl shadow-2xl border border-slate-200/90 flex flex-col max-h-[460px] overflow-hidden ${
          className || ''
        }`}
      >
        {header}
        {panelContent}
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-full overflow-hidden bg-white ${className || ''}`}>
      {header}
      {panelContent}
    </div>
  );
};
