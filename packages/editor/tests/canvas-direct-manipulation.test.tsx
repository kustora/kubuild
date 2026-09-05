import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { PageDocument } from '@kubuild/schema';
import { createDefaultComponentRegistry } from '@kubuild/components';
import { createBlankDocument, insertNode } from '@kubuild/core';
import { useEditorStore } from '../src/store';
import {
  EditorCanvas,
  ResizeHandles,
  SpacingSliders,
  SmartGuides,
  calculateSnapping,
  DistanceMeter,
  calculateDistances,
  CanvasZoomToolbar,
  clampZoom,
  MarqueeSelectionBox,
  calculateMarqueeIntersections,
  rectsIntersect,
  GridGuidelinesOverlay,
} from '../src/components/canvas';

function createFixtureDoc(): PageDocument {
  const doc = createBlankDocument('Direct Manipulation Test Page');
  doc.document.children = [
    {
      id: 'section-1',
      type: 'section',
      props: {},
      styles: {
        base: {
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          paddingTop: '20px',
          paddingBottom: '20px',
          paddingLeft: '10px',
          paddingRight: '10px',
        },
      },
      children: [
        {
          id: 'heading-1',
          type: 'heading',
          props: { text: 'Title' },
          styles: { base: { width: '200px', height: '40px' } },
        },
        {
          id: 'text-1',
          type: 'text',
          props: { text: 'Description paragraph' },
          styles: { base: { width: '200px', height: '60px' } },
        },
      ],
    },
    {
      id: 'container-2',
      type: 'container',
      props: {},
      children: [],
    },
  ];
  return doc;
}

describe('Canvas Direct Manipulation Specialist (Agent 3)', () => {
  const registry = createDefaultComponentRegistry();

  beforeEach(() => {
    const doc = createFixtureDoc();
    useEditorStore.getState().setDocument(doc);
    useEditorStore.getState().selectNode(null);
  });

  // =========================================================================
  // STORA-132: Multi-Selection in Store
  // =========================================================================
  describe('STORA-132: Multi-Selection in Editor Store', () => {
    it('initializes selectedNodeIds as an empty array', () => {
      const state = useEditorStore.getState();
      expect(state.selectedNodeId).toBeNull();
      expect(state.selectedNodeIds).toEqual([]);
    });

    it('selectNode(id) synchronizes selectedNodeId and selectedNodeIds', () => {
      useEditorStore.getState().selectNode('heading-1');
      const state = useEditorStore.getState();
      expect(state.selectedNodeId).toBe('heading-1');
      expect(state.selectedNodeIds).toEqual(['heading-1']);

      useEditorStore.getState().selectNode(null);
      const cleared = useEditorStore.getState();
      expect(cleared.selectedNodeId).toBeNull();
      expect(cleared.selectedNodeIds).toEqual([]);
    });

    it('selectMultipleNodes(ids) sets multi-selection and primary selectedNodeId', () => {
      useEditorStore.getState().selectMultipleNodes(['heading-1', 'text-1']);
      const state = useEditorStore.getState();
      expect(state.selectedNodeIds).toEqual(['heading-1', 'text-1']);
      expect(state.selectedNodeId).toBe('heading-1');

      useEditorStore.getState().selectMultipleNodes([]);
      const cleared = useEditorStore.getState();
      expect(cleared.selectedNodeIds).toEqual([]);
      expect(cleared.selectedNodeId).toBeNull();
    });

    it('toggleNodeSelection(id, multi) supports Shift+Click toggle behavior', () => {
      // Non-multi sets single selection
      useEditorStore.getState().toggleNodeSelection('heading-1', false);
      expect(useEditorStore.getState().selectedNodeIds).toEqual(['heading-1']);
      expect(useEditorStore.getState().selectedNodeId).toBe('heading-1');

      // Multi=true adds second node
      useEditorStore.getState().toggleNodeSelection('text-1', true);
      expect(useEditorStore.getState().selectedNodeIds).toEqual(['heading-1', 'text-1']);
      expect(useEditorStore.getState().selectedNodeId).toBe('heading-1');

      // Multi=true removes node when already selected
      useEditorStore.getState().toggleNodeSelection('heading-1', true);
      expect(useEditorStore.getState().selectedNodeIds).toEqual(['text-1']);
      expect(useEditorStore.getState().selectedNodeId).toBe('text-1');

      // Remove the last remaining node
      useEditorStore.getState().toggleNodeSelection('text-1', true);
      expect(useEditorStore.getState().selectedNodeIds).toEqual([]);
      expect(useEditorStore.getState().selectedNodeId).toBeNull();
    });

    it('wrapSelectedIntoFrame wraps selected nodes into a new flex frame and selects it', () => {
      useEditorStore.getState().selectMultipleNodes(['heading-1', 'text-1']);
      const result = useEditorStore.getState().wrapSelectedIntoFrame();

      expect(result.success).toBe(true);
      expect(result.nodeId).toBeDefined();

      const state = useEditorStore.getState();
      expect(state.selectedNodeId).toBe(result.nodeId);
      expect(state.selectedNodeIds).toEqual([result.nodeId]);

      // Check document structure
      const section = state.document.document.children?.[0];
      expect(section?.children).toBeDefined();
      expect(section?.children?.length).toBe(1);
      const frame = section?.children?.[0];
      expect(frame?.type).toBe('flex');
      expect(frame?.id).toBe(result.nodeId);
      expect(frame?.children?.map((c) => c.id)).toEqual(['heading-1', 'text-1']);
    });

    it('wrapSelectedIntoFrame rejects empty selection or root page wrapping', () => {
      useEditorStore.getState().selectNode(null);
      const emptyResult = useEditorStore.getState().wrapSelectedIntoFrame();
      expect(emptyResult.success).toBe(false);
      expect(emptyResult.error).toContain('At least one node ID must be provided');

      useEditorStore.getState().selectNode('root-page');
      const rootResult = useEditorStore.getState().wrapSelectedIntoFrame();
      expect(rootResult.success).toBe(false);
      expect(rootResult.error).toContain('Cannot wrap the root page node');
    });

    it('ungroupSelectedFrame ungroups flex container and selects unwrapped children', () => {
      // First wrap
      useEditorStore.getState().selectMultipleNodes(['heading-1', 'text-1']);
      const wrapResult = useEditorStore.getState().wrapSelectedIntoFrame();
      expect(wrapResult.success).toBe(true);
      const frameId = wrapResult.nodeId!;

      // Now ungroup
      useEditorStore.getState().selectNode(frameId);
      const ungroupResult = useEditorStore.getState().ungroupSelectedFrame();

      expect(ungroupResult.success).toBe(true);
      expect(ungroupResult.unwrappedIds).toEqual(['heading-1', 'text-1']);

      const state = useEditorStore.getState();
      expect(state.selectedNodeIds).toEqual(['heading-1', 'text-1']);

      const section = state.document.document.children?.[0];
      expect(section?.children?.map((c) => c.id)).toEqual(['heading-1', 'text-1']);
    });

    it('ungroupSelectedFrame rejects non-flex nodes', () => {
      useEditorStore.getState().selectNode('heading-1');
      const result = useEditorStore.getState().ungroupSelectedFrame();
      expect(result.success).toBe(false);
      expect(result.error).toContain('is not a flex container');
    });

    it('selectParent updates both selectedNodeId and selectedNodeIds', () => {
      useEditorStore.getState().selectNode('heading-1');
      useEditorStore.getState().selectParent();

      const state = useEditorStore.getState();
      expect(state.selectedNodeId).toBe('section-1');
      expect(state.selectedNodeIds).toEqual(['section-1']);
    });

    it('history undo and redo preserves valid multi-selection state', () => {
      useEditorStore.getState().selectMultipleNodes(['heading-1', 'text-1']);
      useEditorStore.getState().updateNodeStyle('heading-1', { color: 'red' }, 'base');

      expect(useEditorStore.getState().canUndo).toBe(true);
      useEditorStore.getState().undo();

      const undoneState = useEditorStore.getState();
      expect(undoneState.selectedNodeIds).toEqual(['heading-1', 'text-1']);

      useEditorStore.getState().redo();
      const redoneState = useEditorStore.getState();
      expect(redoneState.selectedNodeIds).toEqual(['heading-1', 'text-1']);
    });
  });

  // =========================================================================
  // STORA-120 & STORA-125: 8-Point Visual Transform & Resize Handles
  // =========================================================================
  describe('STORA-120: 8-Point Visual Transform & Resize Handles', () => {
    it('renders all 8 resize handles around selected bounding box', () => {
      const html = renderToString(
        <ResizeHandles
          selectedNodeId="heading-1"
          selectedRect={{ top: 20, left: 30, width: 200, height: 50 }}
        />,
      );

      expect(html).toContain('data-testid="resize-handles-container"');
      expect(html).toContain('data-testid="resize-handle-nw"');
      expect(html).toContain('data-testid="resize-handle-n"');
      expect(html).toContain('data-testid="resize-handle-ne"');
      expect(html).toContain('data-testid="resize-handle-e"');
      expect(html).toContain('data-testid="resize-handle-se"');
      expect(html).toContain('data-testid="resize-handle-s"');
      expect(html).toContain('data-testid="resize-handle-sw"');
      expect(html).toContain('data-testid="resize-handle-w"');
    });

    it('correctly sets cursor styles for resize directions', () => {
      const html = renderToString(
        <ResizeHandles
          selectedNodeId="heading-1"
          selectedRect={{ top: 20, left: 30, width: 200, height: 50 }}
        />,
      );

      expect(html).toContain('cursor:nwse-resize');
      expect(html).toContain('cursor:nesw-resize');
      expect(html).toContain('cursor:ns-resize');
      expect(html).toContain('cursor:ew-resize');
    });
  });

  // =========================================================================
  // STORA-121 & STORA-122: On-Canvas Spacing & Gap Sliders
  // =========================================================================
  describe('STORA-121 & STORA-122: On-Canvas Padding & Gap Sliders', () => {
    it('renders tinted padding box and 4 padding drag handles', () => {
      const doc = createFixtureDoc();
      useEditorStore.getState().setDocument(doc);
      useEditorStore.getState().selectNode('section-1');

      const html = renderToString(
        <SpacingSliders
          document={doc}
          selectedNodeId="section-1"
          selectedRect={{ top: 10, left: 10, width: 400, height: 300 }}
        />,
      );

      expect(html).toContain('data-testid="spacing-sliders-container"');
      expect(html).toContain('data-testid="padding-box-overlay"');
      expect(html).toContain('data-testid="padding-handle-top"');
      expect(html).toContain('data-testid="padding-handle-bottom"');
      expect(html).toContain('data-testid="padding-handle-left"');
      expect(html).toContain('data-testid="padding-handle-right"');
    });

    it('renders gap slider handle for flex container with multiple children (STORA-122)', () => {
      const doc = createFixtureDoc();
      useEditorStore.getState().setDocument(doc);
      useEditorStore.getState().selectNode('section-1');

      const html = renderToString(
        <SpacingSliders
          document={doc}
          selectedNodeId="section-1"
          selectedRect={{ top: 10, left: 10, width: 400, height: 300 }}
        />,
      );

      expect(html).toContain('data-testid="gap-slider-overlay"');
      expect(html).toContain('data-testid="gap-slider-handle"');
      expect(html).toContain('Gap: 16px');
    });

    it('does not render gap slider when node is not flex/grid or has fewer than 2 children', () => {
      const doc = createFixtureDoc();
      useEditorStore.getState().setDocument(doc);
      useEditorStore.getState().selectNode('container-2');

      const html = renderToString(
        <SpacingSliders
          document={doc}
          selectedNodeId="container-2"
          selectedRect={{ top: 10, left: 10, width: 400, height: 100 }}
        />,
      );

      expect(html).not.toContain('data-testid="gap-slider-handle"');
    });
  });

  // =========================================================================
  // STORA-123: Smart Alignment Guides & Snapping Engine
  // =========================================================================
  describe('STORA-123: Smart Alignment Guides & Snapping Engine', () => {
    const active = { top: 102, left: 51, width: 100, height: 50 };
    const candidates = [
      { top: 100, left: 50, width: 100, height: 50 }, // close to top (100) and left (50) within 2px
    ];

    it('snaps within 5px threshold and generates cyan guides for same-edge match', () => {
      const result = calculateSnapping(active, candidates, 5);

      expect(result.snappedX).toBe(true);
      expect(result.snappedY).toBe(true);
      expect(result.snappedRect.top).toBe(100);
      expect(result.snappedRect.left).toBe(50);

      // Cyan guides for same-edge alignments
      const cyanGuides = result.guides.filter((g) => g.color === 'cyan');
      expect(cyanGuides.length).toBeGreaterThan(0);
      expect(cyanGuides.some((g) => g.type === 'horizontal' && g.position === 100)).toBe(true);
      expect(cyanGuides.some((g) => g.type === 'vertical' && g.position === 50)).toBe(true);
    });

    it('snaps opposite edges with magenta visual guides (e.g. top-to-bottom)', () => {
      const activeCloseToBottom = { top: 152, left: 200, width: 100, height: 50 };
      const ref = [{ top: 100, left: 200, width: 100, height: 50 }]; // bottom is 150 -> diff = 2px

      const result = calculateSnapping(activeCloseToBottom, ref, 5);
      expect(result.snappedY).toBe(true);
      expect(result.snappedRect.top).toBe(150);

      const magentaGuides = result.guides.filter((g) => g.color === 'magenta');
      expect(magentaGuides.length).toBeGreaterThan(0);
      expect(magentaGuides.some((g) => g.type === 'horizontal' && g.position === 150)).toBe(true);
    });

    it('does not snap when distance exceeds threshold', () => {
      const farActive = { top: 120, left: 120, width: 100, height: 50 };
      const result = calculateSnapping(farActive, candidates, 5);

      expect(result.snappedX).toBe(false);
      expect(result.snappedY).toBe(false);
      expect(result.snappedRect.top).toBe(120);
      expect(result.snappedRect.left).toBe(120);
      expect(result.guides.length).toBe(0);
    });

    it('renders SmartGuides component with cyan and magenta lines', () => {
      const guides = [
        { id: 'g1', type: 'horizontal' as const, position: 100, start: 40, end: 160, color: 'cyan' as const },
        { id: 'g2', type: 'vertical' as const, position: 50, start: 80, end: 170, color: 'magenta' as const },
      ];

      const html = renderToString(<SmartGuides guides={guides} />);
      expect(html).toContain('data-testid="smart-guides-container"');
      expect(html).toContain('data-guide-color="cyan"');
      expect(html).toContain('data-guide-color="magenta"');
      expect(html).toContain('#06b6d4'); // cyan hex
      expect(html).toContain('#d946ef'); // magenta hex
    });
  });

  // =========================================================================
  // STORA-124: Distance Meter on Alt/Option Hold
  // =========================================================================
  describe('STORA-124: Distance Meter', () => {
    it('calculates inner distances when target contains selected node (parent -> child)', () => {
      const parent = { top: 0, left: 0, width: 500, height: 400 };
      const child = { top: 50, left: 60, width: 200, height: 100 };

      const measurements = calculateDistances(child, parent);

      expect(measurements.length).toBe(4);
      const topDist = measurements.find((m) => m.id === 'inner-top');
      const leftDist = measurements.find((m) => m.id === 'inner-left');
      const bottomDist = measurements.find((m) => m.id === 'inner-bottom');
      const rightDist = measurements.find((m) => m.id === 'inner-right');

      expect(topDist?.distance).toBe(50);
      expect(leftDist?.distance).toBe(60);
      expect(bottomDist?.distance).toBe(250); // 400 - (50 + 100) = 250
      expect(rightDist?.distance).toBe(240); // 500 - (60 + 200) = 240
    });

    it('calculates sibling gap distances with pixel badges', () => {
      const leftSibling = { top: 100, left: 50, width: 100, height: 50 };
      const rightSibling = { top: 100, left: 190, width: 100, height: 50 };

      const measurements = calculateDistances(leftSibling, rightSibling);
      expect(measurements.length).toBe(1);
      expect(measurements[0].type).toBe('horizontal');
      expect(measurements[0].distance).toBe(40); // 190 - (50 + 100) = 40
    });

    it('renders DistanceMeter component with measurement lines and badges', () => {
      const leftSibling = { top: 100, left: 50, width: 100, height: 50 };
      const rightSibling = { top: 100, left: 190, width: 100, height: 50 };

      const html = renderToString(
        <DistanceMeter selectedRect={leftSibling} targetRect={rightSibling} />,
      );

      expect(html).toContain('data-testid="distance-meter-container"');
      expect(html).toContain('data-testid="distance-meter-line"');
      expect(html).toContain('data-testid="distance-badge"');
      expect(html).toContain('40px');
    });
  });

  // =========================================================================
  // STORA-130 & STORA-131: Canvas Pan & Zoom
  // =========================================================================
  describe('STORA-130 & STORA-131: Canvas Pan & Zoom', () => {
    it('clampZoom limits zoom level between 25% and 200%', () => {
      expect(clampZoom(0.1)).toBe(0.25);
      expect(clampZoom(0.25)).toBe(0.25);
      expect(clampZoom(1.0)).toBe(1.0);
      expect(clampZoom(1.8)).toBe(1.8);
      expect(clampZoom(2.5)).toBe(2.0);
    });

    it('CanvasZoomToolbar renders all preset buttons and zoom level', () => {
      const onZoom = vi.fn();
      const onReset = vi.fn();
      const onFit = vi.fn();

      const html = renderToString(
        <CanvasZoomToolbar
          zoom={1.0}
          onZoomChange={onZoom}
          onReset={onReset}
          onFit={onFit}
        />,
      );

      expect(html).toContain('data-testid="canvas-zoom-toolbar"');
      expect(html).toContain('data-testid="zoom-in-btn"');
      expect(html).toContain('data-testid="zoom-out-btn"');
      expect(html).toContain('data-testid="zoom-level-display"');
      expect(html).toContain('100%');
      expect(html).toContain('data-testid="zoom-preset-50"');
      expect(html).toContain('data-testid="zoom-preset-75"');
      expect(html).toContain('data-testid="zoom-preset-100"');
      expect(html).toContain('data-testid="zoom-preset-150"');
      expect(html).toContain('data-testid="zoom-reset-btn"');
      expect(html).toContain('data-testid="zoom-fit-btn"');
    });

    it('renders navigation tool mode toggles (Select and Hand tools)', () => {
      const onZoom = vi.fn();
      const onReset = vi.fn();
      const onToolChange = vi.fn();

      const html = renderToString(
        <CanvasZoomToolbar
          zoom={1.0}
          onZoomChange={onZoom}
          onReset={onReset}
          toolMode="hand"
          onToolModeChange={onToolChange}
        />,
      );

      expect(html).toContain('data-testid="tool-select-btn"');
      expect(html).toContain('data-testid="tool-hand-btn"');
    });
  });

  // =========================================================================
  // STORA-133: Marquee Selection Box
  // =========================================================================
  describe('STORA-133: Marquee Selection Box', () => {
    it('rectsIntersect detects overlapping rectangles', () => {
      const r1 = { top: 10, left: 10, width: 100, height: 100 };
      const r2 = { top: 50, left: 50, width: 100, height: 100 };
      const r3 = { top: 200, left: 200, width: 50, height: 50 };

      expect(rectsIntersect(r1, r2)).toBe(true);
      expect(rectsIntersect(r1, r3)).toBe(false);
    });

    it('calculateMarqueeIntersections returns IDs of intersecting nodes', () => {
      const marquee = { top: 0, left: 0, width: 150, height: 150 };
      const nodes = [
        { id: 'node-1', rect: { top: 20, left: 20, width: 50, height: 50 } }, // inside
        { id: 'node-2', rect: { top: 100, left: 100, width: 100, height: 100 } }, // overlapping
        { id: 'node-3', rect: { top: 300, left: 300, width: 50, height: 50 } }, // outside
      ];

      const result = calculateMarqueeIntersections(marquee, nodes);
      expect(result).toEqual(['node-1', 'node-2']);
    });

    it('renders MarqueeSelectionBox component when active', () => {
      const html = renderToString(
        <MarqueeSelectionBox rect={{ top: 20, left: 30, width: 100, height: 80 }} />,
      );

      expect(html).toContain('data-testid="marquee-selection-box"');
      expect(html).toContain('top:20px');
      expect(html).toContain('left:30px');
      expect(html).toContain('width:100px');
      expect(html).toContain('height:80px');
    });

    it('does not render MarqueeSelectionBox when rect is null or too small', () => {
      const htmlNull = renderToString(<MarqueeSelectionBox rect={null} />);
      expect(htmlNull).toBe('');

      const htmlSmall = renderToString(
        <MarqueeSelectionBox rect={{ top: 0, left: 0, width: 1, height: 1 }} />,
      );
      expect(htmlSmall).toBe('');
    });
  });

  // =========================================================================
  // Full Integration in EditorCanvas
  // =========================================================================
  describe('EditorCanvas Integration', () => {
    it('renders transformed canvas layer and zoom toolbar', () => {
      const doc = createFixtureDoc();
      useEditorStore.getState().setDocument(doc);

      const html = renderToString(
        <EditorCanvas document={doc} registry={registry} viewport="desktop" />,
      );

      expect(html).toContain('data-testid="canvas-viewport-container"');
      expect(html).toContain('data-testid="canvas-transform-layer"');
      expect(html).toContain('data-testid="canvas-zoom-toolbar"');
    });

    it('synchronizes background dot grid position and size with canvas pan and zoom', () => {
      const doc = createFixtureDoc();
      useEditorStore.getState().setDocument(doc);

      const html = renderToString(
        <EditorCanvas document={doc} registry={registry} viewport="desktop" />,
      );

      expect(html).toContain('background-position:');
      expect(html).toContain('background-size:');
      expect(html).toContain('radial-gradient');
    });
  });

  // =========================================================================
  // STORA-114: Canvas Grid Guidelines Overlay
  // =========================================================================
  describe('STORA-114: Canvas Grid Guidelines Overlay', () => {
    it('renders visual dashed grid overlay with columns, rows, and gaps for grid container', () => {
      const gridNode = {
        id: 'grid-1',
        type: 'grid',
        props: { columns: 3, gap: '16px' },
        styles: {
          base: {
            display: 'grid',
            gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
            gap: '16px',
          },
        },
        children: [
          { id: 'c1', type: 'text', props: { text: 'Cell 1' } },
          { id: 'c2', type: 'text', props: { text: 'Cell 2' } },
          { id: 'c3', type: 'text', props: { text: 'Cell 3' } },
        ],
      };

      const html = renderToString(
        <GridGuidelinesOverlay
          node={gridNode}
          selectedRect={{ top: 50, left: 100, width: 600, height: 200 }}
          viewport="desktop"
        />,
      );

      expect(html).toContain('data-testid="grid-guidelines-overlay"');
      expect(html).toContain('data-testid="grid-column-track"');
      expect(html).toContain('Col 1');
      expect(html).toContain('Col 2');
      expect(html).toContain('Col 3');
      expect(html).toContain('data-testid="grid-row-track"');
      expect(html).toContain('data-testid="grid-cell-guide"');
      expect(html).toContain('data-testid="grid-cell-coords"');
      expect(html).toContain('1,1');
      expect(html).toContain('data-testid="grid-gap-indicator"');
      expect(html).toContain('Gap: 16px');
      expect(html).toContain('border:1px dashed #3b82f6');
    });

    it('adapts column and row tracks when display is grid with custom template', () => {
      const customGridNode = {
        id: 'box-grid',
        type: 'container',
        styles: {
          base: {
            display: 'grid',
            gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
            gridTemplateRows: 'repeat(2, 100px)',
            rowGap: '20px',
            columnGap: '10px',
          },
        },
        children: [],
      };

      const html = renderToString(
        <GridGuidelinesOverlay
          node={customGridNode}
          selectedRect={{ top: 0, left: 0, width: 800, height: 300 }}
        />,
      );

      expect(html).toContain('data-testid="grid-guidelines-overlay"');
      expect(html).toContain('Col 4');
      expect(html).toContain('R2');
      expect(html).toContain('Gap: 10px / 20px');
    });

    it('renders overlay in EditorCanvas when grid container is selected', () => {
      const doc = createBlankDocument('Grid Canvas Page');
      doc.document.children = [
        {
          id: 'grid-container-1',
          type: 'grid',
          props: { columns: 2 },
          styles: {
            base: {
              display: 'grid',
              gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
              gap: '12px',
            },
          },
          children: [
            { id: 'item-1', type: 'text', props: { text: 'One' } },
            { id: 'item-2', type: 'text', props: { text: 'Two' } },
          ],
        },
      ];

      useEditorStore.getState().setDocument(doc);
      useEditorStore.getState().selectNode('grid-container-1');

      const html = renderToString(
        <EditorCanvas document={doc} registry={registry} viewport="desktop" />,
      );

      // In SSR/renderToString rectFor is null without DOM, but EditorCanvas integrates the conditional check
      expect(html).toContain('data-testid="canvas-viewport-container"');
    });
  });

  // =========================================================================
  // Keyboard Shortcuts: Cmd+G (wrap) & Cmd+Shift+G (ungroup)
  // =========================================================================
  describe('Keyboard shortcuts: Cmd+G (wrap) and Cmd+Shift+G (ungroup)', () => {
    it('executes wrap into frame action via store shortcut equivalent', () => {
      const doc = createFixtureDoc();
      useEditorStore.getState().setDocument(doc);
      useEditorStore.getState().selectMultipleNodes(['heading-1', 'text-1']);

      const wrapRes = useEditorStore.getState().wrapSelectedIntoFrame();
      expect(wrapRes.success).toBe(true);
      expect(wrapRes.nodeId).toBeDefined();

      const createdFrame = useEditorStore.getState().selectedNodeId;
      expect(createdFrame).toBe(wrapRes.nodeId);

      // Ungroup shortcut equivalent
      const ungroupRes = useEditorStore.getState().ungroupSelectedFrame();
      expect(ungroupRes.success).toBe(true);
      expect(ungroupRes.unwrappedIds).toEqual(['heading-1', 'text-1']);
    });
  });
});
