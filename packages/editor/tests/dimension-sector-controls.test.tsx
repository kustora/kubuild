import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { createDefaultComponentRegistry } from '@kubuild/components';
import { createBlankDocument } from '@kubuild/core';
import {
  DimensionSectorControls,
  DimensionUnitInput,
  parseDimensionValue,
  DIMENSION_UNITS,
} from '../src/components/style-manager/dimension-sector-controls';
import { StyleManagerAccordion } from '../src/components/style-manager/style-manager-accordion';
import { InspectorPanel } from '../src/components/panels/inspector-panel';
import { useEditorStore } from '../src/store';

describe('Dimension & Display Sector Controls (STORA-203)', () => {
  const registry = createDefaultComponentRegistry();

  it('DIMENSION_UNITS defines supported unit switches', () => {
    expect(DIMENSION_UNITS).toContain('px');
    expect(DIMENSION_UNITS).toContain('%');
    expect(DIMENSION_UNITS).toContain('rem');
    expect(DIMENSION_UNITS).toContain('em');
    expect(DIMENSION_UNITS).toContain('vw');
    expect(DIMENSION_UNITS).toContain('vh');
    expect(DIMENSION_UNITS).toContain('auto');
    expect(DIMENSION_UNITS).toContain('none');
  });

  it('parseDimensionValue parses empty, numbers, auto, none, and unit dimensions', () => {
    expect(parseDimensionValue(undefined)).toEqual({ num: '', unit: 'px', raw: '' });
    expect(parseDimensionValue(null)).toEqual({ num: '', unit: 'px', raw: '' });
    expect(parseDimensionValue('')).toEqual({ num: '', unit: 'px', raw: '' });
    expect(parseDimensionValue(100)).toEqual({ num: '100', unit: 'px', raw: '100px' });
    expect(parseDimensionValue('auto')).toEqual({ num: 'auto', unit: 'auto', raw: 'auto' });
    expect(parseDimensionValue('none')).toEqual({ num: 'none', unit: 'none', raw: 'none' });
    expect(parseDimensionValue('50%')).toEqual({ num: '50', unit: '%', raw: '50%' });
    expect(parseDimensionValue('2.5rem')).toEqual({ num: '2.5', unit: 'rem', raw: '2.5rem' });
    expect(parseDimensionValue('100vw')).toEqual({ num: '100', unit: 'vw', raw: '100vw' });
    expect(parseDimensionValue('80vh')).toEqual({ num: '80', unit: 'vh', raw: '80vh' });
    expect(parseDimensionValue('2em')).toEqual({ num: '2', unit: 'em', raw: '2em' });
    expect(parseDimensionValue('300px')).toEqual({ num: '300', unit: 'px', raw: '300px' });
  });

  it('renders DimensionUnitInput with label, input, and unit select dropdown', () => {
    const html = renderToString(
      <DimensionUnitInput
        property="width"
        label="Width"
        value="100%"
        onChange={() => {}}
      />,
    );

    expect(html).toContain('Width');
    expect(html).toContain('value="100"');
    expect(html).toContain('<select');
    expect(html).toContain('value="%"');
    expect(html).toContain('px');
    expect(html).toContain('rem');
    expect(html).toContain('vw');
    expect(html).toContain('vh');
    expect(html).toContain('auto');
  });

  it('renders all 8 dimension & display controls in DimensionSectorControls', () => {
    const styles = {
      display: 'flex',
      overflow: 'hidden',
      width: '100%',
      height: '400px',
      minWidth: '320px',
      maxWidth: '1200px',
      minHeight: '200px',
      maxHeight: 'none',
    };

    const html = renderToString(
      <DimensionSectorControls
        styles={styles}
        onChange={() => {}}
      />,
    );

    // Check display and overflow
    expect(html).toContain('Display');
    expect(html).toContain('Flex');
    expect(html).toContain('Overflow');
    expect(html).toContain('Hidden');

    // Check all 6 sizing dimensions with unit controls
    expect(html).toContain('Width');
    expect(html).toContain('Height');
    expect(html).toContain('Min Width');
    expect(html).toContain('Max Width');
    expect(html).toContain('Min Height');
    expect(html).toContain('Max Height');

    expect(html).toContain('value="100"');
    expect(html).toContain('value="400"');
    expect(html).toContain('value="320"');
    expect(html).toContain('value="1200"');
    expect(html).toContain('value="200"');
    expect(html).toContain('value="none"');
  });

  it('updates display, width, minHeight, and overflow in editor store via StyleManagerAccordion', () => {
    const doc = createBlankDocument('Dimension Test Doc');
    doc.document.children = [
      {
        id: 'box-node',
        type: 'container',
        props: { tag: 'div' },
        styles: {
          base: {
            display: 'block',
            width: '100%',
          },
        },
      },
    ];

    useEditorStore.getState().setDocument(doc);
    useEditorStore.getState().selectNode('box-node');

    const state = useEditorStore.getState();
    expect(state.getSelectedNode()?.styles?.base?.display).toBe('block');
    expect(state.getSelectedNode()?.styles?.base?.width).toBe('100%');

    // Update dimensions in base breakpoint
    state.updateNodeStyle('box-node', { display: 'flex', width: '50%', minHeight: '300px', overflow: 'hidden' }, 'base');

    const updated = useEditorStore.getState().getSelectedNode();
    expect(updated?.styles?.base?.display).toBe('flex');
    expect(updated?.styles?.base?.width).toBe('50%');
    expect(updated?.styles?.base?.minHeight).toBe('300px');
    expect(updated?.styles?.base?.overflow).toBe('hidden');
  });

  it('renders DimensionSectorControls within InspectorPanel', () => {
    const doc = createBlankDocument('Inspector Dimension Test');
    useEditorStore.getState().setDocument(doc);
    useEditorStore.getState().selectNode(doc.document.id);

    const html = renderToString(
      <InspectorPanel registry={registry} document={doc} selectedNodeId={doc.document.id} />,
    );

    expect(html).toContain('data-testid="dimension-sector-controls"');
    expect(html).toContain('data-testid="dimension-select-display"');
    expect(html).toContain('data-testid="dimension-select-overflow"');
    expect(html).toContain('data-testid="dimension-input-width"');
    expect(html).toContain('data-testid="dimension-input-height"');
  });
});
