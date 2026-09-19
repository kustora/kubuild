import React from 'react';
import {
  PageDocument,
  Node,
  isActionBinding,
} from '@kubuild/schema';
import { type ComponentRegistry, createDefaultComponentRegistry } from '@kubuild/components';
import {
  RenderContext,
  DEFAULT_RENDER_CONTEXT,
  RenderContextProvider,
  resolveActionPayload,
  dispatchAction,
  Diagnostic,
} from './render-context';
import { AlertTriangle } from 'lucide-react';
import { resolveNodeStyles, collectStateStylesCss } from './styles';
import { collectAnimationStylesCss } from './animation';
import { ComponentErrorBoundary } from './error-boundary';
import { resolvePropsForNode } from './prop-resolution';
import { renderNodeContent } from './renderers';
import { ToastContainer } from './action-runners/toast-container';
import { useModal, modalManager, type ModalManager } from './action-runners';
import { executeNodeActions, useNodeLoadActions } from './action-dispatcher';
import { injectTrackingScripts } from './tracking/tracking-manager';

// Re-export all nodes and media utilities for backward compatibility
export * from './nodes';
export * from './renderers';

export interface KubuildRendererProps {
  document: PageDocument;
  registry?: ComponentRegistry;
  context?: RenderContext;
  viewport?: 'desktop' | 'tablet' | 'mobile';
  mode?: 'editor' | 'runtime';
  className?: string;
  showToastContainer?: boolean;
  onNodeClick?: (nodeId: string, event: React.MouseEvent) => void;
  onDiagnostic?: (diagnostic: Diagnostic) => void;
  onActionDispatch?: (actionType: string, payload: Record<string, unknown> | undefined, nodeId: string) => void;
  onNodePropChange?: (nodeId: string, propName: string, value: unknown, isBlur?: boolean) => void;
  /**
   * Id of the currently-selected node (editor mode only). Typography/button/form-label
   * nodes only become `contentEditable` once they're already selected, so a first tap/click
   * always just selects instead of immediately opening edit mode underneath it.
   */
  selectedNodeId?: string | null;
}

export interface NodeRendererProps {
  node: Node;
  document: PageDocument;
  registry: ComponentRegistry;
  context?: RenderContext;
  viewport?: 'desktop' | 'tablet' | 'mobile';
  mode?: 'editor' | 'runtime';
  onNodeClick?: (nodeId: string, event: React.MouseEvent) => void;
  onDiagnostic?: (diagnostic: Diagnostic) => void;
  onActionDispatch?: (actionType: string, payload: Record<string, unknown> | undefined, nodeId: string) => void;
  onNodePropChange?: (nodeId: string, propName: string, value: unknown, isBlur?: boolean) => void;
  selectedNodeId?: string | null;
  /**
   * Suffix appended to the HTML `id` attribute (never to `data-kubuild-node`, the
   * canonical template-node reference) so a `collection` node's repeated child
   * template produces unique DOM ids per iteration instead of duplicates.
   */
  instanceSuffix?: string;
}

function useSafeModalOpen(modalId: string | undefined, manager: ModalManager): boolean {
  if (!modalId) return false;
  try {
    const r = React as unknown as Record<string, unknown>;
    const internals = (r.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE ||
      r.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED) as Record<string, unknown> | undefined;
    const hasDispatcher = Boolean(
      internals &&
        (internals['H'] ||
          (internals['ReactCurrentDispatcher'] as Record<string, unknown> | undefined)?.['current']),
    );
    if (hasDispatcher) {
      const { isOpen } = useModal(modalId, manager);
      return isOpen;
    }
  } catch {
    // Fallback if called directly as function outside React tree
  }
  return manager.isModalOpen(modalId);
}

export function NodeRenderer({
  node,
  document,
  registry,
  context: propContext,
  viewport = 'desktop',
  mode = 'runtime',
  onNodeClick,
  onDiagnostic,
  onActionDispatch,
  onNodePropChange,
  selectedNodeId,
  instanceSuffix = '',
}: NodeRendererProps): React.ReactElement {
  const context = propContext || DEFAULT_RENDER_CONTEXT;
  const styles = resolveNodeStyles(node.styles, viewport);
  const props = node.props || {};
  const definition = registry.get(node.type);
  const domId = instanceSuffix ? `${node.id}${instanceSuffix}` : node.id;
  const { props: resolvedProps, diagnostics } = resolvePropsForNode(node, definition, context);

  diagnostics.forEach((diagnostic) => {
    onDiagnostic?.(diagnostic);
    context?.onDiagnostic?.(diagnostic);
  });

  // Execute `load` lifecycle action pipelines on component mount
  useNodeLoadActions(node, {
    document,
    context,
    onDiagnostic,
    onActionDispatch,
    mode,
  });

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onNodeClick) {
      onNodeClick(node.id, e);
    }

    // 1. Execute modern ActionPipeline[] for 'click' trigger
    if (node.actions && node.actions.length > 0 && !props.disabled) {
      await executeNodeActions({
        node,
        trigger: 'click',
        document,
        context,
        onDiagnostic,
        onActionDispatch,
      });
    }

    // 2. Backward compatibility: dispatch legacy single props.action
    if (props.action && !props.disabled) {
      dispatchAction({
        action: props.action,
        nodeId: node.id,
        document,
        context,
        onDiagnostic,
      });
      if (onActionDispatch && isActionBinding(props.action)) {
        onActionDispatch(props.action.type, resolveActionPayload(context, props.action.payload), node.id);
      }
    }
  };

  const childrenElements = node.children?.map((child: Node) => (
    <NodeRenderer
      key={`${child.id}${instanceSuffix}`}
      node={child}
      document={document}
      registry={registry}
      context={context}
      viewport={viewport}
      mode={mode}
      onNodeClick={onNodeClick}
      onDiagnostic={onDiagnostic}
      onActionDispatch={onActionDispatch}
      onNodePropChange={onNodePropChange}
      selectedNodeId={selectedNodeId}
      instanceSuffix={instanceSuffix}
    />
  ));

  const renderChildNode = (
    child: Node,
    childInstanceSuffix: string = '',
    itemContext: RenderContext = context,
  ) => (
    <NodeRenderer
      key={`${child.id}${instanceSuffix}${childInstanceSuffix}`}
      node={child}
      document={document}
      registry={registry}
      context={itemContext}
      viewport={viewport}
      mode={mode}
      onNodeClick={onNodeClick}
      onDiagnostic={onDiagnostic}
      onActionDispatch={onActionDispatch}
      onNodePropChange={onNodePropChange}
      selectedNodeId={selectedNodeId}
      instanceSuffix={`${instanceSuffix}${childInstanceSuffix}`}
    />
  );

  const modalId = (props.modalId || props.modalNodeId || props.targetModalId) as string | undefined;
  const modalManagerInstance =
    ((context as unknown as Record<string, unknown> | undefined)?.modalManager as ModalManager) || modalManager;
  const hasModalState = modalId ? modalManagerInstance.hasState(modalId) : false;
  const rawIsModalOpen = useSafeModalOpen(modalId, modalManagerInstance);
  // Fall back to the node's `defaultOpen` prop only when the manager has never seen this id,
  // so an untouched collapsible/modal can start open without a mutation-during-render hack.
  const isModalOpen = hasModalState ? rawIsModalOpen : Boolean(props.defaultOpen);

  const effectiveStyles: React.CSSProperties = { ...styles };
  // A plain container (e.g. a navbar's mobile dropdown) that's linked to a modalId toggle should hide
  // when closed in both editor and runtime mode, so clicking its trigger is visibly reactive while
  // editing, not just after publishing. Dedicated 'modal'/'drawer'/'collapsible' node types are excluded:
  // they render through interactive-renderers.tsx, which already forces itself open in editor mode so
  // its content stays editable — applying this gate on top of that would hide it again.
  const isDedicatedInteractiveNode = node.type === 'modal' || node.type === 'drawer' || node.type === 'collapsible';
  const isModalContainer =
    Boolean(props.modalId || props.modalNodeId) &&
    node.type !== 'button' &&
    node.type !== 'link' &&
    !isDedicatedInteractiveNode;
  if (isModalContainer && !isModalOpen) {
    effectiveStyles.display = 'none';
  }

  let content: React.ReactElement;
  try {
    content = renderNodeContent({
      node,
      document,
      registry,
      context,
      viewport,
      mode,
      styles: effectiveStyles,
      props,
      resolvedProps,
      definition,
      domId,
      childrenElements,
      handleClick,
      onNodeClick,
      onDiagnostic,
      onActionDispatch,
      onNodePropChange,
      selectedNodeId,
      instanceSuffix,
      isModalOpen,
      renderChildNode,
    });
  } catch (error) {
    if (mode === 'editor') {
      content = (
        <div
          data-kubuild-node={node.id}
          data-kubuild-error={node.type}
          style={{
            padding: '12px 16px',
            margin: '4px 0',
            backgroundColor: '#fef2f2',
            border: '1px solid #ef4444',
            borderRadius: '6px',
            color: '#b91c1c',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            fontSize: '13px',
            lineHeight: '1.4',
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <AlertTriangle size={14} aria-hidden="true" />
            <span>Component Render Error: &lt;{node.type}&gt;</span>
          </div>
          <div style={{ fontSize: '11px', color: '#7f1d1d', wordBreak: 'break-all' }}>
            Node ID: <code>{node.id}</code> — {error instanceof Error ? error.message : String(error)}
          </div>
        </div>
      );
    } else {
      content = (
        <div
          data-kubuild-node={node.id}
          data-kubuild-error={node.type}
          style={{ display: 'none' }}
          aria-hidden="true"
        />
      );
    }
  }

  return (
    <ComponentErrorBoundary
      nodeId={node.id}
      componentType={node.type}
      mode={mode}
      onDiagnostic={onDiagnostic}
    >
      {content}
    </ComponentErrorBoundary>
  );
}

const KubuildRendererComponent: React.FC<KubuildRendererProps> = ({
  document,
  registry = createDefaultComponentRegistry(),
  context,
  viewport = 'desktop',
  mode = 'runtime',
  className,
  showToastContainer = true,
  onNodeClick,
  onDiagnostic,
  onActionDispatch,
  onNodePropChange,
  selectedNodeId,
}) => {
  if (!document || !document.document) {
    return <div className={className}>Empty Document</div>;
  }

  const stateStylesCss = React.useMemo(
    () => collectStateStylesCss(document),
    [document],
  );
  const animStylesCss = React.useMemo(
    () => collectAnimationStylesCss(document),
    [document],
  );

  // Stable string key derived from the tracking config — avoids re-injecting on every render
  // because each deserialized JSON parse produces a new object reference even if content is unchanged.
  const trackingKey = React.useMemo(
    () => (document?.tracking ? JSON.stringify(document.tracking) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [document?.tracking],
  );

  React.useEffect(() => {
    if (mode === 'runtime' && document?.tracking && trackingKey) {
      const cleanup = injectTrackingScripts(document.tracking);
      return cleanup;
    }
  // trackingKey is a stable string — safe to use instead of the object reference
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, trackingKey]);

  return (
    <RenderContextProvider value={context}>
      <div className={`kubuild-canvas-root ${className || ''}`}>
        {/* Compiled pseudo-state CSS (:hover/:active/:focus) — STORA-222 */}
        {stateStylesCss ? <style data-kubuild-state-styles>{stateStylesCss}</style> : null}
        {/* Compiled animation & hover micro-interactions CSS — STORA-264 */}
        {animStylesCss ? <style data-kubuild-animation-styles>{animStylesCss}</style> : null}
        <NodeRenderer
          node={document.document}
          document={document}
          registry={registry}
          context={context}
          viewport={viewport}
          mode={mode}
          onNodeClick={onNodeClick}
          onDiagnostic={onDiagnostic}
          onActionDispatch={onActionDispatch}
          onNodePropChange={onNodePropChange}
          selectedNodeId={selectedNodeId}
        />
        {showToastContainer && <ToastContainer />}
      </div>
    </RenderContextProvider>
  );
};

export const KubuildRenderer = React.memo(KubuildRendererComponent);
