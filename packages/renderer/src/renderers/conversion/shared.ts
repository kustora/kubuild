import type { Node } from '@kubuild/schema';
import type { RenderNodeContentOptions } from '../render-node-content';

/** Reads a prop, preferring the binding-resolved value over the raw document value. */
export function readProp(options: RenderNodeContentOptions, name: string): unknown {
  const resolved = options.resolvedProps[name];
  return resolved !== undefined ? resolved : options.props[name];
}

export function readString(options: RenderNodeContentOptions, name: string, fallback = ''): string {
  const v = readProp(options, name);
  if (v === undefined || v === null) return fallback;
  if (typeof v === 'object') return fallback;
  return String(v);
}

export function readNumber(
  options: RenderNodeContentOptions,
  name: string,
  fallback: number,
): number {
  const v = readProp(options, name);
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
  return Number.isFinite(n) ? n : fallback;
}

export function readBoolean(
  options: RenderNodeContentOptions,
  name: string,
  fallback: boolean,
): boolean {
  const v = readProp(options, name);
  if (typeof v === 'boolean') return v;
  if (v === 'true') return true;
  if (v === 'false') return false;
  return fallback;
}

export function readAriaLabel(options: RenderNodeContentOptions): string | undefined {
  const v = readProp(options, 'ariaLabel');
  return typeof v === 'string' && v.trim() !== '' ? v : undefined;
}

/** True when `targetId` is `node` itself or any descendant of it. */
export function subtreeContains(node: Node, targetId: string | null | undefined): boolean {
  if (!targetId) return false;
  if (node.id === targetId) return true;
  return (node.children ?? []).some((child) => subtreeContains(child, targetId));
}

/**
 * Index of the direct child whose subtree contains `targetId`, or -1. Used in editor
 * mode so a node selected from the layers panel is revealed even when it lives in a
 * collapsed accordion item, inactive tab, or off-screen carousel slide.
 */
export function childIndexContaining(node: Node, targetId: string | null | undefined): number {
  if (!targetId) return -1;
  return (node.children ?? []).findIndex((child) => subtreeContains(child, targetId));
}
