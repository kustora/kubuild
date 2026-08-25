import React, { useEffect, useState } from 'react';
import { Node } from '@kubuild/schema';
import { ComponentRegistry } from '@kubuild/components';
import { findNodeById, findNodeLocation, isDescendantOf, getAncestorChain } from '@kubuild/core';
import { useEditorStore } from './store';
import { ComponentIcon } from './icons';

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
  const { document, selectedNodeId, hoveredNodeId, selectNode, hoverNode, moveComponent } = useEditorStore();
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set([document.document.id]));
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropCandidate, setDropCandidate] = useState<DropCandidate | null>(null);

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
    const canGoInside = !!registry.get(node.type)?.acceptsChildren;
    const location = findNodeLocation(document.document, node.id);

    let candidate: DropCandidate | null = null;
    if (canGoInside && (!location?.parent || (ratio > 0.25 && ratio < 0.75))) {
      candidate = { parentId: node.id, index: node.children?.length ?? 0, position: 'inside' };
    } else if (location?.parent) {
      candidate = {
        parentId: location.parent.id,
        index: location.index + (ratio >= 0.5 ? 1 : 0),
        position: ratio >= 0.5 ? 'after' : 'before',
      };
    }

    if (!candidate) {
      setDropCandidate(null);
      e.dataTransfer.dropEffect = 'none';
      return;
    }

    const targetType =
      candidate.position === 'inside' ? node.type : findNodeById(document.document, candidate.parentId)?.type;
    const policy = targetType ? registry.canInsertChild(targetType, draggedNode.type) : { valid: false, errors: [] };
    if (!policy.valid) {
      setDropCandidate(null);
      e.dataTransfer.dropEffect = 'none';
      return;
    }

    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropCandidate(candidate);
  };

  const handleRowDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (draggingId && dropCandidate) {
      moveComponent(draggingId, dropCandidate.parentId, registry, dropCandidate.index);
    }
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
          style={{ paddingLeft: depth * 16 + 8 }}
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
          className={`flex items-center gap-1 py-1 pr-2 text-xs cursor-pointer border-l-2 ${
            isSelected
              ? 'bg-blue-50 border-blue-500 text-blue-700'
              : isHovered
                ? 'bg-slate-50 border-slate-300'
                : 'border-transparent'
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
              className="w-4 shrink-0 text-slate-400"
            >
              {isExpanded ? '▾' : '▸'}
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

  return (
    <div className={`overflow-y-auto ${className || ''}`}>{renderRow(document.document, 0)}</div>
  );
};
