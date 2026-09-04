import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { createDefaultComponentRegistry } from '@kubuild/components';
import { createBlankDocument } from '@kubuild/core';
import { BoxModelEditor, VisualBoxModel, parseBoxValue } from '../src/components/style-manager/box-model-editor';
import { InspectorPanel } from '../src/components/panels/inspector-panel';
import { useEditorStore } from '../src/store';

describe('Visual Box Model Component (STORA-201)', () => {
  const registry = createDefaultComponentRegistry();

  it('parseBoxValue handles empty, numeric, auto, and dimension strings', () => {
    expect(parseBoxValue(undefined)).toEqual({ num: '-', unit: 'px', raw: '' });
    expect(parseBoxValue(null)).toEqual({ num: '-', unit: 'px', raw: '' });
    expect(parseBoxValue('')).toEqual({ num: '-', unit: 'px', raw: '' });
    expect(parseBoxValue(24)).toEqual({ num: '24', unit: 'px', raw: '24px' });
    expect(parseBoxValue('0')).toEqual({ num: '0', unit: 'px', raw: '0' });
    expect(parseBoxValue('16px')).toEqual({ num: '16', unit: 'px', raw: '16px' });
    expect(parseBoxValue('2rem')).toEqual({ num: '2', unit: 'rem', raw: '2rem' });
    expect(parseBoxValue('50%')).toEqual({ num: '50', unit: '%', raw: '50%' });
    expect(parseBoxValue('auto')).toEqual({ num: 'auto', unit: 'auto', raw: 'auto' });
  });

  it('renders all nested layers: Margin, Border, Padding, and Content', () => {
    const values = {
      marginTop: '20px',
      marginRight: '15px',
      marginBottom: '20px',
      marginLeft: '15px',
      borderTopWidth: '1px',
      borderRightWidth: '1px',
      borderBottomWidth: '1px',
      borderLeftWidth: '1px',
      paddingTop: '12px',
      paddingRight: '16px',
      paddingBottom: '12px',
      paddingLeft: '16px',
    };

    const html = renderToString(<BoxModelEditor values={values} />);

    // Check layer labels
    expect(html).toContain('Margin');
    expect(html).toContain('Border');
    expect(html).toContain('Padding');
    expect(html).toContain('Content');

    // Check input/button labels and values
    expect(html).toContain('Margin Top');
    expect(html).toContain('20');
    expect(html).toContain('15');
    expect(html).toContain('Padding Left');
    expect(html).toContain('16');
    expect(html).toContain('12');
    expect(html).toContain('Border Top Width');
    expect(html).toContain('1');
  });

  it('VisualBoxModel is an alias of BoxModelEditor', () => {
    expect(VisualBoxModel).toBe(BoxModelEditor);
  });

  it('updates marginTop/Right/Bottom/Left and paddingTop/Right/Bottom/Left in editor store', () => {
    const doc = createBlankDocument('Box Model Test');
    doc.document.children = [
      {
        id: 'heading-node',
        type: 'heading',
        props: { text: 'Heading', level: 'h2' },
        styles: {
          base: {
            marginTop: '10px',
            paddingTop: '8px',
          },
        },
      },
    ];

    useEditorStore.getState().setDocument(doc);
    useEditorStore.getState().selectNode('heading-node');

    const state = useEditorStore.getState();
    const node = state.getSelectedNode();
    expect(node?.id).toBe('heading-node');
    expect(node?.styles?.base?.marginTop).toBe('10px');
    expect(node?.styles?.base?.paddingTop).toBe('8px');

    // Update margin top and padding left
    state.updateNodeStyle('heading-node', { marginTop: '32px' }, 'base');
    state.updateNodeStyle('heading-node', { paddingLeft: '24px' }, 'base');

    const updatedNode = useEditorStore.getState().getSelectedNode();
    expect(updatedNode?.styles?.base?.marginTop).toBe('32px');
    expect(updatedNode?.styles?.base?.paddingLeft).toBe('24px');
  });

  it('renders BoxModelEditor inside InspectorPanel for active selected node', () => {
    const doc = createBlankDocument('Inspector Box Model Test');
    useEditorStore.getState().setDocument(doc);
    useEditorStore.getState().selectNode(doc.document.id);

    const html = renderToString(
      <InspectorPanel registry={registry} document={doc} selectedNodeId={doc.document.id} />,
    );

    expect(html).toContain('Spacing (Box Model)');
    expect(html).toContain('Margin');
    expect(html).toContain('Border');
    expect(html).toContain('Padding');
    expect(html).toContain('Content');
  });

  it('renders disabled state when disabled prop is true', () => {
    const values = {
      marginTop: '10px',
      paddingTop: '20px',
    };

    const html = renderToString(<BoxModelEditor values={values} disabled />);
    expect(html).toContain('disabled=""');
  });
});
