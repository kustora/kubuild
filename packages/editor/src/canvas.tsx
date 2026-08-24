import React, { useLayoutEffect, useRef, useState, useEffect } from 'react';
import { ComponentRegistry } from '@kubuild/components';
import { KubuildRenderer } from '@kubuild/renderer';
import {
  RuntimeContext,
  Diagnostic,
  getNavigationTarget,
  NavigationDirection,
  findNodeById,
  findNodeLocation,
  isDescendantOf,
} from '@kubuild/core';
import { useEditorStore, Viewport } from './store';

export interface EditorCanvasProps {
  registry: ComponentRegistry;
  context?: RuntimeContext;
  viewport: Viewport;
  onDiagnostic?: (diagnostic: Diagnostic) => void;
}

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
}

const ARROW_DIRECTIONS: Record<string, NavigationDirection> = {
  ArrowUp: 'parent',
  ArrowDown: 'child',
  ArrowLeft: 'previous-sibling',
  ArrowRight: 'next-sibling',
};

interface DropTarget {
  parentId: string;
  index?: number;
  position: 'before' | 'after' | 'inside';
  rect: Rect;
}

function rectFor(container: HTMLElement, nodeId: string | null): Rect | null {
  if (!nodeId) return null;
  const el = container.querySelector(`[data-kubuild-node="${CSS.escape(nodeId)}"]`);
  if (!el) return null;
  const containerRect = container.getBoundingClientRect();
  const elRect = el.getBoundingClientRect();
  return {
    top: elRect.top - containerRect.top,
    left: elRect.left - containerRect.left,
    width: elRect.width,
    height: elRect.height,
  };
}

export const EditorCanvas: React.FC<EditorCanvasProps> = ({ registry, context, viewport, onDiagnostic }) => {
  const { document, selectedNodeId, hoveredNodeId, selectNode, hoverNode } = useEditorStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedRect, setSelectedRect] = useState<Rect | null>(null);
  const [hoveredRect, setHoveredRect] = useState<Rect | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);

  useLayoutEffect(() => {
    const recompute = () => {
      const container = containerRef.current;
      if (!container) return;
      setSelectedRect(rectFor(container, selectedNodeId));
      setHoveredRect(rectFor(container, hoveredNodeId));
    };

    recompute();
    window.addEventListener('resize', recompute);
    window.addEventListener('scroll', recompute, true);
    return () => {
      window.removeEventListener('resize', recompute);
      window.removeEventListener('scroll', recompute, true);
    };
  }, [document, selectedNodeId, hoveredNodeId, viewport]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.querySelectorAll<HTMLElement>('[data-kubuild-node]').forEach((el) => {
      const id = el.getAttribute('data-kubuild-node');
      el.draggable = !!id && id !== document.document.id;
    });
  }, [document, viewport]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target)) return;

      const state = useEditorStore.getState();

      if (e.key === 'Escape') {
        state.selectNode(null);
        return;
      }

      const mod = e.metaKey || e.ctrlKey;

      if (mod && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        state.undo();
        return;
      }
      if (mod && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) {
        e.preventDefault();
        state.redo();
        return;
      }

      if (!state.selectedNodeId) return;

      if (mod && e.key.toLowerCase() === 'c') {
        state.copyNode(state.selectedNodeId);
        return;
      }
      if (mod && e.key.toLowerCase() === 'v') {
        state.pasteNode(state.selectedNodeId, registry);
        return;
      }
      if (mod && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        state.duplicateComponent(state.selectedNodeId, registry);
        return;
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (state.selectedNodeId === state.document.document.id) return;
        e.preventDefault();
        state.deleteComponent(state.selectedNodeId);
        return;
      }

      const direction = ARROW_DIRECTIONS[e.key];
      if (direction) {
        e.preventDefault();
        const target = getNavigationTarget(state.document.document, state.selectedNodeId, direction);
        if (target) state.selectNode(target);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [registry]);

  const handleMouseOver = (e: React.MouseEvent) => {
    const el = (e.target as HTMLElement).closest('[data-kubuild-node]');
    if (el) hoverNode(el.getAttribute('data-kubuild-node'));
  };

  const handleMouseLeave = () => hoverNode(null);

  const handleDragStart = (e: React.DragEvent) => {
    const el = (e.target as HTMLElement).closest('[data-kubuild-node]');
    const nodeId = el?.getAttribute('data-kubuild-node');
    if (!nodeId || nodeId === document.document.id) {
      e.preventDefault();
      return;
    }
    e.stopPropagation();
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', nodeId);
    setDraggingId(nodeId);
    selectNode(nodeId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (!draggingId) return;
    const container = containerRef.current;
    const hoveredEl = (e.target as HTMLElement).closest('[data-kubuild-node]') as HTMLElement | null;
    if (!container || !hoveredEl) return;

    const hoveredId = hoveredEl.getAttribute('data-kubuild-node');
    const draggedNode = hoveredId ? findNodeById(document.document, draggingId) : null;
    const hoveredNode = hoveredId ? findNodeById(document.document, hoveredId) : null;
    if (!hoveredId || !draggedNode || !hoveredNode || isDescendantOf(draggedNode, hoveredId)) {
      setDropTarget(null);
      e.dataTransfer.dropEffect = 'none';
      return;
    }

    const elRect = hoveredEl.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    const ratio = elRect.height > 0 ? (e.clientY - elRect.top) / elRect.height : 0.5;
    const hoveredDef = registry.get(hoveredNode.type);
    const canGoInside = !!hoveredDef?.acceptsChildren;

    const location = findNodeLocation(document.document, hoveredId);
    let candidate: { parentId: string; index?: number; position: DropTarget['position']; targetType: string };

    if (canGoInside && (!location?.parent || (ratio > 0.25 && ratio < 0.75))) {
      candidate = {
        parentId: hoveredId,
        index: hoveredNode.children?.length ?? 0,
        position: 'inside',
        targetType: hoveredNode.type,
      };
    } else if (location?.parent) {
      candidate = {
        parentId: location.parent.id,
        index: location.index + (ratio >= 0.5 ? 1 : 0),
        position: ratio >= 0.5 ? 'after' : 'before',
        targetType: location.parent.type,
      };
    } else {
      // Hovering the root without it accepting children: no valid drop here.
      setDropTarget(null);
      e.dataTransfer.dropEffect = 'none';
      return;
    }

    const policy = registry.canInsertChild(candidate.targetType, draggedNode.type);
    if (!policy.valid) {
      setDropTarget(null);
      e.dataTransfer.dropEffect = 'none';
      return;
    }

    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropTarget({
      parentId: candidate.parentId,
      index: candidate.index,
      position: candidate.position,
      rect: {
        top: elRect.top - containerRect.top,
        left: elRect.left - containerRect.left,
        width: elRect.width,
        height: elRect.height,
      },
    });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (draggingId && dropTarget) {
      useEditorStore
        .getState()
        .moveComponent(draggingId, dropTarget.parentId, registry, dropTarget.index);
    }
    setDraggingId(null);
    setDropTarget(null);
  };

  const handleDragEnd = () => {
    setDraggingId(null);
    setDropTarget(null);
  };

  return (
    <div
      ref={containerRef}
      style={{ position: 'relative' }}
      onMouseOver={handleMouseOver}
      onMouseLeave={handleMouseLeave}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onDragEnd={handleDragEnd}
    >
      <KubuildRenderer
        document={document}
        registry={registry}
        context={context}
        viewport={viewport}
        mode="editor"
        onNodeClick={(id: string) => selectNode(id)}
        onDiagnostic={onDiagnostic}
      />
      {hoveredRect && hoveredNodeId !== selectedNodeId && (
        <div
          aria-hidden="true"
          role="presentation"
          data-testid="editor-hover-overlay"
          style={{
            position: 'absolute',
            pointerEvents: 'none',
            top: hoveredRect.top,
            left: hoveredRect.left,
            width: hoveredRect.width,
            height: hoveredRect.height,
            border: '1px dashed #94a3b8',
          }}
        />
      )}
      {selectedRect && (
        <div
          aria-hidden="true"
          role="presentation"
          data-testid="editor-selection-overlay"
          style={{
            position: 'absolute',
            pointerEvents: 'none',
            top: selectedRect.top,
            left: selectedRect.left,
            width: selectedRect.width,
            height: selectedRect.height,
            border: '2px solid #3b82f6',
          }}
        />
      )}
      {dropTarget &&
        (dropTarget.position === 'inside' ? (
          <div
            aria-hidden="true"
            role="presentation"
            data-testid="editor-drop-overlay"
            style={{
              position: 'absolute',
              pointerEvents: 'none',
              top: dropTarget.rect.top,
              left: dropTarget.rect.left,
              width: dropTarget.rect.width,
              height: dropTarget.rect.height,
              border: '2px dashed #16a34a',
              backgroundColor: 'rgba(22, 163, 74, 0.08)',
            }}
          />
        ) : (
          <div
            aria-hidden="true"
            role="presentation"
            data-testid="editor-drop-line-overlay"
            style={{
              position: 'absolute',
              pointerEvents: 'none',
              left: dropTarget.rect.left,
              width: dropTarget.rect.width,
              top:
                dropTarget.position === 'before'
                  ? dropTarget.rect.top - 1
                  : dropTarget.rect.top + dropTarget.rect.height - 1,
              height: 2,
              backgroundColor: '#16a34a',
            }}
          />
        ))}
    </div>
  );
};
