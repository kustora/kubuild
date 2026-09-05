import React, { useLayoutEffect, useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { PageDocument } from '@kubuild/schema';
import { ComponentRegistry, STARTER_BLOCKS } from '@kubuild/components';
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
import { useEditorStore, Viewport } from '../../store';
import { FloatingActionBadges } from './floating-badges';
import { ResizeHandles } from './resize-handles';
import { SpacingSliders } from './spacing-sliders';
import { SmartGuides, GuideLine, CanvasRect } from './smart-guides';
import { DistanceMeter } from './distance-meter';
import { CanvasZoomToolbar, useCanvasPanZoom, clampZoom } from './canvas-pan-zoom';
import { MarqueeSelectionBox, MarqueeRect, calculateMarqueeIntersections } from './marquee-selection';
import { MultiDevicePreview } from './multi-device-preview';
import { GridGuidelinesOverlay } from './grid-guidelines-overlay';
import { ViewportResizer } from './viewport-resizer';
import { EditorCanvasConfig } from '../../config';

export interface EditorPageItem {
  id: string;
  name: string;
  slug?: string;
  document: PageDocument;
  width?: number;
  viewport?: Viewport;
}

export interface EditorCanvasProps {
  document?: PageDocument;
  registry: ComponentRegistry;
  context?: RuntimeContext;
  viewport: Viewport;
  onDiagnostic?: (diagnostic: Diagnostic) => void;
  config?: EditorCanvasConfig;
  fluidWidth?: number;
  onFluidWidthChange?: (width: number) => void;
  onBreakpointChange?: (breakpoint: Viewport) => void;
  pages?: EditorPageItem[];
  activePageId?: string;
  onActivePageChange?: (pageId: string) => void;
  onPagesChange?: (pages: EditorPageItem[]) => void;
  className?: string;
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
  rect: CanvasRect;
}

function rectFor(container: HTMLElement, nodeId: string | null, zoom = 1): CanvasRect | null {
  if (!nodeId) return null;
  const el = container.querySelector(`[data-kubuild-node="${CSS.escape(nodeId)}"]`);
  if (!el) return null;
  const containerRect = container.getBoundingClientRect();
  const elRect = el.getBoundingClientRect();
  const scale = zoom > 0 ? zoom : 1;
  return {
    top: (elRect.top - containerRect.top) / scale,
    left: (elRect.left - containerRect.left) / scale,
    width: elRect.width / scale,
    height: elRect.height / scale,
  };
}

export const EditorCanvas: React.FC<EditorCanvasProps> = ({
  document: propDoc,
  registry,
  context,
  viewport,
  onDiagnostic,
  config,
  fluidWidth,
  onFluidWidthChange,
  onBreakpointChange,
  pages,
  activePageId,
  onActivePageChange,
  onPagesChange,
  className,
}) => {
  const {
    document: storeDoc,
    selectedNodeId,
    selectedNodeIds,
    hoveredNodeId,
    dragPayload,
    selectNode,
    selectMultipleNodes,
    toggleNodeSelection,
    wrapSelectedIntoFrame,
    ungroupSelectedFrame,
    hoverNode,
    updateNodeProps,
    setDragPayload,
    insertComponent,
    insertBlock,
    moveComponent,
    deleteComponent,
    duplicateComponent,
    copyNode,
    pasteNode,
    undo,
    redo,
    previewMode,
    multiDeviceMode,
    toggleMultiDeviceMode,
    addActionLog,
    setLiveFormState,
  } = useEditorStore();

  const document = propDoc ?? storeDoc;
  const showFloatingBadges = config?.showFloatingBadges !== false && !previewMode;

  const containerRef = useRef<HTMLDivElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const activeArtboardRef = useRef<HTMLDivElement>(null);

  const allPages = useMemo<EditorPageItem[]>(() => {
    if (pages && pages.length > 0) return pages;
    return [
      {
        id: 'default',
        name: document.metadata?.title || 'Page 1',
        slug: '/',
        document,
      },
    ];
  }, [pages, document]);

  const effectiveActivePageId = useMemo(() => {
    if (activePageId && allPages.some((p) => p.id === activePageId)) {
      return activePageId;
    }
    return allPages[0]?.id || 'default';
  }, [activePageId, allPages]);

  const activeDoc = useMemo(() => {
    return allPages.find((p) => p.id === effectiveActivePageId)?.document || document;
  }, [allPages, effectiveActivePageId, document]);

  const defaultWidthForViewport = (vp: Viewport) => {
    if (vp === 'mobile') return 375;
    if (vp === 'tablet') return 768;
    return 1200;
  };

  const getBreakpointFromWidth = (w: number): Viewport => {
    if (w < 768) return 'mobile';
    if (w < 1024) return 'tablet';
    return 'desktop';
  };

  // Per-page responsive state map
  const [pageResponsiveMap, setPageResponsiveMap] = useState<
    Record<string, { width: number; viewport: Viewport }>
  >(() => {
    const initial: Record<string, { width: number; viewport: Viewport }> = {};
    if (pages && pages.length > 0) {
      pages.forEach((p) => {
        const vp = p.viewport || (p.width ? getBreakpointFromWidth(p.width) : 'desktop');
        const w = p.width ?? defaultWidthForViewport(vp);
        initial[p.id] = { width: w, viewport: vp };
      });
    } else {
      const activeVp = viewport ?? 'desktop';
      const activeW = fluidWidth ?? defaultWidthForViewport(activeVp);
      initial['default'] = { width: activeW, viewport: activeVp };
    }
    return initial;
  });

  useEffect(() => {
    if (pages && pages.length > 0) {
      setPageResponsiveMap((prev) => {
        const next = { ...prev };
        let changed = false;
        pages.forEach((p) => {
          if (!next[p.id]) {
            const vp = p.viewport || (p.width ? getBreakpointFromWidth(p.width) : 'desktop');
            const w = p.width ?? defaultWidthForViewport(vp);
            next[p.id] = { width: w, viewport: vp };
            changed = true;
          } else {
            if (p.width !== undefined && p.width !== next[p.id].width) {
              next[p.id] = { ...next[p.id], width: p.width };
              changed = true;
            }
            if (p.viewport !== undefined && p.viewport !== next[p.id].viewport) {
              next[p.id] = { ...next[p.id], viewport: p.viewport };
              changed = true;
            }
          }
        });
        return changed ? next : prev;
      });
    }
  }, [pages]);

  useEffect(() => {
    if (effectiveActivePageId) {
      setPageResponsiveMap((prev) => {
        const cur = prev[effectiveActivePageId];
        const newW = fluidWidth ?? cur?.width;
        const newVp = viewport ?? cur?.viewport;
        if (!cur || cur.width !== newW || cur.viewport !== newVp) {
          if (newW !== undefined || newVp !== undefined) {
            return {
              ...prev,
              [effectiveActivePageId]: {
                width: newW ?? defaultWidthForViewport(newVp || 'desktop'),
                viewport: newVp ?? 'desktop',
              },
            };
          }
        }
        return prev;
      });
    }
  }, [effectiveActivePageId, fluidWidth, viewport]);

  const getPageWidth = useCallback(
    (p: EditorPageItem): number => {
      if (p.id === effectiveActivePageId && fluidWidth !== undefined) {
        return fluidWidth;
      }
      return (
        pageResponsiveMap[p.id]?.width ??
        p.width ??
        defaultWidthForViewport(p.viewport || 'desktop')
      );
    },
    [effectiveActivePageId, fluidWidth, pageResponsiveMap],
  );

  const getPageViewport = useCallback(
    (p: EditorPageItem): Viewport => {
      if (p.id === effectiveActivePageId && viewport !== undefined) {
        return viewport;
      }
      return (
        pageResponsiveMap[p.id]?.viewport ??
        p.viewport ??
        (p.width ? getBreakpointFromWidth(p.width) : 'desktop')
      );
    },
    [effectiveActivePageId, viewport, pageResponsiveMap],
  );

  const handlePageWidthChange = useCallback(
    (pageId: string, newWidth: number) => {
      const newBp = getBreakpointFromWidth(newWidth);
      setPageResponsiveMap((prev) => ({
        ...prev,
        [pageId]: { width: newWidth, viewport: newBp },
      }));

      if (pageId === effectiveActivePageId) {
        onFluidWidthChange?.(newWidth);
        onBreakpointChange?.(newBp);
      }

      if (onPagesChange && pages) {
        onPagesChange(
          pages.map((p) =>
            p.id === pageId ? { ...p, width: newWidth, viewport: newBp } : p,
          ),
        );
      }
    },
    [effectiveActivePageId, onFluidWidthChange, onBreakpointChange, onPagesChange, pages],
  );

  const handlePageBreakpointChange = useCallback(
    (pageId: string, newBp: Viewport) => {
      const newWidth = defaultWidthForViewport(newBp);
      setPageResponsiveMap((prev) => ({
        ...prev,
        [pageId]: { width: newWidth, viewport: newBp },
      }));

      if (pageId === effectiveActivePageId) {
        onFluidWidthChange?.(newWidth);
        onBreakpointChange?.(newBp);
      }

      if (onPagesChange && pages) {
        onPagesChange(
          pages.map((p) =>
            p.id === pageId ? { ...p, width: newWidth, viewport: newBp } : p,
          ),
        );
      }
    },
    [effectiveActivePageId, onFluidWidthChange, onBreakpointChange, onPagesChange, pages],
  );

  const handleSelectPage = useCallback(
    (pageId: string) => {
      onActivePageChange?.(pageId);
      const targetPage = allPages.find((p) => p.id === pageId);
      if (targetPage) {
        useEditorStore.getState().setDocument(targetPage.document);
        const targetViewport = getPageViewport(targetPage);
        useEditorStore.getState().setViewport(targetViewport);
      }
    },
    [allPages, onActivePageChange, getPageViewport],
  );

  const [selectedRect, setSelectedRect] = useState<CanvasRect | null>(null);
  const [selectedRects, setSelectedRects] = useState<Array<{ id: string; rect: CanvasRect }>>([]);
  const [hoveredRect, setHoveredRect] = useState<CanvasRect | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);
  const [activeGuides, setActiveGuides] = useState<GuideLine[]>([]);
  const [isAltPressed, setIsAltPressed] = useState<boolean>(false);
  const [marqueeRect, setMarqueeRect] = useState<MarqueeRect | null>(null);

  const marqueeDragRef = useRef<{
    startX: number;
    startY: number;
    shiftKey: boolean;
  } | null>(null);

  // Pan & Zoom controls (STORA-130, STORA-131)
  const {
    pan,
    setPan,
    zoom,
    setZoom,
    isPanning,
    isSpacePressed,
    toolMode,
    setToolMode,
    cursorStyle,
    handlePointerDown: handlePanPointerDown,
    resetPanZoom,
  } = useCanvasPanZoom({
    containerRef,
    enabled: !previewMode,
  });

  // Auto-center active artboard comfortably in the canvas viewport on mount
  const hasAutoCenteredRef = useRef(false);
  useEffect(() => {
    if (hasAutoCenteredRef.current) return;
    const container = containerRef.current;
    if (!container) return;

    const checkAndCenter = () => {
      const cw = container.clientWidth;
      const ch = container.clientHeight;
      if (cw > 0 && ch > 0) {
        hasAutoCenteredRef.current = true;
        const activePageItem = allPages.find((p) => p.id === effectiveActivePageId) || allPages[0];
        const targetWidth = activePageItem ? getPageWidth(activePageItem) : (fluidWidth || 1200);
        if (cw < targetWidth + 96) {
          const fitScale = clampZoom(Math.max(0.25, (cw - 64) / targetWidth));
          const fitPanX = Math.max(24, Math.round((cw - targetWidth * fitScale) / 2));
          setZoom(fitScale);
          setPan({ x: fitPanX, y: 40 });
        } else {
          const initialPanX = Math.round((cw - targetWidth) / 2);
          setPan({ x: initialPanX, y: 40 });
        }
      }
    };

    checkAndCenter();
    const frame = requestAnimationFrame(checkAndCenter);
    return () => cancelAnimationFrame(frame);
  }, [containerRef, allPages, effectiveActivePageId, fluidWidth, getPageWidth, setPan, setZoom]);

  const fitPanZoom = useCallback(() => {
    if (!containerRef.current || !layerRef.current) {
      resetPanZoom();
      return;
    }
    const container = containerRef.current;
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;

    const activePageItem = allPages.find((p) => p.id === effectiveActivePageId) || allPages[0];
    const targetWidth = activePageItem ? getPageWidth(activePageItem) : (fluidWidth || 1200);
    const artboardContainer = layerRef.current.firstElementChild as HTMLElement | null;
    const contentWidth = artboardContainer ? artboardContainer.scrollWidth : targetWidth;
    const contentHeight = artboardContainer ? artboardContainer.scrollHeight : 800;

    if (containerWidth > 0 && contentWidth > 0) {
      const padding = 60;
      const scaleX = (containerWidth - padding * 2) / contentWidth;
      const scaleY = (containerHeight - padding * 2) / contentHeight;
      const targetZoom = Math.min(1.0, Math.max(0.25, Math.min(scaleX, scaleY)));
      const targetPanX = Math.round((containerWidth - contentWidth * targetZoom) / 2);
      const targetPanY = 40;
      setZoom(Math.round(targetZoom * 100) / 100);
      setPan({ x: targetPanX, y: targetPanY });
    } else {
      resetPanZoom();
    }
  }, [containerRef, layerRef, fluidWidth, resetPanZoom, setZoom, setPan]);

  const selectedNode = useMemo(() => {
    if (!selectedNodeId) return null;
    return findNodeById(activeDoc.document, selectedNodeId);
  }, [activeDoc.document, selectedNodeId]);

  const isGridSelected = useMemo(() => {
    if (!selectedNode) return false;
    if (selectedNode.type === 'grid') return true;
    const baseDisplay = (selectedNode.styles?.base as Record<string, unknown> | undefined)?.display;
    const viewportDisplay = (selectedNode.styles?.[viewport] as Record<string, unknown> | undefined)?.display;
    return (
      baseDisplay === 'grid' ||
      baseDisplay === 'inline-grid' ||
      viewportDisplay === 'grid' ||
      viewportDisplay === 'inline-grid'
    );
  }, [selectedNode, viewport]);

  // Recompute bounding boxes of selection and hover
  useLayoutEffect(() => {
    const recompute = () => {
      const artboard = activeArtboardRef.current || layerRef.current || containerRef.current;
      if (!artboard) return;
      setSelectedRect(rectFor(artboard, selectedNodeId, zoom));
      setHoveredRect(rectFor(artboard, hoveredNodeId, zoom));

      const multi: Array<{ id: string; rect: CanvasRect }> = [];
      for (const id of selectedNodeIds) {
        const r = rectFor(artboard, id, zoom);
        if (r) multi.push({ id, rect: r });
      }
      setSelectedRects(multi);
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
  }, [activeDoc, selectedNodeId, selectedNodeIds, hoveredNodeId, viewport, zoom, pan, fluidWidth, effectiveActivePageId]);

  // Set draggable on element nodes
  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;
    layer.querySelectorAll<HTMLElement>('[data-kubuild-node]').forEach((el) => {
      const id = el.getAttribute('data-kubuild-node');
      const isEditable = el.isContentEditable || el.getAttribute('contenteditable') === 'true';
      el.draggable = !!id && id !== document.document.id && !isEditable;
    });
  }, [document, viewport]);

  // Global Keyboard listener
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Alt') {
        setIsAltPressed(true);
      }

      if (isEditableTarget(e.target)) return;

      const state = useEditorStore.getState();

      if (e.key === 'Escape') {
        state.selectNode(null);
        return;
      }

      const mod = e.metaKey || e.ctrlKey;

      // Undo / Redo
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

      // Wrap into frame (Cmd+G) & Ungroup frame (Cmd+Shift+G)
      if (mod && e.key.toLowerCase() === 'g') {
        e.preventDefault();
        if (e.shiftKey) {
          state.ungroupSelectedFrame();
        } else {
          state.wrapSelectedIntoFrame();
        }
        return;
      }

      const activeIds =
        state.selectedNodeIds.length > 0
          ? state.selectedNodeIds
          : state.selectedNodeId
            ? [state.selectedNodeId]
            : [];

      if (activeIds.length === 0) return;

      if (mod && e.key.toLowerCase() === 'c' && state.selectedNodeId) {
        state.copyNode(state.selectedNodeId);
        return;
      }
      if (mod && e.key.toLowerCase() === 'v' && state.selectedNodeId) {
        state.pasteNode(state.selectedNodeId, registry);
        return;
      }
      if (mod && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        activeIds.forEach((id) => state.duplicateComponent(id, registry));
        return;
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        const toDelete = activeIds.filter((id) => id !== state.document.document.id);
        if (toDelete.length > 0) {
          e.preventDefault();
          toDelete.forEach((id) => state.deleteComponent(id));
        }
        return;
      }

      const direction = ARROW_DIRECTIONS[e.key];
      if (direction && state.selectedNodeId) {
        e.preventDefault();
        const target = getNavigationTarget(
          state.document.document,
          state.selectedNodeId,
          direction,
        );
        if (target) state.selectNode(target);
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Alt') {
        setIsAltPressed(false);
      }
    };

    const onBlur = () => {
      setIsAltPressed(false);
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, [registry]);

  // Candidate rects for smart snapping
  const candidateRects = useMemo(() => {
    const layer = layerRef.current;
    if (!layer || !selectedNodeId) return [];
    const elements = layer.querySelectorAll<HTMLElement>('[data-kubuild-node]');
    const results: CanvasRect[] = [];
    const layerRect = layer.getBoundingClientRect();
    const scale = zoom > 0 ? zoom : 1;

    elements.forEach((el) => {
      const id = el.getAttribute('data-kubuild-node');
      if (id && id !== selectedNodeId && id !== document.document.id) {
        const r = el.getBoundingClientRect();
        results.push({
          top: (r.top - layerRect.top) / scale,
          left: (r.left - layerRect.left) / scale,
          width: r.width / scale,
          height: r.height / scale,
        });
      }
    });
    return results;
  }, [document, selectedNodeId, zoom]);

  const handleMouseOver = (e: React.MouseEvent) => {
    const el = (e.target as HTMLElement).closest('[data-kubuild-node]');
    if (el) hoverNode(el.getAttribute('data-kubuild-node'));
  };

  const handleMouseLeave = () => hoverNode(null);

  // Marquee Drag Selection Handlers (STORA-133) & Canvas Pan Handlers (STORA-130)
  const handleCanvasPointerDown = (e: React.PointerEvent) => {
    // Check if middle click, space pan, or hand tool mode
    if (e.button === 1 || isSpacePressed || toolMode === 'hand') {
      handlePanPointerDown(e);
      return;
    }

    if (previewMode || e.button !== 0) return;

    const target = e.target as HTMLElement;
    const clickedNode = target.closest('[data-kubuild-node]');
    const isRootOrEmpty = !clickedNode || clickedNode.getAttribute('data-kubuild-node') === document.document.id;

    // Check if clicking directly on empty canvas background / dot-grid container or transform layer:
    const isDirectCanvasBg =
      target === containerRef.current ||
      target === layerRef.current ||
      target.getAttribute('data-testid') === 'canvas-viewport-container' ||
      target.getAttribute('data-testid') === 'canvas-transform-layer';

    if (isDirectCanvasBg && !e.shiftKey) {
      // In Figma, clicking empty canvas background without holding Shift starts panning!
      handlePanPointerDown(e);
      return;
    }

    if (isRootOrEmpty) {
      marqueeDragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        shiftKey: e.shiftKey,
      };
    }
  };

  const handleCanvasPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const drag = marqueeDragRef.current;
      if (!drag || !layerRef.current) return;

      const layerRect = layerRef.current.getBoundingClientRect();
      const scale = zoom > 0 ? zoom : 1;

      const startX = (drag.startX - layerRect.left) / scale;
      const startY = (drag.startY - layerRect.top) / scale;
      const currentX = (e.clientX - layerRect.left) / scale;
      const currentY = (e.clientY - layerRect.top) / scale;

      const left = Math.min(startX, currentX);
      const top = Math.min(startY, currentY);
      const width = Math.abs(currentX - startX);
      const height = Math.abs(currentY - startY);

      setMarqueeRect({ top, left, width, height });
    },
    [zoom],
  );

  const handleCanvasPointerUp = useCallback(() => {
    const drag = marqueeDragRef.current;
    if (!drag) return;

    const layer = layerRef.current;
    if (layer && marqueeRect && marqueeRect.width >= 4 && marqueeRect.height >= 4) {
      const nodeElements = Array.from(layer.querySelectorAll<HTMLElement>('[data-kubuild-node]'));
      const scale = zoom > 0 ? zoom : 1;
      const layerRect = layer.getBoundingClientRect();

      const candidateNodes = nodeElements
        .map((el) => {
          const id = el.getAttribute('data-kubuild-node');
          if (!id || id === document.document.id) return null;
          const r = el.getBoundingClientRect();
          const rect: CanvasRect = {
            top: (r.top - layerRect.top) / scale,
            left: (r.left - layerRect.left) / scale,
            width: r.width / scale,
            height: r.height / scale,
          };
          return { id, rect };
        })
        .filter((n): n is { id: string; rect: CanvasRect } => n !== null);

      const intersectedIds = calculateMarqueeIntersections(marqueeRect, candidateNodes);

      if (drag.shiftKey) {
        const merged = Array.from(new Set([...selectedNodeIds, ...intersectedIds]));
        selectMultipleNodes(merged);
      } else if (intersectedIds.length > 0) {
        selectMultipleNodes(intersectedIds);
      } else {
        selectNode(null);
      }
    } else {
      // Just a click on empty canvas background
      selectNode(null);
    }

    marqueeDragRef.current = null;
    setMarqueeRect(null);
  }, [marqueeRect, zoom, document.document.id, selectedNodeIds, selectMultipleNodes, selectNode]);

  // Drag & drop handlers
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

    const layer = layerRef.current;
    if (!layer) return;

    const layerRect = layer.getBoundingClientRect();
    const scale = zoom > 0 ? zoom : 1;
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
      const blockDef = STARTER_BLOCKS.find((b) => b.id === activePayload.blockId);
      if (blockDef) {
        try {
          const sample = blockDef.createNodeTree(() => 'sample');
          incomingType = sample.type;
        } catch {
          incomingType = 'section';
        }
      } else {
        incomingType = 'section';
      }
    }

    if (!incomingType) {
      setDropTarget(null);
      e.dataTransfer.dropEffect = 'none';
      return;
    }

    if (!hoveredEl) {
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
          width: layerRect.width / scale,
          height: Math.max(layerRect.height / scale, 200),
        },
      });
      return;
    }

    const hoveredId = hoveredEl.getAttribute('data-kubuild-node');
    if (!hoveredId) return;

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
        top: (elRect.top - layerRect.top) / scale,
        left: (elRect.left - layerRect.left) / scale,
        width: elRect.width / scale,
        height: elRect.height / scale,
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

  const isMultiSelecting = selectedNodeIds.length > 1;

  if (multiDeviceMode) {
    return (
      <MultiDevicePreview
        document={document}
        registry={registry}
        context={context}
        onClose={toggleMultiDeviceMode}
      />
    );
  }

  return (
    <div
      ref={containerRef}
      data-testid="canvas-viewport-container"
      className={`relative w-full h-full overflow-hidden select-none ${className || ''}`}
      style={{
        position: 'relative',
        width: '100%',
        minHeight: '100%',
        height: '100%',
        overflow: 'hidden',
        cursor: cursorStyle,
        backgroundColor: '#f1f5f9',
        backgroundImage: `radial-gradient(circle, #cbd5e1 ${Math.max(0.75, Math.min(2.5, 1.2 * zoom))}px, transparent ${Math.max(0.75, Math.min(2.5, 1.2 * zoom))}px)`,
        backgroundSize: `${24 * zoom}px ${24 * zoom}px`,
        backgroundPosition: `${pan.x}px ${pan.y}px`,
      }}
      onPointerDown={handleCanvasPointerDown}
      onPointerMove={handleCanvasPointerMove}
      onPointerUp={handleCanvasPointerUp}
      onMouseOver={previewMode ? undefined : handleMouseOver}
      onMouseLeave={previewMode ? undefined : handleMouseLeave}
      onDragStart={previewMode ? undefined : handleDragStart}
      onDragOver={previewMode ? undefined : handleDragOver}
      onDrop={previewMode ? undefined : handleDrop}
      onDragEnd={previewMode ? undefined : handleDragEnd}
    >
      {/* 60 FPS Hardware-Accelerated Canvas Transform Layer (STORA-125, STORA-130, STORA-131) */}
      <div
        ref={layerRef}
        data-testid="canvas-transform-layer"
        style={{
          position: 'relative',
          width: 'max-content',
          minWidth: '100%',
          minHeight: '100%',
          transform: `translate3d(${pan.x}px, ${pan.y}px, 0px) scale(${zoom})`,
          transformOrigin: '0 0',
          willChange: isPanning ? 'transform' : undefined,
          boxSizing: 'border-box',
        }}
      >
        {/* Figma Multi-Page Artboards Container */}
        <div className="inline-flex items-start gap-16 p-12 select-none" style={{ minWidth: 'max-content' }}>
          {allPages.map((pageItem) => {
            const isActive = pageItem.id === effectiveActivePageId;
            const pageWidth = getPageWidth(pageItem);
            const pageViewport = getPageViewport(pageItem);

            return (
              <ViewportResizer
                key={pageItem.id}
                width={pageWidth}
                onWidthChange={(newW) => handlePageWidthChange(pageItem.id, newW)}
                onBreakpointChange={(newBp) => handlePageBreakpointChange(pageItem.id, newBp as Viewport)}
                title={pageItem.name}
                slug={pageItem.slug}
                isActive={isActive}
                onSelect={() => handleSelectPage(pageItem.id)}
                zoom={zoom}
                showPresets={true}
                frameRef={isActive ? activeArtboardRef : undefined}
                onHeaderPointerDown={handlePanPointerDown}
                className="shrink-0"
              >
                {isActive ? (
                  <>
                    <KubuildRenderer
                      document={activeDoc}
                      registry={registry}
                      context={context}
                      viewport={pageViewport}
                      mode={previewMode ? 'runtime' : 'editor'}
                    onNodeClick={(id: string, e?: React.MouseEvent) => {
                      if (!previewMode) {
                        if (e?.shiftKey) {
                          // STORA-132: Multi-selection via Shift + Click
                          toggleNodeSelection(id, true);
                        } else {
                          selectNode(id);
                        }
                      }
                    }}
                    onNodePropChange={(nodeId: string, propName: string, value: unknown, isBlur?: boolean) => {
                      if (previewMode) return;
                      if (!isBlur && typeof value === 'string' && value.trim() === '') return;
                      updateNodeProps(nodeId, { [propName]: value }, registry);
                    }}
                    onActionDispatch={(
                      actionType: string,
                      payload: Record<string, unknown> | undefined,
                      nodeId: string,
                    ) => {
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

                  {/* Overlays on Active Artboard */}
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

                  {!previewMode &&
                    isMultiSelecting &&
                    selectedRects.map(({ id, rect }) => (
                      <div
                        key={id}
                        aria-hidden="true"
                        role="presentation"
                        data-testid="editor-selection-overlay"
                        data-node-id={id}
                        style={{
                          position: 'absolute',
                          pointerEvents: 'none',
                          top: rect.top,
                          left: rect.left,
                          width: rect.width,
                          height: rect.height,
                          border: '2px solid #3b82f6',
                          backgroundColor: 'rgba(59, 130, 246, 0.06)',
                        }}
                      />
                    ))}

                  {!previewMode && !isMultiSelecting && selectedRect && (
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

                  {!previewMode && !isMultiSelecting && selectedRect && selectedNode && isGridSelected && (
                    <GridGuidelinesOverlay
                      node={selectedNode}
                      selectedRect={selectedRect}
                      viewport={viewport}
                      zoom={zoom}
                      containerRef={activeArtboardRef}
                    />
                  )}

                  {!previewMode &&
                    !isMultiSelecting &&
                    selectedRect &&
                    selectedNodeId &&
                    selectedNodeId !== activeDoc.document.id && (
                      <ResizeHandles
                        selectedNodeId={selectedNodeId}
                        selectedRect={selectedRect}
                        zoom={zoom}
                        candidateRects={candidateRects}
                        onGuidesChange={setActiveGuides}
                      />
                    )}

                  {!previewMode &&
                    !isMultiSelecting &&
                    selectedRect &&
                    selectedNodeId &&
                    selectedNodeId !== activeDoc.document.id && (
                      <SpacingSliders
                        selectedNodeId={selectedNodeId}
                        selectedRect={selectedRect}
                        document={activeDoc}
                        zoom={zoom}
                      />
                    )}

                  {!previewMode && <SmartGuides guides={activeGuides} />}

                  {!previewMode &&
                    isAltPressed &&
                    selectedRect &&
                    hoveredRect &&
                    hoveredNodeId &&
                    hoveredNodeId !== selectedNodeId && (
                      <DistanceMeter selectedRect={selectedRect} targetRect={hoveredRect} />
                    )}

                  {!previewMode && showFloatingBadges && selectedRect && selectedNodeId && !isMultiSelecting && (
                    <FloatingActionBadges
                      selectedNodeId={selectedNodeId}
                      document={activeDoc}
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
                  </>
                ) : (
                  <div
                    data-testid={`canvas-artboard-page-${pageItem.id}`}
                    onClick={() => handleSelectPage(pageItem.id)}
                    className="w-full h-full min-h-[500px] cursor-pointer group/artboard relative"
                    title="Click to edit"
                  >
                    <div className="absolute top-2 right-2 z-10 opacity-0 group-hover/artboard:opacity-100 transition-opacity bg-slate-900/80 text-white text-[11px] font-medium px-2 py-1 rounded shadow pointer-events-none">
                      Click to edit
                    </div>
                    <KubuildRenderer
                      document={pageItem.document}
                      registry={registry}
                      context={context}
                      viewport={pageViewport}
                      mode="runtime"
                      onNodeClick={() => handleSelectPage(pageItem.id)}
                    />
                  </div>
                )}
              </ViewportResizer>
            );
          })}
        </div>

        {/* STORA-133: Marquee Selection Box */}
        {!previewMode && <MarqueeSelectionBox rect={marqueeRect} />}
      </div>

      {/* STORA-131: Canvas Zoom Toolbar */}
      {!previewMode && (
        <div className="absolute bottom-3 right-3 z-40">
          <CanvasZoomToolbar
            zoom={zoom}
            onZoomChange={setZoom}
            onReset={resetPanZoom}
            onFit={fitPanZoom}
            toolMode={toolMode}
            onToolModeChange={setToolMode}
            multiDeviceMode={multiDeviceMode}
            onToggleMultiDevice={toggleMultiDeviceMode}
          />
        </div>
      )}
    </div>
  );
};
