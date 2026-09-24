import React from 'react';
import type { RenderNodeContentOptions } from '../render-node-content';
import { readNumber, readString } from './shared';

export function renderDivider(options: RenderNodeContentOptions): React.ReactElement {
  const { node, domId, styles, handleClick } = options;
  const rawStyle = readString(options, 'lineStyle', 'solid');
  const lineStyle = rawStyle === 'dashed' || rawStyle === 'dotted' ? rawStyle : 'solid';
  const thickness = Math.max(0, readNumber(options, 'thickness', 1));
  const color = readString(options, 'color', '#e2e8f0') || '#e2e8f0';
  const label = readString(options, 'label').trim();
  const line = `${thickness}px ${lineStyle} ${color}`;

  if (!label) {
    return (
      <hr
        id={domId}
        style={{ height: 0, border: 'none', borderTop: line, ...styles }}
        onClick={handleClick}
        data-kubuild-node={node.id}
      />
    );
  }

  return (
    <div
      id={domId}
      style={{ display: 'flex', alignItems: 'center', gap: '12px', ...styles }}
      onClick={handleClick}
      data-kubuild-node={node.id}
      role="separator"
      aria-orientation="horizontal"
      aria-label={label}
    >
      <span aria-hidden="true" style={{ flex: 1, borderTop: line }} />
      <span style={{ fontSize: '12px', fontWeight: 500, color: '#64748b', whiteSpace: 'nowrap' }}>{label}</span>
      <span aria-hidden="true" style={{ flex: 1, borderTop: line }} />
    </div>
  );
}

/**
 * Spacer: its height comes from the node's (per-breakpoint) styles. In the editor it
 * gets a dashed outline so an otherwise invisible node can still be found and selected.
 */
export function renderSpacer(options: RenderNodeContentOptions): React.ReactElement {
  const { node, domId, styles, handleClick, mode } = options;
  return (
    <div
      id={domId}
      style={{
        width: '100%',
        ...styles,
        height: styles.height ?? '24px',
        ...(mode === 'editor' ? { outline: '1px dashed #cbd5e1', outlineOffset: '-1px' } : {}),
      }}
      onClick={handleClick}
      data-kubuild-node={node.id}
      data-kubuild-spacer=""
      aria-hidden="true"
    />
  );
}
