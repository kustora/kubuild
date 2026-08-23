import React, { useLayoutEffect, useRef, useState, useEffect } from 'react';
import { ComponentRegistry } from '@kubuild/components';
import { KubuildRenderer } from '@kubuild/renderer';
import { RuntimeContext, removeNode, getNavigationTarget, NavigationDirection } from '@kubuild/core';
import { useEditorStore, Viewport } from './store';

export interface EditorCanvasProps {
  registry: ComponentRegistry;
  context?: RuntimeContext;
  viewport: Viewport;
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

export const EditorCanvas: React.FC<EditorCanvasProps> = ({ registry, context, viewport }) => {
  const { document, selectedNodeId, hoveredNodeId, selectNode, hoverNode } = useEditorStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedRect, setSelectedRect] = useState<Rect | null>(null);
  const [hoveredRect, setHoveredRect] = useState<Rect | null>(null);

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
    const onKeyDown = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target)) return;

      const state = useEditorStore.getState();

      if (e.key === 'Escape') {
        state.selectNode(null);
        return;
      }

      if (!state.selectedNodeId) return;

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (state.selectedNodeId === state.document.document.id) return;
        e.preventDefault();
        state.dispatch((doc) => removeNode(doc, { nodeId: state.selectedNodeId as string }));
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
  }, []);

  const handleMouseOver = (e: React.MouseEvent) => {
    const el = (e.target as HTMLElement).closest('[data-kubuild-node]');
    if (el) hoverNode(el.getAttribute('data-kubuild-node'));
  };

  const handleMouseLeave = () => hoverNode(null);

  return (
    <div
      ref={containerRef}
      style={{ position: 'relative' }}
      onMouseOver={handleMouseOver}
      onMouseLeave={handleMouseLeave}
    >
      <KubuildRenderer
        document={document}
        registry={registry}
        context={context}
        viewport={viewport}
        mode="editor"
        onNodeClick={(id: string) => selectNode(id)}
      />
      {hoveredRect && hoveredNodeId !== selectedNodeId && (
        <div
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
    </div>
  );
};
