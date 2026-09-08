import React from 'react';
import { ARTBOARD_REFERENCE_NODE_TYPE } from '@kubuild/schema';
import type { RenderNodeContentOptions } from './render-node-content';
import { modalManager, type ModalManager } from '../action-runners';

/**
 * Interactive nodes: modal, drawer, collapsible
 */
export function renderInteractiveNode(options: RenderNodeContentOptions): React.ReactElement | null {
  const {
    node,
    domId,
    styles,
    resolvedProps,
    props,
    childrenElements,
    handleClick,
    context,
    mode,
    isModalOpen,
  } = options;

  const rawModalId = resolvedProps.modalId || props.modalId || node.id;
  const modalId = String(rawModalId).trim();
  const targetManager: ModalManager =
    ((context as unknown as Record<string, unknown> | undefined)?.modalManager as ModalManager) ||
    modalManager;

  /**
   * True while this node is being authored alone on its own component artboard. The
   * backdrop and viewport-pinned positioning exist to sit over a real page; on an isolated
   * surface they'd just paint the whole artboard, hiding the canvas the author is working
   * on, so the node is laid out in flow instead and the overlay chrome is dropped.
   */
  const isIsolatedComponentSurface = mode === 'editor' && context?.artboardSurface === 'component';

  switch (node.type) {
    case 'modal': {
      // If closed in runtime mode, render empty element so it does not fall through to unknown node fallback
      if (!isModalOpen && mode === 'runtime') {
        return <React.Fragment />;
      }

      const showBackdrop = resolvedProps.backdrop !== false && props.backdrop !== false;
      const closeOnBackdrop = resolvedProps.closeOnBackdrop !== false && props.closeOnBackdrop !== false;
      const showCloseBtn = resolvedProps.showCloseButton !== false && props.showCloseButton !== false;
      const rawTitle = resolvedProps.title ?? props.title;
      const title = rawTitle !== undefined ? String(rawTitle) : undefined;
      const size = (resolvedProps.size || props.size || 'md') as 'sm' | 'md' | 'lg' | 'fullscreen';

      const sizeMaxWidth =
        size === 'sm' ? '400px' : size === 'lg' ? '768px' : size === 'fullscreen' ? '100%' : '560px';
      const sizeHeight = size === 'fullscreen' ? '100%' : 'auto';

      return (
        <div
          id={`${domId}-overlay`}
          data-kubuild-overlay={modalId}
          data-kubuild-isolated={isIsolatedComponentSurface ? 'true' : undefined}
          style={
            isIsolatedComponentSurface
              ? {
                  // In flow on its own artboard: no backdrop, no viewport pinning.
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'center',
                  padding: size === 'fullscreen' ? '0' : '16px',
                }
              : {
                  position: mode === 'editor' ? 'absolute' : 'fixed',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: showBackdrop ? 'rgba(15, 23, 42, 0.65)' : 'transparent',
                  backdropFilter: showBackdrop ? 'blur(4px)' : 'none',
                  display: 'flex',
                  alignItems: size === 'fullscreen' ? 'stretch' : 'center',
                  justifyContent: 'center',
                  zIndex: 9999,
                  padding: size === 'fullscreen' ? '0' : '16px',
                }
          }
          onClick={(e) => {
            if (e.target === e.currentTarget && closeOnBackdrop && mode === 'runtime') {
              targetManager.closeModal(modalId);
            }
          }}
        >
          <div
            id={domId}
            style={{
              ...styles,
              position: 'relative',
              boxSizing: 'border-box',
              maxWidth: sizeMaxWidth,
              height: sizeHeight,
              width: '100%',
            }}
            onClick={handleClick}
            data-kubuild-node={node.id}
            role="dialog"
            aria-modal="true"
            aria-label={typeof title === 'string' ? title : 'Modal Dialog'}
          >
            {showCloseBtn && (
              <button
                type="button"
                aria-label="Close modal"
                style={{
                  position: 'absolute',
                  top: '14px',
                  right: '14px',
                  background: 'transparent',
                  border: 'none',
                  fontSize: '18px',
                  cursor: 'pointer',
                  color: '#64748b',
                  padding: '4px 8px',
                  lineHeight: 1,
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  targetManager.closeModal(modalId);
                }}
              >
                ✕
              </button>
            )}
            {title && (
              <div
                style={{
                  fontWeight: 600,
                  fontSize: '18px',
                  marginBottom: '16px',
                  color: '#0f172a',
                }}
              >
                {String(title)}
              </div>
            )}
            {childrenElements}
          </div>
        </div>
      );
    }

    case 'drawer': {
      if (!isModalOpen && mode === 'runtime') {
        return <React.Fragment />;
      }

      const placement = (resolvedProps.placement || props.placement || 'right') as
        | 'left'
        | 'right'
        | 'top'
        | 'bottom';
      const showBackdrop = resolvedProps.backdrop !== false && props.backdrop !== false;
      const closeOnBackdrop = resolvedProps.closeOnBackdrop !== false && props.closeOnBackdrop !== false;
      const showCloseBtn = resolvedProps.showCloseButton !== false && props.showCloseButton !== false;
      const rawTitle = resolvedProps.title ?? props.title;
      const title = rawTitle !== undefined ? String(rawTitle) : undefined;

      const isVertical = placement === 'top' || placement === 'bottom';

      return (
        <div
          id={`${domId}-overlay`}
          data-kubuild-overlay={modalId}
          data-kubuild-isolated={isIsolatedComponentSurface ? 'true' : undefined}
          style={
            isIsolatedComponentSurface
              ? {
                  position: 'relative',
                  display: 'flex',
                  justifyContent:
                    placement === 'left'
                      ? 'flex-start'
                      : placement === 'right'
                        ? 'flex-end'
                        : 'center',
                  alignItems: 'flex-start',
                  padding: '16px',
                }
              : {
                  position: mode === 'editor' ? 'absolute' : 'fixed',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: showBackdrop ? 'rgba(15, 23, 42, 0.5)' : 'transparent',
                  backdropFilter: showBackdrop ? 'blur(2px)' : 'none',
                  display: 'flex',
                  justifyContent:
                    placement === 'left'
                      ? 'flex-start'
                      : placement === 'right'
                        ? 'flex-end'
                        : 'center',
                  alignItems:
                    placement === 'top'
                      ? 'flex-start'
                      : placement === 'bottom'
                        ? 'flex-end'
                        : 'stretch',
                  zIndex: 9999,
                }
          }
          onClick={(e) => {
            if (e.target === e.currentTarget && closeOnBackdrop && mode === 'runtime') {
              targetManager.closeModal(modalId);
            }
          }}
        >
          <div
            id={domId}
            style={{
              ...styles,
              position: 'relative',
              boxSizing: 'border-box',
              // Isolated: size to content instead of filling a viewport-sized overlay,
              // which would otherwise collapse to zero height in flow.
              height: isIsolatedComponentSurface ? 'auto' : isVertical ? 'auto' : '100%',
              ...(isIsolatedComponentSurface ? { minHeight: '240px' } : {}),
              width: isVertical ? '100%' : (styles.width || '320px'),
              maxHeight: isIsolatedComponentSurface ? 'none' : isVertical ? '80vh' : '100%',
              overflowY: 'auto',
            }}
            onClick={handleClick}
            data-kubuild-node={node.id}
            role="region"
            aria-label={typeof title === 'string' ? title : 'Drawer'}
          >
            {showCloseBtn && (
              <button
                type="button"
                aria-label="Close drawer"
                style={{
                  position: 'absolute',
                  top: '14px',
                  right: '14px',
                  background: 'transparent',
                  border: 'none',
                  fontSize: '18px',
                  cursor: 'pointer',
                  color: '#64748b',
                  padding: '4px 8px',
                  lineHeight: 1,
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  targetManager.closeModal(modalId);
                }}
              >
                ✕
              </button>
            )}
            {title && (
              <div
                style={{
                  fontWeight: 600,
                  fontSize: '18px',
                  marginBottom: '16px',
                  color: '#0f172a',
                }}
              >
                {String(title)}
              </div>
            )}
            {childrenElements}
          </div>
        </div>
      );
    }

    case 'collapsible': {
      const isOpen = mode === 'editor' ? true : Boolean(isModalOpen);
      return (
        <div
          id={domId}
          style={{
            ...styles,
            display: isOpen ? (styles.display || 'block') : 'none',
          }}
          onClick={handleClick}
          data-kubuild-node={node.id}
          data-kubuild-collapsible={modalId}
        >
          {childrenElements}
        </div>
      );
    }

    case ARTBOARD_REFERENCE_NODE_TYPE: {
      // A stub left behind when a subtree was detached into its own artboard.
      // Runtime: nothing renders here — ArtboardPortalHost puts the real content on screen
      // when its trigger fires. Editor: a compact, selectable chip so the author keeps a
      // visible anchor for "this surface opens artboard X".
      if (mode === 'runtime') {
        return <React.Fragment />;
      }

      const referencedArtboardId =
        typeof props.artboardId === 'string' ? props.artboardId : undefined;
      const label =
        (typeof props.label === 'string' && props.label.trim().length > 0
          ? props.label
          : referencedArtboardId) || 'artboard';

      return (
        <div
          id={domId}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 10px',
            border: '1px dashed #94a3b8',
            borderRadius: '6px',
            backgroundColor: '#f8fafc',
            color: '#475569',
            fontSize: '12px',
            fontFamily: 'ui-sans-serif, system-ui, sans-serif',
            cursor: 'pointer',
            ...styles,
          }}
          onClick={handleClick}
          data-kubuild-node={node.id}
          data-kubuild-artboard-reference={referencedArtboardId}
          title={`Opens artboard "${label}" — edit it on its own canvas surface`}
        >
          <span aria-hidden="true">⧉</span>
          <span>{`Opens: ${label}`}</span>
        </div>
      );
    }

    default:
      return null;
  }
}
