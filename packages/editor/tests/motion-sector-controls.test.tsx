import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { createDefaultComponentRegistry } from '@kubuild/components';
import { createBlankDocument } from '@kubuild/core';
import {
  MotionSectorControls,
  ANIMATION_TYPES,
  EASING_OPTIONS,
  HOVER_EFFECTS,
  LOOP_EFFECTS,
} from '../src/components/style-manager/motion-sector-controls';
import { StyleManagerAccordion } from '../src/components/style-manager/style-manager-accordion';
import { InspectorPanel } from '../src/components/panels/inspector-panel';
import { useEditorStore } from '../src/store';

describe('Motion & Animation Sector Controls (STORA-261)', () => {
  const registry = createDefaultComponentRegistry();

  it('defines animation options: types, easing curves, hover and loop effects', () => {
    expect(ANIMATION_TYPES.length).toBeGreaterThan(3);
    expect(EASING_OPTIONS.map((e) => e.value)).toContain('ease-out');
    expect(EASING_OPTIONS.map((e) => e.value)).toContain('ease-in-out');
    expect(HOVER_EFFECTS.map((h) => h.value)).toEqual(['none', 'lift', 'scale', 'glow', 'tilt']);
    expect(LOOP_EFFECTS.map((l) => l.value)).toEqual([
      'none',
      'pulse',
      'bounce',
      'spin',
      'float',
      'shimmer',
    ]);
  });

  it('renders MotionSectorControls with default values', () => {
    const html = renderToString(
      <MotionSectorControls
        animation={{
          type: 'none',
          duration: 600,
          delay: 0,
          easing: 'ease-out',
          once: true,
          hoverEffect: 'none',
          loopEffect: 'none',
        }}
        onChange={() => {}}
      />,
    );

    expect(html).toContain('Entrance / Scroll Effect');
    expect(html).toContain('data-testid="motion-animation-type"');
    expect(html).toContain('Duration');
    expect(html).toContain('data-testid="motion-duration-slider"');
    expect(html).toContain('data-testid="motion-duration-input"');
    expect(html).toContain('value="600"');
    expect(html).toContain('Delay');
    expect(html).toContain('data-testid="motion-delay-slider"');
    expect(html).toContain('data-testid="motion-delay-input"');
    expect(html).toContain('value="0"');
    expect(html).toContain('Easing Curve');
    expect(html).toContain('data-testid="motion-easing-select"');
    expect(html).toContain('Trigger Once');
    expect(html).toContain('data-testid="motion-once-toggle"');
    expect(html).toContain('Hover Micro-Interaction');
    expect(html).toContain('data-testid="motion-hover-segmented"');
    expect(html).toContain('data-testid="motion-hover-lift"');
    expect(html).toContain('Loop Animation');
    expect(html).toContain('data-testid="motion-loop-segmented"');
    expect(html).toContain('data-testid="motion-loop-pulse"');
  });

  it('renders custom animation configuration values', () => {
    const html = renderToString(
      <MotionSectorControls
        animation={{
          type: 'fade-up',
          duration: 850,
          delay: 150,
          easing: 'ease-in-out',
          once: false,
          hoverEffect: 'lift',
          loopEffect: 'pulse',
        }}
        onChange={() => {}}
      />,
    );

    expect(html).toContain('value="850"');
    expect(html).toContain('value="150"');
    expect(html).toContain('Active');
    expect(html).toContain('lift');
    expect(html).toContain('pulse');
  });

  it('renders Play / Replay Animation button when animations are active and onReplay is provided (STORA-262)', () => {
    const onReplaySpy = vi.fn();
    const html = renderToString(
      <MotionSectorControls
        animation={{
          type: 'fade-up',
          duration: 600,
          delay: 0,
          easing: 'ease-out',
          once: true,
          hoverEffect: 'lift',
          loopEffect: 'none',
        }}
        onChange={() => {}}
        onReplay={onReplaySpy}
      />,
    );

    expect(html).toContain('data-testid="motion-replay-button"');
    expect(html).toContain('Play / Replay Animation');
  });

  it('renders Motion sector inside StyleManagerAccordion when open', () => {
    const html = renderToString(
      <StyleManagerAccordion
        styles={{}}
        animation={{
          type: 'zoom-in',
          duration: 500,
          delay: 100,
          easing: 'ease-out',
          once: true,
          hoverEffect: 'scale',
          loopEffect: 'none',
        }}
        onCommitStyle={() => {}}
        onCommitAnimation={() => {}}
        initialState={{
          dimension: false,
          spacing: false,
          typography: false,
          decorations: false,
          flex: false,
          motion: true,
        }}
      />,
    );

    expect(html).toContain('Motion / Animation');
    expect(html).toContain('data-testid="motion-sector-controls"');
    expect(html).toContain('data-testid="motion-animation-type"');
    expect(html).toContain('data-testid="motion-duration-slider"');
  });

  it('shows active property badge count for motion in StyleManagerAccordion', () => {
    const html = renderToString(
      <StyleManagerAccordion
        styles={{}}
        animation={{
          type: 'fade-down',
          delay: 200,
          hoverEffect: 'glow',
          loopEffect: 'float',
        }}
        onCommitStyle={() => {}}
        onCommitAnimation={() => {}}
      />,
    );

    // 4 active properties: type, delay, hoverEffect, loopEffect
    expect(html).toContain('4 custom properties set');
  });

  it('updates node animation in editor store and reflects in document realtime', () => {
    const doc = createBlankDocument('Motion Store Test');
    doc.document.children = [
      {
        id: 'hero-btn',
        type: 'button',
        props: { label: 'Click Me' },
      },
    ];

    useEditorStore.getState().setDocument(doc);
    useEditorStore.getState().selectNode('hero-btn');

    // 1. Update type and duration
    const res1 = useEditorStore.getState().updateNodeAnimation('hero-btn', {
      type: 'slide-up',
      duration: 750,
      delay: 100,
    });
    expect(res1.success).toBe(true);

    const updatedNode1 = useEditorStore.getState().getSelectedNode();
    expect(updatedNode1?.animation).toBeDefined();
    expect(updatedNode1?.animation?.type).toBe('slide-up');
    expect(updatedNode1?.animation?.duration).toBe(750);
    expect(updatedNode1?.animation?.delay).toBe(100);

    // 2. Update hover effect
    const res2 = useEditorStore.getState().updateNodeAnimation('hero-btn', {
      hoverEffect: 'lift',
    });
    expect(res2.success).toBe(true);

    const updatedNode2 = useEditorStore.getState().getSelectedNode();
    expect(updatedNode2?.animation?.type).toBe('slide-up');
    expect(updatedNode2?.animation?.hoverEffect).toBe('lift');

    // 3. Test Undo
    expect(useEditorStore.getState().canUndo).toBe(true);
    useEditorStore.getState().undo();

    const nodeAfterUndo = useEditorStore.getState().getSelectedNode();
    expect(nodeAfterUndo?.animation?.hoverEffect).toBe('none');

    // 4. Test Redo
    useEditorStore.getState().redo();
    const nodeAfterRedo = useEditorStore.getState().getSelectedNode();
    expect(nodeAfterRedo?.animation?.hoverEffect).toBe('lift');
  });

  it('renders Motion sector in InspectorPanel for the active selected node', () => {
    const doc = createBlankDocument('Motion Inspector Test');
    doc.document.children = [
      {
        id: 'card-1',
        type: 'container',
        animation: {
          type: 'fade-up',
          duration: 600,
          delay: 50,
          easing: 'ease-out',
          once: true,
          hoverEffect: 'lift',
          loopEffect: 'none',
        },
      },
    ];

    useEditorStore.getState().setDocument(doc);
    useEditorStore.getState().selectNode('card-1');

    const html = renderToString(
      <InspectorPanel registry={registry} document={doc} selectedNodeId="card-1" />,
    );

    expect(html).toContain('Motion / Animation');
    expect(html).toContain('data-testid="sector-motion"');
  });
});
