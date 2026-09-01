import React, { useLayoutEffect, useRef, useState, useEffect } from 'react';
import { PageDocument } from '@kubuild/schema';
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
import { FloatingActionBadges } from './floating-badges';
import { EditorCanvasConfig } from './config';

export interface EditorCanvasProps {
  document?: PageDocument;
  registry: ComponentRegistry;
  context?: RuntimeContext;
  viewport: Viewport;
  onDiagnostic?: (diagnostic: Diagnostic) => void;
  config?: EditorCanvasConfig;
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

export const EditorCanvas: React.FC<EditorCanvasProps> = ({
  document: propDoc,
  registry,
  context,
  viewport,
  onDiagnostic,
  config,
}) => {
  const {
    document: storeDoc,
    selectedNodeId,
    hoveredNodeId,
    dragPayload,
    selectNode,
    hoverNode,
    updateNodeProps,
    setDragPayload,
    insertComponent,
    insertBlock,
    moveComponent,
    previewMode,
    addActionLog,
    setLiveFormState,
  } = useEditorStore();
  const document = propDoc ?? storeDoc;
  const showFloatingBadges = config?.showFloatingBadges !== false && !previewMode;
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
    const container = containerRef.current;
    window.addEventListener('resize', recompute);
    window.addEventListener('scroll', recompute, true);
    container?.addEventListener('input', recompute);
    return () => {
      window.removeEventListener('resize', recompute);
      window.removeEventListener('scroll', recompute, true);
      container?.removeEventListener('input', recompute);
    };
  }, [document, selectedNodeId, hoveredNodeId, viewport]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.querySelectorAll<HTMLElement>('[data-kubuild-node]').forEach((el) => {
      const id = el.getAttribute('data-kubuild-node');
      const isEditable = el.isContentEditable || el.getAttribute('contenteditable') === 'true';
      el.draggable = !!id && id !== document.document.id && !isEditable;
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
        const target = getNavigationTarget(
          state.document.document,
          state.selectedNodeId,
          direction,
        );
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
    const target = e.target as HTMLElement;
    if (target.isContentEditable || target.closest('[contenteditable="true"]')) {
      e.preventDefault();
      return;
    }
    const el = target.closest('[data-kubuild-node]');
    const nodeId = el?.getAttribute('data-kubuild-node');
    if (!nodeId || nodeId === document.document.id) {
      e.preventDefault();
      return;
    }
    e.stopPropagation();
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', nodeId);
    e.dataTransfer.setData('application/kubuild-drag-type', 'node');
    e.dataTransfer.setData('application/kubuild-node-id', nodeId);
    setDraggingId(nodeId);
    setDragPayload({ type: 'node', nodeId });
    selectNode(nodeId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    const activePayload =
      dragPayload ?? (draggingId ? { type: 'node' as const, nodeId: draggingId } : null);
    if (!activePayload) return;

    const container = containerRef.current;
    if (!container) return;

    const containerRect = container.getBoundingClientRect();
    const hoveredEl = (e.target as HTMLElement).closest(
      '[data-kubuild-node]',
    ) as HTMLElement | null;

    let incomingType: string | null = null;
    if (activePayload.type === 'node') {
      const draggedNode = findNodeById(document.document, activePayload.nodeId);
      incomingType = draggedNode?.type ?? null;
    } else if (activePayload.type === 'component') {
      incomingType = activePayload.componentType;
    } else if (activePayload.type === 'block') {
      incomingType = 'section';
    }

    if (!incomingType) {
      setDropTarget(null);
      e.dataTransfer.dropEffect = 'none';
      return;
    }

    if (!hoveredEl) {
      // Hovering directly over empty canvas container: default to dropping inside root page
      const rootNode = document.document;
      const policy = registry.canInsertChild(rootNode.type, incomingType);
      if (!policy.valid) {
        setDropTarget(null);
        e.dataTransfer.dropEffect = 'none';
        return;
      }

      e.preventDefault();
      e.dataTransfer.dropEffect = activePayload.type === 'node' ? 'move' : 'copy';
      setDropTarget({
        parentId: rootNode.id,
        index: rootNode.children?.length ?? 0,
        position: 'inside',
        rect: {
          top: 0,
          left: 0,
          width: containerRect.width,
          height: Math.max(containerRect.height, 200),
        },
      });
      return;
    }

    const hoveredId = hoveredEl.getAttribute('data-kubuild-node');
    if (!hoveredId) return;

    // If dragging an existing node, prevent dropping into itself or its descendants
    if (activePayload.type === 'node') {
      const draggedNode = findNodeById(document.document, activePayload.nodeId);
      if (!draggedNode || isDescendantOf(draggedNode, hoveredId)) {
        setDropTarget(null);
        e.dataTransfer.dropEffect = 'none';
        return;
      }
    }

    const hoveredNode = findNodeById(document.document, hoveredId);
    if (!hoveredNode) return;

    const elRect = hoveredEl.getBoundingClientRect();
    const ratio = elRect.height > 0 ? (e.clientY - elRect.top) / elRect.height : 0.5;
    const hoveredDef = registry.get(hoveredNode.type);
    const canGoInside = !!hoveredDef?.acceptsChildren;
    const location = findNodeLocation(document.document, hoveredId);

    let candidate: {
      parentId: string;
      index?: number;
      position: DropTarget['position'];
      targetType: string;
    };

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
      // Hovering root directly
      candidate = {
        parentId: document.document.id,
        index: document.document.children?.length ?? 0,
        position: 'inside',
        targetType: document.document.type,
      };
    }

    const policy = registry.canInsertChild(candidate.targetType, incomingType);
    if (!policy.valid) {
      setDropTarget(null);
      e.dataTransfer.dropEffect = 'none';
      return;
    }

    e.preventDefault();
    e.dataTransfer.dropEffect = activePayload.type === 'node' ? 'move' : 'copy';
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
    const activePayload =
      dragPayload ?? (draggingId ? { type: 'node' as const, nodeId: draggingId } : null);

    if (activePayload && dropTarget) {
      if (activePayload.type === 'node') {
        moveComponent(activePayload.nodeId, dropTarget.parentId, registry, dropTarget.index);
      } else if (activePayload.type === 'component') {
        insertComponent(
          activePayload.componentType,
          registry,
          dropTarget.parentId,
          dropTarget.index,
        );
      } else if (activePayload.type === 'block') {
        insertBlock(activePayload.blockId, dropTarget.parentId, dropTarget.index);
      }
    }

    setDraggingId(null);
    setDropTarget(null);
    setDragPayload(null);
  };

  const handleDragEnd = () => {
    setDraggingId(null);
    setDropTarget(null);
    setDragPayload(null);
  };

  return (
    <div
      ref={containerRef}
      style={{ position: 'relative' }}
      onMouseOver={previewMode ? undefined : handleMouseOver}
      onMouseLeave={previewMode ? undefined : handleMouseLeave}
      onDragStart={previewMode ? undefined : handleDragStart}
      onDragOver={previewMode ? undefined : handleDragOver}
      onDrop={previewMode ? undefined : handleDrop}
      onDragEnd={previewMode ? undefined : handleDragEnd}
    >
      <KubuildRenderer
        document={document}
        registry={registry}
        context={context}
        viewport={viewport}
        mode={previewMode ? 'runtime' : 'editor'}
        onNodeClick={(id: string) => {
          if (!previewMode) {
            selectNode(id);
          }
        }}
        onNodePropChange={(nodeId: string, propName: string, value: unknown, isBlur?: boolean) => {
          if (previewMode) {
            return;
          }
          if (!isBlur && typeof value === 'string' && value.trim() === '') {
            return;
          }
          updateNodeProps(nodeId, { [propName]: value }, registry);
        }}
        onActionDispatch={(actionType: string, payload: Record<string, unknown> | undefined, nodeId: string) => {
          if (previewMode) {
            addActionLog({
              actionType,
              trigger: 'dispatch',
              nodeId,
              status: 'success',
              payload,
            });
            if (actionType === 'submit' && payload) {
              setLiveFormState({
                formId: nodeId,
                values: payload,
                errors: {},
                touched: {},
                isSubmitting: false,
                isValid: true,
                dirty: true,
              });
            }
          }
        }}
        onDiagnostic={(diag) => {
          if (previewMode && diag.code === 'ACTION_EXECUTION_ERROR') {
            addActionLog({
              actionType: diag.actionType || 'action_error',
              trigger: 'error',
              nodeId: diag.nodeId,
              status: 'error',
              error: diag.message,
            });
          }
          onDiagnostic?.(diag);
        }}
      />
      {!previewMode && hoveredRect && hoveredNodeId !== selectedNodeId && (
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
      {!previewMode && selectedRect && (
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
      {!previewMode && showFloatingBadges && selectedRect && selectedNodeId && (
        <FloatingActionBadges
          selectedNodeId={selectedNodeId}
          document={document}
          registry={registry}
          selectedRect={selectedRect}
          onDragStart={handleDragStart}
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
