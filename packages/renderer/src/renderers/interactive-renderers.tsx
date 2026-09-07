import React from 'react';
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
          style={{
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
          }}
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
          style={{
            position: mode === 'editor' ? 'absolute' : 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: showBackdrop ? 'rgba(15, 23, 42, 0.5)' : 'transparent',
            backdropFilter: showBackdrop ? 'blur(2px)' : 'none',
            display: 'flex',
            justifyContent:
              placement === 'left' ? 'flex-start' : placement === 'right' ? 'flex-end' : 'center',
            alignItems:
              placement === 'top' ? 'flex-start' : placement === 'bottom' ? 'flex-end' : 'stretch',
            zIndex: 9999,
          }}
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
              height: isVertical ? 'auto' : '100%',
              width: isVertical ? '100%' : (styles.width || '320px'),
              maxHeight: isVertical ? '80vh' : '100%',
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

    default:
      return null;
  }
}
